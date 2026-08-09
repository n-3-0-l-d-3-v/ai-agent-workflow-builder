import { NhostHandler } from '../types';
import { gql } from '../lib/hasura';
import { verifyWebhookSignature } from '../lib/webhookSignature';
import { startRun } from '../lib/startRun';
import { QuotaExceededError } from '../lib/quota';

interface TriggerRow {
  id: string;
  workflow_id: string;
  org_id: string;
  type: string;
  is_enabled: boolean;
  config: { webhook_secret?: string };
}

/**
 * POST /webhooks/workflow?trigger_id=<workflow_triggers.id>
 * Headers: x-webhook-signature: hex(HMAC-SHA256(rawBody, trigger.config.webhook_secret))
 *
 * This is deliberately a plain signed HTTP endpoint rather than a GraphQL
 * mutation an external system would have to construct -- it's what a real
 * inbound webhook receiver looks like (same shape as Stripe/GitHub), and
 * it shares the exact same startRun()/executeRun() core as the manual and
 * scheduled trigger paths. See docs/write-up.md for why this satisfies
 * "a Hasura Action acting as an inbound endpoint" without forcing external
 * callers through the Action's GraphQL envelope.
 */
const handler: NhostHandler = async (req, res) => {
  try {
    const triggerId = req.query?.trigger_id;
    if (!triggerId) {
      res.status(400).json({ message: 'trigger_id query param is required' });
      return;
    }

    const data = await gql<{ workflow_triggers_by_pk: TriggerRow | null }>(
      `query ($id: uuid!) {
        workflow_triggers_by_pk(id: $id) { id workflow_id org_id type is_enabled config }
      }`,
      { id: triggerId }
    );
    const trigger = data.workflow_triggers_by_pk;

    if (!trigger || trigger.type !== 'webhook' || !trigger.is_enabled) {
      // Same response whether the trigger doesn't exist, isn't a webhook
      // trigger, or is disabled -- don't leak which one to an
      // unauthenticated caller.
      res.status(404).json({ message: 'not found' });
      return;
    }

    const secret = trigger.config?.webhook_secret;
    const signature = req.headers['x-webhook-signature'];
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {});

    if (!secret || !verifyWebhookSignature(rawBody, secret, Array.isArray(signature) ? signature[0] : signature)) {
      res.status(401).json({ message: 'invalid signature' });
      return;
    }

    const payload = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body ?? {};

    const { runId, status } = await startRun({
      workflowId: trigger.workflow_id,
      orgId: trigger.org_id,
      triggerType: 'webhook',
      triggerContext: { webhook_payload: payload },
    });

    res.status(200).json({ workflow_run_id: runId, status });
  } catch (err) {
    if (err instanceof QuotaExceededError) {
      res.status(429).json({ message: err.message });
      return;
    }
    console.error('workflow webhook failed', err);
    res.status(500).json({ message: (err as Error).message ?? 'internal error' });
  }
};

export default handler;

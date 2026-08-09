import { NhostHandler } from '../types';
import { gql } from '../lib/hasura';
import { startRun } from '../lib/startRun';

interface HasuraEventPayload {
  event: { op: string; data: { new: Record<string, unknown> } };
  table: { schema: string; name: string };
}

interface MatchingTrigger {
  id: string;
  workflow_id: string;
  org_id: string;
}

/**
 * Hasura Event Trigger handler for `leads` INSERT (see
 * nhost/metadata/databases/default/tables/public_leads.yaml ->
 * event_triggers). This is the `database_event` trigger type: a row
 * landing in a watched table auto-starts every enabled workflow whose
 * trigger config points at that table, scoped to the row's own org so a
 * lead created in Org A can never fire a workflow belonging to Org B.
 */
const handler: NhostHandler = async (req, res) => {
  const payload = req.body as HasuraEventPayload;
  const lead = payload?.event?.data?.new;

  if (!lead || payload.event.op !== 'INSERT') {
    res.status(200).json({ skipped: true });
    return;
  }

  const orgId = lead.org_id as string;

  const data = await gql<{ workflow_triggers: MatchingTrigger[] }>(
    `query ($orgId: uuid!) {
      workflow_triggers(
        where: {
          type: { _eq: "database_event" }
          is_enabled: { _eq: true }
          org_id: { _eq: $orgId }
          config: { _contains: { watched_table: "leads" } }
        }
      ) {
        id
        workflow_id
        org_id
      }
    }`,
    { orgId }
  );

  const results = [];
  for (const trigger of data.workflow_triggers) {
    try {
      const { runId, status } = await startRun({
        workflowId: trigger.workflow_id,
        orgId: trigger.org_id,
        triggerType: 'database_event',
        triggerContext: { lead },
      });
      results.push({ trigger_id: trigger.id, run_id: runId, status });
    } catch (err) {
      results.push({ trigger_id: trigger.id, error: (err as Error).message });
    }
  }

  res.status(200).json({ lead_id: lead.id, org_id: orgId, results });
};

export default handler;

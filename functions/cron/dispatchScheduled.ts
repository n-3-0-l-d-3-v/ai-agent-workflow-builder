import { NhostHandler } from '../types';
import { gql } from '../lib/hasura';
import { cronMatches } from '../lib/cron';
import { startRun } from '../lib/startRun';

interface ScheduledTrigger {
  id: string;
  workflow_id: string;
  org_id: string;
  config: { cron?: string };
}

/**
 * Called every minute by the Hasura cron trigger `dispatch_scheduled_workflows`
 * (see nhost/metadata/cron_triggers.yaml). Hasura cron triggers are static,
 * so per-workflow schedules can't each be their own cron trigger -- this
 * polls the enabled `scheduled` workflow_triggers and starts a run for any
 * whose stored cron expression matches the current UTC minute.
 */
const handler: NhostHandler = async (_req, res) => {
  const now = new Date();

  const data = await gql<{ workflow_triggers: ScheduledTrigger[] }>(
    `query {
      workflow_triggers(where: { type: { _eq: "scheduled" }, is_enabled: { _eq: true } }) {
        id
        workflow_id
        org_id
        config
      }
    }`
  );

  const results: { trigger_id: string; started: boolean; error?: string }[] = [];

  for (const trigger of data.workflow_triggers) {
    const cron = trigger.config?.cron;
    if (!cron || !cronMatches(now, cron)) continue;

    try {
      const { runId, status } = await startRun({
        workflowId: trigger.workflow_id,
        orgId: trigger.org_id,
        triggerType: 'scheduled',
        triggerContext: { fired_at: now.toISOString(), cron },
      });
      results.push({ trigger_id: trigger.id, started: true });
      console.log(`scheduled trigger ${trigger.id} started run ${runId} (${status})`);
    } catch (err) {
      // one trigger's failure (e.g. quota exhausted) must not block the
      // rest of the sweep
      results.push({ trigger_id: trigger.id, started: false, error: (err as Error).message });
      console.error(`scheduled trigger ${trigger.id} failed to start`, err);
    }
  }

  res.status(200).json({ checked_at: now.toISOString(), results });
};

export default handler;

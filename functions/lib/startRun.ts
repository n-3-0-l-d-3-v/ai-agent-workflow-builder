import { gql } from './hasura';
import { assertQuotaAvailable } from './quota';
import { executeRun } from './runEngine';

export type TriggerType = 'manual' | 'webhook' | 'scheduled' | 'database_event';

/**
 * Shared by every non-manual trigger path (webhook, cron dispatcher,
 * database event). Manual runs go through triggerWorkflowRun.ts instead
 * because they additionally need the caller's org-role check -- these
 * three are system-initiated, so there's no "caller" to check, only the
 * org's quota.
 */
export async function startRun(params: {
  workflowId: string;
  orgId: string;
  triggerType: TriggerType;
  triggerContext?: Record<string, unknown>;
  triggeredBy?: string | null;
}): Promise<{ runId: string; status: string }> {
  await assertQuotaAvailable(params.orgId);

  const insertResult = await gql<{ insert_workflow_runs_one: { id: string } }>(
    `mutation ($object: workflow_runs_insert_input!) {
      insert_workflow_runs_one(object: $object) { id }
    }`,
    {
      object: {
        workflow_id: params.workflowId,
        org_id: params.orgId,
        status: 'pending',
        trigger_type: params.triggerType,
        triggered_by: params.triggeredBy ?? null,
        trigger_context: params.triggerContext ?? {},
      },
    }
  );

  const runId = insertResult.insert_workflow_runs_one.id;
  const { status } = await executeRun(runId);
  return { runId, status };
}

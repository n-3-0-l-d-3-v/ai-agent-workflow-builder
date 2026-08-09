import { NhostHandler } from '../types';
import { gql } from '../lib/hasura';
import { requireUserId, requireOrgRole, AuthError } from '../lib/auth';
import { executeRun } from '../lib/runEngine';

interface StepRunRow {
  id: string;
  status: string;
  workflow_run_id: string;
  org_id: string;
}

/**
 * Hasura Action handler for `approveStep(step_run_id, decision)`.
 *
 * This is the one place in the whole system where a permission decision
 * genuinely cannot be a database row-permission: clearing an
 * approval_gate is a mid-execution decision ("is this specific paused run
 * allowed to continue right now"), not a row read/write, so the
 * owner/editor check happens here, freshly, against the run's org --
 * exactly as the assignment calls out.
 */
const handler: NhostHandler = async (req, res) => {
  try {
    const sessionVariables = req.body?.session_variables ?? {};
    const stepRunId: string | undefined = req.body?.input?.step_run_id;
    const decision: string | undefined = req.body?.input?.decision;

    if (!stepRunId || !decision || !['approve', 'reject'].includes(decision)) {
      res.status(400).json({ message: 'step_run_id and decision ("approve"|"reject") are required' });
      return;
    }

    const userId = requireUserId(sessionVariables);

    const data = await gql<{ step_runs_by_pk: StepRunRow | null }>(
      `query ($id: uuid!) {
        step_runs_by_pk(id: $id) { id status workflow_run_id org_id }
      }`,
      { id: stepRunId }
    );
    const stepRun = data.step_runs_by_pk;
    if (!stepRun) {
      res.status(404).json({ message: 'step_run not found' });
      return;
    }
    if (stepRun.status !== 'paused') {
      res.status(409).json({ message: `step_run is not awaiting approval (status: ${stepRun.status})` });
      return;
    }

    await requireOrgRole(stepRun.org_id, userId, ['owner', 'editor']);

    if (decision === 'reject') {
      await gql(
        `mutation ($id: uuid!, $userId: uuid!, $now: timestamptz!) {
          update_step_runs_by_pk(
            pk_columns: { id: $id }
            _set: { status: "failed", error: "rejected by approver", approved_by: $userId, approved_at: $now, finished_at: $now }
          ) { id }
        }`,
        { id: stepRunId, userId, now: new Date().toISOString() }
      );
      await gql(
        `mutation ($runId: uuid!, $now: timestamptz!) {
          update_workflow_runs_by_pk(
            pk_columns: { id: $runId }
            _set: { status: "failed", error: "approval_gate rejected", finished_at: $now }
          ) { id }
        }`,
        { runId: stepRun.workflow_run_id, now: new Date().toISOString() }
      );
      res.status(200).json({ step_run_id: stepRunId, workflow_run_id: stepRun.workflow_run_id, status: 'failed' });
      return;
    }

    await gql(
      `mutation ($id: uuid!, $userId: uuid!, $now: timestamptz!) {
        update_step_runs_by_pk(
          pk_columns: { id: $id }
          _set: { status: "succeeded", output: { approved: true }, approved_by: $userId, approved_at: $now, finished_at: $now }
        ) { id }
      }`,
      { id: stepRunId, userId, now: new Date().toISOString() }
    );
    await gql(
      `mutation ($runId: uuid!) {
        update_workflow_runs_by_pk(pk_columns: { id: $runId }, _set: { status: "running" }) { id }
      }`,
      { runId: stepRun.workflow_run_id }
    );

    const { status } = await executeRun(stepRun.workflow_run_id);

    res.status(200).json({ step_run_id: stepRunId, workflow_run_id: stepRun.workflow_run_id, status });
  } catch (err) {
    if (err instanceof AuthError) {
      res.status(err.statusCode).json({ message: err.message });
      return;
    }
    console.error('approveStep failed', err);
    res.status(500).json({ message: (err as Error).message ?? 'internal error' });
  }
};

export default handler;

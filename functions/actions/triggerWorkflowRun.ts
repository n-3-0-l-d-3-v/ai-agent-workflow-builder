import { NhostHandler } from '../types';
import { gql } from '../lib/hasura';
import { requireUserId, requireOrgRole, AuthError } from '../lib/auth';
import { QuotaExceededError } from '../lib/quota';
import { startRun } from '../lib/startRun';
import { parseJsonBody } from '../lib/parseBody';

interface WorkflowRow {
  id: string;
  org_id: string;
}

/**
 * Hasura Action handler for `triggerWorkflowRun(workflow_id)`.
 *
 *   1. caller must be owner/editor in the workflow's org (viewers can't
 *      trigger runs -- this is re-checked here, not just relied on from
 *      the Action's `role: user` permission, because the actual write is
 *      to workflow_runs which has no user-facing insert permission at all)
 *   2. quota must not be exhausted
 *   3. creates the workflow_run and executes it synchronously
 *   4. increments quota happens per external call inside the run engine
 */
const handler: NhostHandler = async (req, res) => {
  try {
    const body = parseJsonBody(req.body);
    const sessionVariables = body.session_variables ?? {};
    const workflowId: string | undefined = body.input?.workflow_id;
    if (!workflowId) {
      // TEMP DEBUG — remove after diagnosing body parsing on nhost functions.
      res.status(400).json({
        message: 'workflow_id is required',
        debug: {
          rawBodyType: typeof req.body,
          isBuffer: Buffer.isBuffer(req.body),
          rawBodyPreview: Buffer.isBuffer(req.body)
            ? req.body.toString('utf8').slice(0, 300)
            : typeof req.body === 'string'
              ? req.body.slice(0, 300)
              : JSON.stringify(req.body).slice(0, 300),
          parsedKeys: Object.keys(body ?? {}),
        },
      });
      return;
    }

    const userId = requireUserId(sessionVariables);

    const data = await gql<{ workflows_by_pk: WorkflowRow | null }>(
      `query ($id: uuid!) { workflows_by_pk(id: $id) { id org_id } }`,
      { id: workflowId }
    );
    const workflow = data.workflows_by_pk;
    if (!workflow) {
      res.status(404).json({ message: 'workflow not found' });
      return;
    }

    await requireOrgRole(workflow.org_id, userId, ['owner', 'editor']);

    const { runId, status } = await startRun({
      workflowId: workflow.id,
      orgId: workflow.org_id,
      triggerType: 'manual',
      triggeredBy: userId,
    });

    res.status(200).json({ workflow_run_id: runId, status });
  } catch (err) {
    if (err instanceof AuthError) {
      res.status(err.statusCode).json({ message: err.message });
      return;
    }
    if (err instanceof QuotaExceededError) {
      res.status(429).json({ message: err.message });
      return;
    }
    console.error('triggerWorkflowRun failed', err);
    res.status(500).json({ message: (err as Error).message ?? 'internal error' });
  }
};

export default handler;

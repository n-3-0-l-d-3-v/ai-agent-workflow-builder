import { gql } from './hasura';
import { assertQuotaAvailable, incrementQuotaUsage } from './quota';
import { withRetry } from './retry';
import { callLlm } from './llm';
import { executeHttpRequest } from './httpRequest';
import { renderDeep, renderTemplate, RunContext } from './template';

type StepType = 'llm_call' | 'http_request' | 'db_write' | 'notify' | 'conditional_branch' | 'approval_gate';

interface WorkflowStep {
  id: string;
  step_order: number;
  type: StepType;
  name: string;
  config: any;
}

interface StepRunRow {
  id: string;
  workflow_step_id: string;
  status: string;
  output: unknown;
}

interface WorkflowRunRow {
  id: string;
  workflow_id: string;
  org_id: string;
  status: string;
  trigger_context: Record<string, unknown>;
  workflow: { steps: WorkflowStep[] };
  step_runs: StepRunRow[];
}

const RUN_QUERY = `
  query ($runId: uuid!) {
    workflow_runs_by_pk(id: $runId) {
      id
      workflow_id
      org_id
      status
      trigger_context
      workflow {
        steps(order_by: { step_order: asc }) {
          id
          step_order
          type
          name
          config
        }
      }
      step_runs {
        id
        workflow_step_id
        status
        output
      }
    }
  }
`;

async function fetchRun(runId: string): Promise<WorkflowRunRow> {
  const data = await gql<{ workflow_runs_by_pk: WorkflowRunRow }>(RUN_QUERY, { runId });
  if (!data.workflow_runs_by_pk) throw new Error(`workflow_run ${runId} not found`);
  return data.workflow_runs_by_pk;
}

async function setRunStatus(
  runId: string,
  fields: Partial<{ status: string; error: string | null; started_at: string; finished_at: string }>
) {
  await gql(
    `mutation ($runId: uuid!, $set: workflow_runs_set_input!) {
      update_workflow_runs_by_pk(pk_columns: { id: $runId }, _set: $set) { id }
    }`,
    { runId, set: fields }
  );
}

async function createStepRun(input: {
  workflow_run_id: string;
  workflow_step_id: string;
  org_id: string;
  status: string;
  input: unknown;
}): Promise<string> {
  const data = await gql<{ insert_step_runs_one: { id: string } }>(
    `mutation ($input: step_runs_insert_input!) {
      insert_step_runs_one(object: $input) { id }
    }`,
    { input: { ...input, started_at: new Date().toISOString() } }
  );
  return data.insert_step_runs_one.id;
}

async function updateStepRun(stepRunId: string, fields: Record<string, unknown>) {
  await gql(
    `mutation ($id: uuid!, $set: step_runs_set_input!) {
      update_step_runs_by_pk(pk_columns: { id: $id }, _set: $set) { id }
    }`,
    { id: stepRunId, set: fields }
  );
}

function buildContext(run: WorkflowRunRow, orderedCompletedSteps: { order: number; output: unknown }[]): RunContext {
  const steps: Record<string, { output: unknown }> = {};
  for (const s of orderedCompletedSteps) steps[String(s.order)] = { output: s.output };
  const previous = orderedCompletedSteps.length
    ? orderedCompletedSteps[orderedCompletedSteps.length - 1].output
    : null;
  return { trigger: run.trigger_context ?? {}, steps, previous };
}

function resolveDotPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc === null || acc === undefined) return undefined;
    return (acc as Record<string, unknown>)[key];
  }, obj);
}

function evaluateCondition(op: string, actual: unknown, expected: unknown): boolean {
  switch (op) {
    case 'equals':
      return actual === expected;
    case 'not_equals':
      return actual !== expected;
    case 'contains':
      return typeof actual === 'string' && typeof expected === 'string' && actual.includes(expected);
    case 'gt':
      return Number(actual) > Number(expected);
    case 'lt':
      return Number(actual) < Number(expected);
    default:
      return false;
  }
}

/**
 * Executes (or resumes) a workflow_run. Resumption is stateless by design:
 * on every call we look at which step_runs already exist and pick up from
 * the first workflow_step that doesn't have one yet. That's what lets
 * approveStep just call this again after unblocking an approval_gate,
 * instead of needing separate "start" and "resume" code paths.
 */
export async function executeRun(runId: string): Promise<{ status: string }> {
  let run = await fetchRun(runId);

  if (run.status === 'pending') {
    await setRunStatus(runId, { status: 'running', started_at: new Date().toISOString() });
    run = await fetchRun(runId);
  } else if (run.status !== 'running' && run.status !== 'paused') {
    // succeeded / failed / cancelled — nothing to do.
    return { status: run.status };
  }

  const steps = run.workflow.steps;
  const doneByStepId = new Map(run.step_runs.map((sr) => [sr.workflow_step_id, sr]));
  const completedOutputs = steps
    .filter((s) => {
      const sr = doneByStepId.get(s.id);
      return sr && (sr.status === 'succeeded' || sr.status === 'skipped');
    })
    .map((s) => ({ order: s.step_order, output: doneByStepId.get(s.id)!.output }));

  let skipUntilOrder: number | null = null;

  for (const step of steps) {
    const existing = doneByStepId.get(step.id);
    if (existing && existing.status !== 'paused') continue; // already ran (succeeded/failed/skipped)
    if (existing && existing.status === 'paused') {
      // Shouldn't reach here mid-loop unless caller resumed without
      // approving — bail out rather than silently re-running a gate.
      return { status: 'paused' };
    }

    if (skipUntilOrder !== null && step.step_order < skipUntilOrder) {
      await createStepRun({
        workflow_run_id: run.id,
        workflow_step_id: step.id,
        org_id: run.org_id,
        status: 'skipped',
        input: {},
      });
      continue;
    }
    skipUntilOrder = null;

    const context = buildContext(run, completedOutputs);
    const stepRunId = await createStepRun({
      workflow_run_id: run.id,
      workflow_step_id: step.id,
      org_id: run.org_id,
      status: 'running',
      input: context,
    });

    try {
      switch (step.type) {
        case 'llm_call': {
          await assertQuotaAvailable(run.org_id);
          const cfg = renderDeep(step.config, context);
          const { result, attempts } = await withRetry(() =>
            callLlm({ prompt: cfg.prompt, system_prompt: cfg.system_prompt, model: cfg.model, temperature: cfg.temperature })
          );
          await incrementQuotaUsage(run.org_id, 1);
          await updateStepRun(stepRunId, {
            status: 'succeeded',
            output: { text: result.text, model: result.model, stubbed: result.stubbed },
            attempt_count: attempts,
            finished_at: new Date().toISOString(),
          });
          completedOutputs.push({ order: step.step_order, output: { text: result.text } });
          break;
        }

        case 'http_request': {
          await assertQuotaAvailable(run.org_id);
          const cfg = renderDeep(step.config, context);
          const { result, attempts } = await withRetry(() => executeHttpRequest(cfg));
          await incrementQuotaUsage(run.org_id, 1);
          await updateStepRun(stepRunId, {
            status: 'succeeded',
            output: result,
            attempt_count: attempts,
            finished_at: new Date().toISOString(),
          });
          completedOutputs.push({ order: step.step_order, output: result });
          break;
        }

        case 'db_write': {
          const cfg = renderDeep(step.config, context);
          const value = cfg.value !== undefined ? cfg.value : context.previous;
          await gql(
            `mutation ($object: workflow_outputs_insert_input!) {
              insert_workflow_outputs_one(object: $object) { id }
            }`,
            {
              object: {
                org_id: run.org_id,
                workflow_run_id: run.id,
                step_run_id: stepRunId,
                key: cfg.key ?? 'result',
                value,
              },
            }
          );
          await updateStepRun(stepRunId, {
            status: 'succeeded',
            output: { key: cfg.key ?? 'result', written: true },
            finished_at: new Date().toISOString(),
          });
          completedOutputs.push({ order: step.step_order, output: value });
          break;
        }

        case 'notify': {
          const cfg = renderDeep(step.config, context);
          // The step itself never sends anything -- it inserts a row, and
          // a Hasura Event Trigger on notifications INSERT is what
          // actually delivers it (functions/events/sendNotification.ts).
          await gql(
            `mutation ($object: notifications_insert_input!) {
              insert_notifications_one(object: $object) { id }
            }`,
            {
              object: {
                org_id: run.org_id,
                step_run_id: stepRunId,
                workflow_run_id: run.id,
                channel: cfg.channel ?? 'slack',
                target: cfg.target,
                message: renderTemplate(cfg.message ?? '', context),
              },
            }
          );
          await updateStepRun(stepRunId, {
            status: 'succeeded',
            output: { queued: true },
            finished_at: new Date().toISOString(),
          });
          completedOutputs.push({ order: step.step_order, output: { queued: true } });
          break;
        }

        case 'conditional_branch': {
          const cfg = step.config as {
            path: string;
            operator: string;
            value: unknown;
            on_true_goto?: number;
            on_false_goto?: number;
          };
          const actual = resolveDotPath(context.previous, cfg.path);
          const matched = evaluateCondition(cfg.operator, actual, cfg.value);
          const goto = matched ? cfg.on_true_goto : cfg.on_false_goto;

          await updateStepRun(stepRunId, {
            status: 'succeeded',
            output: { matched, evaluated: actual },
            finished_at: new Date().toISOString(),
          });
          completedOutputs.push({ order: step.step_order, output: { matched } });

          if (typeof goto === 'number' && goto > step.step_order) {
            skipUntilOrder = goto;
          }
          break;
        }

        case 'approval_gate': {
          await updateStepRun(stepRunId, { status: 'paused' });
          await setRunStatus(run.id, { status: 'paused' });
          return { status: 'paused' };
        }

        default:
          throw new Error(`unknown step type: ${step.type}`);
      }
    } catch (err: any) {
      const message = err?.message ?? String(err);
      await updateStepRun(stepRunId, {
        status: 'failed',
        error: message,
        finished_at: new Date().toISOString(),
      });
      await setRunStatus(run.id, {
        status: 'failed',
        error: message,
        finished_at: new Date().toISOString(),
      });
      return { status: 'failed' };
    }
  }

  await setRunStatus(run.id, { status: 'succeeded', finished_at: new Date().toISOString() });
  return { status: 'succeeded' };
}

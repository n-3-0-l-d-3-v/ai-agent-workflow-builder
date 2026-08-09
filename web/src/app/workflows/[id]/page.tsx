'use client';

import { useEffect, useState, useCallback } from 'react';
import { use as usePromise } from 'react';
import Link from 'next/link';
import { useOrg } from '@/context/OrgProvider';
import { gqlRequest, GraphQLRequestError } from '@/lib/graphql';
import { WORKFLOWS_QUERY, TRIGGER_WORKFLOW_RUN_MUTATION, RUN_HISTORY_QUERY } from '@/lib/queries';
import { StepEditor } from '@/components/StepEditor';
import { TriggerEditor } from '@/components/TriggerEditor';
import { RunStatus } from '@/components/RunStatus';

interface WorkflowDetail {
  id: string;
  name: string;
  description: string | null;
  steps: { id: string; step_order: number; type: string; name: string; config: unknown }[];
  triggers: { id: string; type: string; is_enabled: boolean; config: Record<string, unknown> }[];
}

interface RunHistoryRow {
  id: string;
  status: string;
  trigger_type: string;
  started_at: string | null;
  finished_at: string | null;
  error: string | null;
}

export default function WorkflowDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: workflowId } = usePromise(params);
  const { currentOrg } = useOrg();
  const [workflow, setWorkflow] = useState<WorkflowDetail | null>(null);
  const [runHistory, setRunHistory] = useState<RunHistoryRow[]>([]);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [triggering, setTriggering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!currentOrg) return;
    const [wfData, historyData] = await Promise.all([
      gqlRequest<{ workflows: WorkflowDetail[] }>(WORKFLOWS_QUERY, { orgId: currentOrg.id }),
      gqlRequest<{ workflow_runs: RunHistoryRow[] }>(RUN_HISTORY_QUERY, { workflowId }),
    ]);
    setWorkflow(wfData.workflows.find((w) => w.id === workflowId) ?? null);
    setRunHistory(historyData.workflow_runs);
  }, [currentOrg?.id, workflowId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial workflow + run history fetch
    load();
  }, [load]);

  const runNow = async () => {
    setTriggering(true);
    setError(null);
    try {
      const data = await gqlRequest<{ triggerWorkflowRun: { workflow_run_id: string; status: string } }>(
        TRIGGER_WORKFLOW_RUN_MUTATION,
        { workflowId }
      );
      setActiveRunId(data.triggerWorkflowRun.workflow_run_id);
      await load();
    } catch (err) {
      setError(err instanceof GraphQLRequestError ? err.message : 'failed to trigger run');
    } finally {
      setTriggering(false);
    }
  };

  if (!currentOrg || !workflow) return <p className="text-sm text-neutral-500">loading...</p>;

  const isOwner = currentOrg.role === 'owner';
  const canEdit = currentOrg.role === 'owner' || currentOrg.role === 'editor';
  const canTrigger = canEdit; // viewers cannot trigger runs (layer 1)

  return (
    <div>
      <Link href="/workflows" className="text-xs text-neutral-500 hover:text-neutral-300">
        ← workflows
      </Link>
      <div className="flex items-center justify-between mt-2 mb-6">
        <h1 className="text-lg font-semibold">{workflow.name}</h1>
        {canTrigger && (
          <button
            onClick={runNow}
            disabled={triggering}
            className="bg-emerald-700 hover:bg-emerald-600 rounded px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {triggering ? 'starting...' : 'Run'}
          </button>
        )}
      </div>
      {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section>
          <h2 className="text-sm font-semibold text-neutral-400 mb-2">Steps</h2>
          <StepEditor
            workflowId={workflow.id}
            orgId={currentOrg.id}
            steps={workflow.steps}
            isOwner={isOwner}
            canEdit={canEdit}
            onChanged={load}
          />

          <h2 className="text-sm font-semibold text-neutral-400 mb-2 mt-8">Triggers</h2>
          <TriggerEditor
            workflowId={workflow.id}
            orgId={currentOrg.id}
            triggers={workflow.triggers}
            isOwner={isOwner}
            canEdit={canEdit}
            onChanged={load}
          />
        </section>

        <section>
          <h2 className="text-sm font-semibold text-neutral-400 mb-2">
            {activeRunId ? 'Live run' : 'Run history'}
          </h2>
          {activeRunId ? (
            <>
              <button onClick={() => setActiveRunId(null)} className="text-xs text-neutral-500 hover:text-neutral-300 mb-2">
                ← back to history
              </button>
              <RunStatus workflowRunId={activeRunId} canApprove={canTrigger} />
            </>
          ) : (
            <ul className="flex flex-col gap-2">
              {runHistory.map((run) => (
                <li key={run.id}>
                  <button
                    onClick={() => setActiveRunId(run.id)}
                    className="w-full text-left border border-neutral-800 rounded px-3 py-2 text-sm hover:border-neutral-600"
                  >
                    <div className="flex justify-between">
                      <span>{run.status}</span>
                      <span className="text-xs text-neutral-500">{run.trigger_type}</span>
                    </div>
                    {run.started_at && (
                      <div className="text-xs text-neutral-500 mt-1">{new Date(run.started_at).toLocaleString()}</div>
                    )}
                  </button>
                </li>
              ))}
              {runHistory.length === 0 && <p className="text-sm text-neutral-500">No runs yet.</p>}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

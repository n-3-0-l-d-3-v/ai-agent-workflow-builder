'use client';

import { useEffect, useState, useCallback } from 'react';
import { use as usePromise } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Play, ListChecks, Radio, AlertCircle, GitFork } from 'lucide-react';
import { useOrg } from '@/context/OrgProvider';
import { gqlRequest, GraphQLRequestError } from '@/lib/graphql';
import { WORKFLOWS_QUERY, TRIGGER_WORKFLOW_RUN_MUTATION, RUN_HISTORY_QUERY } from '@/lib/queries';
import { StepEditor } from '@/components/StepEditor';
import { TriggerEditor } from '@/components/TriggerEditor';
import { RunStatus } from '@/components/RunStatus';
import { StatusBadge } from '@/components/StatusBadge';
import { TRIGGER_TYPE_META } from '@/lib/stepMeta';
import type { TriggerTypeName } from '@/lib/stepDefaults';

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

  if (!currentOrg || !workflow) {
    return (
      <div className="flex flex-col gap-3">
        <div className="skeleton h-6 w-64 rounded" />
        <div className="skeleton h-40 w-full rounded" />
      </div>
    );
  }

  const isOwner = currentOrg.role === 'owner';
  const canEdit = currentOrg.role === 'owner' || currentOrg.role === 'editor';
  const canTrigger = canEdit; // viewers cannot trigger runs (layer 1)

  return (
    <div>
      <Link
        href="/workflows"
        className="mb-3 inline-flex items-center gap-1 text-xs text-[var(--muted)] transition-colors hover:text-neutral-300"
      >
        <ArrowLeft className="h-3 w-3" /> workflows
      </Link>

      <div className="mb-7 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-medium tracking-tight text-[var(--foreground)]">{workflow.name}</h1>
          {workflow.description && <p className="mt-1 text-sm text-[var(--muted)]">{workflow.description}</p>}
        </div>
        {canTrigger && (
          <button
            onClick={runNow}
            disabled={triggering}
            className="btn-primary flex shrink-0 items-center gap-2 rounded px-5 py-2.5 text-sm disabled:opacity-60"
          >
            {triggering ? 'Starting…' : (
              <>
                <Play className="h-4 w-4 fill-current" /> Run
              </>
            )}
          </button>
        )}
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 flex items-center gap-2 rounded border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-2 text-xs text-[var(--danger)]"
          >
            <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {error}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <section>
          <h2 className="mono mb-3 flex items-center gap-1.5 text-xs uppercase tracking-wide text-[var(--muted)]">
            <GitFork className="h-3.5 w-3.5" /> Steps
          </h2>
          <StepEditor
            workflowId={workflow.id}
            orgId={currentOrg.id}
            steps={workflow.steps}
            isOwner={isOwner}
            canEdit={canEdit}
            onChanged={load}
          />

          <h2 className="mono mb-3 mt-8 flex items-center gap-1.5 text-xs uppercase tracking-wide text-[var(--muted)]">
            <Radio className="h-3.5 w-3.5" /> Triggers
          </h2>
          <TriggerEditor
            workflowId={workflow.id}
            orgId={currentOrg.id}
            triggers={workflow.triggers}
            isOwner={isOwner}
            canEdit={canEdit}
            onChanged={load}
          />
        </section>

        <section className="lg:sticky lg:top-20 lg:self-start">
          <h2 className="mono mb-3 flex items-center gap-1.5 text-xs uppercase tracking-wide text-[var(--muted)]">
            <ListChecks className="h-3.5 w-3.5" />
            {activeRunId ? 'Live run' : 'Run history'}
          </h2>
          {activeRunId ? (
            <>
              <button
                onClick={() => setActiveRunId(null)}
                className="mb-3 flex items-center gap-1 text-xs text-[var(--muted)] hover:text-neutral-300"
              >
                <ArrowLeft className="h-3 w-3" /> back to history
              </button>
              <RunStatus workflowRunId={activeRunId} canApprove={canTrigger} />
            </>
          ) : (
            <div className="flex flex-col gap-2">
              <AnimatePresence initial={false}>
                {runHistory.map((run, i) => {
                  const meta = TRIGGER_TYPE_META[run.trigger_type as TriggerTypeName];
                  const TriggerIcon = meta?.icon;
                  return (
                    <motion.button
                      key={run.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ delay: i * 0.02 }}
                      onClick={() => setActiveRunId(run.id)}
                      className="card card-hover flex items-center justify-between px-3.5 py-2.5 text-left"
                    >
                      <div className="flex items-center gap-2.5">
                        {TriggerIcon && <TriggerIcon className="h-3.5 w-3.5 text-[var(--muted-2)]" />}
                        <div>
                          <StatusBadge status={run.status} />
                          {run.started_at && (
                            <div className="mono mt-1 text-[11px] text-[var(--muted-2)]">{new Date(run.started_at).toLocaleString()}</div>
                          )}
                        </div>
                      </div>
                      <span className="mono text-[11px] capitalize text-[var(--muted-2)]">{run.trigger_type}</span>
                    </motion.button>
                  );
                })}
              </AnimatePresence>
              {runHistory.length === 0 && (
                <div className="card flex flex-col items-center gap-2 px-4 py-10 text-center">
                  <p className="text-sm text-[var(--muted)]">No runs yet.</p>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

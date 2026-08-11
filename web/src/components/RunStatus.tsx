'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, Loader2 } from 'lucide-react';
import { gqlSubscribe, gqlRequest, GraphQLRequestError } from '@/lib/graphql';
import { STEP_RUNS_SUBSCRIPTION, APPROVE_STEP_MUTATION } from '@/lib/queries';
import { StatusBadge } from './StatusBadge';
import { STEP_TYPE_META } from '@/lib/stepMeta';
import type { StepTypeName } from '@/lib/stepDefaults';

interface StepRun {
  id: string;
  workflow_step_id: string;
  status: string;
  output: unknown;
  error: string | null;
  attempt_count: number;
  approved_by: string | null;
  started_at: string | null;
  finished_at: string | null;
  workflow_step: { name: string; type: string; step_order: number };
}

export function RunStatus({ workflowRunId, canApprove }: { workflowRunId: string; canApprove: boolean }) {
  const [stepRuns, setStepRuns] = useState<StepRun[]>([]);
  const [approving, setApproving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = gqlSubscribe<{ step_runs: StepRun[] }>(
      STEP_RUNS_SUBSCRIPTION,
      { workflowRunId },
      (data) => setStepRuns(data.step_runs),
      (err) => setError(String(err))
    );
    return unsubscribe;
  }, [workflowRunId]);

  const decide = async (stepRunId: string, decision: 'approve' | 'reject') => {
    setApproving(stepRunId);
    setError(null);
    try {
      await gqlRequest(APPROVE_STEP_MUTATION, { stepRunId, decision });
    } catch (err) {
      setError(err instanceof GraphQLRequestError ? err.message : 'approval failed');
    } finally {
      setApproving(null);
    }
  };

  const sorted = stepRuns.slice().sort((a, b) => a.workflow_step.step_order - b.workflow_step.step_order);

  return (
    <div className="flex flex-col">
      {error && <p className="mb-2 text-xs text-[var(--danger)]">{error}</p>}

      {sorted.length === 0 && (
        <div className="card flex items-center gap-3 px-4 py-5">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--muted)]" />
          <p className="text-xs text-[var(--muted)]">Waiting for the run to start…</p>
        </div>
      )}

      <AnimatePresence initial={false}>
        {sorted.map((sr, i) => {
          const meta = STEP_TYPE_META[sr.workflow_step.type as StepTypeName];
          const Icon = meta?.icon;
          const running = sr.status === 'running';
          const paused = sr.status === 'paused';

          return (
            <motion.div key={sr.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} className="relative flex gap-3">
              <div className="flex flex-col items-center">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded border ${
                    paused ? 'border-[var(--accent)]/50 text-[var(--accent)]' : 'border-[var(--border)] text-[var(--muted)]'
                  } ${running ? 'soft-pulse' : ''}`}
                >
                  {running ? <Loader2 className="h-3 w-3 animate-spin" /> : Icon ? <Icon className="h-3 w-3" /> : null}
                </span>
                {i < sorted.length - 1 && <div className="rule my-1 w-px flex-1" style={{ minHeight: 16 }} />}
              </div>

              <div className={`card mb-3 flex-1 px-3.5 py-2.5 ${paused ? 'border-[var(--accent)]/40' : ''}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="mono shrink-0 text-[11px] text-[var(--muted-2)]">{String(sr.workflow_step.step_order).padStart(2, '0')}</span>
                    <span className="truncate text-sm font-medium text-neutral-100">{sr.workflow_step.name}</span>
                  </div>
                  <StatusBadge status={sr.status} label={paused ? 'awaiting approval' : undefined} />
                </div>

                {sr.error && <p className="mt-1.5 text-xs text-[var(--danger)]">{sr.error}</p>}
                {sr.attempt_count > 1 && <p className="mono mt-1 text-[11px] text-[var(--muted-2)]">{sr.attempt_count} attempts</p>}

                {paused && canApprove && (
                  <div className="mt-2.5 flex gap-2">
                    <button
                      disabled={approving === sr.id}
                      onClick={() => decide(sr.id, 'approve')}
                      className="flex items-center gap-1.5 rounded border border-[var(--success)]/40 px-3 py-1.5 text-xs font-medium text-[var(--success)] transition-colors hover:bg-[var(--success)]/10 disabled:opacity-50"
                    >
                      <Check className="h-3 w-3" /> Approve
                    </button>
                    <button
                      disabled={approving === sr.id}
                      onClick={() => decide(sr.id, 'reject')}
                      className="flex items-center gap-1.5 rounded border border-[var(--danger)]/40 px-3 py-1.5 text-xs font-medium text-[var(--danger)] transition-colors hover:bg-[var(--danger)]/10 disabled:opacity-50"
                    >
                      <X className="h-3 w-3" /> Reject
                    </button>
                  </div>
                )}
                {paused && !canApprove && (
                  <p className="mt-2 text-xs text-[var(--muted)]">Waiting for an owner/editor to approve.</p>
                )}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

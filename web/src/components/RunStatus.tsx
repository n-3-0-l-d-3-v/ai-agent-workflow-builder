'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, Loader2, RadioTower } from 'lucide-react';
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
      {error && <p className="mb-2 text-xs text-red-400">{error}</p>}

      {sorted.length === 0 && (
        <div className="card flex items-center gap-3 px-4 py-5">
          <span className="relative flex h-6 w-6 items-center justify-center">
            <RadioTower className="h-4 w-4 animate-pulse text-violet-300" />
          </span>
          <p className="text-xs text-neutral-500">Waiting for the run to start…</p>
        </div>
      )}

      <AnimatePresence initial={false}>
        {sorted.map((sr, i) => {
          const meta = STEP_TYPE_META[sr.workflow_step.type as StepTypeName];
          const Icon = meta?.icon;
          const running = sr.status === 'running';
          const paused = sr.status === 'paused';

          return (
            <motion.div
              key={sr.id}
              layout
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25, delay: i * 0.03 }}
              className="relative flex gap-3"
            >
              <div className="flex flex-col items-center">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${meta?.ring ?? 'from-neutral-700 to-neutral-800'} ring-1 ring-white/10 ${running ? 'pulse-ring' : ''}`}
                >
                  {running ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-300" />
                  ) : Icon ? (
                    <Icon className={`h-3.5 w-3.5 ${meta?.color}`} />
                  ) : null}
                </span>
                {i < sorted.length - 1 && <div className="my-1 w-px flex-1 bg-gradient-to-b from-[var(--border)] to-transparent" style={{ minHeight: 16 }} />}
              </div>

              <div className={`card mb-3 flex-1 px-3.5 py-2.5 ${paused ? 'border-amber-500/30' : ''}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="shrink-0 text-[11px] text-neutral-600">#{sr.workflow_step.step_order}</span>
                    <span className="truncate text-sm font-medium text-neutral-100">{sr.workflow_step.name}</span>
                  </div>
                  <StatusBadge status={sr.status} label={paused ? 'awaiting approval' : undefined} />
                </div>

                {sr.error && <p className="mt-1.5 text-xs text-red-400">{sr.error}</p>}
                {sr.attempt_count > 1 && <p className="mt-1 text-[11px] text-neutral-600">{sr.attempt_count} attempts</p>}

                {paused && canApprove && (
                  <div className="mt-2.5 flex gap-2">
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      disabled={approving === sr.id}
                      onClick={() => decide(sr.id, 'approve')}
                      className="flex items-center gap-1.5 rounded-md bg-emerald-600/90 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
                    >
                      <Check className="h-3 w-3" /> Approve
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      disabled={approving === sr.id}
                      onClick={() => decide(sr.id, 'reject')}
                      className="flex items-center gap-1.5 rounded-md bg-red-950 px-3 py-1.5 text-xs font-medium text-red-300 transition-colors hover:bg-red-900 disabled:opacity-50"
                    >
                      <X className="h-3 w-3" /> Reject
                    </motion.button>
                  </div>
                )}
                {paused && !canApprove && (
                  <p className="mt-2 text-xs text-neutral-500">Waiting for an owner/editor to approve.</p>
                )}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

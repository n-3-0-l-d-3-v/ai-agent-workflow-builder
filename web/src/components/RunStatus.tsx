'use client';

import { useEffect, useState } from 'react';
import { gqlSubscribe, gqlRequest, GraphQLRequestError } from '@/lib/graphql';
import { STEP_RUNS_SUBSCRIPTION, APPROVE_STEP_MUTATION } from '@/lib/queries';

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

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-neutral-800 text-neutral-400',
  running: 'bg-sky-950 text-sky-300 animate-pulse',
  succeeded: 'bg-emerald-950 text-emerald-300',
  failed: 'bg-red-950 text-red-300',
  paused: 'bg-amber-950 text-amber-300',
  skipped: 'bg-neutral-900 text-neutral-600',
};

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

  return (
    <div className="flex flex-col gap-2">
      {error && <p className="text-xs text-red-400">{error}</p>}
      {stepRuns.length === 0 && <p className="text-xs text-neutral-500">waiting for the run to start...</p>}
      {stepRuns
        .slice()
        .sort((a, b) => a.workflow_step.step_order - b.workflow_step.step_order)
        .map((sr) => (
          <div key={sr.id} className="border border-neutral-800 rounded px-3 py-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs text-neutral-500">#{sr.workflow_step.step_order}</span>
                <span className="text-sm font-medium">{sr.workflow_step.name}</span>
                <span className="text-xs text-neutral-500">({sr.workflow_step.type})</span>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded ${STATUS_STYLES[sr.status] ?? ''}`}>
                {sr.status === 'paused' ? 'paused — awaiting approval' : sr.status}
              </span>
            </div>

            {sr.error && <p className="text-xs text-red-400 mt-1">{sr.error}</p>}
            {sr.attempt_count > 1 && <p className="text-xs text-neutral-500 mt-1">{sr.attempt_count} attempts</p>}

            {sr.status === 'paused' && canApprove && (
              <div className="flex gap-2 mt-2">
                <button
                  disabled={approving === sr.id}
                  onClick={() => decide(sr.id, 'approve')}
                  className="text-xs bg-emerald-800 hover:bg-emerald-700 rounded px-2 py-1 disabled:opacity-50"
                >
                  approve
                </button>
                <button
                  disabled={approving === sr.id}
                  onClick={() => decide(sr.id, 'reject')}
                  className="text-xs bg-red-900 hover:bg-red-800 rounded px-2 py-1 disabled:opacity-50"
                >
                  reject
                </button>
              </div>
            )}
            {sr.status === 'paused' && !canApprove && (
              <p className="text-xs text-neutral-500 mt-1">waiting for an owner/editor to approve</p>
            )}
          </div>
        ))}
    </div>
  );
}

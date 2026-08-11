'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
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

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatClock(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour12: false });
}

/** Live event log derived straight from step_run timestamps -- not a
 * separate fake log, the actual started_at/finished_at rows from the
 * subscription, sorted and formatted. */
function buildLog(stepRuns: StepRun[]): { key: string; time: string; text: string; tone: 'ok' | 'err' | 'wait' | 'muted' }[] {
  const events: { at: string; key: string; text: string; tone: 'ok' | 'err' | 'wait' | 'muted' }[] = [];
  for (const sr of stepRuns) {
    if (sr.started_at) {
      events.push({ at: sr.started_at, key: `${sr.id}-start`, text: `${sr.workflow_step.name} started`, tone: 'muted' });
    }
    if (sr.finished_at) {
      const durMs = sr.started_at ? new Date(sr.finished_at).getTime() - new Date(sr.started_at).getTime() : null;
      const suffix = durMs != null ? ` (${formatDuration(durMs)})` : '';
      const tone = sr.status === 'succeeded' ? 'ok' : sr.status === 'failed' ? 'err' : 'muted';
      events.push({ at: sr.finished_at, key: `${sr.id}-end`, text: `${sr.workflow_step.name} ${sr.status}${suffix}`, tone });
    } else if (sr.status === 'paused') {
      events.push({ at: sr.started_at ?? '', key: `${sr.id}-pause`, text: `${sr.workflow_step.name} paused — awaiting approval`, tone: 'wait' });
    }
  }
  return events
    .sort((a, b) => a.at.localeCompare(b.at))
    .map((e) => ({ key: e.key, time: e.at ? formatClock(e.at) : '--:--:--', text: e.text, tone: e.tone }));
}

const LOG_TONE_CLASS: Record<string, string> = {
  ok: 'text-[var(--success)]',
  err: 'text-[var(--danger)]',
  wait: 'text-[var(--accent)]',
  muted: 'text-[var(--muted)]',
};

function StepOutput({ output }: { output: unknown }) {
  const [expanded, setExpanded] = useState(false);
  if (output === null || output === undefined) return null;
  return (
    <div className="mt-2">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="mono flex items-center gap-1 text-[11px] text-[var(--muted-2)] hover:text-neutral-300"
      >
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        {expanded ? 'hide output' : 'view output'}
      </button>
      {expanded && (
        <pre className="mono mt-1.5 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded bg-black/25 px-2.5 py-2 text-[11px] text-[var(--muted)]">
          {JSON.stringify(output, null, 2)}
        </pre>
      )}
    </div>
  );
}

function LiveElapsed({ startedAt }: { startedAt: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 150);
    return () => clearInterval(interval);
  }, []);
  if (now === null) return null;
  const elapsed = now - new Date(startedAt).getTime();
  return <span className="mono tabular-nums text-[11px] text-[var(--muted)]">{formatDuration(Math.max(elapsed, 0))}</span>;
}

export function RunStatus({ workflowRunId, canApprove }: { workflowRunId: string; canApprove: boolean }) {
  const [stepRuns, setStepRuns] = useState<StepRun[]>([]);
  const [approving, setApproving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = gqlSubscribe<{ step_runs: StepRun[] }>(
      STEP_RUNS_SUBSCRIPTION,
      { workflowRunId },
      (data) => setStepRuns(data.step_runs),
      (err) => setError(String(err))
    );
    return unsubscribe;
  }, [workflowRunId]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
  }, [stepRuns]);

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
  const log = buildLog(stepRuns);

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
          const durationMs = sr.started_at && sr.finished_at ? new Date(sr.finished_at).getTime() - new Date(sr.started_at).getTime() : null;

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
                  <div className="flex shrink-0 items-center gap-2">
                    {running && sr.started_at && <LiveElapsed startedAt={sr.started_at} />}
                    {durationMs != null && <span className="mono tabular-nums text-[11px] text-[var(--muted-2)]">{formatDuration(durationMs)}</span>}
                    <StatusBadge status={sr.status} label={paused ? 'awaiting approval' : undefined} />
                  </div>
                </div>

                {sr.error && <p className="mt-1.5 text-xs text-[var(--danger)]">{sr.error}</p>}
                {sr.attempt_count > 1 && <p className="mono mt-1 text-[11px] text-[var(--muted-2)]">retry · attempt {sr.attempt_count}</p>}
                {(sr.status === 'succeeded' || sr.status === 'failed') && <StepOutput output={sr.output} />}

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

      {log.length > 0 && (
        <div className="term mt-1">
          <div className="term-bar">
            <span className="term-dot" />
            <span className="term-dot" />
            <span className="term-dot" />
            <span className="mono ml-2 text-[11px] text-[var(--muted-2)]">run log</span>
          </div>
          <div ref={logRef} className="mono max-h-40 overflow-y-auto px-3 py-2.5 text-[11.5px] leading-[1.85]">
            {log.map((line) => (
              <div key={line.key} className="flex gap-2">
                <span className="text-[var(--muted-2)]">{line.time}</span>
                <span className={LOG_TONE_CLASS[line.tone]}>{line.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

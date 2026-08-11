'use client';

import Link from 'next/link';
import { useAuth } from '@/context/AuthProvider';

const FEATURES = [
  {
    n: '01',
    title: 'llm_call · http_request · db_write',
    body: 'Chain real model calls and external APIs into a single deterministic run, with retries built in.',
  },
  {
    n: '02',
    title: 'Conditional branching',
    body: "Steps that change path based on the model's own output — not a fixed pipeline.",
  },
  {
    n: '03',
    title: 'Approval gates',
    body: 'Pause a live run and require a human owner or editor to resume it, with a full audit trail.',
  },
  {
    n: '04',
    title: 'Four ways to start a run',
    body: 'Manual, signed webhook, cron schedule, or a database row landing in a watched table.',
  },
  {
    n: '05',
    title: 'Live, not polled',
    body: 'Every step transition streams over a GraphQL subscription — no refresh, ever.',
  },
  {
    n: '06',
    title: 'Two permission layers',
    body: 'Org + role scoping, plus step-level gating for the steps that reach outside the sandbox.',
  },
];

export default function Home() {
  const { userId, isLoading } = useAuth();

  if (isLoading) return null;

  return (
    <div>
      <div className="mx-auto mt-8 max-w-2xl sm:mt-14">
        <p className="mono mb-4 text-xs text-[var(--muted)]">org-scoped · role-gated · live</p>
        <h1 className="text-3xl font-medium leading-[1.15] tracking-tight text-[var(--foreground)] sm:text-4xl">
          Build AI agent workflows that actually run themselves.
        </h1>
        <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-[var(--muted)]">
          Chain <code className="mono rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-[13px] text-neutral-300">llm_call</code>,{' '}
          <code className="mono rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-[13px] text-neutral-300">http_request</code>,{' '}
          <code className="mono rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-[13px] text-neutral-300">conditional_branch</code>, and{' '}
          <code className="mono rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-[13px] text-neutral-300">approval_gate</code> steps
          into workflows that trigger on a schedule, a webhook, or a database event — with every action checked against org and role
          permissions, live.
        </p>

        <div className="mt-8 flex items-center gap-3">
          {userId ? (
            <Link href="/workflows" className="btn-primary rounded px-5 py-2.5 text-sm">
              Go to workflows
            </Link>
          ) : (
            <>
              <Link href="/sign-up" className="btn-primary rounded px-5 py-2.5 text-sm">
                Get started
              </Link>
              <Link href="/sign-in" className="rounded border border-[var(--border)] px-5 py-2.5 text-sm text-[var(--muted)] transition-colors hover:border-[var(--border-strong)] hover:text-neutral-200">
                Sign in
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="rule mx-auto my-14 max-w-5xl" />

      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-x-10 gap-y-8 sm:grid-cols-2">
        {FEATURES.map((f) => (
          <div key={f.n} className="flex gap-4">
            <span className="mono mt-0.5 shrink-0 text-xs text-[var(--muted-2)]">{f.n}</span>
            <div>
              <h3 className="text-sm font-medium text-neutral-200">{f.title}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--muted)]">{f.body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

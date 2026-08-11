'use client';

import { useEffect, useState } from 'react';
import { Zap } from 'lucide-react';
import { gqlRequest } from '@/lib/graphql';
import { ORG_USAGE_QUERY } from '@/lib/queries';

interface UsageRow {
  quota_calls_allowed: number;
  quota_calls_used: number;
  quota_calls_remaining: number;
  runs_this_period: number;
  avg_run_duration_seconds: number | null;
}

export function UsageBadge({ orgId }: { orgId: string }) {
  const [usage, setUsage] = useState<UsageRow | null>(null);

  useEffect(() => {
    let cancelled = false;
    gqlRequest<{ org_usage_current_period: UsageRow[] }>(ORG_USAGE_QUERY, { orgId })
      .then((data) => {
        if (!cancelled) setUsage(data.org_usage_current_period[0] ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  if (!usage) return null;

  const pct = usage.quota_calls_allowed > 0 ? Math.min(usage.quota_calls_used / usage.quota_calls_allowed, 1) : 0;
  const level = pct >= 0.9 ? 'critical' : pct >= 0.65 ? 'warn' : 'ok';
  const barColor =
    level === 'critical' ? 'from-red-500 to-rose-400' : level === 'warn' ? 'from-amber-500 to-yellow-400' : 'from-cyan-400 to-violet-500';

  return (
    <div
      className="group flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1.5"
      title={`${usage.runs_this_period} runs this period · avg ${usage.avg_run_duration_seconds ? Math.round(usage.avg_run_duration_seconds) + 's' : 'n/a'}`}
    >
      <Zap className={`h-3.5 w-3.5 shrink-0 ${level === 'critical' ? 'text-red-400' : 'text-violet-300'}`} strokeWidth={2.5} />
      <div className="flex flex-col gap-1">
        <span className="text-[11px] leading-none text-neutral-300 tabular-nums">
          {usage.quota_calls_used}
          <span className="text-neutral-500">/{usage.quota_calls_allowed}</span>
        </span>
        <div className="h-1 w-16 overflow-hidden rounded-full bg-white/5">
          <div
            className={`h-full rounded-full bg-gradient-to-r ${barColor} transition-all duration-500`}
            style={{ width: `${pct * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}

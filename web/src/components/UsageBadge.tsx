'use client';

import { useEffect, useState } from 'react';
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
  const critical = pct >= 0.9;

  return (
    <div
      className="flex items-center gap-2"
      title={`${usage.runs_this_period} runs this period · avg ${usage.avg_run_duration_seconds ? Math.round(usage.avg_run_duration_seconds) + 's' : 'n/a'}`}
    >
      <span className="mono text-[11px] text-[var(--muted)] tabular-nums">
        {usage.quota_calls_used}/{usage.quota_calls_allowed}
      </span>
      <div className="h-1 w-12 overflow-hidden rounded-sm bg-[var(--surface-2)]">
        <div
          className="h-full rounded-sm transition-all duration-500"
          style={{ width: `${pct * 100}%`, backgroundColor: critical ? 'var(--danger)' : 'var(--muted-2)' }}
        />
      </div>
    </div>
  );
}

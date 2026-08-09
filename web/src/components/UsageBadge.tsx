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

  const pctUsed = usage.quota_calls_allowed > 0 ? usage.quota_calls_used / usage.quota_calls_allowed : 0;
  const isLow = pctUsed >= 0.9;

  return (
    <div
      className={`text-xs px-2 py-1 rounded border ${isLow ? 'border-red-800 text-red-300 bg-red-950/40' : 'border-neutral-700 text-neutral-300'}`}
      title={`${usage.runs_this_period} runs this period · avg ${usage.avg_run_duration_seconds ? Math.round(usage.avg_run_duration_seconds) + 's' : 'n/a'}`}
    >
      {usage.quota_calls_used}/{usage.quota_calls_allowed} calls
    </div>
  );
}

'use client';

import { useEffect, useState, FormEvent } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, ArrowUpRight, Clock } from 'lucide-react';
import { useOrg } from '@/context/OrgProvider';
import { useRequireAuth } from '@/lib/useRequireAuth';
import { gqlRequest } from '@/lib/graphql';
import { WORKFLOWS_QUERY, CREATE_WORKFLOW_MUTATION } from '@/lib/queries';
import { StatusBadge } from '@/components/StatusBadge';
import { STEP_TYPE_META } from '@/lib/stepMeta';
import type { StepTypeName } from '@/lib/stepDefaults';

interface WorkflowSummary {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  avg_duration_seconds: number | null;
  steps: { id: string; type: string }[];
  triggers: { id: string; type: string; is_enabled: boolean }[];
  runs: { id: string; status: string; created_at: string }[];
}

function WorkflowCardSkeleton() {
  return (
    <div className="card p-4">
      <div className="skeleton mb-2 h-4 w-40 rounded" />
      <div className="skeleton h-3 w-24 rounded" />
    </div>
  );
}

export default function WorkflowsPage() {
  const { userId } = useRequireAuth();
  const { currentOrg, isLoading: orgLoading } = useOrg();
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);

  const load = async (orgId: string) => {
    setLoading(true);
    const data = await gqlRequest<{ workflows: WorkflowSummary[] }>(WORKFLOWS_QUERY, { orgId });
    setWorkflows(data.workflows);
    setLoading(false);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- workflow list re-fetch whenever the current org changes
    if (currentOrg) load(currentOrg.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrg?.id]);

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentOrg) return;
    setCreating(true);
    try {
      await gqlRequest(CREATE_WORKFLOW_MUTATION, { orgId: currentOrg.id, name, description: null });
      setName('');
      await load(currentOrg.id);
    } finally {
      setCreating(false);
    }
  };

  if (!userId || orgLoading) return null;
  if (!currentOrg) {
    return (
      <div className="card mx-auto mt-10 max-w-md p-6 text-center">
        <p className="text-sm text-[var(--muted)]">
          No organization selected. <Link href="/orgs" className="text-[var(--accent)] hover:opacity-80">Create or join one</Link>.
        </p>
      </div>
    );
  }

  const canEdit = currentOrg.role === 'owner' || currentOrg.role === 'editor';

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-lg font-medium tracking-tight text-[var(--foreground)]">Workflows</h1>
        <p className="mt-0.5 text-xs text-[var(--muted)]">{currentOrg.name}</p>
      </div>

      {canEdit && (
        <form onSubmit={onCreate} className="card mb-6 flex items-center gap-2 p-2">
          <input
            required
            placeholder="New workflow name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 bg-transparent px-2.5 py-2 text-sm outline-none placeholder:text-[var(--muted-2)]"
          />
          <button
            type="submit"
            disabled={creating}
            className="btn-primary flex shrink-0 items-center gap-1.5 rounded px-3.5 py-2 text-sm disabled:opacity-50"
          >
            {creating ? (
              'Creating…'
            ) : (
              <>
                <Plus className="h-3.5 w-3.5" /> New workflow
              </>
            )}
          </button>
        </form>
      )}

      {loading ? (
        <div className="flex flex-col gap-3">
          <WorkflowCardSkeleton />
          <WorkflowCardSkeleton />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <AnimatePresence initial={false}>
            {workflows.map((wf, i) => {
              const lastRun = wf.runs[0];
              const uniqueTypes = Array.from(new Set(wf.steps.map((s) => s.type))) as StepTypeName[];
              return (
                <motion.div
                  key={wf.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25, delay: i * 0.03 }}
                >
                  <Link href={`/workflows/${wf.id}`} className="card card-hover group flex items-center justify-between gap-4 p-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-sm font-medium text-neutral-100">
                          {wf.name}
                          <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-[var(--muted-2)] opacity-0 transition-opacity group-hover:opacity-100" />
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          {uniqueTypes.slice(0, 5).map((t) => {
                            const meta = STEP_TYPE_META[t];
                            if (!meta) return null;
                            const Icon = meta.icon;
                            return (
                              <span key={t} title={meta.label} className={meta.accented ? 'text-[var(--accent)]' : 'text-[var(--muted-2)]'}>
                                <Icon className="h-3.5 w-3.5" />
                              </span>
                            );
                          })}
                          <span className="mono text-[11px] text-[var(--muted-2)]">
                            {wf.steps.length} steps · {wf.triggers.length} triggers
                            {wf.avg_duration_seconds != null && (
                              <span className="ml-1 inline-flex items-center gap-0.5">
                                <Clock className="inline h-2.5 w-2.5" /> {Math.round(wf.avg_duration_seconds)}s avg
                              </span>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0">
                      {lastRun ? (
                        <StatusBadge status={lastRun.status} />
                      ) : (
                        <span className="mono text-[11px] text-[var(--muted-2)]">never run</span>
                      )}
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </AnimatePresence>
          {workflows.length === 0 && (
            <div className="card flex flex-col items-center gap-2 px-4 py-14 text-center">
              <p className="text-sm text-[var(--muted)]">No workflows yet.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

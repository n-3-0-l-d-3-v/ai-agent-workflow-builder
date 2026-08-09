'use client';

import { useEffect, useState, FormEvent } from 'react';
import Link from 'next/link';
import { useOrg } from '@/context/OrgProvider';
import { gqlRequest } from '@/lib/graphql';
import { WORKFLOWS_QUERY, CREATE_WORKFLOW_MUTATION } from '@/lib/queries';

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

const STATUS_COLORS: Record<string, string> = {
  succeeded: 'text-emerald-400',
  failed: 'text-red-400',
  paused: 'text-amber-400',
  running: 'text-sky-400',
  pending: 'text-neutral-400',
  cancelled: 'text-neutral-500',
};

export default function WorkflowsPage() {
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

  if (orgLoading) return null;
  if (!currentOrg) {
    return (
      <p className="text-sm text-neutral-400">
        No organization selected. <Link href="/orgs" className="underline">Create or join one</Link>.
      </p>
    );
  }

  const canEdit = currentOrg.role === 'owner' || currentOrg.role === 'editor';

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-semibold">Workflows — {currentOrg.name}</h1>
      </div>

      {canEdit && (
        <form onSubmit={onCreate} className="flex gap-2 mb-6">
          <input
            required
            placeholder="new workflow name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={creating}
            className="bg-neutral-100 text-neutral-900 rounded px-3 py-2 text-sm font-medium disabled:opacity-50"
          >
            {creating ? 'creating...' : 'new workflow'}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-neutral-500">loading...</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {workflows.map((wf) => {
            const lastRun = wf.runs[0];
            return (
              <li key={wf.id}>
                <Link
                  href={`/workflows/${wf.id}`}
                  className="flex items-center justify-between border border-neutral-800 rounded px-4 py-3 hover:border-neutral-600 transition-colors"
                >
                  <div>
                    <div className="text-sm font-medium">{wf.name}</div>
                    <div className="text-xs text-neutral-500 mt-1">
                      {wf.steps.length} steps · {wf.triggers.length} triggers
                      {wf.avg_duration_seconds != null && ` · avg ${Math.round(wf.avg_duration_seconds)}s`}
                    </div>
                  </div>
                  <div className={`text-xs font-medium ${lastRun ? STATUS_COLORS[lastRun.status] : 'text-neutral-600'}`}>
                    {lastRun ? lastRun.status : 'never run'}
                  </div>
                </Link>
              </li>
            );
          })}
          {workflows.length === 0 && <p className="text-sm text-neutral-500">No workflows yet.</p>}
        </ul>
      )}
    </div>
  );
}

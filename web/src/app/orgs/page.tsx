'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, ArrowRight, AlertCircle, Users } from 'lucide-react';
import { useOrg } from '@/context/OrgProvider';
import { useRequireAuth } from '@/lib/useRequireAuth';
import { gqlRequest } from '@/lib/graphql';
import { CREATE_ORG_MUTATION } from '@/lib/queries';
import { RoleBadge } from '@/components/RoleBadge';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export default function OrgsPage() {
  const { userId } = useRequireAuth();
  const { orgs, currentOrg, refetch, setCurrentOrgId } = useOrg();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const data = await gqlRequest<{ insert_organizations_one: { id: string } }>(CREATE_ORG_MUTATION, {
        name,
        slug: `${slugify(name)}-${Math.random().toString(36).slice(2, 7)}`,
      });
      setName('');
      await refetch();
      setCurrentOrgId(data.insert_organizations_one.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed to create organization');
    } finally {
      setCreating(false);
    }
  };

  if (!userId) return null;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-lg font-medium tracking-tight text-[var(--foreground)]">Organizations</h1>
        <p className="mt-0.5 text-xs text-[var(--muted)]">Every workflow lives inside exactly one of these.</p>
      </div>

      <div className="mb-6 flex flex-col gap-2">
        <AnimatePresence initial={false}>
          {orgs.map((org, i) => {
            const active = org.id === currentOrg?.id;
            return (
              <motion.button
                key={org.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25, delay: i * 0.03 }}
                onClick={() => setCurrentOrgId(org.id)}
                className={`card card-hover flex items-center justify-between px-4 py-3 text-left ${active ? 'border-[var(--border-strong)]' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <span className="mono flex h-7 w-7 items-center justify-center rounded border border-[var(--border)] text-xs text-[var(--muted)]">
                    {org.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="text-sm text-neutral-200">{org.name}</span>
                  {active && <span className="mono text-[10px] uppercase tracking-wide text-[var(--accent)]">current</span>}
                </div>
                <div className="flex items-center gap-3">
                  <Link
                    href={`/orgs/${org.id}`}
                    onClick={(e) => e.stopPropagation()}
                    title="manage members"
                    className="rounded p-1 text-[var(--muted-2)] hover:bg-white/[0.05] hover:text-neutral-200"
                  >
                    <Users className="h-3.5 w-3.5" />
                  </Link>
                  <RoleBadge role={org.role} />
                </div>
              </motion.button>
            );
          })}
        </AnimatePresence>
        {orgs.length === 0 && (
          <div className="card flex flex-col items-center gap-2 px-4 py-10 text-center">
            <p className="text-sm text-[var(--muted)]">You&apos;re not a member of any organization yet.</p>
          </div>
        )}
      </div>

      <form onSubmit={onCreate} className="card flex items-center gap-2 p-2">
        <input
          required
          placeholder="New organization name"
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
              <Plus className="h-3.5 w-3.5" /> Create
            </>
          )}
        </button>
      </form>
      {error && (
        <div className="mt-2 flex items-start gap-2 rounded border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-2 text-xs text-[var(--danger)]">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}
      <p className="mt-3 flex items-center gap-1.5 text-xs text-[var(--muted-2)]">
        <ArrowRight className="h-3 w-3" />
        Creating an organization makes you its owner automatically.
      </p>
    </div>
  );
}

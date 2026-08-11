'use client';

import Link from 'next/link';
import { Workflow, Building2, ListTree, LogOut, ChevronDown } from 'lucide-react';
import { useAuth } from '@/context/AuthProvider';
import { useOrg } from '@/context/OrgProvider';
import { UsageBadge } from './UsageBadge';

export function Nav() {
  const { userId, email, signOut } = useAuth();
  const { orgs, currentOrg, setCurrentOrgId } = useOrg();

  return (
    <header className="sticky top-0 z-20 border-b border-[var(--border)] glass">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="group flex items-center gap-2 shrink-0">
          <span className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-400 to-violet-500 shadow-[0_0_20px_-4px_var(--accent-glow)] transition-transform group-hover:scale-105">
            <Workflow className="h-4.5 w-4.5 text-black" strokeWidth={2.5} />
          </span>
          <span className="hidden text-sm font-semibold tracking-tight sm:inline">
            agent<span className="text-gradient">workflows</span>
          </span>
        </Link>

        {userId && (
          <>
            <div className="relative">
              <select
                className="peer appearance-none rounded-lg border border-[var(--border)] bg-[var(--surface-2)] py-1.5 pl-3 pr-8 text-sm text-neutral-200 outline-none transition-colors hover:border-neutral-600 focus:border-violet-400"
                value={currentOrg?.id ?? ''}
                onChange={(e) => setCurrentOrgId(e.target.value)}
              >
                {orgs.length === 0 && <option value="">no organizations yet</option>}
                {orgs.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name} · {org.role}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-500 peer-hover:text-neutral-300" />
            </div>

            <nav className="ml-1 hidden items-center gap-1 text-sm text-neutral-400 sm:flex">
              <Link
                href="/orgs"
                className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 transition-colors hover:bg-white/5 hover:text-neutral-100"
              >
                <Building2 className="h-3.5 w-3.5" /> orgs
              </Link>
              <Link
                href="/workflows"
                className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 transition-colors hover:bg-white/5 hover:text-neutral-100"
              >
                <ListTree className="h-3.5 w-3.5" /> workflows
              </Link>
            </nav>

            <div className="ml-auto flex items-center gap-3">
              {currentOrg && <UsageBadge orgId={currentOrg.id} />}
              <span className="hidden max-w-[10rem] truncate text-xs text-neutral-500 md:inline">{email}</span>
              <button
                onClick={signOut}
                title="sign out"
                className="flex items-center gap-1.5 rounded-md border border-transparent px-2.5 py-1.5 text-xs text-neutral-400 transition-colors hover:border-[var(--border)] hover:text-neutral-100"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">sign out</span>
              </button>
            </div>
          </>
        )}

        {!userId && (
          <div className="ml-auto flex gap-2 text-sm">
            <Link
              href="/sign-in"
              className="rounded-lg px-3 py-1.5 text-neutral-300 transition-colors hover:bg-white/5 hover:text-neutral-100"
            >
              Sign in
            </Link>
            <Link href="/sign-up" className="btn-primary rounded-lg px-3.5 py-1.5 text-sm">
              Sign up
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}

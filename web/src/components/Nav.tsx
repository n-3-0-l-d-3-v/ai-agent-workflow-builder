'use client';

import Link from 'next/link';
import { Building2, ListTree, LogOut, ChevronDown } from 'lucide-react';
import { useAuth } from '@/context/AuthProvider';
import { useOrg } from '@/context/OrgProvider';
import { UsageBadge } from './UsageBadge';

export function Nav() {
  const { userId, email, signOut } = useAuth();
  const { orgs, currentOrg, setCurrentOrgId } = useOrg();

  return (
    <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--background)]">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="mono flex items-center gap-1.5 shrink-0 text-sm text-[var(--foreground)]">
          <span className="text-[var(--accent)]">❯</span>
          dispatch
        </Link>

        {userId && (
          <>
            <div className="rule mx-1 hidden h-4 w-px sm:block" />

            <div className="relative">
              <select
                className="mono peer appearance-none rounded border border-[var(--border)] bg-[var(--surface)] py-1.5 pl-3 pr-7 text-xs text-neutral-300 outline-none transition-colors hover:border-[var(--border-strong)] focus:border-[var(--accent)]"
                value={currentOrg?.id ?? ''}
                onChange={(e) => setCurrentOrgId(e.target.value)}
              >
                {orgs.length === 0 && <option value="">no organizations</option>}
                {orgs.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name} · {org.role}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-[var(--muted)]" />
            </div>

            <nav className="ml-1 hidden items-center gap-1 text-sm text-[var(--muted)] sm:flex">
              <Link href="/orgs" className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs transition-colors hover:bg-white/[0.03] hover:text-neutral-200">
                <Building2 className="h-3.5 w-3.5" /> orgs
              </Link>
              <Link href="/workflows" className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs transition-colors hover:bg-white/[0.03] hover:text-neutral-200">
                <ListTree className="h-3.5 w-3.5" /> workflows
              </Link>
            </nav>

            <div className="ml-auto flex items-center gap-3">
              {currentOrg && <UsageBadge orgId={currentOrg.id} />}
              <span className="mono hidden max-w-[10rem] truncate text-[11px] text-[var(--muted-2)] md:inline">{email}</span>
              <button
                onClick={signOut}
                title="sign out"
                className="flex items-center gap-1.5 rounded px-2 py-1.5 text-xs text-[var(--muted)] transition-colors hover:text-neutral-200"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          </>
        )}

        {!userId && (
          <div className="ml-auto flex gap-2 text-sm">
            <Link href="/sign-in" className="rounded px-3 py-1.5 text-[var(--muted)] transition-colors hover:text-neutral-200">
              Sign in
            </Link>
            <Link href="/sign-up" className="btn-primary rounded px-3.5 py-1.5 text-sm">
              Sign up
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}

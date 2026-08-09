'use client';

import Link from 'next/link';
import { useAuth } from '@/context/AuthProvider';
import { useOrg } from '@/context/OrgProvider';
import { UsageBadge } from './UsageBadge';

export function Nav() {
  const { userId, email, signOut } = useAuth();
  const { orgs, currentOrg, setCurrentOrgId } = useOrg();

  return (
    <header className="border-b border-neutral-800 bg-neutral-900/60 backdrop-blur sticky top-0 z-10">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center gap-4">
        <Link href="/" className="font-semibold tracking-tight text-sm">
          agent workflows
        </Link>

        {userId && (
          <>
            <select
              className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-sm"
              value={currentOrg?.id ?? ''}
              onChange={(e) => setCurrentOrgId(e.target.value)}
            >
              {orgs.length === 0 && <option value="">no organizations yet</option>}
              {orgs.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name} ({org.role})
                </option>
              ))}
            </select>

            <Link href="/orgs" className="text-sm text-neutral-400 hover:text-neutral-200">
              orgs
            </Link>
            <Link href="/workflows" className="text-sm text-neutral-400 hover:text-neutral-200">
              workflows
            </Link>

            <div className="ml-auto flex items-center gap-3">
              {currentOrg && <UsageBadge orgId={currentOrg.id} />}
              <span className="text-xs text-neutral-500">{email}</span>
              <button
                onClick={signOut}
                className="text-xs px-2 py-1 rounded border border-neutral-700 text-neutral-300 hover:bg-neutral-800"
              >
                sign out
              </button>
            </div>
          </>
        )}

        {!userId && (
          <div className="ml-auto flex gap-3 text-sm">
            <Link href="/sign-in" className="text-neutral-300 hover:text-neutral-100">
              sign in
            </Link>
            <Link href="/sign-up" className="text-neutral-300 hover:text-neutral-100">
              sign up
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}

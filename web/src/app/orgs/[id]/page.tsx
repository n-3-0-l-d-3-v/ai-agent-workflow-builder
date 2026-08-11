'use client';

import { useEffect, useState, useCallback, use as usePromise, FormEvent } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, UserPlus, Trash2, AlertCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthProvider';
import { useOrg } from '@/context/OrgProvider';
import { useRequireAuth } from '@/lib/useRequireAuth';
import { gqlRequest, GraphQLRequestError } from '@/lib/graphql';
import { ORG_MEMBERS_QUERY, FIND_USER_BY_EMAIL_QUERY, INVITE_MEMBER_MUTATION, UPDATE_MEMBER_ROLE_MUTATION, REMOVE_MEMBER_MUTATION } from '@/lib/queries';
import { RoleBadge } from '@/components/RoleBadge';
import type { OrgRole } from '@/context/OrgProvider';

interface Member {
  id: string;
  role: OrgRole;
  created_at: string;
  user: { id: string; display_name: string | null; email: string } | null;
}

export default function OrgMembersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: orgId } = usePromise(params);
  const { userId } = useRequireAuth();
  const { userId: authedUserId } = useAuth();
  const { orgs } = useOrg();

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<OrgRole>('editor');
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const org = orgs.find((o) => o.id === orgId);
  const isOwner = org?.role === 'owner';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await gqlRequest<{ org_members: Member[] }>(ORG_MEMBERS_QUERY, { orgId });
      setMembers(data.org_members);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial member list fetch
    load();
  }, [load]);

  const invite = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setInviting(true);
    try {
      const found = await gqlRequest<{ auth_users: { id: string }[] }>(FIND_USER_BY_EMAIL_QUERY, { email });
      const foundUser = found.auth_users[0];
      if (!foundUser) {
        setError(`No account found for ${email} — they need to sign up first, then you can add them.`);
        return;
      }
      await gqlRequest(INVITE_MEMBER_MUTATION, { orgId, userId: foundUser.id, role });
      setEmail('');
      await load();
    } catch (err) {
      setError(err instanceof GraphQLRequestError ? err.message : 'failed to add member');
    } finally {
      setInviting(false);
    }
  };

  const changeRole = async (memberId: string, newRole: OrgRole) => {
    await gqlRequest(UPDATE_MEMBER_ROLE_MUTATION, { id: memberId, role: newRole });
    await load();
  };

  const remove = async (memberId: string) => {
    await gqlRequest(REMOVE_MEMBER_MUTATION, { id: memberId });
    await load();
  };

  if (!userId) return null;

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/orgs" className="mb-3 inline-flex items-center gap-1 text-xs text-[var(--muted)] transition-colors hover:text-neutral-300">
        <ArrowLeft className="h-3 w-3" /> organizations
      </Link>

      <div className="mb-6">
        <h1 className="text-lg font-medium tracking-tight text-[var(--foreground)]">{org?.name ?? 'Members'}</h1>
        <p className="mt-0.5 text-xs text-[var(--muted)]">
          {members.length} member{members.length === 1 ? '' : 's'}
          {!isOwner && ' · only owners can manage membership'}
        </p>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          <div className="skeleton h-12 rounded" />
          <div className="skeleton h-12 rounded" />
        </div>
      ) : (
        <div className="mb-6 flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {members.map((m) => {
              const self = m.user?.id === authedUserId;
              return (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="card flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm text-neutral-200">
                      {m.user?.display_name || m.user?.email || 'unknown user'}
                      {self && <span className="mono ml-1.5 text-[10px] text-[var(--muted-2)]">(you)</span>}
                    </div>
                    {m.user?.display_name && <div className="mono truncate text-[11px] text-[var(--muted-2)]">{m.user.email}</div>}
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {isOwner ? (
                      <select
                        value={m.role}
                        onChange={(e) => changeRole(m.id, e.target.value as OrgRole)}
                        className="mono rounded border border-[var(--border)] bg-[var(--surface-2)] px-1.5 py-1 text-[11px] text-neutral-300 outline-none focus:border-[var(--accent)]"
                      >
                        <option value="owner">owner</option>
                        <option value="editor">editor</option>
                        <option value="viewer">viewer</option>
                      </select>
                    ) : (
                      <RoleBadge role={m.role} />
                    )}
                    {isOwner && !self && (
                      <button onClick={() => remove(m.id)} className="rounded p-1 text-[var(--danger)] hover:bg-[var(--danger)]/10">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {isOwner && (
        <form onSubmit={invite} className="card p-3">
          <p className="mono mb-2 flex items-center gap-1.5 text-xs text-[var(--muted)]">
            <UserPlus className="h-3.5 w-3.5" /> add a member
          </p>
          <div className="flex gap-2">
            <input
              type="email"
              required
              placeholder="teammate@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 rounded border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1.5 text-sm outline-none focus:border-[var(--accent)]"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as OrgRole)}
              className="rounded border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1.5 text-sm outline-none focus:border-[var(--accent)]"
            >
              <option value="owner">owner</option>
              <option value="editor">editor</option>
              <option value="viewer">viewer</option>
            </select>
            <button
              type="submit"
              disabled={inviting}
              className="btn-primary shrink-0 rounded px-3.5 py-1.5 text-sm disabled:opacity-50"
            >
              {inviting ? 'Adding…' : 'Add'}
            </button>
          </div>
          {error && (
            <div className="mt-2 flex items-start gap-2 rounded border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-2 text-xs text-[var(--danger)]">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {error}
            </div>
          )}
          <p className="mt-2 text-[11px] text-[var(--muted-2)]">
            They need an existing account on this app — this adds them to the org, it doesn&apos;t send an email invite.
          </p>
        </form>
      )}
    </div>
  );
}

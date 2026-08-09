import { gql } from './hasura';

export type OrgRole = 'owner' | 'editor' | 'viewer';

export class AuthError extends Error {
  constructor(message: string, public statusCode = 403) {
    super(message);
  }
}

/**
 * Session variables Hasura forwards to an Action handler. We only ever
 * trust x-hasura-user-id from here — role is NOT a claim, it's looked up
 * fresh per-org on every privileged call (see docs/write-up.md: "why role
 * checks live in the handler, not the JWT").
 */
export interface SessionVariables {
  'x-hasura-user-id'?: string;
  'x-hasura-role'?: string;
  [key: string]: string | undefined;
}

export function requireUserId(sessionVariables: SessionVariables | undefined): string {
  const userId = sessionVariables?.['x-hasura-user-id'];
  if (!userId) throw new AuthError('Not authenticated', 401);
  return userId;
}

/** Looks up the caller's role in a specific org. Returns null if not a member. */
export async function getOrgRole(orgId: string, userId: string): Promise<OrgRole | null> {
  const data = await gql<{ org_members: { role: OrgRole }[] }>(
    `query ($orgId: uuid!, $userId: uuid!) {
      org_members(where: { org_id: { _eq: $orgId }, user_id: { _eq: $userId } }, limit: 1) {
        role
      }
    }`,
    { orgId, userId }
  );
  return data.org_members[0]?.role ?? null;
}

/**
 * Enforces "caller must be at least `minRole` in this org". This is the
 * step-level (layer 2) gate for approval_gate specifically -- Hasura row
 * permissions can't express "pause mid-execution and require a fresh role
 * check before resuming", so approveStep calls this explicitly instead of
 * relying on a database permission.
 */
export async function requireOrgRole(
  orgId: string,
  userId: string,
  allowed: OrgRole[]
): Promise<OrgRole> {
  const role = await getOrgRole(orgId, userId);
  if (!role || !allowed.includes(role)) {
    throw new AuthError(
      `caller must have one of [${allowed.join(', ')}] in this organization`,
      403
    );
  }
  return role;
}

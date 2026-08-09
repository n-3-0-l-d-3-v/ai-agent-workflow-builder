import { gql } from './hasura';

export class QuotaExceededError extends Error {
  constructor() {
    super('organization quota exhausted for this period');
  }
}

interface OrgQuotaRow {
  id: string;
  quota_calls_allowed: number;
  quota_calls_used: number;
  quota_period_start: string;
}

/**
 * Rolls the quota period over if we've crossed into a new month, then
 * throws QuotaExceededError if the org has no calls left. Called once
 * before a run starts (per the assignment) -- we also call it again before
 * each external-call step so a long-running workflow can't blow through
 * the quota mid-flight between the initial check and later steps.
 */
export async function assertQuotaAvailable(orgId: string): Promise<void> {
  const data = await gql<{ organizations_by_pk: OrgQuotaRow }>(
    `query ($orgId: uuid!) {
      organizations_by_pk(id: $orgId) {
        id
        quota_calls_allowed
        quota_calls_used
        quota_period_start
      }
    }`,
    { orgId }
  );

  const org = data.organizations_by_pk;
  if (!org) throw new Error('organization not found');

  const periodStart = new Date(org.quota_period_start);
  const now = new Date();
  const periodAge =
    now.getUTCFullYear() * 12 + now.getUTCMonth() - (periodStart.getUTCFullYear() * 12 + periodStart.getUTCMonth());

  if (periodAge >= 1) {
    await gql(
      `mutation ($orgId: uuid!, $now: timestamptz!) {
        update_organizations_by_pk(
          pk_columns: { id: $orgId }
          _set: { quota_calls_used: 0, quota_period_start: $now }
        ) { id }
      }`,
      { orgId, now: now.toISOString() }
    );
    return; // fresh period, definitely has quota
  }

  if (org.quota_calls_used >= org.quota_calls_allowed) {
    throw new QuotaExceededError();
  }
}

export async function incrementQuotaUsage(orgId: string, by = 1): Promise<void> {
  await gql(
    `mutation ($orgId: uuid!, $by: Int!) {
      update_organizations_by_pk(
        pk_columns: { id: $orgId }
        _inc: { quota_calls_used: $by }
      ) { id }
    }`,
    { orgId, by }
  );
}

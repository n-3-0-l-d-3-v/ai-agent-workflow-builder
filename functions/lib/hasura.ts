// Thin admin-secret GraphQL client. Every function handler in this project
// talks to Hasura through this instead of a generated SDK — the query set
// is small and fixed, and it keeps the deploy footprint to zero third-party
// dependencies.

// NHOST_GRAPHQL_URL and NHOST_ADMIN_SECRET are injected automatically by
// nhost into every function's environment -- no manual configuration
// needed on the project. (Locally, e.g. for scripts/seed.mjs, the
// equivalent values live under HASURA_GRAPHQL_URL / HASURA_GRAPHQL_ADMIN_SECRET
// in .env.local, since those aren't running inside nhost's own runtime.)
const ENDPOINT = process.env.NHOST_GRAPHQL_URL;
const ADMIN_SECRET = process.env.NHOST_ADMIN_SECRET;

export class HasuraError extends Error {
  constructor(message: string, public errors: unknown) {
    super(message);
  }
}

export async function gql<T = any>(query: string, variables?: Record<string, unknown>): Promise<T> {
  if (!ENDPOINT || !ADMIN_SECRET) {
    throw new Error('NHOST_GRAPHQL_URL / NHOST_ADMIN_SECRET not configured');
  }

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-hasura-admin-secret': ADMIN_SECRET,
      'x-hasura-role': 'admin',
    },
    body: JSON.stringify({ query, variables }),
  });

  const json: any = await res.json();
  if (json.errors) {
    throw new HasuraError(json.errors[0]?.message ?? 'GraphQL error', json.errors);
  }
  return json.data as T;
}

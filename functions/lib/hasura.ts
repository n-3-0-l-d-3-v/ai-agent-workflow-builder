// Thin admin-secret GraphQL client. Every function handler in this project
// talks to Hasura through this instead of a generated SDK — the query set
// is small and fixed, and it keeps the deploy footprint to zero third-party
// dependencies.

const ENDPOINT = process.env.HASURA_GRAPHQL_URL;
const ADMIN_SECRET = process.env.HASURA_GRAPHQL_ADMIN_SECRET;

export class HasuraError extends Error {
  constructor(message: string, public errors: unknown) {
    super(message);
  }
}

export async function gql<T = any>(query: string, variables?: Record<string, unknown>): Promise<T> {
  if (!ENDPOINT || !ADMIN_SECRET) {
    throw new Error('HASURA_GRAPHQL_URL / HASURA_GRAPHQL_ADMIN_SECRET not configured');
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

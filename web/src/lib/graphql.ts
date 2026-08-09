import { createClient as createWsClient, Client as WsClient } from 'graphql-ws';
import { nhost } from './nhost';

export class GraphQLRequestError extends Error {
  constructor(message: string, public errors: unknown) {
    super(message);
  }
}

export async function gqlRequest<T = unknown>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await nhost.graphql.request<T>({ query, variables });
  if (res.body.errors?.length) {
    throw new GraphQLRequestError(res.body.errors[0].message, res.body.errors);
  }
  return res.body.data as T;
}

let wsClient: WsClient | null = null;

function getWsClient(): WsClient {
  if (wsClient) return wsClient;
  const wsUrl = nhost.graphql.url.replace(/^http/, 'ws');
  wsClient = createWsClient({
    url: wsUrl,
    connectionParams: () => {
      const session = nhost.getUserSession();
      return session ? { headers: { Authorization: `Bearer ${session.accessToken}` } } : {};
    },
  });
  return wsClient;
}

/**
 * Subscribes to a GraphQL subscription. Returns an unsubscribe function.
 * Used for the live step_runs feed -- see components/RunStatus.tsx.
 */
export function gqlSubscribe<T = unknown>(
  query: string,
  variables: Record<string, unknown> | undefined,
  onData: (data: T) => void,
  onError?: (err: unknown) => void
): () => void {
  const client = getWsClient();
  return client.subscribe<T>(
    { query, variables },
    {
      next: (result) => {
        if (result.data) onData(result.data as T);
      },
      error: (err) => onError?.(err),
      complete: () => {},
    }
  );
}

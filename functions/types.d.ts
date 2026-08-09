// nhost serverless functions run on a lightweight Express-compatible
// runtime. We declare only the surface we actually touch instead of taking
// on a dependency for it.
export interface NhostRequest {
  body: any;
  headers: Record<string, string | string[] | undefined>;
  query: Record<string, string>;
  method: string;
}

export interface NhostResponse {
  status(code: number): NhostResponse;
  json(body: any): void;
  send(body?: any): void;
}

export type NhostHandler = (req: NhostRequest, res: NhostResponse) => Promise<void> | void;

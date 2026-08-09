export interface HttpRequestConfig {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  timeout_ms?: number;
}

export interface HttpRequestResult {
  status: number;
  ok: boolean;
  body: unknown;
}

export async function executeHttpRequest(config: HttpRequestConfig): Promise<HttpRequestResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeout_ms ?? 15_000);
  try {
    const res = await fetch(config.url, {
      method: config.method ?? 'GET',
      headers: config.headers,
      body: config.body !== undefined ? JSON.stringify(config.body) : undefined,
      signal: controller.signal,
    });

    const contentType = res.headers.get('content-type') ?? '';
    const body = contentType.includes('application/json') ? await res.json().catch(() => null) : await res.text();

    if (!res.ok) {
      throw new Error(`http_request failed: ${res.status} ${typeof body === 'string' ? body.slice(0, 300) : JSON.stringify(body).slice(0, 300)}`);
    }

    return { status: res.status, ok: res.ok, body };
  } finally {
    clearTimeout(timeout);
  }
}

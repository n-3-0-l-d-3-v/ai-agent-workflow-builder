/**
 * nhost's function runtime doesn't guarantee req.body is already a parsed
 * object the way Express's json() middleware would -- observed in practice
 * to sometimes arrive as a raw string/Buffer. Every handler that reads a
 * JSON body goes through this instead of touching req.body directly.
 */
export function parseJsonBody(body: unknown): any {
  if (body == null) return {};
  if (typeof body === 'object') return body;
  if (Buffer.isBuffer(body)) {
    try {
      return JSON.parse(body.toString('utf8') || '{}');
    } catch {
      return {};
    }
  }
  if (typeof body === 'string') {
    try {
      return JSON.parse(body || '{}');
    } catch {
      return {};
    }
  }
  return {};
}

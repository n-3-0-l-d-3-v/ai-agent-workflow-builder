/**
 * nhost's function runtime doesn't guarantee req.body is already a parsed
 * object the way Express's json() middleware would -- observed in practice
 * to sometimes arrive as a raw string/Buffer. Every handler that reads a
 * JSON body goes through this instead of touching req.body directly.
 */
export function parseJsonBody(body: unknown): any {
  if (body == null) return {};
  // Buffer must be checked before the generic `typeof === 'object'` branch
  // below -- a Buffer's typeof is also 'object' in JS, so this order
  // matters: getting it backwards means every Buffer body silently returns
  // itself unparsed instead of being JSON.parse'd, and `body.input` on a
  // Buffer is just undefined. (This exact bug shipped once already.)
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
  if (typeof body === 'object') return body;
  return {};
}

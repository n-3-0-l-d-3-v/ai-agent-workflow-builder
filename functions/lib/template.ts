/**
 * Minimal {{dot.path}} templating for step configs. Deliberately not a
 * general expression language -- steps only ever need to reference prior
 * output and trigger context, and a tiny resolver is easier to reason
 * about (and audit) than pulling in a template engine for six lines of
 * logic.
 */
export interface RunContext {
  trigger: Record<string, unknown>;
  steps: Record<string, { output: unknown }>;
  previous: unknown;
}

function resolvePath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc === null || acc === undefined) return undefined;
    return (acc as Record<string, unknown>)[key];
  }, obj);
}

export function renderTemplate(input: string, context: RunContext): string {
  return input.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, path: string) => {
    const value = resolvePath(context, path);
    if (value === undefined) return '';
    return typeof value === 'string' ? value : JSON.stringify(value);
  });
}

/** Deep-renders templates inside strings anywhere in a JSON-like value. */
export function renderDeep<T>(value: T, context: RunContext): T {
  if (typeof value === 'string') {
    return renderTemplate(value, context) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((v) => renderDeep(v, context)) as unknown as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = renderDeep(v, context);
    }
    return out as T;
  }
  return value;
}

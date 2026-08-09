/**
 * Minimal 5-field cron matcher (minute hour day-of-month month day-of-week).
 * Supports *, single values, comma lists, and step values (e.g. every-N via
 * the slash syntax). That
 * covers every schedule a demo/assignment workflow needs without pulling
 * in a cron parsing library for something this small.
 */
function fieldMatches(field: string, value: number): boolean {
  return field.split(',').some((part) => {
    if (part === '*') return true;
    if (part.startsWith('*/')) {
      const step = Number(part.slice(2));
      return step > 0 && value % step === 0;
    }
    return Number(part) === value;
  });
}

export function cronMatches(date: Date, expression: string): boolean {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  return (
    fieldMatches(minute, date.getUTCMinutes()) &&
    fieldMatches(hour, date.getUTCHours()) &&
    fieldMatches(dayOfMonth, date.getUTCDate()) &&
    fieldMatches(month, date.getUTCMonth() + 1) &&
    fieldMatches(dayOfWeek, date.getUTCDay())
  );
}

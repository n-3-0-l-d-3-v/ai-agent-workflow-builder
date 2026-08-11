import { CheckCircle2, XCircle, PauseCircle, Loader2, Circle, MinusCircle, SkipForward } from 'lucide-react';

/*
 * Status color is functional, not decorative: success reads as calm sage,
 * failure as a muted brick red, and the accent is reserved for "paused —
 * needs a person". Everything else (pending, running, skipped, cancelled)
 * stays in the neutral scale so the two states that actually need
 * attention are the only things that stand out.
 */
const STYLES: Record<string, { icon: typeof Circle; className: string; spin?: boolean }> = {
  succeeded: { icon: CheckCircle2, className: 'text-[var(--success)] border-[var(--success)]/30' },
  sent: { icon: CheckCircle2, className: 'text-[var(--success)] border-[var(--success)]/30' },
  failed: { icon: XCircle, className: 'text-[var(--danger)] border-[var(--danger)]/30' },
  paused: { icon: PauseCircle, className: 'text-[var(--accent)] border-[var(--accent)]/40' },
  running: { icon: Loader2, className: 'text-neutral-200 border-[var(--border-strong)]', spin: true },
  pending: { icon: Circle, className: 'text-[var(--muted)] border-[var(--border)]' },
  cancelled: { icon: MinusCircle, className: 'text-[var(--muted-2)] border-[var(--border)]' },
  skipped: { icon: SkipForward, className: 'text-[var(--muted-2)] border-[var(--border)]' },
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const s = STYLES[status] ?? STYLES.pending;
  const Icon = s.icon;
  return (
    <span className={`mono inline-flex items-center gap-1.5 rounded border bg-transparent px-2 py-0.5 text-[11px] uppercase tracking-wide ${s.className}`}>
      <Icon className={`h-3 w-3 ${s.spin ? 'animate-spin' : ''}`} />
      {label ?? status}
    </span>
  );
}

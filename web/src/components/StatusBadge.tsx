import { CheckCircle2, XCircle, PauseCircle, Loader2, Circle, MinusCircle, SkipForward } from 'lucide-react';

const STYLES: Record<string, { icon: typeof Circle; className: string; spin?: boolean }> = {
  succeeded: { icon: CheckCircle2, className: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  sent: { icon: CheckCircle2, className: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  failed: { icon: XCircle, className: 'text-red-400 bg-red-500/10 border-red-500/20' },
  paused: { icon: PauseCircle, className: 'text-amber-300 bg-amber-500/10 border-amber-500/20' },
  running: { icon: Loader2, className: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/20', spin: true },
  pending: { icon: Circle, className: 'text-neutral-400 bg-white/5 border-[var(--border)]' },
  cancelled: { icon: MinusCircle, className: 'text-neutral-500 bg-white/5 border-[var(--border)]' },
  skipped: { icon: SkipForward, className: 'text-neutral-500 bg-white/5 border-[var(--border)]' },
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const s = STYLES[status] ?? STYLES.pending;
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium capitalize ${s.className}`}>
      <Icon className={`h-3 w-3 ${s.spin ? 'animate-spin' : ''}`} />
      {label ?? status}
    </span>
  );
}

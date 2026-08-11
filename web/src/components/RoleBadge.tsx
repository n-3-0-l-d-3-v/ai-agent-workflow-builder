import { Crown, Pencil, Eye } from 'lucide-react';

const STYLES: Record<string, { icon: typeof Crown; className: string }> = {
  owner: { icon: Crown, className: 'text-[var(--accent)] border-[var(--accent)]/40' },
  editor: { icon: Pencil, className: 'text-neutral-300 border-[var(--border-strong)]' },
  viewer: { icon: Eye, className: 'text-[var(--muted)] border-[var(--border)]' },
};

export function RoleBadge({ role }: { role: string }) {
  const s = STYLES[role] ?? STYLES.viewer;
  const Icon = s.icon;
  return (
    <span className={`mono inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] uppercase tracking-wide ${s.className}`}>
      <Icon className="h-3 w-3" />
      {role}
    </span>
  );
}

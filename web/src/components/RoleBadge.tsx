import { Crown, Pencil, Eye } from 'lucide-react';

const STYLES: Record<string, { icon: typeof Crown; className: string }> = {
  owner: { icon: Crown, className: 'text-amber-300 bg-amber-500/10 border-amber-500/20' },
  editor: { icon: Pencil, className: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/20' },
  viewer: { icon: Eye, className: 'text-neutral-400 bg-white/5 border-[var(--border)]' },
};

export function RoleBadge({ role }: { role: string }) {
  const s = STYLES[role] ?? STYLES.viewer;
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide ${s.className}`}>
      <Icon className="h-3 w-3" />
      {role}
    </span>
  );
}

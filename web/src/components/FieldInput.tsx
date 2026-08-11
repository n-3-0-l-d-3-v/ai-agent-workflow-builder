'use client';

import { LucideIcon } from 'lucide-react';
import { InputHTMLAttributes } from 'react';

export function FieldInput({
  icon: Icon,
  ...props
}: { icon: LucideIcon } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-2)]" />
      <input
        {...props}
        className="w-full rounded border border-[var(--border)] bg-[var(--surface-2)] py-2.5 pl-9 pr-3 text-sm text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-2)] hover:border-[var(--border-strong)] focus:border-[var(--accent)]"
      />
    </div>
  );
}

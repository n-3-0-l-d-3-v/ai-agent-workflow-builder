'use client';

import { ReactNode } from 'react';

export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="mx-auto mt-14 flex max-w-sm flex-col sm:mt-20">
      <div className="mb-6">
        <span className="mono mb-4 flex items-center gap-1.5 text-xs text-[var(--muted)]">
          <span className="text-[var(--accent)]">❯</span>
          workflows
        </span>
        <h1 className="font-heading text-xl font-semibold tracking-tight text-[var(--foreground)]">{title}</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">{subtitle}</p>
      </div>

      <div className="card p-6">{children}</div>

      {footer && <div className="mt-5 text-center text-sm text-[var(--muted)]">{footer}</div>}
    </div>
  );
}

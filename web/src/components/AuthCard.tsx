'use client';

import { motion } from 'framer-motion';
import { Workflow } from 'lucide-react';
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
    <div className="relative mx-auto mt-14 flex max-w-sm flex-col items-center sm:mt-20">
      <div
        aria-hidden
        className="dot-grid pointer-events-none absolute -top-10 left-1/2 -z-10 h-64 w-[140%] -translate-x-1/2 [mask-image:radial-gradient(ellipse_50%_60%_at_50%_0%,black,transparent)]"
      />
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className="w-full"
      >
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-violet-500 shadow-[0_0_24px_-6px_var(--accent-glow)]">
            <Workflow className="h-5 w-5 text-black" strokeWidth={2.5} />
          </span>
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-neutral-500">{subtitle}</p>
        </div>

        <div className="card p-6">{children}</div>

        {footer && <div className="mt-5 text-center text-sm text-neutral-500">{footer}</div>}
      </motion.div>
    </div>
  );
}

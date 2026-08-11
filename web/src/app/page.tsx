'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Bot, GitBranch, Globe, ShieldCheck, Sparkles, Timer } from 'lucide-react';
import { useAuth } from '@/context/AuthProvider';

const FEATURES = [
  {
    icon: Bot,
    title: 'llm_call, http_request, db_write',
    body: 'Chain real model calls and external APIs into a single deterministic run, with retries built in.',
  },
  {
    icon: GitBranch,
    title: 'Conditional branching',
    body: "Steps that change path based on the model's own output — not a fixed pipeline.",
  },
  {
    icon: ShieldCheck,
    title: 'Approval gates',
    body: 'Pause a live run and require a human owner or editor to resume it, with a full audit trail.',
  },
  {
    icon: Globe,
    title: 'Four ways to start a run',
    body: 'Manual, signed webhook, cron schedule, or a database row landing in a watched table.',
  },
  {
    icon: Timer,
    title: 'Live, not polled',
    body: 'Every step transition streams over a GraphQL subscription — no refresh, ever.',
  },
  {
    icon: Sparkles,
    title: 'Two real permission layers',
    body: 'Org + role scoping, plus step-level gating for the steps that reach outside the sandbox.',
  },
];

export default function Home() {
  const { userId, isLoading } = useAuth();

  if (isLoading) return null;

  return (
    <div className="relative">
      <div
        aria-hidden
        className="dot-grid pointer-events-none absolute inset-x-0 -top-8 -z-10 h-[420px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_0%,black,transparent)]"
      />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="mx-auto mt-10 max-w-3xl text-center sm:mt-16"
      >
        <span className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1 text-xs text-neutral-400">
          <Sparkles className="h-3 w-3 text-violet-300" />
          org-scoped · role-gated · live
        </span>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Build AI agent <span className="text-gradient">workflows</span>
          <br className="hidden sm:block" /> that actually run themselves
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-balance text-[15px] leading-relaxed text-neutral-400">
          Chain <code className="rounded bg-white/5 px-1.5 py-0.5 text-[13px]">llm_call</code>,{' '}
          <code className="rounded bg-white/5 px-1.5 py-0.5 text-[13px]">http_request</code>,{' '}
          <code className="rounded bg-white/5 px-1.5 py-0.5 text-[13px]">conditional_branch</code>, and{' '}
          <code className="rounded bg-white/5 px-1.5 py-0.5 text-[13px]">approval_gate</code> steps into workflows
          that trigger on a schedule, a webhook, or a database event — with every action checked against org and
          role permissions, live.
        </p>

        <div className="mt-8 flex items-center justify-center gap-3">
          {userId ? (
            <Link href="/workflows" className="btn-primary group flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm">
              Go to workflows
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          ) : (
            <>
              <Link
                href="/sign-up"
                className="btn-primary group flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm"
              >
                Get started
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/sign-in"
                className="rounded-xl border border-[var(--border)] px-5 py-2.5 text-sm text-neutral-300 transition-colors hover:border-neutral-600 hover:text-neutral-100"
              >
                Sign in
              </Link>
            </>
          )}
        </div>
      </motion.div>

      <motion.div
        initial="hidden"
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
        className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-4 sm:mt-20 sm:grid-cols-2 lg:grid-cols-3"
      >
        {FEATURES.map((f) => (
          <motion.div
            key={f.title}
            variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            className="card card-hover p-5"
          >
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-400/20 to-violet-500/20">
              <f.icon className="h-4.5 w-4.5 text-violet-300" strokeWidth={2} />
            </div>
            <h3 className="text-sm font-medium text-neutral-100">{f.title}</h3>
            <p className="mt-1.5 text-[13px] leading-relaxed text-neutral-500">{f.body}</p>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}

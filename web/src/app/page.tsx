'use client';

import Link from 'next/link';
import { useAuth } from '@/context/AuthProvider';

export default function Home() {
  const { userId, isLoading } = useAuth();

  if (isLoading) return null;

  return (
    <div className="max-w-2xl mx-auto mt-20 text-center">
      <h1 className="text-3xl font-semibold tracking-tight mb-4">AI Agent Workflow Builder</h1>
      <p className="text-neutral-400 mb-8">
        Chain llm_call, http_request, db_write, notify, conditional_branch and approval_gate steps
        into org-scoped workflows, triggered manually, on a schedule, by webhook, or by a database
        event — with live per-step status.
      </p>
      {userId ? (
        <Link
          href="/workflows"
          className="inline-block bg-neutral-100 text-neutral-900 rounded px-4 py-2 text-sm font-medium"
        >
          Go to workflows
        </Link>
      ) : (
        <div className="flex gap-3 justify-center">
          <Link href="/sign-in" className="border border-neutral-700 rounded px-4 py-2 text-sm">
            Sign in
          </Link>
          <Link href="/sign-up" className="bg-neutral-100 text-neutral-900 rounded px-4 py-2 text-sm font-medium">
            Sign up
          </Link>
        </div>
      )}
    </div>
  );
}

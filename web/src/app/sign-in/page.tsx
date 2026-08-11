'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, Lock, ArrowRight, AlertCircle } from 'lucide-react';
import { nhost } from '@/lib/nhost';
import { AuthCard } from '@/components/AuthCard';
import { FieldInput } from '@/components/FieldInput';

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await nhost.auth.signInEmailPassword({ email, password });
      if (!res.body?.session) {
        setError('Sign-in requires an additional step (e.g. MFA) not supported in this demo UI');
        return;
      }
      router.push('/workflows');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard
      title="Welcome back"
      subtitle="Sign in to keep building"
      footer={
        <>
          Don&apos;t have an account?{' '}
          <Link href="/sign-up" className="text-violet-300 hover:text-violet-200">
            Sign up
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <FieldInput
          icon={Mail}
          type="email"
          required
          autoFocus
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <FieldInput
          icon={Lock}
          type="password"
          required
          placeholder="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-xs text-red-300">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {error}
          </div>
        )}

        <button type="submit" disabled={loading} className="btn-primary group mt-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm disabled:opacity-50">
          {loading ? 'Signing in…' : 'Sign in'}
          {!loading && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />}
        </button>
      </form>
    </AuthCard>
  );
}

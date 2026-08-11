'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { User, Mail, Lock, ArrowRight, Info } from 'lucide-react';
import { nhost } from '@/lib/nhost';
import { AuthCard } from '@/components/AuthCard';
import { FieldInput } from '@/components/FieldInput';

export default function SignUpPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await nhost.auth.signUpEmailPassword({
        email,
        password,
        options: displayName ? { displayName } : undefined,
      });
      if (!res.body?.session) {
        setError('Account created. Check your email to verify before signing in (if email verification is enabled for this project).');
        return;
      }
      router.push('/orgs');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard
      title="Create your account"
      subtitle="Start building agent workflows"
      footer={
        <>
          Already have an account?{' '}
          <Link href="/sign-in" className="text-[var(--accent)] hover:opacity-80">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <FieldInput icon={User} placeholder="Display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        <FieldInput
          icon={Mail}
          type="email"
          required
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <FieldInput
          icon={Lock}
          type="password"
          required
          minLength={8}
          placeholder="Password (min 8 chars)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && (
          <div className="flex items-start gap-2 rounded border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3 py-2 text-xs text-[var(--accent)]">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {error}
          </div>
        )}

        <button type="submit" disabled={loading} className="btn-primary mt-1 flex items-center justify-center gap-2 rounded py-2.5 text-sm disabled:opacity-50">
          {loading ? 'Creating account…' : 'Create account'}
          {!loading && <ArrowRight className="h-4 w-4" />}
        </button>
      </form>
    </AuthCard>
  );
}

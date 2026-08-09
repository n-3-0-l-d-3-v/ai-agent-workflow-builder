'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { nhost } from '@/lib/nhost';

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
      setError(err instanceof Error ? err.message : 'sign up failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto mt-16">
      <h1 className="text-lg font-semibold mb-6">Create account</h1>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <input
          placeholder="display name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm"
        />
        <input
          type="email"
          required
          placeholder="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm"
        />
        <input
          type="password"
          required
          minLength={8}
          placeholder="password (min 8 chars)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm"
        />
        {error && <p className="text-sm text-amber-400">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="bg-neutral-100 text-neutral-900 rounded px-3 py-2 text-sm font-medium disabled:opacity-50"
        >
          {loading ? 'creating account...' : 'sign up'}
        </button>
      </form>
    </div>
  );
}

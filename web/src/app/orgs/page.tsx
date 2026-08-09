'use client';

import { useState, FormEvent } from 'react';
import { useOrg } from '@/context/OrgProvider';
import { gqlRequest } from '@/lib/graphql';
import { CREATE_ORG_MUTATION } from '@/lib/queries';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export default function OrgsPage() {
  const { orgs, refetch, setCurrentOrgId } = useOrg();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const data = await gqlRequest<{ insert_organizations_one: { id: string } }>(CREATE_ORG_MUTATION, {
        name,
        slug: `${slugify(name)}-${Math.random().toString(36).slice(2, 7)}`,
      });
      setName('');
      await refetch();
      setCurrentOrgId(data.insert_organizations_one.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed to create organization');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="max-w-xl">
      <h1 className="text-lg font-semibold mb-4">Organizations</h1>

      <ul className="mb-8 flex flex-col gap-2">
        {orgs.map((org) => (
          <li
            key={org.id}
            className="flex items-center justify-between border border-neutral-800 rounded px-3 py-2 text-sm"
          >
            <span>{org.name}</span>
            <span className="text-neutral-500 text-xs uppercase">{org.role}</span>
          </li>
        ))}
        {orgs.length === 0 && <p className="text-sm text-neutral-500">You&apos;re not a member of any organization yet.</p>}
      </ul>

      <form onSubmit={onCreate} className="flex gap-2">
        <input
          required
          placeholder="new organization name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={creating}
          className="bg-neutral-100 text-neutral-900 rounded px-3 py-2 text-sm font-medium disabled:opacity-50"
        >
          {creating ? 'creating...' : 'create'}
        </button>
      </form>
      {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
      <p className="text-xs text-neutral-500 mt-2">
        Creating an organization makes you its owner automatically (bootstrapped by a database trigger).
      </p>
    </div>
  );
}

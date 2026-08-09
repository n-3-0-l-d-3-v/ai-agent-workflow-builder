'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { useAuth } from './AuthProvider';
import { gqlRequest } from '@/lib/graphql';
import { MY_ORGS_QUERY } from '@/lib/queries';

export type OrgRole = 'owner' | 'editor' | 'viewer';

export interface MyOrg {
  id: string;
  name: string;
  slug: string;
  role: OrgRole;
}

interface OrgContextValue {
  orgs: MyOrg[];
  currentOrg: MyOrg | null;
  isLoading: boolean;
  setCurrentOrgId: (id: string) => void;
  refetch: () => Promise<void>;
}

const OrgContext = createContext<OrgContextValue>({
  orgs: [],
  currentOrg: null,
  isLoading: true,
  setCurrentOrgId: () => {},
  refetch: async () => {},
});

const STORAGE_KEY = 'aawb.currentOrgId';

export function OrgProvider({ children }: { children: ReactNode }) {
  const { userId } = useAuth();
  const [orgs, setOrgs] = useState<MyOrg[]>([]);
  const [currentOrgId, setCurrentOrgIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!userId) {
      setOrgs([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const data = await gqlRequest<{ org_members: { role: OrgRole; organization: { id: string; name: string; slug: string } }[] }>(
        MY_ORGS_QUERY,
        { userId }
      );
      const mapped = data.org_members.map((m) => ({ ...m.organization, role: m.role }));
      setOrgs(mapped);

      const stored = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
      const stillValid = stored && mapped.some((o) => o.id === stored);
      setCurrentOrgIdState(stillValid ? stored : mapped[0]?.id ?? null);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial org list fetch, re-run whenever the signed-in user changes
    refetch();
  }, [refetch]);

  const setCurrentOrgId = (id: string) => {
    setCurrentOrgIdState(id);
    if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, id);
  };

  const currentOrg = orgs.find((o) => o.id === currentOrgId) ?? null;

  return (
    <OrgContext.Provider value={{ orgs, currentOrg, isLoading, setCurrentOrgId, refetch }}>
      {children}
    </OrgContext.Provider>
  );
}

export function useOrg() {
  return useContext(OrgContext);
}

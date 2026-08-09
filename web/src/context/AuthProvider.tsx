'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { nhost } from '@/lib/nhost';
import type { StoredSession } from '@nhost/nhost-js/session';

interface AuthContextValue {
  session: StoredSession | null;
  userId: string | null;
  email: string | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  userId: null,
  email: null,
  isLoading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<StoredSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Deliberately reads/sets on mount rather than as a lazy useState
    // initializer: this component renders during SSR (no localStorage
    // there), so starting from null and syncing here avoids a
    // server/client hydration mismatch on the signed-in-vs-signed-out UI.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSession(nhost.getUserSession());
    setIsLoading(false);
    const unsubscribe = nhost.sessionStorage.onChange((next) => setSession(next));
    return unsubscribe;
  }, []);

  const signOut = async () => {
    if (session?.refreshToken) {
      await nhost.auth.signOut({ refreshToken: session.refreshToken }).catch(() => {});
    }
    nhost.clearSession();
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        userId: session?.user?.id ?? null,
        email: session?.user?.email ?? null,
        isLoading,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthProvider';

/** Sends signed-out visitors back to the landing page instead of letting them see an empty "no org" state on a protected route. */
export function useRequireAuth() {
  const { userId, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !userId) router.replace('/');
  }, [isLoading, userId, router]);

  return { userId, isLoading };
}

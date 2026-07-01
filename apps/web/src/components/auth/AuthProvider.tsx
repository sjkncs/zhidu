'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setLoading } = useAuthStore();

  useEffect(() => {
    const supabase = createClient();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    // Check initial session, with getUser() fallback
    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      if (error) {
        console.warn('[AuthProvider] getSession error:', error.message);
      }

      if (session?.user) {
        setUser(session.user);
        return;
      }

      // Fallback: getUser() makes a network call to Supabase,
      // which can trigger token refresh even if local session is stale
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) {
        console.warn('[AuthProvider] getUser fallback error:', userError.message);
      }
      setUser(user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [setUser, setLoading]);

  return <>{children}</>;
}

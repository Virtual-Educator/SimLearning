import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';

export type UserRole = 'student' | 'instructor' | 'admin';

export type UserProfile = {
  id: string;
  role: UserRole;
};

interface AuthContextValue {
  session: Session | null;
  profile: UserProfile | null;
  loadingAuth: boolean;
  loadingProfile: boolean;
  profileError: string | null;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function fetchOrCreateProfile(userId: string): Promise<UserProfile> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      const { data: newProfile, error: insertError } = await supabase
        .from('profiles')
        .insert({ id: userId, role: 'student' })
        .select('id, role')
        .single();

      if (insertError) {
        throw new Error(`Unable to create a default profile: ${insertError.message}`);
      }

      return newProfile as UserProfile;
    }

    const normalizedMessage = error.message?.toLowerCase() ?? '';
    const isPermissionIssue =
      normalizedMessage.includes('permission') ||
      normalizedMessage.includes('row level') ||
      error.code === '42501';

    const message = isPermissionIssue
      ? 'Unable to load your profile due to insufficient permissions.'
      : error.message || 'Unable to load profile.';

    throw new Error(message);
  }

  return data as UserProfile;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function initializeSession() {
      setLoadingAuth(true);
      const { data, error } = await supabase.auth.getSession();
      if (!isMounted) return;

      if (error) {
        console.error('Error fetching session', error);
      }
      setSession(data.session ?? null);
      setLoadingAuth(false);
    }

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, newSession: Session | null) => {
        setSession(newSession);
        setLoadingAuth(false);
      },
    );

    initializeSession();

    return () => {
      isMounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const loadProfileState = useCallback(
    async (shouldCancel?: () => boolean) => {
      if (!session?.user) {
        if (shouldCancel?.()) return;
        setProfile(null);
        setProfileError(null);
        setLoadingProfile(false);
        return;
      }

      setLoadingProfile(true);
      setProfileError(null);

      try {
        const loadedProfile = await fetchOrCreateProfile(session.user.id);
        if (shouldCancel?.()) return;
        setProfile(loadedProfile);
      } catch (error) {
        if (shouldCancel?.()) return;
        const message = error instanceof Error ? error.message : 'Unable to load profile.';
        setProfile(null);
        setProfileError(message);
      } finally {
        if (shouldCancel?.()) return;
        setLoadingProfile(false);
      }
    },
    [session],
  );

  useEffect(() => {
    let cancelled = false;

    loadProfileState(() => cancelled);

    return () => {
      cancelled = true;
    };
  }, [loadProfileState]);

  const refreshProfile = useCallback(async () => {
    await loadProfileState();
  }, [loadProfileState]);

  const value: AuthContextValue = {
    session,
    profile,
    loadingAuth,
    loadingProfile,
    profileError,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}

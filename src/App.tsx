import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabaseClient';
import { LoginPage } from './pages/LoginPage';
import { PlayerPage } from './pages/PlayerPage';
import { InstructorPage } from './pages/InstructorPage';
import { AdminPage } from './pages/AdminPage';

export type UserRole = 'student' | 'instructor' | 'admin';

export type UserProfile = {
  id: string;
  role: UserRole;
};

function LoadingScreen() {
  return (
    <div className="page">
      <div className="card">
        <p>Loading...</p>
      </div>
    </div>
  );
}

function ProtectedRoute({
  session,
  profile,
  isLoading,
  children,
  allowedRoles,
}: {
  session: Session | null;
  profile: UserProfile | null;
  isLoading: boolean;
  allowedRoles?: UserRole[];
  children: JSX.Element;
}) {
  if (isLoading) return <LoadingScreen />;
  if (!session) return <Navigate to="/login" replace />;

  if (allowedRoles) {
    if (!profile) return <LoadingScreen />;
    if (!allowedRoles.includes(profile.role)) {
      return <Navigate to="/player" replace />;
    }
  }

  return children;
}

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  useEffect(() => {
    async function initializeSession() {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.error('Error fetching session', error);
      }
      setSession(data.session ?? null);
      setIsAuthLoading(false);
    }

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    initializeSession();

    return () => {
      subscription.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    async function loadProfile(userId: string) {
      setIsAuthLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching profile', error);
      }

      if (!data) {
        const { data: newProfile, error: insertError } = await supabase
          .from('profiles')
          .insert({ id: userId, role: 'student' })
          .select('id, role')
          .single();

        if (insertError) {
          console.error('Error creating profile', insertError);
        } else {
          setProfile(newProfile);
        }
      } else {
        setProfile(data as UserProfile);
      }
      setIsAuthLoading(false);
    }

    if (!session?.user) {
      setProfile(null);
      setIsAuthLoading(false);
      return;
    }

    loadProfile(session.user.id);
  }, [session]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to={session ? '/player' : '/login'} replace />} />
        <Route path="/login" element={<LoginPage isAuthenticated={Boolean(session)} />} />
        <Route
          path="/player"
          element={
            <ProtectedRoute session={session} profile={profile} isLoading={isAuthLoading}>
              <PlayerPage onSignOut={handleSignOut} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/instructor"
          element={
            <ProtectedRoute
              session={session}
              profile={profile}
              isLoading={isAuthLoading}
              allowedRoles={['instructor', 'admin']}
            >
              <InstructorPage onSignOut={handleSignOut} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute
              session={session}
              profile={profile}
              isLoading={isAuthLoading}
              allowedRoles={['admin']}
            >
              <AdminPage onSignOut={handleSignOut} />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to={session ? '/player' : '/login'} replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { supabase } from './lib/supabaseClient';
import { LoginPage } from './pages/LoginPage';
import { PlayerPage } from './pages/PlayerPage';
import { InstructorPage } from './pages/InstructorPage';
import { AdminPage } from './pages/AdminPage';
import { AdminSimulationDetailPage } from './pages/AdminSimulationDetailPage';
import { PlayerActivityPage } from './pages/PlayerActivityPage';
import { InstructorAttemptReviewPage } from './pages/InstructorAttemptReviewPage';
import { AuthProvider, useAuth, type UserRole } from './context/AuthContext';
import { landingPathForRole } from './lib/routing';

function LoadingScreen() {
  return (
    <div className="page">
      <div className="card">
        <p>Loading...</p>
      </div>
    </div>
  );
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <div className="page">
      <div className="card">
        <h2>Profile error</h2>
        <p>{message}</p>
      </div>
    </div>
  );
}

function ProtectedRoute({
  children,
  allowedRoles,
}: {
  allowedRoles?: UserRole[];
  children: JSX.Element;
}) {
  const { session, profile, loadingAuth, loadingProfile, profileError } = useAuth();

  if (loadingAuth || loadingProfile) return <LoadingScreen />;
  if (!session) return <Navigate to="/login" replace />;

  if (profileError) {
    return <ErrorScreen message={profileError} />;
  }

  if (allowedRoles) {
    if (!profile) return <LoadingScreen />;
    if (!allowedRoles.includes(profile.role)) {
      return <Navigate to={landingPathForRole(profile.role)} replace />;
    }
  }

  return children;
}

function RootRedirect() {
  const { session, profile, loadingAuth, loadingProfile } = useAuth();

  if (loadingAuth || loadingProfile) return <LoadingScreen />;
  if (!session) return <Navigate to="/login" replace />;
  if (!profile) return <LoadingScreen />;

  return <Navigate to={landingPathForRole(profile.role)} replace />;
}

function LoginRoute() {
  const { session, profile, loadingAuth, loadingProfile } = useAuth();

  if (loadingAuth || loadingProfile) return <LoadingScreen />;
  if (session && profile) {
    return <Navigate to={landingPathForRole(profile.role)} replace />;
  }

  return <LoginPage />;
}

function AppRoutes() {
  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<LoginRoute />} />
        <Route
          path="/player"
          element={
            <ProtectedRoute>
              <PlayerPage onSignOut={handleSignOut} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/player/activities/:activityId"
          element={
            <ProtectedRoute>
              <PlayerActivityPage onSignOut={handleSignOut} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/instructor"
          element={
            <ProtectedRoute allowedRoles={['instructor', 'admin']}>
              <InstructorPage onSignOut={handleSignOut} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/instructor/attempts/:attemptId"
          element={
            <ProtectedRoute allowedRoles={['instructor', 'admin']}>
              <InstructorAttemptReviewPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminPage onSignOut={handleSignOut} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/simulations/:simulationId"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminSimulationDetailPage onSignOut={handleSignOut} />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<RootRedirect />} />
      </Routes>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

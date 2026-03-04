import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Spinner from './components/ui/Spinner';
import AppShell from './components/layout/AppShell';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import MyTeamPage from './pages/MyTeamPage';
import WeeklyPicksPage from './pages/WeeklyPicksPage';
import StandingsPage from './pages/StandingsPage';
import RaceCalendarPage from './pages/RaceCalendarPage';
import RaceDetailPage from './pages/RaceDetailPage';
import TransferLogPage from './pages/TransferLogPage';
import PlayerProfilePage from './pages/PlayerProfilePage';
import AdminPage from './pages/AdminPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.is_admin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function GuestRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route
          path="/login"
          element={
            <GuestRoute>
              <LoginPage />
            </GuestRoute>
          }
        />

        <Route
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="my-team" element={<MyTeamPage />} />
          <Route path="picks" element={<WeeklyPicksPage />} />
          <Route path="standings" element={<StandingsPage />} />
          <Route path="calendar" element={<RaceCalendarPage />} />
          <Route path="race/:raceId" element={<RaceDetailPage />} />
          <Route path="transfers" element={<TransferLogPage />} />
          <Route path="player/:userId" element={<PlayerProfilePage />} />
          <Route
            path="admin"
            element={
              <AdminRoute>
                <AdminPage />
              </AdminRoute>
            }
          />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}

import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthLayout, DashboardLayout } from '@/layouts';
import { ProtectedRoute } from './ProtectedRoute';
import { Loader } from '@/components/ui';
import { useAuth } from '@/hooks';

// ── Lazy loaded pages ────────────────────────────────────────
const LoginPage = lazy(() => import('@/features/auth/pages/LoginPage'));
const RegisterPage = lazy(() => import('@/features/auth/pages/RegisterPage'));
const HomePage = lazy(() => import('@/features/users/pages/HomePage'));
const ChatView = lazy(() => import('@/features/chat/pages/ChatView'));
const TeamsPage = lazy(() => import('@/features/teams/pages/TeamsPage'));
const ActivityPage = lazy(() => import('@/features/notifications/pages/ActivityPage'));
const AdminDashboard = lazy(() => import('@/features/users/pages/AdminDashboard'));
const UserManagementPage = lazy(() => import('@/features/users/pages/UserManagementPage'));
const DirectMessagesPage = lazy(() => import('@/features/messages/pages/DirectMessagesPage'));
const ProfilePage = lazy(() => import('@/features/profile/pages/ProfilePage'));

const SuspenseWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Suspense fallback={<Loader />}>{children}</Suspense>
);

export const AppRoutes: React.FC = () => {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      {/* ── Auth routes ────────────────────────────────────── */}
      <Route element={<AuthLayout />}>
        <Route
          path="/login"
          element={
            isAuthenticated ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <SuspenseWrapper>
                <LoginPage />
              </SuspenseWrapper>
            )
          }
        />
        <Route
          path="/register"
          element={
            isAuthenticated ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <SuspenseWrapper>
                <RegisterPage />
              </SuspenseWrapper>
            )
          }
        />
      </Route>

      {/* ── Protected dashboard routes ─────────────────────── */}
      <Route
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route
          path="/dashboard"
          element={
            <SuspenseWrapper>
              <HomePage />
            </SuspenseWrapper>
          }
        />
        <Route
          path="/dashboard/chat/:channelId"
          element={
            <SuspenseWrapper>
              <ChatView />
            </SuspenseWrapper>
          }
        />
        <Route
          path="/dashboard/teams"
          element={
            <SuspenseWrapper>
              <TeamsPage />
            </SuspenseWrapper>
          }
        />
        <Route
          path="/dashboard/activity"
          element={
            <SuspenseWrapper>
              <ActivityPage />
            </SuspenseWrapper>
          }
        />
        <Route
          path="/dashboard/admin"
          element={
            <ProtectedRoute requiredRole="admin|director">
              <SuspenseWrapper>
                <AdminDashboard />
              </SuspenseWrapper>
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/admin/users"
          element={
            <ProtectedRoute requiredRole="admin|director|manager">
              <SuspenseWrapper>
                <UserManagementPage />
              </SuspenseWrapper>
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/messages"
          element={
            <SuspenseWrapper>
              <DirectMessagesPage />
            </SuspenseWrapper>
          }
        />
        <Route
          path="/dashboard/profile"
          element={
            <SuspenseWrapper>
              <ProfilePage />
            </SuspenseWrapper>
          }
        />
      </Route>

      {/* ── Catch-all redirect ─────────────────────────────── */}
      <Route
        path="*"
        element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />}
      />
    </Routes>
  );
};

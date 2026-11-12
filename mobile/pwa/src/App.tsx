import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './queryClient';
import { useAuthStore } from './stores/authStore';
import { useThemeStore } from './stores/themeStore';
import { initNetworkListener } from './utils/network';
import { GlobalAlertModal } from './components/organisms/GlobalAlertModal';
import { ToastContainer } from './components/organisms/ToastContainer';
import { GlobalPwaInstallPrompt } from './components/organisms/GlobalPwaInstallPrompt';
import { BottomNavBar } from './components/organisms/BottomNavBar';

// Screens
import { LoginScreen } from './modules/auth/LoginScreen';
import { HomeScreen } from './modules/home/HomeScreen';
import { AttendanceScreen } from './modules/attendance/AttendanceScreen';
import { LeaveScreen } from './modules/leave/LeaveScreen';
import { LeaveRequestScreen } from './modules/leave/LeaveRequestScreen';
import { LeaveHistoryScreen } from './modules/leave/LeaveHistoryScreen';
import { OosScreen } from './modules/oos/OosScreen';
import { OosDetailsScreen } from './modules/oos/OosDetailsScreen';
import { ApprovalsScreen } from './modules/approvals/ApprovalsScreen';
import { ProfileScreen } from './modules/profile/ProfileScreen';
import { AccountScreen } from './modules/account/AccountScreen';
import { SettingsScreen } from './modules/settings/SettingsScreen';
import { SyncIssuesScreen } from './modules/sync/SyncIssuesScreen';
import { NotificationsScreen } from './modules/notifications/NotificationsScreen';

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, authReady } = useAuthStore();
  const location = useLocation();

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-black">
        <div className="animate-pulse text-xs font-bold text-zinc-400">Loading PMS iHRIS...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return (
    <>
      {children}
      <BottomNavBar />
    </>
  );
}

export default function App() {
  const { hydrateToken } = useAuthStore();
  const { applyTheme } = useThemeStore();

  useEffect(() => {
    hydrateToken();
    applyTheme();
    const unsubscribe = initNetworkListener();
    return () => unsubscribe();
  }, [hydrateToken, applyTheme]);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginScreen />} />

          {/* Protected Routes */}
          <Route
            path="/"
            element={
              <ProtectedLayout>
                <HomeScreen />
              </ProtectedLayout>
            }
          />
          <Route
            path="/attendance"
            element={
              <ProtectedLayout>
                <AttendanceScreen />
              </ProtectedLayout>
            }
          />
          <Route
            path="/leave"
            element={
              <ProtectedLayout>
                <LeaveScreen />
              </ProtectedLayout>
            }
          />
          <Route
            path="/leave/apply"
            element={
              <ProtectedLayout>
                <LeaveRequestScreen />
              </ProtectedLayout>
            }
          />
          <Route
            path="/leave/history"
            element={
              <ProtectedLayout>
                <LeaveHistoryScreen />
              </ProtectedLayout>
            }
          />
          <Route
            path="/oos"
            element={
              <ProtectedLayout>
                <OosScreen />
              </ProtectedLayout>
            }
          />
          <Route
            path="/oos/:id"
            element={
              <ProtectedLayout>
                <OosDetailsScreen />
              </ProtectedLayout>
            }
          />
          <Route
            path="/approvals"
            element={
              <ProtectedLayout>
                <ApprovalsScreen />
              </ProtectedLayout>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedLayout>
                <ProfileScreen />
              </ProtectedLayout>
            }
          />
          <Route
            path="/account"
            element={
              <ProtectedLayout>
                <AccountScreen />
              </ProtectedLayout>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedLayout>
                <SettingsScreen />
              </ProtectedLayout>
            }
          />
          <Route
            path="/sync-issues"
            element={
              <ProtectedLayout>
                <SyncIssuesScreen />
              </ProtectedLayout>
            }
          />
          <Route
            path="/notifications"
            element={
              <ProtectedLayout>
                <NotificationsScreen />
              </ProtectedLayout>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

        <GlobalAlertModal />
        <ToastContainer />
        <GlobalPwaInstallPrompt />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

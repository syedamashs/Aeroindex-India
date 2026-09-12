import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { AppProvider } from '@/context/AppContext';
import { Layout } from '@/components/Layout';
import { Toast } from '@/components/ui/Toast';
import { LandingPage } from '@/pages/LandingPage';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { IndexPage } from '@/pages/IndexPage';
import { RoutesPage } from '@/pages/RoutesPage';
import { RouteDetailPage } from '@/pages/RouteDetailPage';
import { AirlinesPage } from '@/pages/AirlinesPage';
import { BookingWindowPage } from '@/pages/BookingWindowPage';
import { MapPage } from '@/pages/MapPage';
import { DataExplorerPage } from '@/pages/DataExplorerPage';
import { AlertsPage } from '@/pages/AlertsPage';
import { MethodologyPage } from '@/pages/MethodologyPage';
import { AuditLogPage } from '@/pages/AuditLogPage';
import type { JSX } from 'react';

function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/index" element={<ProtectedRoute><IndexPage /></ProtectedRoute>} />
      <Route path="/routes" element={<ProtectedRoute><RoutesPage /></ProtectedRoute>} />
      <Route path="/routes/:routeId" element={<ProtectedRoute><RouteDetailPage /></ProtectedRoute>} />
      <Route path="/airlines" element={<ProtectedRoute><AirlinesPage /></ProtectedRoute>} />
      <Route path="/booking-window" element={<ProtectedRoute><BookingWindowPage /></ProtectedRoute>} />
      <Route path="/map" element={<ProtectedRoute><MapPage /></ProtectedRoute>} />
      <Route path="/explorer" element={<ProtectedRoute><DataExplorerPage /></ProtectedRoute>} />
      <Route path="/alerts" element={<ProtectedRoute><AlertsPage /></ProtectedRoute>} />
      <Route path="/methodology" element={<ProtectedRoute><MethodologyPage /></ProtectedRoute>} />
      <Route path="/audit" element={<ProtectedRoute><AuditLogPage /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <BrowserRouter>
          <AppRoutes />
          <Toast />
        </BrowserRouter>
      </AppProvider>
    </AuthProvider>
  );
}

export default App;

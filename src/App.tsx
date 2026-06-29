import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ItemsProvider } from './contexts/ItemsContext';
import { UserSettingsProvider } from './contexts/UserSettingsContext';
import { SearchProcessor } from './components/SearchProcessor';
import { Navbar } from './components/Navbar';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { UploadPage } from './pages/UploadPage';
import { ReviewPage } from './pages/ReviewPage';
import { SettingsPage } from './pages/SettingsPage';
import type { ReactNode } from 'react';

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="loading-full"><div className="spinner" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function HomeRoute() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="loading-full"><div className="spinner" /></div>;
  if (user) return <Navigate to="/dashboard" replace />;
  return <HomePage />;
}

function AppRoutes() {
  return (
    <>
      <SearchProcessor />
      <Navbar />
      <main className="main-content">
        <Routes>
          <Route path="/login"    element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/dashboard"
            element={<ProtectedRoute><DashboardPage /></ProtectedRoute>}
          />
          <Route
            path="/upload"
            element={<ProtectedRoute><UploadPage /></ProtectedRoute>}
          />
          <Route
            path="/review"
            element={<ProtectedRoute><ReviewPage /></ProtectedRoute>}
          />
          <Route
            path="/settings"
            element={<ProtectedRoute><SettingsPage /></ProtectedRoute>}
          />
          <Route path="/" element={<HomeRoute />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <UserSettingsProvider>
          <ItemsProvider>
            <AppRoutes />
          </ItemsProvider>
        </UserSettingsProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

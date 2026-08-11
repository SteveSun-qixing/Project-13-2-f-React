import React, { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { App as AntdApp, ConfigProvider, Result } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { appleTheme } from '@chips/ui';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SiteHeader } from './components/SiteHeader';
import { SiteFooter } from './components/SiteFooter';
import HomePage from './pages/HomePage';
import AboutPage from './pages/AboutPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ProfilePage from './pages/ProfilePage';
import WorkspacePage from './pages/WorkspacePage';
import CardDetailPage from './pages/CardDetailPage';
import BoxDetailPage from './pages/BoxDetailPage';
import HostedPluginSessionPage from './pages/HostedPluginSessionPage';
import AdminRedirectPage from './pages/AdminRedirectPage';
import { getPostAuthPath } from './lib/ui';
import './styles/runtime.css';

type AppRouteMode = 'default' | 'document' | 'immersive';

function resolveAppRouteMode(pathname: string): AppRouteMode {
  if (pathname.startsWith('/host/plugins/')) {
    return 'immersive';
  }

  if (pathname.startsWith('/cards/') || pathname.startsWith('/boxes/')) {
    return 'document';
  }

  return 'default';
}

function isProfileRoute(pathname: string): boolean {
  return /^\/@[^/]+\/?$/.test(pathname);
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div className="page-loader">加载中…</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}

function GuestRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return <div className="page-loader">加载中…</div>;
  }

  if (isAuthenticated && user) {
    return <Navigate to={getPostAuthPath(user)} replace />;
  }

  return <>{children}</>;
}

function RootRedirect() {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return <div className="page-loader">加载中…</div>;
  }

  if (isAuthenticated && user?.role === 'admin') {
    return <Navigate to="/admin" replace />;
  }

  if (isAuthenticated && user) {
    return <Navigate to={`/@${user.username}`} replace />;
  }

  return <HomePage />;
}

function NotFoundPage() {
  return (
    <div className="page-container">
      <Result status="404" title="404" subTitle="没有找到目标内容。" />
    </div>
  );
}

function AppRoutes() {
  const location = useLocation();
  const routeMode = resolveAppRouteMode(location.pathname);

  return (
    <main
      className={[
        'app-shell__main',
        routeMode === 'document' ? 'app-shell__main--document' : '',
        routeMode === 'immersive' ? 'app-shell__main--immersive' : '',
      ].filter(Boolean).join(' ')}
    >
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/about" element={<AboutPage />} />
        <Route
          path="/login"
          element={
            <GuestRoute>
              <LoginPage />
            </GuestRoute>
          }
        />
        <Route
          path="/register"
          element={
            <GuestRoute>
              <RegisterPage />
            </GuestRoute>
          }
        />
        <Route path="/:username" element={<ProfilePage />} />
        <Route path="/admin" element={<AdminRedirectPage />} />
        <Route
          path="/workspace"
          element={
            <ProtectedRoute>
              <WorkspacePage />
            </ProtectedRoute>
          }
        />
        <Route path="/cards/:cardId" element={<CardDetailPage />} />
        <Route path="/host/plugins/:sessionId" element={<HostedPluginSessionPage />} />
        <Route path="/boxes/:boxId" element={<BoxDetailPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </main>
  );
}

function AppChrome() {
  const location = useLocation();
  const routeMode = resolveAppRouteMode(location.pathname);
  const isChromeVisible = routeMode === 'default';
  const shouldShowFooter = isChromeVisible && !isProfileRoute(location.pathname);

  useEffect(() => {
    document.documentElement.setAttribute('data-ccps-route-mode', routeMode);
    document.body.setAttribute('data-ccps-route-mode', routeMode);

    return () => {
      document.documentElement.removeAttribute('data-ccps-route-mode');
      document.body.removeAttribute('data-ccps-route-mode');
    };
  }, [routeMode]);

  return (
    <div
      className={[
        'app-shell',
        routeMode === 'document' ? 'app-shell--document' : '',
        routeMode === 'immersive' ? 'app-shell--immersive' : '',
      ].filter(Boolean).join(' ')}
    >
      {isChromeVisible ? <SiteHeader /> : null}
      <AppRoutes />
      {shouldShowFooter ? <SiteFooter /> : null}
    </div>
  );
}

function App() {
  return (
    <ConfigProvider locale={zhCN} theme={appleTheme}>
      <AntdApp>
        <BrowserRouter>
          <AuthProvider>
            <AppChrome />
          </AuthProvider>
        </BrowserRouter>
      </AntdApp>
    </ConfigProvider>
  );
}

export default App;

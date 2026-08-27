import React, { useEffect } from 'react';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import { App as AntdApp, ConfigProvider, Result } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { appleTheme } from '@chips/ui';
import { SiteHeader } from './components/SiteHeader';
import { SiteFooter } from './components/SiteFooter';
import HomePage from './pages/HomePage';
import AboutPage from './pages/AboutPage';
import WorkspacePage from './pages/WorkspacePage';
import CardDetailPage from './pages/CardDetailPage';
import BoxDetailPage from './pages/BoxDetailPage';
import './styles/runtime.css';

type AppRouteMode = 'default' | 'document';

function resolveAppRouteMode(pathname: string): AppRouteMode {
  if (pathname.startsWith('/cards/') || pathname.startsWith('/boxes/')) {
    return 'document';
  }

  return 'default';
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
      ].filter(Boolean).join(' ')}
    >
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/workspace" element={<WorkspacePage />} />
        <Route path="/cards/:cardId" element={<CardDetailPage />} />
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
      ].filter(Boolean).join(' ')}
    >
      {isChromeVisible ? <SiteHeader /> : null}
      <AppRoutes />
      {isChromeVisible ? <SiteFooter /> : null}
    </div>
  );
}

function App() {
  return (
    <ConfigProvider locale={zhCN} theme={appleTheme}>
      <AntdApp>
        <BrowserRouter>
          <AppChrome />
        </BrowserRouter>
      </AntdApp>
    </ConfigProvider>
  );
}

export default App;

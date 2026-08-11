import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  HashRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { Result } from "antd";
import type { Client } from "chips-sdk";
import { AppChrome } from "@chips/ui";
import { chipsClient } from "../runtime/chips-client";
import { CommunityPreferencesProvider, useAppPreferences } from "../community/contexts/PreferencesContext";
import { AuthProvider, useAuth } from "../community/contexts/AuthContext";
import { SiteHeader } from "../community/components/SiteHeader";
import { SiteFooter } from "../community/components/SiteFooter";
import HomePage from "../community/pages/HomePage";
import AboutPage from "../community/pages/AboutPage";
import LoginPage from "../community/pages/LoginPage";
import RegisterPage from "../community/pages/RegisterPage";
import ProfilePage from "../community/pages/ProfilePage";
import WorkspacePage from "../community/pages/WorkspacePage";
import AdminRedirectPage from "../community/pages/AdminRedirectPage";
import SettingsPage from "../community/pages/SettingsPage";
import { getPostAuthPath } from "../community/lib/ui";
import {
  COMMUNITY_REFRESH_TOKEN_REF,
  configureCommunityApiBaseUrl,
  loadCommunityServerUrl,
  setRefreshTokenReader,
} from "../runtime/community-runtime";
import { useAppCommands } from "../commands/useAppCommands";

function isProfileRoute(pathname: string): boolean {
  return /^\/@[^/]+\/?$/.test(pathname);
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { t } = useAppPreferences();
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div className="page-loader">{t("common.loading")}</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}

function GuestRoute({ children }: { children: ReactNode }) {
  const { t } = useAppPreferences();
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return <div className="page-loader">{t("common.loading")}</div>;
  }

  if (isAuthenticated && user) {
    return <Navigate to={getPostAuthPath(user)} replace />;
  }

  return <>{children}</>;
}

function RootRedirect() {
  const { t } = useAppPreferences();
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return <div className="page-loader">{t("common.loading")}</div>;
  }

  if (isAuthenticated && user?.role === "admin") {
    return <Navigate to="/admin" replace />;
  }

  if (isAuthenticated && user) {
    return <Navigate to={`/@${user.username}`} replace />;
  }

  return <HomePage />;
}

function NotFoundPage() {
  const { t } = useAppPreferences();

  return (
    <div className="page-container">
      <Result status="404" title="404" subTitle={t("detail.notFound")} />
    </div>
  );
}

function AppRoutes() {
  const location = useLocation();
  const isProfile = isProfileRoute(location.pathname);
  const shouldShowHeader = !isProfile;
  const shouldShowFooter = !isProfile;

  return (
    <>
      {shouldShowHeader ? <SiteHeader /> : null}
      <main className="app-shell__main">
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
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
      {shouldShowFooter ? <SiteFooter /> : null}
    </>
  );
}

function AppChromeShell() {
  const navigate = useNavigate();
  useAppCommands({
    openWorkspace: () => navigate("/workspace"),
    openSettings: () => navigate("/settings"),
  });

  return (
    <AppChrome paletteShortcut="Mod+P">
      <AppRoutes />
    </AppChrome>
  );
}

function CommunityBootstrap({ children }: { children: ReactNode }) {
  const client: Client = chipsClient;
  const { t } = useAppPreferences();
  const [ready, setReady] = useState(false);
  const bootstrapRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!bootstrapRef.current) {
      bootstrapRef.current = (async () => {
        const baseUrl = await loadCommunityServerUrl(client);
        configureCommunityApiBaseUrl(baseUrl);
        setRefreshTokenReader(() => client.credential.get(COMMUNITY_REFRESH_TOKEN_REF));
      })().catch((error) => {
        bootstrapRef.current = null;
        throw error;
      });
    }

    void bootstrapRef.current
      .then(() => {
        if (!cancelled) {
          setReady(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setReady(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [client]);

  if (!ready) {
    return <div className="page-loader">{t("common.loading")}</div>;
  }

  return <>{children}</>;
}

export function AppShell() {
  const client: Client = chipsClient;

  return (
    <CommunityPreferencesProvider>
      <CommunityBootstrap>
        <AuthProvider client={client}>
          <HashRouter>
            <AppChromeShell />
          </HashRouter>
        </AuthProvider>
      </CommunityBootstrap>
    </CommunityPreferencesProvider>
  );
}

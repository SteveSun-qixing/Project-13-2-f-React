import React, { useEffect, useMemo, useState } from "react";
import { ChipsThemeProvider, ChipsButton, ChipsInput } from "@chips/component-library";
import { ExamplePanel } from "./components/ExamplePanel";
import { createTranslator, normalizeLocale, type AppLocale } from "./i18n";

type ThemeInfo = {
  themeId?: string;
  displayName?: string;
  version?: string;
};

type ThemeState = {
  themeId: string;
  version: string;
};

const DEFAULT_THEME_STATE: ThemeState = {
  themeId: "chips-official.default-theme",
  version: "1.0.0",
};

function readDocumentThemeState(): ThemeState {
  if (typeof document === "undefined") {
    return DEFAULT_THEME_STATE;
  }

  const root = document.documentElement;
  const themeId = root.getAttribute("data-chips-theme-id");
  const version = root.getAttribute("data-chips-theme-version");

  return {
    themeId: typeof themeId === "string" && themeId.trim().length > 0 ? themeId : DEFAULT_THEME_STATE.themeId,
    version: typeof version === "string" && version.trim().length > 0 ? version : DEFAULT_THEME_STATE.version,
  };
}

function useRuntimeState() {
  const [themeInfo, setThemeInfo] = useState<ThemeInfo | null>(null);
  const [themeState, setThemeState] = useState<ThemeState>(() => readDocumentThemeState());
  const [locale, setLocale] = useState<AppLocale>("zh-CN");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const bridge = typeof window !== "undefined" ? (window as any).chips : undefined;
    if (!bridge || typeof bridge.invoke !== "function") {
      setError("BRIDGE_UNAVAILABLE");
      return;
    }

    let cancelled = false;
    const unsubscribe = typeof bridge.on === "function"
      ? bridge.on("language.changed", (payload: unknown) => {
          if (cancelled) {
            return;
          }
          const nextLocale =
            typeof payload === "string"
              ? payload
              : payload && typeof payload === "object" && "locale" in payload
                ? (payload as { locale?: string }).locale
                : undefined;
          setLocale(normalizeLocale(nextLocale));
        })
      : () => undefined;

    Promise.all([
      bridge.invoke("theme.getCurrent", {}),
      bridge.invoke("i18n.getCurrent", {}),
    ])
      .then(([info, currentLocale]: [ThemeInfo, { locale?: string } | string]) => {
        if (cancelled) {
          return;
        }
        setThemeInfo(info);
        setThemeState({
          themeId: info?.themeId || DEFAULT_THEME_STATE.themeId,
          version: info?.version || DEFAULT_THEME_STATE.version,
        });
        const nextLocale =
          typeof currentLocale === "string"
            ? currentLocale
            : currentLocale?.locale;
        setLocale(normalizeLocale(nextLocale));
      })
      .catch((err: { code?: string; message?: string }) => {
        if (!cancelled) {
          setError(err?.message || "RUNTIME_STATE_LOAD_FAILED");
        }
      });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return { themeInfo, themeState, locale, error };
}

interface HeaderProps {
  subtitle: string;
}

function Header({ subtitle }: HeaderProps) {
  return (
    <header
      data-chips-app="app-standard.header"
      style={{
        padding: "44px 24px 16px",
        borderBottom: "1px solid var(--chips-border-subtle, rgba(17,17,17,0.12))",
        WebkitAppRegion: "drag",
      }}
    >
      <h1 style={{ margin: 0, fontSize: 18 }}>{{ DISPLAY_NAME }}</h1>
      <p style={{ margin: "4px 0 0", fontSize: 12, opacity: 0.8 }}>{subtitle}</p>
    </header>
  );
}

interface MainContentProps {
  error: string | null;
  themeInfo: ThemeInfo | null;
  launchContext: {
    pluginId?: string;
    sessionId?: string;
    launchParams: Record<string, unknown>;
  };
  translate: (key: string) => string;
}

function MainContent({ error, themeInfo, launchContext, translate }: MainContentProps) {
  const resolvedError =
    error === null
      ? null
      : error === "BRIDGE_UNAVAILABLE"
        ? translate("app-standard.bridge.unavailable")
        : error === "RUNTIME_STATE_LOAD_FAILED"
          ? translate("app-standard.bridge.loadError")
          : error;

  return (
    <main
      data-chips-app="app-standard.main"
      style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}
    >
      <section>
        <h2 style={{ fontSize: 14, marginBottom: 8 }}>{translate("app-standard.sections.sampleForm")}</h2>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <ChipsInput placeholder={translate("app-standard.sample.input.placeholder")} />
          <ChipsButton variant="primary">{translate("app-standard.actions.submit")}</ChipsButton>
        </div>
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <h2 style={{ fontSize: 14, marginBottom: 8 }}>{translate("app-standard.sections.bridgeExample")}</h2>
        {resolvedError ? (
          <p style={{ color: "var(--chips-color-danger, #d93025)", fontSize: 12 }}>{resolvedError}</p>
        ) : (
          <>
            <p style={{ fontSize: 12 }}>
              {translate("app-standard.bridge.themeLabel")}：
              <code>
                {themeInfo?.themeId || translate("app-standard.bridge.unknownTheme")} / {themeInfo?.displayName || translate("app-standard.bridge.unknownDisplayName")}
              </code>
            </p>
            <p style={{ fontSize: 12 }}>
              {translate("app-standard.bridge.launchLabel")}：
              <code>
                {launchContext.pluginId || translate("app-standard.bridge.unknownTheme")} / {String(launchContext.launchParams.trigger ?? "manual")}
              </code>
            </p>
          </>
        )}
      </section>

      <ExamplePanel
        title={translate("app-standard.examplePanel.title")}
        description={translate("app-standard.examplePanel.description")}
        actionLabel={translate("app-standard.actions.learnMore")}
      />
    </main>
  );
}

export function App() {
  const themeEventSource = typeof window !== "undefined" ? (window as any).chips : undefined;
  const { themeInfo, themeState, locale, error } = useRuntimeState();
  const translate = useMemo(() => createTranslator(locale), [locale]);
  const launchContext = useMemo(() => {
    const bridge = typeof window !== "undefined" ? (window as any).chips : undefined;
    if (!bridge?.platform || typeof bridge.platform.getLaunchContext !== "function") {
      return { launchParams: {} };
    }
    return bridge.platform.getLaunchContext();
  }, []);

  return (
    <ChipsThemeProvider
      themeId={themeState.themeId}
      version={themeState.version}
      eventSource={themeEventSource}
      eventName="theme.changed"
    >
      <div
        data-chips-app="app-standard.shell"
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          background: "var(--chips-sys-color-surface, #ffffff)",
          color: "var(--chips-sys-color-on-surface, #111111)",
        }}
      >
        <Header subtitle={translate("app-standard.header.subtitle")} />
        <MainContent error={error} themeInfo={themeInfo} launchContext={launchContext} translate={translate} />
      </div>
    </ChipsThemeProvider>
  );
}

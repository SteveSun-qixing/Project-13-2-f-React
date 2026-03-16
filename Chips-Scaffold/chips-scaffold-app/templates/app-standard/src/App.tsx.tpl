import React, { useEffect, useState } from "react";
import { ChipsThemeProvider, ChipsButton, ChipsInput } from "@chips/component-library";
import { createClient } from "chips-sdk";
import { ExamplePanel } from "./components/ExamplePanel";

const chipsClient = createClient();

type ThemeInfo = {
  themeId?: string;
  displayName?: string;
  version?: string;
};

function useChipsThemeInfo() {
  const [themeInfo, setThemeInfo] = useState<ThemeInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    chipsClient.theme
      .getCurrent()
      .then((info: ThemeInfo) => {
        if (!cancelled) {
          setThemeInfo(info);
        }
      })
      .catch((err: { code?: string; message?: string }) => {
        if (!cancelled) {
          setError(err?.message || "获取主题信息失败");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { themeInfo, error };
}

function Header() {
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
      <p style={{ margin: "4px 0 0", fontSize: 12, opacity: 0.8 }}>
        由 chips-scaffold-app 生成的标准应用插件示例。
      </p>
    </header>
  );
}

function MainContent() {
  const { themeInfo, error } = useChipsThemeInfo();

  return (
    <main
      data-chips-app="app-standard.main"
      style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}
    >
      <section>
        <h2 style={{ fontSize: 14, marginBottom: 8 }}>示例表单</h2>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <ChipsInput placeholderKey="app-standard.sample.input.placeholder" />
          <ChipsButton variant="primary">提交</ChipsButton>
        </div>
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <h2 style={{ fontSize: 14, marginBottom: 8 }}>SDK 调用示例</h2>
        {error ? (
          <p style={{ color: "var(--chips-color-danger, #d93025)", fontSize: 12 }}>{error}</p>
        ) : (
          <p style={{ fontSize: 12 }}>
            当前主题：
            <code>
              {themeInfo?.themeId || "未知"} / {themeInfo?.displayName || "Unknown"}
            </code>
          </p>
        )}
      </section>

      <ExamplePanel title="组件库示例面板" />
    </main>
  );
}

export function App() {
  const themeEventSource = typeof window !== "undefined" ? (window as any).chips : undefined;

  return (
    <ChipsThemeProvider
      themeId="chips-official.default-theme"
      version="1.0.0"
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
        <Header />
        <MainContent />
      </div>
    </ChipsThemeProvider>
  );
}

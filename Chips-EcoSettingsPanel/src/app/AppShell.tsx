import React from "react";
import { Button, Select, Spin } from "antd";
import { AppChrome } from "@chips/ui";
import { useI18n } from "./providers/I18nProvider";
import { NotificationStack } from "../shared/ui/NotificationStack";
import { SettingsSidebar, type SettingsSidebarGroup } from "../shared/ui/SettingsSidebar";
import { isSettingsSceneId, sceneDefinitions, type SettingsSceneId } from "./scene-registry";
import { useAppRuntime } from "./AppRuntimeProvider";
import { SETTINGS_COMMAND_IDS } from "../commands/settings-commands";
import { useSettingsCommands } from "../commands/useSettingsCommands";
import { getSettingsSceneIcon } from "./settings-scene-icons";

export function AppShell(): React.ReactElement {
  const { t } = useI18n();
  const runtime = useAppRuntime();
  const { activeScene, activeSceneId, ready, runtimeError, setActiveSceneId, refreshRuntimeState } = runtime;
  const commands = useSettingsCommands(runtime.client);
  const handledInvocationRef = React.useRef<string | null>(null);
  const [navQuery, setNavQuery] = React.useState("");

  const mobileSceneOptions = React.useMemo(() => {
    return sceneDefinitions.map((scene) => ({
      value: scene.id,
      label: scene.title,
    }));
  }, []);

  const feedbackItems = React.useMemo(() => {
    if (!runtimeError) {
      return [];
    }
    return [
      {
        id: runtimeError.code,
        tone: "error" as const,
        title: t("settingsPanel.feedback.runtimeErrorTitle"),
        message: runtimeError.message,
        durationMs: 0,
      },
    ];
  }, [runtimeError, t]);

  const sidebarGroups = React.useMemo<SettingsSidebarGroup[]>(() => {
    const groups: SettingsSidebarGroup[] = [];
    sceneDefinitions.forEach((scene) => {
      let group = groups.find((entry) => entry.key === scene.category);
      if (!group) {
        group = { key: scene.category, label: scene.category, items: [] };
        groups.push(group);
      }
      group.items.push({
        id: scene.id,
        title: scene.title,
        summary: scene.summary,
        icon: getSettingsSceneIcon(scene.id),
      });
    });
    return groups;
  }, []);

  React.useEffect(() => {
    if (!commands.lastInvoked) {
      return;
    }

    const invocationKey = commands.lastInvoked.invocationId ?? `${commands.lastInvoked.commandId}:${commands.lastInvoked.source}`;
    if (handledInvocationRef.current === invocationKey) {
      return;
    }
    handledInvocationRef.current = invocationKey;
    setActiveSceneId(commands.lastInvoked.sceneId);
  }, [commands.lastInvoked, setActiveSceneId]);

  const invokeSceneCommand = React.useCallback((sceneId: SettingsSceneId) => {
    void commands.invokeCommand(SETTINGS_COMMAND_IDS[sceneId], "api");
  }, [commands]);

  const handleSidebarSelect = (sceneId: string): void => {
    if (isSettingsSceneId(sceneId)) {
      invokeSceneCommand(sceneId);
    }
  };

  return (
    <AppChrome paletteShortcut="Mod+P" contentStyle={{ overflow: "hidden" }}>
      <div className="settings-app-shell" data-app-id={runtime.environment.appId} data-scene-id={activeSceneId}>
        <aside className="settings-app-shell__sidebar" aria-label={t("settingsPanel.menu.ariaLabel")}>
          <SettingsSidebar
            groups={sidebarGroups}
            selectedId={activeSceneId}
            searchValue={navQuery}
            searchPlaceholder={t("settingsPanel.menu.searchPlaceholder")}
            searchAriaLabel={t("settingsPanel.menu.ariaLabel")}
            emptyText={t("settingsPanel.menu.searchEmpty")}
            onSearchChange={setNavQuery}
            onSelect={handleSidebarSelect}
          />
        </aside>
        <main className="settings-app-shell__detail">
          <div className="settings-app-shell__content">
            <div className="settings-mobile-nav">
              <span className="settings-mobile-nav__label">{t("settingsPanel.menu.mobileLabel")}</span>
              <Select
                value={activeScene.id}
                aria-label={t("settingsPanel.menu.mobileAriaLabel")}
                options={mobileSceneOptions}
                onChange={(nextValue) => invokeSceneCommand(nextValue as SettingsSceneId)}
                className="settings-mobile-nav__select"
              />
              <span className="settings-mobile-nav__summary">{activeScene.summary}</span>
            </div>
            <NotificationStack
              ariaLabel={t("settingsPanel.feedback.ariaLabel")}
              closeButtonLabel={t("settingsPanel.common.close")}
              items={feedbackItems}
            />
            {!ready ? (
              <div className="settings-app-shell__loading" role="status" aria-label={t("settingsPanel.app.loading")}>
                <Spin />
                <span>{t("settingsPanel.app.loading")}</span>
              </div>
            ) : (
              <div className="settings-app-shell__scene">{activeScene.render()}</div>
            )}
            {runtimeError ? (
              <div className="settings-app-shell__footer-action">
                <Button onClick={() => void refreshRuntimeState()}>
                  {t("settingsPanel.app.retry")}
                </Button>
              </div>
            ) : null}
          </div>
        </main>
      </div>
    </AppChrome>
  );
}

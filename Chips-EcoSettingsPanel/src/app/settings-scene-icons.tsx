import type { ReactNode } from "react";
import {
  AppstoreAddOutlined,
  AppstoreOutlined,
  BlockOutlined,
  DashboardOutlined,
  FolderOpenOutlined,
  LayoutOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import type { SettingsSceneId } from "./scene-registry";

export interface SettingsSceneIcon {
  name: string;
  tone: string;
  icon: ReactNode;
}

export const SETTINGS_SCENE_ICONS: Record<SettingsSceneId, SettingsSceneIcon> = {
  "app-plugins": { name: "apps", tone: "blue", icon: <AppstoreOutlined /> },
  "card-plugins": { name: "dashboard_customize", tone: "green", icon: <DashboardOutlined /> },
  "layout-plugins": { name: "view_quilt", tone: "purple", icon: <LayoutOutlined /> },
  "module-plugins": { name: "extension", tone: "orange", icon: <BlockOutlined /> },
  "file-open": { name: "file_open", tone: "indigo", icon: <FolderOpenOutlined /> },
  "preview-quality": { name: "speed", tone: "indigo", icon: <ThunderboltOutlined /> },
  "component-gallery": { name: "component_gallery", tone: "teal", icon: <AppstoreAddOutlined /> },
};

export function getSettingsSceneIconName(sceneId: SettingsSceneId): string {
  return SETTINGS_SCENE_ICONS[sceneId].name;
}

export function getSettingsSceneIconTone(sceneId: SettingsSceneId): string {
  return SETTINGS_SCENE_ICONS[sceneId].tone;
}

export function getSettingsSceneIcon(sceneId: SettingsSceneId): ReactNode {
  const { tone, icon } = SETTINGS_SCENE_ICONS[sceneId];
  return <span className={`settings-scene-tile settings-scene-tile--${tone}`} aria-hidden="true">{icon}</span>;
}

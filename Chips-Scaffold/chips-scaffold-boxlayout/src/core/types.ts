import { Stats } from "node:fs";

export interface BoxlayoutScaffoldTemplateMeta {
  id: string;
  name: string;
  description: string;
  version: string;
  supports?: {
    sdk?: boolean;
    uiKit?: "antd";
  };
}

export interface CreateBoxlayoutProjectOptions {
  projectName: string;
  targetDir: string;
  templateId: string;
  pluginId: string;
  layoutType: string;
  displayName: string;
  description: string;
  version: string;
  authorName?: string;
  authorEmail?: string;
}

export interface TemplateContext {
  PROJECT_NAME: string;
  TARGET_DIR: string;
  TEMPLATE_ID: string;
  PLUGIN_ID: string;
  LAYOUT_TYPE: string;
  DISPLAY_NAME: string;
  DESCRIPTION: string;
  VERSION: string;
  AUTHOR_NAME?: string;
  AUTHOR_EMAIL?: string;
}

export interface StandardError extends Error {
  code: string;
  details?: unknown;
}

export interface TemplateFileInfo {
  absolutePath: string;
  relativePath: string;
  stats: Stats;
}

export interface CreateBoxlayoutProjectResult {
  projectDir: string;
  templateId: string;
  filesCreated: number;
}

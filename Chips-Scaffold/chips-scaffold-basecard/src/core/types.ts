import { Stats } from "node:fs";

export interface BasecardScaffoldTemplateMeta {
  id: string;
  name: string;
  description: string;
  version: string;
  supports?: {
    sdk?: boolean;
    uiKit?: "antd";
  };
}

export interface CreateBasecardProjectOptions {
  projectName: string;
  targetDir: string;
  templateId: string;
  pluginId: string;
  cardType: string;
  displayName: string;
  version: string;
  authorName?: string;
  authorEmail?: string;
}

export interface TemplateContext {
  PROJECT_NAME: string;
  TARGET_DIR: string;
  TEMPLATE_ID: string;
  PLUGIN_ID: string;
  CARD_TYPE: string;
  DISPLAY_NAME: string;
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

export interface CreateBasecardProjectResult {
  projectDir: string;
  templateId: string;
  filesCreated: number;
}


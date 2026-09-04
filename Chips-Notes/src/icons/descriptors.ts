import type { IconDescriptor } from "chips-sdk";
import type { LayoutType } from "../types/editor";
import type { WorkspaceFile } from "../types/workspace";

export function icon(name: string, overrides: Partial<IconDescriptor> = {}): IconDescriptor {
  return {
    name,
    decorative: true,
    opsz: 24,
    ...overrides,
  };
}

export const ENGINE_ICONS = {
  add: icon("add"),
  apps: icon("apps"),
  box: icon("inventory_2"),
  canvas: icon("all_inclusive"),
  card: icon("style"),
  check: icon("check"),
  chevronDown: icon("keyboard_arrow_down"),
  chevronLeft: icon("keyboard_arrow_left"),
  chevronRight: icon("keyboard_arrow_right"),
  chevronUp: icon("keyboard_arrow_up"),
  close: icon("close"),
  code: icon("code"),
  copy: icon("content_copy"),
  cut: icon("content_cut"),
  delete: icon("delete"),
  document: icon("draft"),
  download: icon("download"),
  edit: icon("edit"),
  empty: icon("inbox"),
  fileManager: icon("folder"),
  folderClosed: icon("folder"),
  folderOpen: icon("folder_open"),
  format: icon("auto_fix_high"),
  history: icon("history"),
  html: icon("html"),
  image: icon("image"),
  info: icon("info"),
  keyboard: icon("keyboard"),
  layout: icon("dashboard_customize"),
  link: icon("link"),
  loading: icon("progress_activity"),
  lock: icon("lock"),
  lockOpen: icon("lock_open"),
  moon: icon("dark_mode"),
  paste: icon("content_paste"),
  pdf: icon("picture_as_pdf"),
  palette: icon("palette"),
  preview: icon("visibility"),
  refresh: icon("refresh"),
  redo: icon("redo"),
  remove: icon("remove"),
  reset: icon("restart_alt"),
  search: icon("search"),
  settings: icon("settings"),
  shortcuts: icon("keyboard_command_key"),
  sun: icon("light_mode"),
  theme: icon("palette"),
  undo: icon("undo"),
  upload: icon("upload_file"),
  warning: icon("warning"),
  workbench: icon("dashboard_customize"),
  zip: icon("folder_zip"),
} as const;

export function getWorkspaceFileIcon(file: Pick<WorkspaceFile, "type" | "expanded" | "extension" | "mimeType" | "category">): IconDescriptor {
  if (file.type === "folder") {
    return file.expanded ? ENGINE_ICONS.folderOpen : ENGINE_ICONS.folderClosed;
  }
  if (file.type === "card") {
    return ENGINE_ICONS.card;
  }
  if (file.type === "box") {
    return ENGINE_ICONS.box;
  }
  if (file.category === "image" || file.mimeType?.startsWith("image/")) {
    return ENGINE_ICONS.image;
  }
  if (file.extension === ".pdf" || file.mimeType === "application/pdf") {
    return ENGINE_ICONS.pdf;
  }
  if (file.category === "archive" || [".zip", ".7z", ".rar", ".tar", ".gz"].includes(file.extension ?? "")) {
    return ENGINE_ICONS.zip;
  }
  if (file.category === "html" || file.extension === ".html" || file.extension === ".htm") {
    return ENGINE_ICONS.html;
  }
  return ENGINE_ICONS.document;
}

export function getToolWindowIcon(component: string): IconDescriptor {
  switch (component) {
    case "FileManager":
      return ENGINE_ICONS.fileManager;
    case "EditPanel":
      return ENGINE_ICONS.edit;
    case "CardBoxLibrary":
      return ENGINE_ICONS.apps;
    default:
      return ENGINE_ICONS.settings;
  }
}

export function getLayoutSwitcherIcon(currentLayout: LayoutType): IconDescriptor {
  return currentLayout === "infinite-canvas"
    ? ENGINE_ICONS.workbench
    : ENGINE_ICONS.canvas;
}

export function getThemeSwitcherIcon(themeId: string): IconDescriptor {
  return themeId.includes("dark") ? ENGINE_ICONS.sun : ENGINE_ICONS.moon;
}

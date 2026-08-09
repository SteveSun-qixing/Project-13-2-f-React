import {
  BoldOutlined,
  ClearOutlined,
  CodeOutlined,
  ItalicOutlined,
  LinkOutlined,
  MinusOutlined,
  OrderedListOutlined,
  UnorderedListOutlined,
} from "@ant-design/icons";
import {
  Editor,
  defaultValueCtx,
  editorViewCtx,
  editorViewOptionsCtx,
  rootCtx,
} from "@milkdown/core";
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import type { Editor as MilkdownEditor } from "@milkdown/core";
import { listener, listenerCtx } from "@milkdown/plugin-listener";
import {
  commonmark,
  insertHrCommand,
  toggleEmphasisCommand,
  toggleInlineCodeCommand,
  toggleLinkCommand,
  toggleStrongCommand,
  turnIntoTextCommand,
  wrapInBlockquoteCommand,
  wrapInBulletListCommand,
  wrapInHeadingCommand,
  wrapInOrderedListCommand,
} from "@milkdown/preset-commonmark";
import { gfm } from "@milkdown/preset-gfm";
import { TextSelection, type Selection } from "@milkdown/prose/state";
import type { EditorState } from "@milkdown/prose/state";
import { callCommand, getMarkdown, insertPos, replaceAll, replaceRange } from "@milkdown/utils";
import type { BasecardResourceImportRequest, BasecardResourceImportResult } from "../index";
import { formatMessage } from "../lib/messages";
import {
  createFileBasecardConfig,
  createInlineBasecardConfig,
  normalizeBasecardConfig,
  validateBasecardConfig,
  type BasecardConfig,
} from "../schema/card-config";
import { configureRichTextMarkdown, richTextMarkdownPlugins } from "../shared/markdown-extensions";
import { loadMarkdownFromConfig, rewriteRelativeResourceUrls } from "../shared/resource-links";
import {
  countUnicodeCharacters,
  createRichTextMarkdownFileName,
  extractPlainTextFromMarkdown,
  hasMeaningfulMarkdownContent,
  normalizeMarkdown,
  shouldUseFileStorage,
} from "../shared/utils";

export interface BasecardEditorProps {
  initialConfig: BasecardConfig;
  onChange: (next: BasecardConfig) => void;
  resolveResourceUrl?: (resourcePath: string) => Promise<string>;
  releaseResourceUrl?: (resourcePath: string) => Promise<void> | void;
  importResource?: (
    input: BasecardResourceImportRequest,
  ) => Promise<BasecardResourceImportResult>;
  deleteResource?: (resourcePath: string) => Promise<void>;
}

type EditorRoot = HTMLElement & {
  __chipsDispose?: () => void;
};

type ReactIslandHost = HTMLElement & {
  __chipsReactRoot?: Root;
};

type ToolbarIconName =
  | "bold"
  | "italic"
  | "code"
  | "link"
  | "clear"
  | "paragraph"
  | "h1"
  | "h2"
  | "h3"
  | "blockquote"
  | "orderedList"
  | "unorderedList"
  | "divider";

type ToolbarButton = {
  key: string;
  labelKey: string;
  icon: ToolbarIconName;
  run: (controller: EditorController) => void | Promise<void>;
};

type ContextMenuAction = {
  key: string;
  labelKey: string;
  icon: ToolbarIconName;
  run: (controller: EditorController) => void | Promise<void>;
};

type SelectionSnapshot = {
  from: number;
  to: number;
};

type EditorController = {
  root: EditorRoot;
  surfaceFrame: HTMLDivElement;
  editorHost: HTMLDivElement;
  scrollSurface: HTMLDivElement;
  floatingToolbar: HTMLDivElement;
  tooltipLayer: HTMLDivElement;
  tooltipContent: HTMLDivElement;
  tooltipArrow: HTMLDivElement;
  contextMenu: HTMLDivElement;
  contextMenuContent: HTMLDivElement;
  errorList: HTMLUListElement;
  locale: string;
  theme: string;
  props: BasecardEditorProps;
  editor?: MilkdownEditor;
  disposed: boolean;
  focused: boolean;
  currentMarkdown: string;
  currentFilePath?: string;
  sessionFileName: string;
  lastCommittedSignature: string;
  lastResolvedResources: Set<string>;
  isComposing: boolean;
  isImporting: boolean;
  rerunCommitAfterImport: boolean;
  previewTimer?: number;
  pendingErrors: string[];
  selectionSnapshot?: SelectionSnapshot;
  tooltipTrigger?: HTMLElement;
  handleWindowResize: () => void;
  handleDocumentPointerDown: (event: PointerEvent) => void;
  handleDocumentKeyDown: (event: KeyboardEvent) => void;
  handleWindowBlur: () => void;
};

const EDITOR_STYLE_TEXT = `
html, body {
  margin: 0;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: #ffffff;
}

#chips-basecard-editor-root {
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  overflow: hidden;
}

.chips-basecard-editor {
  position: relative;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: visible;
  padding: 14px 16px 16px;
  background: #ffffff;
  color: #1d1d1f;
  font: 14px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  isolation: isolate;
}

.chips-basecard-editor *,
.chips-basecard-editor *::before,
.chips-basecard-editor *::after {
  box-sizing: border-box;
}

.chips-basecard-editor__surface-frame {
  position: relative;
  flex: 1;
  min-height: 0;
  width: 100%;
  overflow: visible;
}

.chips-basecard-editor__surface {
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: auto;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  overscroll-behavior: contain;
}

.chips-basecard-editor__editor-host {
  min-height: 100%;
  padding: 20px 24px 56px;
  cursor: text;
}

.chips-basecard-editor__editor-host .milkdown,
.chips-basecard-editor__editor-host .milkdown .editor {
  background: transparent;
}

.chips-basecard-editor__editor-host .ProseMirror {
  min-height: 100%;
  outline: none;
  color: inherit;
  white-space: break-spaces;
  word-break: break-word;
  cursor: text;
}

.chips-basecard-editor__editor-host .ProseMirror > :first-child {
  margin-top: 0;
}

.chips-basecard-editor__editor-host .ProseMirror > :last-child {
  margin-bottom: 0;
}

.chips-basecard-editor__editor-host .ProseMirror p,
.chips-basecard-editor__editor-host .ProseMirror ul,
.chips-basecard-editor__editor-host .ProseMirror ol,
.chips-basecard-editor__editor-host .ProseMirror blockquote,
.chips-basecard-editor__editor-host .ProseMirror h1,
.chips-basecard-editor__editor-host .ProseMirror h2,
.chips-basecard-editor__editor-host .ProseMirror h3,
.chips-basecard-editor__editor-host .ProseMirror h4,
.chips-basecard-editor__editor-host .ProseMirror h5,
.chips-basecard-editor__editor-host .ProseMirror h6 {
  margin: 0 0 12px;
}

.chips-basecard-editor__editor-host .ProseMirror blockquote {
  margin-left: 0;
  padding-left: 14px;
  border-left: 3px solid rgba(10, 132, 255, 0.28);
  color: #6e6e73;
}

.chips-basecard-editor__editor-host .ProseMirror del {
  text-decoration-thickness: 1.5px;
}

.chips-basecard-editor__editor-host .ProseMirror u,
.chips-basecard-editor__editor-host .ProseMirror ins {
  text-decoration-thickness: 1.5px;
  text-decoration-skip-ink: auto;
}

.chips-basecard-editor__editor-host .ProseMirror mark {
  padding: 0 0.18em;
  border-radius: 0.28em;
  background: color-mix(in srgb, #ffcc00 30%, #ffffff);
  color: inherit;
}

.chips-basecard-editor__editor-host .ProseMirror sup,
.chips-basecard-editor__editor-host .ProseMirror sub {
  font-size: 0.78em;
  line-height: 0;
}

.chips-basecard-editor__editor-host .ProseMirror code {
  padding: 2px 6px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.08);
  font-family: "SFMono-Regular", Consolas, monospace;
  font-size: 0.92em;
}

.chips-basecard-editor__editor-host .ProseMirror img {
  max-width: 100%;
  height: auto;
  border-radius: 12px;
}

.chips-basecard-editor__editor-host .ProseMirror pre {
  margin: 0 0 16px;
  padding: 14px 16px;
  overflow-x: auto;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 16px;
  background: #f2f2f7;
  color: #1d1d1f;
  white-space: pre-wrap;
}

.chips-basecard-editor__editor-host .ProseMirror pre code {
  padding: 0;
  border-radius: 0;
  background: transparent;
  font-size: 0.95em;
}

.chips-basecard-editor__editor-host .ProseMirror table {
  width: 100%;
  margin: 0 0 16px;
  border-collapse: collapse;
  table-layout: fixed;
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 14px;
}

.chips-basecard-editor__editor-host .ProseMirror th,
.chips-basecard-editor__editor-host .ProseMirror td {
  padding: 10px 12px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  text-align: left;
  vertical-align: top;
}

.chips-basecard-editor__editor-host .ProseMirror th {
  background: color-mix(in srgb, #0a84ff 7%, #f2f2f7);
  font-weight: 600;
}

.chips-basecard-editor__editor-host .ProseMirror input[type="checkbox"] {
  margin-right: 8px;
  pointer-events: none;
}

.chips-basecard-editor__editor-host .ProseMirror .chips-richtext-math {
  overflow-x: auto;
}

.chips-basecard-editor__editor-host .ProseMirror .chips-richtext-math--inline {
  display: inline-flex;
  align-items: baseline;
  max-width: 100%;
}

.chips-basecard-editor__editor-host .ProseMirror .chips-richtext-math--block {
  margin: 0 0 16px;
  padding: 14px 16px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 16px;
  background: #f2f2f7;
}

.chips-basecard-editor__editor-host .ProseMirror .chips-richtext-math__fallback {
  margin: 0;
  white-space: pre-wrap;
  font: 0.94em/1.6 "SFMono-Regular", Consolas, monospace;
}

.chips-basecard-editor__floating-toolbar {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 60;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: min(320px, calc(100% - 32px));
  padding: 4px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 14px;
  background: color-mix(in srgb, #ffffff 94%, transparent);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.14);
  transform: translate(-50%, calc(-100% - 10px));
  backdrop-filter: blur(16px);
}

.chips-basecard-editor__floating-toolbar[data-side="bottom"] {
  transform: translate(-50%, 10px);
}

.chips-basecard-editor__floating-toolbar[hidden] {
  display: none;
}

.chips-basecard-editor__toolbar-button {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  min-width: 40px;
  height: 40px;
  min-height: 40px;
  padding: 0;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 9px;
  background: #ffffff;
  color: #1d1d1f;
  font: inherit;
  cursor: pointer;
  outline: none;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease,
    background-color 0.15s ease,
    transform 0.15s ease;
}

.chips-basecard-editor__toolbar-button[data-state="hover"],
.chips-basecard-editor__toolbar-button:hover {
  border-color: rgba(10, 132, 255, 0.55);
  transform: translateY(-1px);
}

.chips-basecard-editor__toolbar-button[data-state="active"] {
  background: color-mix(in srgb, #0a84ff 8%, #ffffff);
  transform: translateY(0);
}

.chips-basecard-editor__toolbar-button[data-state="focus"],
.chips-basecard-editor__toolbar-button:focus-visible {
  border-color: rgba(10, 132, 255, 0.85);
  box-shadow: 0 0 0 3px rgba(10, 132, 255, 0.16);
}

.chips-basecard-editor__toolbar-button-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  font-size: 13px;
  line-height: 1;
}

.chips-basecard-editor__tooltip-layer {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 80;
  pointer-events: none;
}

.chips-basecard-editor__tooltip-layer[hidden] {
  display: none;
}

[data-scope="tooltip"][data-part="content"] {
  position: absolute;
  transform: translate(-50%, calc(-100% - 10px));
  padding: 4px 8px;
  white-space: nowrap;
  border-radius: 8px;
  background-color: rgba(0, 0, 0, 0.92);
  color: #ffffff;
  font-size: 12px;
  line-height: 1.2;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.16);
}

.chips-basecard-editor__tooltip-layer[data-side="bottom"] [data-scope="tooltip"][data-part="content"] {
  transform: translate(-50%, 10px);
}

[data-scope="tooltip"][data-part="content"][data-state="focus"] {
  outline: 2px solid rgba(10, 132, 255, 0.48);
  outline-offset: 2px;
}

[data-scope="tooltip"][data-part="arrow"] {
  position: absolute;
  width: 8px;
  height: 8px;
  transform: translate(-50%, calc(-100% - 5px)) rotate(45deg);
  background-color: rgba(0, 0, 0, 0.92);
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.08);
}

.chips-basecard-editor__tooltip-layer[data-side="bottom"] [data-scope="tooltip"][data-part="arrow"] {
  transform: translate(-50%, 5px) rotate(45deg);
}

.chips-basecard-editor__context-menu {
  position: absolute;
  z-index: 70;
}

.chips-basecard-editor__context-menu[hidden] {
  display: none;
}

[data-scope="menu"][data-part="content"] {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 220px;
  padding: 6px;
  border-radius: 12px;
  background-color: #ffffff;
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.18);
}

[data-scope="menu"][data-part="content"][data-state="focus"] {
  outline: 2px solid rgba(10, 132, 255, 0.48);
  outline-offset: 2px;
}

[data-scope="menu"][data-part="item"] {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 40px;
  padding: 0 12px;
  border: 0;
  background: transparent;
  border-radius: 10px;
  color: inherit;
  text-align: left;
  cursor: pointer;
  outline: none;
  transition: background-color 0.15s ease, color 0.15s ease;
}

[data-scope="menu"][data-part="item"][data-state="hover"],
[data-scope="menu"][data-part="item"]:hover {
  background-color: rgba(10, 132, 255, 0.1);
}

[data-scope="menu"][data-part="item"][data-state="active"] {
  background-color: rgba(10, 132, 255, 0.16);
}

[data-scope="menu"][data-part="item"][data-state="focus"],
[data-scope="menu"][data-part="item"]:focus-visible {
  box-shadow: 0 0 0 2px color-mix(in srgb, #0a84ff 35%, transparent);
}

.chips-basecard-editor__context-menu-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  flex: 0 0 18px;
  font-size: 15px;
  line-height: 1;
}

.chips-basecard-editor__context-menu-label {
  min-width: 0;
  flex: 1;
}

.chips-basecard-editor__errors {
  flex: 0 0 auto;
  min-height: 0;
  padding: 10px 16px 14px;
  font-size: 13px;
  color: #ff3b30;
}

.chips-basecard-editor__errors[hidden] {
  display: none;
}

.chips-basecard-editor__errors-list {
  margin: 0;
  padding-left: 18px;
}

`;

const PREVIEW_COMMIT_DELAY_MS = 120;

const TOOLBAR_BUTTONS: ToolbarButton[] = [
  {
    key: "bold",
    labelKey: "basecard.toolbar.bold",
    icon: "bold",
    run: (controller) => {
      runCommand(controller, toggleStrongCommand.key);
    },
  },
  {
    key: "italic",
    labelKey: "basecard.toolbar.italic",
    icon: "italic",
    run: (controller) => {
      runCommand(controller, toggleEmphasisCommand.key);
    },
  },
  {
    key: "code",
    labelKey: "basecard.toolbar.code",
    icon: "code",
    run: (controller) => {
      runCommand(controller, toggleInlineCodeCommand.key);
    },
  },
  {
    key: "link",
    labelKey: "basecard.toolbar.link",
    icon: "link",
    run: async (controller) => {
      const url = askUserForValue(formatMessage("basecard.prompt.linkUrl"));
      if (!url) {
        return;
      }
      runCommand(controller, toggleLinkCommand.key, { href: url });
    },
  },
  {
    key: "clear",
    labelKey: "basecard.toolbar.clear",
    icon: "clear",
    run: (controller) => {
      clearInlineFormatting(controller);
    },
  },
];

const CONTEXT_MENU_ACTIONS: ContextMenuAction[] = [
  {
    key: "paragraph",
    labelKey: "basecard.block.paragraph",
    icon: "paragraph",
    run: (controller) => {
      runCommand(controller, turnIntoTextCommand.key);
    },
  },
  {
    key: "h1",
    labelKey: "basecard.block.h1",
    icon: "h1",
    run: (controller) => {
      runCommand(controller, wrapInHeadingCommand.key, 1);
    },
  },
  {
    key: "h2",
    labelKey: "basecard.block.h2",
    icon: "h2",
    run: (controller) => {
      runCommand(controller, wrapInHeadingCommand.key, 2);
    },
  },
  {
    key: "h3",
    labelKey: "basecard.block.h3",
    icon: "h3",
    run: (controller) => {
      runCommand(controller, wrapInHeadingCommand.key, 3);
    },
  },
  {
    key: "blockquote",
    labelKey: "basecard.toolbar.blockquote",
    icon: "blockquote",
    run: (controller) => {
      runCommand(controller, wrapInBlockquoteCommand.key);
    },
  },
  {
    key: "orderedList",
    labelKey: "basecard.toolbar.orderedList",
    icon: "orderedList",
    run: (controller) => {
      runCommand(controller, wrapInOrderedListCommand.key);
    },
  },
  {
    key: "unorderedList",
    labelKey: "basecard.toolbar.unorderedList",
    icon: "unorderedList",
    run: (controller) => {
      runCommand(controller, wrapInBulletListCommand.key);
    },
  },
  {
    key: "divider",
    labelKey: "basecard.toolbar.divider",
    icon: "divider",
    run: (controller) => {
      runCommand(controller, insertHrCommand.key);
    },
  },
  {
    key: "clear",
    labelKey: "basecard.toolbar.clear",
    icon: "clear",
    run: (controller) => {
      clearInlineFormatting(controller);
    },
  },
];

const TOOLBAR_ICON_COMPONENTS: Partial<
  Record<ToolbarIconName, React.ComponentType<{ style?: React.CSSProperties }>>
> = {
  bold: BoldOutlined,
  italic: ItalicOutlined,
  code: CodeOutlined,
  link: LinkOutlined,
  clear: ClearOutlined,
  orderedList: OrderedListOutlined,
  unorderedList: UnorderedListOutlined,
  divider: MinusOutlined,
};

const TOOLBAR_ICON_GLYPHS: Partial<Record<ToolbarIconName, string>> = {
  paragraph: "¶",
  h1: "H1",
  h2: "H2",
  h3: "H3",
  blockquote: "❝",
};

function askUserForValue(label: string): string | null {
  if (typeof window === "undefined" || typeof window.prompt !== "function") {
    return null;
  }
  const value = window.prompt(label);
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function mountRuntimeIcon(host: ReactIslandHost, element: React.ReactElement): void {
  host.__chipsReactRoot?.unmount();
  const root = createRoot(host);
  host.__chipsReactRoot = root;
  root.render(element);
}

function disposeRuntimeIcon(host: ReactIslandHost): void {
  host.__chipsReactRoot?.unmount();
  host.__chipsReactRoot = undefined;
}

function createRuntimeIconElement(
  icon: ToolbarIconName,
  className: string,
  sizePx: number,
): HTMLSpanElement {
  const node = document.createElement("span") as ReactIslandHost;
  node.className = `${className} chips-basecard-editor__react-icon`;
  node.setAttribute("aria-hidden", "true");

  const iconComponent = TOOLBAR_ICON_COMPONENTS[icon];
  if (iconComponent) {
    mountRuntimeIcon(
      node,
      React.createElement(iconComponent, { style: { fontSize: sizePx } }),
    );
  } else {
    node.style.fontSize = `${sizePx}px`;
    node.style.lineHeight = "1";
    node.textContent = TOOLBAR_ICON_GLYPHS[icon] ?? "";
  }

  return node;
}

function applyInteractiveState(node: HTMLElement): void {
  node.dataset.state = "idle";
  node.addEventListener("mouseenter", () => {
    node.dataset.state = "hover";
  });
  node.addEventListener("mouseleave", () => {
    node.dataset.state = "idle";
  });
  node.addEventListener("focus", () => {
    node.dataset.state = "focus";
  });
  node.addEventListener("blur", () => {
    node.dataset.state = "idle";
  });
  node.addEventListener("mousedown", () => {
    node.dataset.state = "active";
  });
  node.addEventListener("mouseup", () => {
    node.dataset.state = node.matches(":focus") ? "focus" : "hover";
  });
}

function hasTextSelection(selection: Selection): boolean {
  return selection instanceof TextSelection && !selection.empty;
}

function captureSelection(controller: EditorController, selection?: Selection): void {
  if (!controller.editor) {
    return;
  }

  const view = controller.editor.action((ctx) => ctx.get(editorViewCtx));
  const currentSelection = selection ?? view.state.selection;
  controller.selectionSnapshot = {
    from: currentSelection.from,
    to: currentSelection.to,
  };
}

function restoreSelection(controller: EditorController): void {
  if (!controller.editor || !controller.selectionSnapshot) {
    return;
  }

  controller.editor.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    const { state } = view;
    const maxPos = state.doc.content.size;
    const from = Math.max(0, Math.min(controller.selectionSnapshot?.from ?? 0, maxPos));
    const to = Math.max(from, Math.min(controller.selectionSnapshot?.to ?? from, maxPos));
    const nextSelection = TextSelection.create(state.doc, from, to);
    view.dispatch(state.tr.setSelection(nextSelection));
    view.focus();
  });
}

function hideTooltip(controller: EditorController): void {
  if (controller.tooltipTrigger) {
    controller.tooltipTrigger.removeAttribute("aria-describedby");
    controller.tooltipTrigger = undefined;
  }
  controller.tooltipLayer.hidden = true;
}

function showTooltip(controller: EditorController, trigger: HTMLElement, label: string): void {
  const tooltipId = controller.tooltipContent.id;
  if (controller.tooltipTrigger && controller.tooltipTrigger !== trigger) {
    controller.tooltipTrigger.removeAttribute("aria-describedby");
  }

  controller.tooltipTrigger = trigger;
  trigger.setAttribute("aria-describedby", tooltipId);

  const frameRect = controller.surfaceFrame.getBoundingClientRect();
  const triggerRect = trigger.getBoundingClientRect();
  controller.tooltipLayer.hidden = false;
  controller.tooltipContent.textContent = label;
  controller.tooltipContent.dataset.state = "idle";

  const tooltipWidth = controller.tooltipContent.offsetWidth || 72;
  const tooltipHeight = controller.tooltipContent.offsetHeight || 28;
  const centerX = triggerRect.left - frameRect.left + (triggerRect.width / 2);
  const clampedX = Math.min(
    Math.max(centerX, 16 + tooltipWidth / 2),
    frameRect.width - 16 - tooltipWidth / 2,
  );
  const topSpace = triggerRect.top - frameRect.top;
  const bottomSpace = frameRect.bottom - triggerRect.bottom;
  const showBelow = topSpace < tooltipHeight + 18 && bottomSpace > topSpace;
  const anchorTop = showBelow
    ? triggerRect.bottom - frameRect.top - 2
    : triggerRect.top - frameRect.top + 2;

  controller.tooltipLayer.dataset.side = showBelow ? "bottom" : "top";

  controller.tooltipContent.style.left = `${clampedX}px`;
  controller.tooltipContent.style.top = `${anchorTop}px`;
  controller.tooltipArrow.style.left = `${clampedX}px`;
  controller.tooltipArrow.style.top = `${anchorTop}px`;
}

function hideContextMenu(controller: EditorController, restoreToolbar = true): void {
  controller.contextMenu.hidden = true;
  if (restoreToolbar) {
    updateToolbarPosition(controller);
  }
}

function positionContextMenu(controller: EditorController, clientX: number, clientY: number): void {
  hideTooltip(controller);
  controller.floatingToolbar.hidden = true;
  controller.contextMenu.hidden = false;

  const frameRect = controller.surfaceFrame.getBoundingClientRect();
  const width = controller.contextMenuContent.offsetWidth || 220;
  const height = controller.contextMenuContent.offsetHeight || 240;
  const left = Math.min(
    Math.max(clientX - frameRect.left, 12),
    Math.max(12, frameRect.width - width - 12),
  );
  const top = Math.min(
    Math.max(clientY - frameRect.top, 12),
    Math.max(12, frameRect.height - height - 12),
  );

  controller.contextMenu.style.left = `${left}px`;
  controller.contextMenu.style.top = `${top}px`;
}

function getMenuItems(controller: EditorController): HTMLButtonElement[] {
  return Array.from(
    controller.contextMenuContent.querySelectorAll<HTMLButtonElement>('[data-scope="menu"][data-part="item"]'),
  );
}

function focusMenuItem(controller: EditorController, index: number): void {
  const items = getMenuItems(controller);
  if (items.length === 0) {
    return;
  }
  const nextIndex = ((index % items.length) + items.length) % items.length;
  items[nextIndex]?.focus();
}

function createToolbarButton(controller: EditorController, definition: ToolbarButton): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "chips-basecard-editor__toolbar-button";
  button.dataset.scope = "button";
  button.dataset.part = "root";
  button.setAttribute("aria-label", formatMessage(definition.labelKey));

  button.appendChild(createRuntimeIconElement(definition.icon, "chips-basecard-editor__toolbar-button-icon", 16));

  applyInteractiveState(button);

  button.addEventListener("mousedown", (event) => {
    event.preventDefault();
    restoreSelection(controller);
  });
  button.addEventListener("click", () => {
    void definition.run(controller);
  });
  button.addEventListener("mouseenter", () => {
    showTooltip(controller, button, formatMessage(definition.labelKey));
  });
  button.addEventListener("focus", () => {
    showTooltip(controller, button, formatMessage(definition.labelKey));
  });
  button.addEventListener("mouseleave", () => {
    hideTooltip(controller);
  });
  button.addEventListener("blur", () => {
    hideTooltip(controller);
  });

  return button;
}

function createContextMenuItem(controller: EditorController, action: ContextMenuAction): HTMLButtonElement {
  const item = document.createElement("button");
  item.type = "button";
  item.dataset.scope = "menu";
  item.dataset.part = "item";
  item.setAttribute("role", "menuitem");
  item.setAttribute("aria-label", formatMessage(action.labelKey));

  item.appendChild(createRuntimeIconElement(action.icon, "chips-basecard-editor__context-menu-icon", 18));

  const label = document.createElement("span");
  label.className = "chips-basecard-editor__context-menu-label";
  label.textContent = formatMessage(action.labelKey);
  item.appendChild(label);

  applyInteractiveState(item);

  item.addEventListener("mousedown", (event) => {
    event.preventDefault();
    restoreSelection(controller);
  });
  item.addEventListener("click", () => {
    hideContextMenu(controller, false);
    void action.run(controller);
  });

  return item;
}

function setErrors(controller: EditorController, errors: string[]): void {
  controller.pendingErrors = errors;
  controller.errorList.innerHTML = "";
  const wrapper = controller.errorList.parentElement as HTMLElement;
  if (errors.length === 0) {
    wrapper.hidden = true;
    return;
  }

  for (const error of errors) {
    const item = document.createElement("li");
    item.textContent = error;
    controller.errorList.appendChild(item);
  }
  wrapper.hidden = false;
}

function syncValidationErrors(controller: EditorController, markdown: string): void {
  if (hasMeaningfulMarkdownContent(markdown)) {
    setErrors(controller, []);
    return;
  }

  setErrors(controller, [formatMessage("basecard.validation.bodyRequired")]);
}

function clearPreviewTimer(controller: EditorController): void {
  if (controller.previewTimer) {
    window.clearTimeout(controller.previewTimer);
    controller.previewTimer = undefined;
  }
}

function emitPreviewConfig(controller: EditorController): void {
  if (controller.disposed) {
    return;
  }

  const markdown = normalizeMarkdown(controller.currentMarkdown);
  controller.currentMarkdown = markdown;
  syncValidationErrors(controller, markdown);
  if (!hasMeaningfulMarkdownContent(markdown)) {
    return;
  }

  const nextConfig = createInlineBasecardConfig(markdown, controller.locale, controller.theme);
  const validation = validateBasecardConfig(nextConfig);
  if (!validation.valid) {
    setErrors(controller, Object.values(validation.errors));
    return;
  }

  setErrors(controller, []);
  const signature = buildConfigSignature(nextConfig);
  if (signature !== controller.lastCommittedSignature) {
    controller.lastCommittedSignature = signature;
    controller.props.onChange(nextConfig);
  }
}

function scheduleCommit(controller: EditorController, reason: "change" | "flush"): void {
  if (controller.disposed || controller.isComposing) {
    return;
  }

  if (reason === "change") {
    clearPreviewTimer(controller);
    controller.previewTimer = window.setTimeout(() => {
      controller.previewTimer = undefined;
      emitPreviewConfig(controller);
    }, PREVIEW_COMMIT_DELAY_MS);
    return;
  }

  clearPreviewTimer(controller);
  void commitCurrentMarkdown(controller);
}

function buildConfigSignature(config: BasecardConfig): string {
  return JSON.stringify(config);
}

async function commitCurrentMarkdown(controller: EditorController): Promise<void> {
  if (controller.disposed || !controller.editor) {
    return;
  }

  if (controller.isImporting) {
    controller.rerunCommitAfterImport = true;
    return;
  }

  const markdown = normalizeMarkdown(controller.editor.action(getMarkdown()));
  controller.currentMarkdown = markdown;

  const hasContent = hasMeaningfulMarkdownContent(markdown);
  if (!hasContent) {
    setErrors(controller, [formatMessage("basecard.validation.bodyRequired")]);
    return;
  }

  const plainTextLength = countUnicodeCharacters(extractPlainTextFromMarkdown(markdown));
  let nextConfig: BasecardConfig;

  if (shouldUseFileStorage(plainTextLength)) {
    if (!controller.props.importResource) {
      setErrors(controller, [formatMessage("basecard.validation.importUnavailable")]);
      return;
    }

    controller.isImporting = true;
    try {
      const currentPreferredPath = controller.currentFilePath || controller.sessionFileName;
      const file = new File([markdown], currentPreferredPath, { type: "text/markdown;charset=utf-8" });
      const imported = await controller.props.importResource({
        file,
        preferredPath: currentPreferredPath,
      });
      const nextFilePath = imported.path;
      if (controller.currentFilePath && controller.currentFilePath !== nextFilePath && controller.props.deleteResource) {
        await controller.props.deleteResource(controller.currentFilePath);
      }
      controller.currentFilePath = nextFilePath;
      nextConfig = createFileBasecardConfig(nextFilePath, controller.locale, controller.theme);
    } finally {
      controller.isImporting = false;
    }
  } else {
    if (controller.currentFilePath && controller.props.deleteResource) {
      await controller.props.deleteResource(controller.currentFilePath);
      controller.currentFilePath = undefined;
    }
    nextConfig = createInlineBasecardConfig(markdown, controller.locale, controller.theme);
  }

  const validation = validateBasecardConfig(nextConfig);
  if (!validation.valid) {
    setErrors(controller, Object.values(validation.errors));
    return;
  }

  setErrors(controller, []);
  const signature = buildConfigSignature(nextConfig);
  if (signature !== controller.lastCommittedSignature) {
    controller.lastCommittedSignature = signature;
    controller.props.onChange(nextConfig);
  }

  if (controller.rerunCommitAfterImport) {
    controller.rerunCommitAfterImport = false;
    void commitCurrentMarkdown(controller);
  }
}

function runCommand<T>(controller: EditorController, commandKey: string | { name?: string }, payload?: T): void {
  if (!controller.editor) {
    return;
  }

  restoreSelection(controller);
  hideTooltip(controller);
  hideContextMenu(controller, false);

  const key = typeof commandKey === "string" ? commandKey : (commandKey as { name?: string }).name ?? commandKey;
  controller.editor.action(callCommand(key as never, payload));
  void syncPreviewResources(controller);
  scheduleCommit(controller, "change");
  updateToolbarPosition(controller);
}

function clearInlineFormatting(controller: EditorController): void {
  if (!controller.editor) {
    return;
  }

  restoreSelection(controller);
  hideTooltip(controller);
  hideContextMenu(controller, false);

  controller.editor.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    const { state } = view;
    const { from, to } = state.selection;
    const tr = state.tr;
    const marks = [
      state.schema.marks.strong,
      state.schema.marks.em,
      state.schema.marks.link,
      state.schema.marks.code,
      state.schema.marks.strike_through,
      state.schema.marks.highlight,
      state.schema.marks.underline,
      state.schema.marks.superscript,
      state.schema.marks.subscript,
    ].filter(Boolean);

    for (const mark of marks) {
      tr.removeMark(from, to, mark);
    }

    const paragraph = state.schema.nodes.paragraph;
    if (paragraph) {
      try {
        tr.setBlockType(from, to, paragraph);
      } catch {
        // ignore block conversion failures
      }
    }

    view.dispatch(tr.scrollIntoView());
  });

  void syncPreviewResources(controller);
  scheduleCommit(controller, "change");
  updateToolbarPosition(controller);
}

function pasteMarkdownAtSelection(controller: EditorController, markdown: string): void {
  if (!controller.editor) {
    return;
  }

  const normalizedMarkdown = normalizeMarkdown(markdown);
  if (!normalizedMarkdown) {
    return;
  }

  controller.editor.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    const { from, to, empty } = view.state.selection;
    const currentDocumentMarkdown = normalizeMarkdown(getMarkdown()(ctx));
    const isBlockPaste = /(^|\n)\s{0,3}(#{1,6}\s|>\s|[-*+]\s|\d+\.\s|```|~~~|---\s*$|\*\*\*\s*$|___\s*$)/m.test(normalizedMarkdown);
    const emptyBlockRange = getEmptyTextBlockRange(view.state);

    if (isBlockPaste && !hasMeaningfulMarkdownContent(currentDocumentMarkdown)) {
      replaceAll(normalizedMarkdown)(ctx);
      view.focus();
      return;
    }

    if (isBlockPaste && emptyBlockRange) {
      replaceRange(normalizedMarkdown, emptyBlockRange)(ctx);
      view.focus();
      return;
    }

    if (isBlockPaste && empty) {
      insertPos(normalizedMarkdown, from, false)(ctx);
      view.focus();
      return;
    }

    replaceRange(normalizedMarkdown, { from, to })(ctx);
    view.focus();
  });
}

function getEmptyTextBlockRange(
  state: EditorState,
): { from: number; to: number } | null {
  const { selection } = state;
  if (!selection.empty) {
    return null;
  }

  const { $from } = selection;
  const parent = $from.parent;
  if (!parent.isTextblock || parent.content.size !== 0) {
    return null;
  }

  const depth = $from.depth;
  return {
    from: $from.before(depth),
    to: $from.after(depth),
  };
}

function handleMarkdownPaste(
  controller: EditorController,
  event: Pick<ClipboardEvent, "preventDefault" | "clipboardData">,
): boolean {
  const clipboardText = event.clipboardData?.getData("text/plain") ?? "";
  if (!clipboardText.trim()) {
    return false;
  }

  event.preventDefault();
  pasteMarkdownAtSelection(controller, clipboardText);
  return true;
}

function updateToolbarPosition(controller: EditorController, selection?: Selection): void {
  if (!controller.editor || !controller.focused || !controller.contextMenu.hidden) {
    controller.floatingToolbar.hidden = true;
    return;
  }

  const view = controller.editor.action((ctx) => ctx.get(editorViewCtx));
  const currentSelection = selection ?? view.state.selection;
  if (!hasTextSelection(currentSelection)) {
    controller.floatingToolbar.hidden = true;
    return;
  }

  try {
    const start = view.coordsAtPos(currentSelection.from);
    const end = view.coordsAtPos(currentSelection.to);
    const frameRect = controller.surfaceFrame.getBoundingClientRect();
    const toolbarWidth = controller.floatingToolbar.offsetWidth || 280;
    const toolbarHeight = controller.floatingToolbar.offsetHeight || 48;
    const centerX = ((start.left + end.right) / 2) - frameRect.left;
    const clampedX = Math.min(
      Math.max(centerX, 24 + toolbarWidth / 2),
      frameRect.width - 24 - toolbarWidth / 2,
    );
    const selectionTop = Math.min(start.top, end.top) - frameRect.top;
    const selectionBottom = Math.max(start.bottom, end.bottom) - frameRect.top;
    const topSpace = selectionTop;
    const bottomSpace = frameRect.height - selectionBottom;
    const showBelow = topSpace < toolbarHeight + 18 && bottomSpace > topSpace;
    const top = showBelow
      ? Math.min(selectionBottom, Math.max(16, frameRect.height - toolbarHeight - 16))
      : Math.max(selectionTop, 16);

    controller.floatingToolbar.style.left = `${clampedX}px`;
    controller.floatingToolbar.style.top = `${top}px`;
    controller.floatingToolbar.dataset.side = showBelow ? "bottom" : "top";
    controller.floatingToolbar.hidden = false;
  } catch {
    controller.floatingToolbar.hidden = true;
  }
}

async function syncPreviewResources(controller: EditorController): Promise<void> {
  if (!controller.props.resolveResourceUrl) {
    return;
  }

  for (const resourcePath of controller.lastResolvedResources) {
    controller.props.releaseResourceUrl?.(resourcePath);
  }
  controller.lastResolvedResources.clear();

  const resolved = await rewriteRelativeResourceUrls(controller.editorHost, controller.props.resolveResourceUrl);
  resolved.forEach((resourcePath) => controller.lastResolvedResources.add(resourcePath));
}

export function createBasecardEditorRoot(props: BasecardEditorProps): EditorRoot {
  const config = normalizeBasecardConfig(props.initialConfig as unknown as Record<string, unknown>);
  const root = document.createElement("div") as EditorRoot;
  const ownerDocument = root.ownerDocument;
  const ownerWindow = ownerDocument.defaultView ?? window;
  const tooltipId = `chips-basecard-editor-tooltip-${Math.random().toString(36).slice(2, 10)}`;

  root.id = "chips-basecard-editor-root";

  const style = document.createElement("style");
  style.textContent = EDITOR_STYLE_TEXT;
  root.appendChild(style);

  const editorRoot = document.createElement("div");
  editorRoot.className = "chips-basecard-editor";
  root.appendChild(editorRoot);

  const surfaceFrame = document.createElement("div");
  surfaceFrame.className = "chips-basecard-editor__surface-frame";
  editorRoot.appendChild(surfaceFrame);

  const scrollSurface = document.createElement("div");
  scrollSurface.className = "chips-basecard-editor__surface";
  surfaceFrame.appendChild(scrollSurface);

  const editorHost = document.createElement("div");
  editorHost.className = "chips-basecard-editor__editor-host";
  scrollSurface.appendChild(editorHost);

  const floatingToolbar = document.createElement("div");
  floatingToolbar.className = "chips-basecard-editor__floating-toolbar";
  floatingToolbar.hidden = true;
  surfaceFrame.appendChild(floatingToolbar);

  const tooltipLayer = document.createElement("div");
  tooltipLayer.className = "chips-basecard-editor__tooltip-layer";
  tooltipLayer.hidden = true;
  tooltipLayer.dataset.scope = "tooltip";
  tooltipLayer.dataset.part = "root";
  surfaceFrame.appendChild(tooltipLayer);

  const tooltipContent = document.createElement("div");
  tooltipContent.dataset.scope = "tooltip";
  tooltipContent.dataset.part = "content";
  tooltipContent.dataset.state = "idle";
  tooltipContent.id = tooltipId;
  tooltipContent.setAttribute("role", "tooltip");
  tooltipLayer.appendChild(tooltipContent);

  const tooltipArrow = document.createElement("div");
  tooltipArrow.dataset.scope = "tooltip";
  tooltipArrow.dataset.part = "arrow";
  tooltipLayer.appendChild(tooltipArrow);

  const contextMenu = document.createElement("div");
  contextMenu.className = "chips-basecard-editor__context-menu";
  contextMenu.dataset.scope = "menu";
  contextMenu.dataset.part = "root";
  contextMenu.hidden = true;
  surfaceFrame.appendChild(contextMenu);

  const contextMenuContent = document.createElement("div");
  contextMenuContent.dataset.scope = "menu";
  contextMenuContent.dataset.part = "content";
  contextMenuContent.dataset.state = "idle";
  contextMenuContent.setAttribute("role", "menu");
  contextMenu.appendChild(contextMenuContent);

  const errors = document.createElement("div");
  errors.className = "chips-basecard-editor__errors";
  errors.hidden = true;
  const errorList = document.createElement("ul");
  errorList.className = "chips-basecard-editor__errors-list";
  errors.appendChild(errorList);
  editorRoot.appendChild(errors);

  const controller: EditorController = {
    root,
    surfaceFrame,
    editorHost,
    scrollSurface,
    floatingToolbar,
    tooltipLayer,
    tooltipContent,
    tooltipArrow,
    contextMenu,
    contextMenuContent,
    errorList,
    locale: config.locale ?? "zh-CN",
    theme: config.theme ?? "",
    props,
    disposed: false,
    focused: false,
    currentMarkdown: "",
    currentFilePath: config.content_source === "file" ? config.content_file : undefined,
    sessionFileName: createRichTextMarkdownFileName(config.content_file?.replace(/\.md$/i, "")),
    lastCommittedSignature: "",
    lastResolvedResources: new Set<string>(),
    isComposing: false,
    isImporting: false,
    rerunCommitAfterImport: false,
    pendingErrors: [],
    handleWindowResize: () => {
      hideTooltip(controller);
      hideContextMenu(controller, false);
      updateToolbarPosition(controller);
    },
    handleDocumentPointerDown: (event) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        hideTooltip(controller);
        hideContextMenu(controller, false);
        return;
      }

      if (!root.contains(target)) {
        hideTooltip(controller);
        hideContextMenu(controller, false);
        controller.floatingToolbar.hidden = true;
        return;
      }

      if (!floatingToolbar.contains(target)) {
        hideTooltip(controller);
      }

      if (!contextMenu.contains(target)) {
        hideContextMenu(controller, true);
      }
    },
    handleDocumentKeyDown: (event) => {
      if (event.key !== "Escape") {
        return;
      }

      if (!controller.contextMenu.hidden) {
        event.preventDefault();
        hideTooltip(controller);
        hideContextMenu(controller, true);
        return;
      }

      hideTooltip(controller);
    },
    handleWindowBlur: () => {
      hideTooltip(controller);
      hideContextMenu(controller, false);
      controller.floatingToolbar.hidden = true;
    },
  };
  for (const definition of TOOLBAR_BUTTONS) {
    floatingToolbar.appendChild(createToolbarButton(controller, definition));
  }

  for (const action of CONTEXT_MENU_ACTIONS) {
    contextMenuContent.appendChild(createContextMenuItem(controller, action));
  }

  contextMenuContent.addEventListener("focusin", () => {
    contextMenuContent.dataset.state = "focus";
  });
  contextMenuContent.addEventListener("focusout", () => {
    contextMenuContent.dataset.state = "idle";
  });
  contextMenuContent.addEventListener("keydown", (event) => {
    const items = getMenuItems(controller);
    if (items.length === 0) {
      return;
    }

    const currentIndex = items.findIndex((item) => item === ownerDocument.activeElement);
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        focusMenuItem(controller, currentIndex + 1);
        break;
      case "ArrowUp":
        event.preventDefault();
        focusMenuItem(controller, currentIndex - 1);
        break;
      case "Home":
        event.preventDefault();
        focusMenuItem(controller, 0);
        break;
      case "End":
        event.preventDefault();
        focusMenuItem(controller, items.length - 1);
        break;
      case "Escape":
        event.preventDefault();
        hideContextMenu(controller, true);
        break;
      default:
        break;
    }
  });
  const handleSurfaceScroll = () => {
    hideTooltip(controller);
    hideContextMenu(controller, false);
    updateToolbarPosition(controller);
  };

  scrollSurface.addEventListener("scroll", handleSurfaceScroll, { passive: true });
  ownerWindow.addEventListener("resize", controller.handleWindowResize);
  ownerWindow.addEventListener("blur", controller.handleWindowBlur);
  ownerDocument.addEventListener("pointerdown", controller.handleDocumentPointerDown);
  ownerDocument.addEventListener("keydown", controller.handleDocumentKeyDown);

  void (async () => {
    try {
      const markdown = normalizeMarkdown(await loadMarkdownFromConfig(config, {
        resolveResourceUrl: props.resolveResourceUrl,
      }));
      controller.currentMarkdown = markdown;
      controller.editor = await Editor.make()
        .config((ctx) => {
          ctx.set(rootCtx, editorHost);
          ctx.set(defaultValueCtx, markdown);
          configureRichTextMarkdown(ctx);
          ctx.update(editorViewOptionsCtx, (prev) => ({
            ...prev,
            handlePaste: (view, event, slice) => {
              if (handleMarkdownPaste(controller, event)) {
                view.focus();
                return true;
              }

              if (typeof prev.handlePaste === "function") {
                return prev.handlePaste(view, event, slice);
              }

              return false;
            },
            attributes: {
              ...(typeof prev.attributes === "object" ? prev.attributes : {}),
              spellcheck: "true",
              autocapitalize: "off",
              autocorrect: "off",
              translate: "no",
            },
          }));
        })
        .use(commonmark)
        .use(gfm)
        .use(richTextMarkdownPlugins)
        .use(listener)
        .create();

      if (controller.disposed) {
        await controller.editor.destroy();
        return;
      }

      controller.editor.action((ctx) => {
        const manager = ctx.get(listenerCtx);
        manager.markdownUpdated((_listenerCtx, nextMarkdown) => {
          controller.currentMarkdown = normalizeMarkdown(nextMarkdown);
          void syncPreviewResources(controller);
          scheduleCommit(controller, "change");
        });
        manager.selectionUpdated((_listenerCtx, selection) => {
          captureSelection(controller, selection);
          updateToolbarPosition(controller, selection);
        });
        manager.focus(() => {
          controller.focused = true;
          updateToolbarPosition(controller);
        });
        manager.blur(() => {
          controller.focused = false;
          hideTooltip(controller);
          hideContextMenu(controller, false);
          controller.floatingToolbar.hidden = true;
          scheduleCommit(controller, "flush");
        });
      });

      const view = controller.editor.action((ctx) => ctx.get(editorViewCtx));
      view.dom.addEventListener("compositionstart", () => {
        controller.isComposing = true;
      });
      view.dom.addEventListener("compositionend", () => {
        controller.isComposing = false;
        scheduleCommit(controller, "change");
      });
      view.dom.addEventListener("keydown", (event) => {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "b") {
          event.preventDefault();
          runCommand(controller, toggleStrongCommand.key);
        }
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "i") {
          event.preventDefault();
          runCommand(controller, toggleEmphasisCommand.key);
        }
      });
      view.dom.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        captureSelection(controller, view.state.selection);
        positionContextMenu(controller, event.clientX, event.clientY);
        focusMenuItem(controller, 0);
      });

      await syncPreviewResources(controller);
      if (!hasMeaningfulMarkdownContent(markdown)) {
        setErrors(controller, [formatMessage("basecard.validation.bodyRequired")]);
      }
    } catch (error) {
      setErrors(controller, [`${formatMessage("basecard.status.loadFailed")}：${error instanceof Error ? error.message : String(error)}`]);
    }
  })();

  root.__chipsDispose = () => {
    const editor = controller.editor;
    clearPreviewTimer(controller);
    if (editor) {
      void commitCurrentMarkdown(controller).catch(() => undefined);
    }

    controller.disposed = true;
    if (editor) {
      void editor.destroy();
    }
    for (const resourcePath of controller.lastResolvedResources) {
      controller.props.releaseResourceUrl?.(resourcePath);
    }
    controller.lastResolvedResources.clear();
    root.querySelectorAll<ReactIslandHost>(".chips-basecard-editor__react-icon").forEach(disposeRuntimeIcon);
    scrollSurface.removeEventListener("scroll", handleSurfaceScroll);
    ownerWindow.removeEventListener("resize", controller.handleWindowResize);
    ownerWindow.removeEventListener("blur", controller.handleWindowBlur);
    ownerDocument.removeEventListener("pointerdown", controller.handleDocumentPointerDown);
    ownerDocument.removeEventListener("keydown", controller.handleDocumentKeyDown);
  };

  return root;
}

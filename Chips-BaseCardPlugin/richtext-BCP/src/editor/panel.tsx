import type { BasecardConfig } from "../schema/card-config";
import { defaultBasecardConfig } from "../schema/card-config";
import { sanitizeRichTextHtml } from "../shared/utils";
import { createTranslator } from "../shared/i18n";
import type { BasecardResourceImportRequest } from "../index";

export interface BasecardEditorProps {
  initialConfig: BasecardConfig;
  onChange: (next: BasecardConfig) => void;
  resolveResourceUrl?: (resourcePath: string) => Promise<string>;
  releaseResourceUrl?: (resourcePath: string) => Promise<void> | void;
  importResource?: (input: BasecardResourceImportRequest) => Promise<{ path: string } | { path: string; url?: string; name?: string; size?: number; mimeType?: string }>;
  deleteResource?: (resourcePath: string) => Promise<void>;
}

type EditorRoot = HTMLElement & {
  __chipsDispose?: () => void;
};

type DraftConfig = Pick<BasecardConfig, "body">;

const EMIT_DEBOUNCE_MS = 120;
const EMPTY_BODY_HTML = "<p></p>";
const BLOCK_TAGS = new Set([
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "blockquote",
  "li",
]);

const EDITOR_STYLE_TEXT = `
html, body {
  margin: 0;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: var(--chips-sys-color-surface, #ffffff);
}

#chips-basecard-editor-root {
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  overflow: hidden;
}

.chips-basecard-editor {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  padding: 14px 16px 16px;
  background: var(--chips-sys-color-surface, #ffffff);
  color: var(--chips-sys-color-on-surface, #111827);
  font: 14px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.chips-basecard-editor *,
.chips-basecard-editor *::before,
.chips-basecard-editor *::after {
  box-sizing: border-box;
}

.chips-basecard-editor__toolbar-shell {
  flex: 0 0 auto;
  width: 100%;
}

.chips-basecard-editor__toolbar-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
  min-height: 56px;
  padding: 10px 12px;
  border: 1px solid var(--chips-comp-card-shell-border-color, rgba(15, 23, 42, 0.12));
  border-radius: 18px;
  background: var(--chips-comp-card-shell-root-surface, var(--chips-sys-color-surface, #ffffff));
  box-shadow: 0 8px 22px rgba(15, 23, 42, 0.08);
}

.chips-basecard-editor__toolbar-header {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  min-height: 32px;
}

.chips-basecard-editor__toolbar-toggle {
  min-height: 32px;
  padding: 0 10px;
  border: 1px solid var(--chips-comp-card-shell-border-color, rgba(15, 23, 42, 0.12));
  border-radius: 999px;
  background: var(--chips-comp-card-shell-root-surface, var(--chips-sys-color-surface, #ffffff));
  color: inherit;
  font: inherit;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease,
    background-color 0.15s ease;
}

.chips-basecard-editor__toolbar-toggle:hover {
  border-color: rgba(37, 99, 235, 0.55);
  background: rgba(239, 246, 255, 0.92);
}

.chips-basecard-editor__toolbar-toggle:focus-visible {
  border-color: rgba(37, 99, 235, 0.85);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.16);
}

.chips-basecard-editor__toolbar-content {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 10px;
  align-items: flex-start;
  width: 100%;
}

.chips-basecard-editor[data-toolbar-state="collapsed"] .chips-basecard-editor__toolbar-panel {
  min-height: 44px;
  padding: 6px 10px;
  border-radius: 16px;
}

.chips-basecard-editor[data-toolbar-state="collapsed"] .chips-basecard-editor__toolbar-content {
  display: none;
}

.chips-basecard-editor__toolbar-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.chips-basecard-editor__surface-frame {
  flex: 1;
  min-height: 0;
  width: 100%;
  overflow: hidden;
}

.chips-basecard-editor__surface {
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: auto;
  border: 1px solid var(--chips-comp-card-shell-border-color, rgba(15, 23, 42, 0.12));
  border-radius: 22px;
  background: var(--chips-comp-card-shell-root-surface, var(--chips-sys-color-surface, #ffffff));
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
  overscroll-behavior: contain;
}

.chips-basecard-editor__richtext {
  min-height: 100%;
  padding: 20px 24px 56px;
  outline: none;
  color: inherit;
  word-break: break-word;
}

.chips-basecard-editor__richtext[data-empty="true"]::before {
  content: attr(data-placeholder);
  color: #94a3b8;
  pointer-events: none;
}

.chips-basecard-editor__richtext > :first-child {
  margin-top: 0;
}

.chips-basecard-editor__richtext > :last-child {
  margin-bottom: 0;
}

.chips-basecard-editor__richtext p,
.chips-basecard-editor__richtext ul,
.chips-basecard-editor__richtext ol,
.chips-basecard-editor__richtext blockquote,
.chips-basecard-editor__richtext h1,
.chips-basecard-editor__richtext h2,
.chips-basecard-editor__richtext h3,
.chips-basecard-editor__richtext h4,
.chips-basecard-editor__richtext h5,
.chips-basecard-editor__richtext h6 {
  margin: 0 0 12px;
}

.chips-basecard-editor__richtext blockquote {
  margin-left: 0;
  padding-left: 14px;
  border-left: 3px solid rgba(37, 99, 235, 0.28);
  color: #475467;
}

.chips-basecard-editor__richtext code {
  padding: 2px 6px;
  border-radius: 6px;
  background: rgba(15, 23, 42, 0.08);
  font-family: "SFMono-Regular", Consolas, monospace;
  font-size: 0.92em;
}

.chips-basecard-editor__richtext img {
  max-width: 100%;
  height: auto;
  border-radius: 12px;
}

.chips-basecard-editor__toolbar-button,
.chips-basecard-editor__toolbar-select,
.chips-basecard-editor__toolbar-color {
  border: 1px solid var(--chips-comp-card-shell-border-color, rgba(15, 23, 42, 0.12));
  border-radius: 10px;
  background: var(--chips-comp-card-shell-root-surface, var(--chips-sys-color-surface, #ffffff));
  color: inherit;
  font: inherit;
  outline: none;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease,
    background-color 0.15s ease,
    transform 0.15s ease;
}

.chips-basecard-editor__toolbar-button {
  min-width: 36px;
  min-height: 36px;
  padding: 0 10px;
  cursor: pointer;
  font-weight: 600;
}

.chips-basecard-editor__toolbar-select {
  min-width: 108px;
  min-height: 36px;
  padding: 0 10px;
}

.chips-basecard-editor__toolbar-color {
  width: 38px;
  height: 38px;
  padding: 4px;
  cursor: pointer;
}

.chips-basecard-editor__toolbar-button:hover,
.chips-basecard-editor__toolbar-select:hover,
.chips-basecard-editor__toolbar-color:hover {
  border-color: rgba(37, 99, 235, 0.55);
  transform: translateY(-1px);
}

.chips-basecard-editor__toolbar-button:focus-visible,
.chips-basecard-editor__toolbar-select:focus-visible,
.chips-basecard-editor__toolbar-color:focus-visible {
  border-color: rgba(37, 99, 235, 0.85);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.16);
}

.chips-basecard-editor__errors {
  flex: 0 0 auto;
  min-height: 0;
  padding: 10px 16px 14px;
  font-size: 13px;
  color: var(--chips-sys-color-error, #d92d20);
}

.chips-basecard-editor__errors-list {
  margin: 0;
  padding-left: 18px;
}
`;

function ensureEditorFocus(editor: HTMLElement): void {
  if (document.activeElement !== editor) {
    editor.focus();
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function hasMeaningfulEditorContent(editor: HTMLElement): boolean {
  const text = (editor.textContent ?? "").replace(/\u00a0/g, " ").trim();
  if (text.length > 0) {
    return true;
  }

  return editor.querySelector("img, hr") !== null;
}

function normalizeEditorHtml(html: string): string {
  const sanitized = sanitizeRichTextHtml(html);
  if (!sanitized.trim()) {
    return EMPTY_BODY_HTML;
  }
  return sanitized;
}

function createSanitizedDraftBody(editor: HTMLElement): string {
  return normalizeEditorHtml(editor.innerHTML);
}

function isRangeInsideEditor(range: Range, editor: HTMLElement): boolean {
  const container = range.commonAncestorContainer;
  return container === editor || editor.contains(container);
}

function cloneEditorSelection(editor: HTMLElement): Range | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);
  if (!isRangeInsideEditor(range, editor)) {
    return null;
  }

  return range.cloneRange();
}

function placeCaretAtEnd(editor: HTMLElement): Range {
  ensureEditorFocus(editor);
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(editor);
  range.collapse(false);

  if (selection) {
    selection.removeAllRanges();
    selection.addRange(range);
  }

  return range;
}

function restoreEditorSelection(editor: HTMLElement, savedRange: Range | null): Range {
  ensureEditorFocus(editor);

  const selection = window.getSelection();
  if (!selection) {
    return placeCaretAtEnd(editor);
  }

  if (savedRange && isRangeInsideEditor(savedRange, editor)) {
    selection.removeAllRanges();
    selection.addRange(savedRange);
    return savedRange;
  }

  return placeCaretAtEnd(editor);
}

function executeDocumentCommand(command: string, value?: string): boolean {
  const execCommand = (document as Document & {
    execCommand?: (name: string, showUi?: boolean, value?: string) => boolean;
  }).execCommand;

  if (typeof execCommand !== "function") {
    return false;
  }

  if (command === "formatBlock" && value) {
    return (
      execCommand.call(document, command, false, value) ||
      execCommand.call(document, command, false, `<${value}>`)
    );
  }

  return execCommand.call(document, command, false, value);
}

function replaceSelectionWithHtml(editor: HTMLElement, html: string): void {
  const safeHtml = sanitizeRichTextHtml(html).trim();
  if (!safeHtml) {
    return;
  }

  const range = restoreEditorSelection(editor, cloneEditorSelection(editor));
  range.deleteContents();

  const fragment = range.createContextualFragment(safeHtml);
  const lastInsertedNode = fragment.lastChild;
  range.insertNode(fragment);

  const selection = window.getSelection();
  if (!selection) {
    return;
  }

  const nextRange = document.createRange();
  if (lastInsertedNode) {
    nextRange.setStartAfter(lastInsertedNode);
  } else {
    nextRange.selectNodeContents(editor);
    nextRange.collapse(false);
  }
  nextRange.collapse(true);
  selection.removeAllRanges();
  selection.addRange(nextRange);
}

function wrapSelectionWithTag(editor: HTMLElement, tagName: string): void {
  const range = restoreEditorSelection(editor, cloneEditorSelection(editor));
  if (range.collapsed) {
    return;
  }

  const element = document.createElement(tagName);
  try {
    range.surroundContents(element);
  } catch {
    const contents = range.extractContents();
    element.appendChild(contents);
    range.insertNode(element);
  }

  const selection = window.getSelection();
  if (!selection) {
    return;
  }

  const nextRange = document.createRange();
  nextRange.selectNodeContents(element);
  nextRange.collapse(false);
  selection.removeAllRanges();
  selection.addRange(nextRange);
}

function wrapSelectionWithStyle(editor: HTMLElement, style: string): void {
  const range = restoreEditorSelection(editor, cloneEditorSelection(editor));
  if (range.collapsed) {
    return;
  }

  const span = document.createElement("span");
  span.setAttribute("style", style);

  try {
    range.surroundContents(span);
  } catch {
    const text = range.toString();
    replaceSelectionWithHtml(
      editor,
      `<span style="${escapeHtml(style)}">${escapeHtml(text)}</span>`
    );
    return;
  }

  const selection = window.getSelection();
  if (!selection) {
    return;
  }

  const nextRange = document.createRange();
  nextRange.selectNodeContents(span);
  nextRange.collapse(false);
  selection.removeAllRanges();
  selection.addRange(nextRange);
}

function plainTextToRichTextHtml(text: string): string {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return EMPTY_BODY_HTML;
  }

  return normalized
    .split(/\n{2,}/)
    .map((block) => {
      const lineHtml = block
        .split("\n")
        .map((line) => escapeHtml(line))
        .join("<br>");
      return `<p>${lineHtml || "<br>"}</p>`;
    })
    .join("");
}

function pickSingleFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.style.position = "fixed";
    input.style.opacity = "0";
    input.style.pointerEvents = "none";
    input.style.width = "1px";
    input.style.height = "1px";

    const cleanup = () => {
      input.removeEventListener("change", handleChange);
      input.remove();
    };

    const handleChange = () => {
      const file = input.files?.[0] ?? null;
      cleanup();
      resolve(file);
    };

    input.addEventListener("change", handleChange, { once: true });
    document.body.appendChild(input);
    input.click();
  });
}

function getCurrentBlockTag(editor: HTMLElement): string {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return "p";
  }

  const range = selection.getRangeAt(0);
  if (!isRangeInsideEditor(range, editor)) {
    return "p";
  }

  let node: Node | null = range.startContainer;
  if (node.nodeType === Node.TEXT_NODE) {
    node = node.parentNode;
  }

  while (node && node !== editor) {
    if (node instanceof HTMLElement) {
      const tagName = node.tagName.toLowerCase();
      if (BLOCK_TAGS.has(tagName)) {
        return tagName === "li" ? "p" : tagName;
      }
    }
    node = node.parentNode;
  }

  return "p";
}

function createValidatedFragmentHtml(html: string, requiredSelector?: string): string {
  const safeHtml = sanitizeRichTextHtml(html).trim();
  if (!safeHtml) {
    return "";
  }

  if (!requiredSelector) {
    return safeHtml;
  }

  const template = document.createElement("template");
  template.innerHTML = safeHtml;
  return template.content.querySelector(requiredSelector) ? safeHtml : "";
}

function createToolbarGroup(...children: HTMLElement[]): HTMLDivElement {
  const group = document.createElement("div");
  group.className = "chips-basecard-editor__toolbar-group";
  children.forEach((child) => {
    group.appendChild(child);
  });
  return group;
}

export function createBasecardEditorRoot(props: BasecardEditorProps): HTMLElement {
  const t = createTranslator(props.initialConfig.locale);

  const root = document.createElement("div") as EditorRoot;
  root.className = "chips-basecard-editor chips-basecard-editor--richtext";
  root.setAttribute("data-toolbar-state", "expanded");

  const style = document.createElement("style");
  style.textContent = EDITOR_STYLE_TEXT;
  root.appendChild(style);

  const toolbarShell = document.createElement("div");
  toolbarShell.className = "chips-basecard-editor__toolbar-shell";

  const toolbarPanel = document.createElement("div");
  toolbarPanel.className = "chips-basecard-editor__toolbar-panel";

  const toolbarHeader = document.createElement("div");
  toolbarHeader.className = "chips-basecard-editor__toolbar-header";

  const toolbarToggle = document.createElement("button");
  toolbarToggle.type = "button";
  toolbarToggle.className = "chips-basecard-editor__toolbar-toggle";

  const toolbarContent = document.createElement("div");
  toolbarContent.className = "chips-basecard-editor__toolbar-content";

  toolbarHeader.appendChild(toolbarToggle);
  toolbarPanel.appendChild(toolbarHeader);
  toolbarPanel.appendChild(toolbarContent);
  toolbarShell.appendChild(toolbarPanel);
  root.appendChild(toolbarShell);

  const surfaceFrame = document.createElement("div");
  surfaceFrame.className = "chips-basecard-editor__surface-frame";

  const surface = document.createElement("div");
  surface.className = "chips-basecard-editor__surface";

  const bodyEditor = document.createElement("div");
  bodyEditor.className = "chips-basecard-editor__richtext";
  bodyEditor.contentEditable = "true";
  bodyEditor.spellcheck = true;
  bodyEditor.setAttribute("role", "textbox");
  bodyEditor.setAttribute("aria-multiline", "true");
  bodyEditor.setAttribute("aria-label", t("basecard.body"));
  bodyEditor.setAttribute("data-placeholder", t("basecard.placeholder"));
  bodyEditor.innerHTML = normalizeEditorHtml(props.initialConfig.body ?? "");
  surface.appendChild(bodyEditor);
  surfaceFrame.appendChild(surface);
  root.appendChild(surfaceFrame);

  const errorBox = document.createElement("div");
  errorBox.className = "chips-basecard-editor__errors";
  root.appendChild(errorBox);

  let draft: DraftConfig = {
    body: normalizeEditorHtml(props.initialConfig.body ?? ""),
  };
  let lastCommittedSignature = JSON.stringify(draft);
  let emitTimer: number | null = null;
  let savedSelection: Range | null = null;
  let isToolbarCollapsed = false;
  let isComposingText = false;
  let didConfigureParagraphBehavior = false;

  function ensureParagraphBehavior(): void {
    if (didConfigureParagraphBehavior) {
      return;
    }

    executeDocumentCommand("defaultParagraphSeparator", "p");
    didConfigureParagraphBehavior = true;
  }

  function rememberSelection(): void {
    savedSelection = cloneEditorSelection(bodyEditor);
  }

  function resolveSelection(preferLiveSelection = false): Range {
    if (preferLiveSelection) {
      const liveSelection = cloneEditorSelection(bodyEditor);
      if (liveSelection) {
        return restoreEditorSelection(bodyEditor, liveSelection);
      }
    }
    return restoreEditorSelection(bodyEditor, savedSelection);
  }

  function syncToolbarState(): void {
    blockSelect.value = getCurrentBlockTag(bodyEditor);
  }

  function syncPlaceholderState(): void {
    bodyEditor.setAttribute(
      "data-empty",
      hasMeaningfulEditorContent(bodyEditor) ? "false" : "true"
    );
  }

  function applyToolbarState(): void {
    const state = isToolbarCollapsed ? "collapsed" : "expanded";
    root.setAttribute("data-toolbar-state", state);
    toolbarContent.hidden = isToolbarCollapsed;
    toolbarToggle.textContent = isToolbarCollapsed
      ? t("basecard.toolbar.expand")
      : t("basecard.toolbar.collapse");
    toolbarToggle.setAttribute("aria-label", toolbarToggle.textContent);
    toolbarToggle.setAttribute("aria-expanded", String(!isToolbarCollapsed));
  }

  function collectDraftFromDom(): DraftConfig {
    return {
      body: createSanitizedDraftBody(bodyEditor),
    };
  }

  function renderValidation(showErrors: boolean): void {
    errorBox.textContent = "";
    if (!showErrors) {
      return;
    }

    const errors: string[] = [];
    if (!hasMeaningfulEditorContent(bodyEditor)) {
      errors.push(t("basecard.validation.bodyRequired"));
    }

    if (errors.length === 0) {
      return;
    }

    const list = document.createElement("ul");
    list.className = "chips-basecard-editor__errors-list";
    errors.forEach((message) => {
      const item = document.createElement("li");
      item.textContent = message;
      list.appendChild(item);
    });
    errorBox.appendChild(list);
  }

  function validateAndEmit(showErrors = false, normalizeDom = false): void {
    const nextDraft = collectDraftFromDom();
    const safeBodyHtml = normalizeEditorHtml(nextDraft.body);

    if (normalizeDom && safeBodyHtml !== bodyEditor.innerHTML) {
      bodyEditor.innerHTML = safeBodyHtml;
    }
    syncPlaceholderState();

    draft = {
      body: safeBodyHtml,
    };

    renderValidation(showErrors);

    const next: BasecardConfig = {
      id: props.initialConfig.id || defaultBasecardConfig.id,
      body: safeBodyHtml,
      locale: props.initialConfig.locale ?? defaultBasecardConfig.locale,
    };

    const signature = JSON.stringify(draft);
    if (signature === lastCommittedSignature) {
      return;
    }

    lastCommittedSignature = signature;
    props.onChange(next);
  }

  function scheduleValidateAndEmit(showErrors = false, normalizeDom = false): void {
    if (emitTimer !== null) {
      window.clearTimeout(emitTimer);
    }
    emitTimer = window.setTimeout(() => {
      emitTimer = null;
      validateAndEmit(showErrors, normalizeDom);
    }, EMIT_DEBOUNCE_MS);
  }

  function flushValidateAndEmit(showErrors = true, normalizeDom = true): void {
    if (emitTimer !== null) {
      window.clearTimeout(emitTimer);
      emitTimer = null;
    }
    validateAndEmit(showErrors, normalizeDom);
  }

  function runEditorCommand(command: string, value?: string): void {
    resolveSelection();
    executeDocumentCommand(command, value);
    rememberSelection();
    syncToolbarState();
  }

  function insertParagraphBreak(): void {
    ensureParagraphBehavior();
    resolveSelection(true);
    if (!executeDocumentCommand("insertParagraph")) {
      replaceSelectionWithHtml(bodyEditor, "<p><br></p>");
    }
    rememberSelection();
    syncToolbarState();
  }

  function insertLineBreak(): void {
    ensureParagraphBehavior();
    resolveSelection(true);
    if (!executeDocumentCommand("insertLineBreak")) {
      replaceSelectionWithHtml(bodyEditor, "<br>");
    }
    rememberSelection();
    syncToolbarState();
  }

  function createToolbarButton(
    text: string,
    title: string,
    onClick: () => void
  ): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "chips-basecard-editor__toolbar-button";
    button.textContent = text;
    button.title = title;
    button.setAttribute("aria-label", title);
    button.addEventListener("mousedown", (event) => {
      rememberSelection();
      event.preventDefault();
    });
    button.addEventListener("click", (event) => {
      event.preventDefault();
      onClick();
      validateAndEmit(false);
    });
    return button;
  }

  const boldButton = createToolbarButton("B", t("basecard.toolbar.bold"), () =>
    runEditorCommand("bold")
  );
  const italicButton = createToolbarButton("I", t("basecard.toolbar.italic"), () =>
    runEditorCommand("italic")
  );
  const underlineButton = createToolbarButton("U", t("basecard.toolbar.underline"), () =>
    runEditorCommand("underline")
  );
  const strikeButton = createToolbarButton("S", t("basecard.toolbar.strike"), () =>
    runEditorCommand("strikeThrough")
  );
  const superscriptButton = createToolbarButton(
    "X2",
    t("basecard.toolbar.superscript"),
    () => runEditorCommand("superscript")
  );
  const subscriptButton = createToolbarButton(
    "X_2",
    t("basecard.toolbar.subscript"),
    () => runEditorCommand("subscript")
  );
  const codeButton = createToolbarButton("Code", t("basecard.toolbar.code"), () => {
    resolveSelection();
    wrapSelectionWithTag(bodyEditor, "code");
    rememberSelection();
  });

  const blockSelect = document.createElement("select");
  blockSelect.className = "chips-basecard-editor__toolbar-select";
  blockSelect.title = t("basecard.toolbar.block");
  blockSelect.setAttribute("aria-label", t("basecard.toolbar.block"));
  [
    { value: "p", label: t("basecard.block.paragraph") },
    { value: "h1", label: t("basecard.block.h1") },
    { value: "h2", label: t("basecard.block.h2") },
    { value: "h3", label: t("basecard.block.h3") },
    { value: "h4", label: t("basecard.block.h4") },
    { value: "h5", label: t("basecard.block.h5") },
    { value: "h6", label: t("basecard.block.h6") },
  ].forEach((option) => {
    const optionEl = document.createElement("option");
    optionEl.value = option.value;
    optionEl.textContent = option.label;
    blockSelect.appendChild(optionEl);
  });
  blockSelect.addEventListener("mousedown", () => {
    rememberSelection();
  });
  blockSelect.addEventListener("change", () => {
    const value = blockSelect.value;
    runEditorCommand("formatBlock", value === "p" ? "p" : value);
    validateAndEmit(false);
  });

  const orderedListButton = createToolbarButton(
    "1.",
    t("basecard.toolbar.orderedList"),
    () => runEditorCommand("insertOrderedList")
  );
  const unorderedListButton = createToolbarButton(
    "•",
    t("basecard.toolbar.unorderedList"),
    () => runEditorCommand("insertUnorderedList")
  );
  const blockquoteButton = createToolbarButton(
    "\"",
    t("basecard.toolbar.blockquote"),
    () => runEditorCommand("formatBlock", "blockquote")
  );

  const alignLeftButton = createToolbarButton("L", t("basecard.toolbar.alignLeft"), () =>
    runEditorCommand("justifyLeft")
  );
  const alignCenterButton = createToolbarButton(
    "C",
    t("basecard.toolbar.alignCenter"),
    () => runEditorCommand("justifyCenter")
  );
  const alignRightButton = createToolbarButton("R", t("basecard.toolbar.alignRight"), () =>
    runEditorCommand("justifyRight")
  );
  const alignJustifyButton = createToolbarButton(
    "J",
    t("basecard.toolbar.alignJustify"),
    () => runEditorCommand("justifyFull")
  );

  const colorInput = document.createElement("input");
  colorInput.type = "color";
  colorInput.className = "chips-basecard-editor__toolbar-color";
  colorInput.title = t("basecard.toolbar.textColor");
  colorInput.setAttribute("aria-label", t("basecard.toolbar.textColor"));
  colorInput.addEventListener("mousedown", () => {
    rememberSelection();
  });
  colorInput.addEventListener("input", () => {
    if (!colorInput.value) {
      return;
    }
    runEditorCommand("foreColor", colorInput.value);
    validateAndEmit(false);
  });

  const bgColorInput = document.createElement("input");
  bgColorInput.type = "color";
  bgColorInput.className = "chips-basecard-editor__toolbar-color";
  bgColorInput.title = t("basecard.toolbar.highlightColor");
  bgColorInput.setAttribute("aria-label", t("basecard.toolbar.highlightColor"));
  bgColorInput.addEventListener("mousedown", () => {
    rememberSelection();
  });
  bgColorInput.addEventListener("input", () => {
    if (!bgColorInput.value) {
      return;
    }
    runEditorCommand("hiliteColor", bgColorInput.value);
    validateAndEmit(false);
  });

  const fontSizeSelect = document.createElement("select");
  fontSizeSelect.className = "chips-basecard-editor__toolbar-select";
  fontSizeSelect.title = t("basecard.toolbar.fontSize");
  fontSizeSelect.setAttribute("aria-label", t("basecard.toolbar.fontSize"));
  const defaultFontSizeOption = document.createElement("option");
  defaultFontSizeOption.value = "";
  defaultFontSizeOption.textContent = t("basecard.toolbar.fontSize");
  fontSizeSelect.appendChild(defaultFontSizeOption);
  [12, 14, 16, 18, 24, 32].forEach((size) => {
    const optionEl = document.createElement("option");
    optionEl.value = String(size);
    optionEl.textContent = `${size}px`;
    fontSizeSelect.appendChild(optionEl);
  });
  fontSizeSelect.addEventListener("mousedown", () => {
    rememberSelection();
  });
  fontSizeSelect.addEventListener("change", () => {
    const selected = Number.parseInt(fontSizeSelect.value, 10);
    if (!Number.isFinite(selected)) {
      return;
    }
    resolveSelection();
    wrapSelectionWithStyle(bodyEditor, `font-size: ${selected}px`);
    rememberSelection();
    validateAndEmit(false);
    fontSizeSelect.value = "";
  });

  const clearFormatButton = createToolbarButton(
    t("basecard.toolbar.clear"),
    t("basecard.toolbar.clear"),
    () => runEditorCommand("removeFormat")
  );

  const linkButton = createToolbarButton(
    t("basecard.toolbar.link"),
    t("basecard.toolbar.link"),
    () => {
      const selectionRange = cloneEditorSelection(bodyEditor);
      const selectedText = selectionRange?.toString() ?? "";
      const defaultUrl =
        selectedText && selectedText.startsWith("http") ? selectedText : "https://";

      const url = (window.prompt(t("basecard.prompt.linkUrl"), defaultUrl) ?? "").trim();
      if (!url) {
        return;
      }

      const text = (
        selectedText ||
        window.prompt(t("basecard.prompt.linkText"), url) ||
        url
      ).trim();

      const linkHtml = createValidatedFragmentHtml(
        `<a href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(text)}</a>`,
        'a[href]'
      );
      if (!linkHtml) {
        return;
      }

      restoreEditorSelection(bodyEditor, selectionRange);
      replaceSelectionWithHtml(bodyEditor, linkHtml);
      rememberSelection();
    }
  );

  const imageButton = createToolbarButton(
    t("basecard.toolbar.image"),
    t("basecard.toolbar.image"),
    async () => {
      const selectionRange = cloneEditorSelection(bodyEditor);
      let src = "";
      const selectedFile = props.importResource
        ? await pickSingleFile("image/*")
        : null;
      const importedResource = selectedFile
        ? await props.importResource?.({
            file: selectedFile,
            preferredPath: selectedFile.name,
          })
        : null;

      if (typeof importedResource?.path === "string" && importedResource.path.trim().length > 0) {
        src = importedResource.path.trim();
      } else {
        src = (window.prompt(t("basecard.prompt.imageUrl"), "https://") ?? "").trim();
      }

      if (!src) {
        return;
      }

      const alt = (window.prompt(t("basecard.prompt.imageAlt"), "") ?? "").trim();
      const width = (window.prompt(t("basecard.prompt.imageWidth"), "") ?? "").trim();
      const height = (window.prompt(t("basecard.prompt.imageHeight"), "") ?? "").trim();

      const attributes: string[] = [`src="${escapeHtml(src)}"`];
      if (alt) {
        attributes.push(`alt="${escapeHtml(alt)}"`);
      }
      if (width) {
        attributes.push(`width="${escapeHtml(width)}"`);
      }
      if (height) {
        attributes.push(`height="${escapeHtml(height)}"`);
      }

      const imageHtml = createValidatedFragmentHtml(
        `<img ${attributes.join(" ")} />`,
        "img[src]"
      );
      if (!imageHtml) {
        return;
      }

      restoreEditorSelection(bodyEditor, selectionRange);
      replaceSelectionWithHtml(bodyEditor, imageHtml);
      rememberSelection();
    }
  );

  const hrButton = createToolbarButton(
    t("basecard.toolbar.divider"),
    t("basecard.toolbar.divider"),
    () => runEditorCommand("insertHorizontalRule")
  );

  toolbarContent.appendChild(
    createToolbarGroup(
      boldButton,
      italicButton,
      underlineButton,
      strikeButton,
      superscriptButton,
      subscriptButton,
      codeButton
    )
  );
  toolbarContent.appendChild(
    createToolbarGroup(blockSelect, orderedListButton, unorderedListButton, blockquoteButton)
  );
  toolbarContent.appendChild(
    createToolbarGroup(
      alignLeftButton,
      alignCenterButton,
      alignRightButton,
      alignJustifyButton,
      colorInput,
      bgColorInput,
      fontSizeSelect
    )
  );
  toolbarContent.appendChild(
    createToolbarGroup(clearFormatButton, linkButton, imageButton, hrButton)
  );

  toolbarToggle.addEventListener("mousedown", (event) => {
    rememberSelection();
    event.preventDefault();
  });
  toolbarToggle.addEventListener("click", (event) => {
    event.preventDefault();
    isToolbarCollapsed = !isToolbarCollapsed;
    applyToolbarState();
  });

  bodyEditor.addEventListener("focus", () => {
    ensureParagraphBehavior();
    rememberSelection();
    syncToolbarState();
  });

  bodyEditor.addEventListener("mouseup", () => {
    rememberSelection();
    syncToolbarState();
  });

  bodyEditor.addEventListener("keyup", () => {
    rememberSelection();
    syncToolbarState();
  });

  bodyEditor.addEventListener("input", () => {
    if (isComposingText) {
      syncPlaceholderState();
      return;
    }
    rememberSelection();
    syncToolbarState();
    syncPlaceholderState();
    draft = collectDraftFromDom();
    scheduleValidateAndEmit(false, false);
  });

  bodyEditor.addEventListener("compositionstart", () => {
    isComposingText = true;
  });

  bodyEditor.addEventListener("compositionend", () => {
    isComposingText = false;
    rememberSelection();
    syncToolbarState();
    syncPlaceholderState();
    scheduleValidateAndEmit(false, false);
  });

  bodyEditor.addEventListener("paste", (event) => {
    event.preventDefault();

    const clipboardData = event.clipboardData;
    const pastedHtml = clipboardData?.getData("text/html") ?? "";
    const pastedText = clipboardData?.getData("text/plain") ?? "";

    const normalizedHtml = pastedHtml
      ? sanitizeRichTextHtml(pastedHtml).trim()
      : plainTextToRichTextHtml(pastedText);

    if (!normalizedHtml) {
      return;
    }

    rememberSelection();
    resolveSelection();
    replaceSelectionWithHtml(bodyEditor, normalizedHtml);
    rememberSelection();
    syncToolbarState();
    syncPlaceholderState();
    scheduleValidateAndEmit(false, false);
  });

  bodyEditor.addEventListener("keydown", (event) => {
    if (isComposingText || event.isComposing) {
      return;
    }

    if (
      event.key === "Enter" &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      event.preventDefault();
      if (event.shiftKey) {
        insertLineBreak();
      } else {
        insertParagraphBreak();
      }
      syncPlaceholderState();
      scheduleValidateAndEmit(false, false);
      return;
    }

    if (!(event.ctrlKey || event.metaKey)) {
      return;
    }

    const key = event.key.toLowerCase();
    if (key === "b") {
      event.preventDefault();
      resolveSelection(true);
      executeDocumentCommand("bold");
      rememberSelection();
      syncToolbarState();
      scheduleValidateAndEmit(false, false);
    } else if (key === "i") {
      event.preventDefault();
      resolveSelection(true);
      executeDocumentCommand("italic");
      rememberSelection();
      syncToolbarState();
      scheduleValidateAndEmit(false, false);
    } else if (key === "u") {
      event.preventDefault();
      resolveSelection(true);
      executeDocumentCommand("underline");
      rememberSelection();
      syncToolbarState();
      scheduleValidateAndEmit(false, false);
    }
  });

  root.addEventListener("focusout", (event) => {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && root.contains(nextTarget)) {
      return;
    }
    flushValidateAndEmit(true, true);
  });

  syncToolbarState();
  syncPlaceholderState();
  applyToolbarState();

  root.__chipsDispose = () => undefined;

  return root;
}

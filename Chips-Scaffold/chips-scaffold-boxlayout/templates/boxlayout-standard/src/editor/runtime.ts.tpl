import { createLayoutEditorRoot } from "./panel";
import type { BoxEntrySnapshot } from "../shared/types";
import type { LayoutConfig } from "../schema/layout-config";
import type { ResolvedRuntimeResource } from "../shared/types";

export interface MountLayoutEditorOptions {
  container: HTMLElement;
  entries: BoxEntrySnapshot[];
  initialConfig: LayoutConfig;
  readBoxAsset?(assetPath: string): Promise<ResolvedRuntimeResource>;
  importBoxAsset?(input: { file: File; preferredPath?: string }): Promise<{ assetPath: string }>;
  deleteBoxAsset?(assetPath: string): Promise<void>;
  onChange(next: LayoutConfig): void;
}

type StyleSnapshot = {
  display: string;
  height: string;
  minHeight: string;
  overflow: string;
  width: string;
};

function captureStyle(target: HTMLElement): StyleSnapshot {
  return {
    display: target.style.display,
    height: target.style.height,
    minHeight: target.style.minHeight,
    overflow: target.style.overflow,
    width: target.style.width,
  };
}

function restoreStyle(target: HTMLElement, snapshot: StyleSnapshot): void {
  target.style.display = snapshot.display;
  target.style.height = snapshot.height;
  target.style.minHeight = snapshot.minHeight;
  target.style.overflow = snapshot.overflow;
  target.style.width = snapshot.width;
}

export function mountLayoutEditor(options: MountLayoutEditorOptions): () => void {
  const ownerDocument = options.container.ownerDocument;
  const html = ownerDocument.documentElement as HTMLElement;
  const body = ownerDocument.body as HTMLElement;

  const htmlStyle = captureStyle(html);
  const bodyStyle = captureStyle(body);
  const containerStyle = captureStyle(options.container);

  html.style.width = "100%";
  html.style.height = "100%";
  html.style.minHeight = "0";
  html.style.overflow = "hidden";

  body.style.width = "100%";
  body.style.height = "100%";
  body.style.minHeight = "0";
  body.style.overflow = "hidden";

  options.container.style.display = "flex";
  options.container.style.width = "100%";
  options.container.style.height = "100%";
  options.container.style.minHeight = "0";
  options.container.style.overflow = "hidden";

  options.container.replaceChildren();

  const root = createLayoutEditorRoot({
    entries: options.entries,
    config: options.initialConfig,
    readBoxAsset: options.readBoxAsset,
    importBoxAsset: options.importBoxAsset,
    deleteBoxAsset: options.deleteBoxAsset,
    onChange: options.onChange,
  });

  options.container.appendChild(root);

  return () => {
    root.__chipsDispose?.();
    restoreStyle(html, htmlStyle);
    restoreStyle(body, bodyStyle);
    restoreStyle(options.container, containerStyle);
    options.container.replaceChildren();
  };
}

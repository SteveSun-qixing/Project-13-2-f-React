import type { BasecardEditorContext } from "../index";
import { createBasecardEditorRoot } from "./panel";

type StyleSnapshot = {
  height: string;
  minHeight: string;
  width: string;
  overflow: string;
  display: string;
};

type BasecardEditorContainer = HTMLElement & {
  __chipsBasecardEditorDispose?: () => void;
};

function captureStyle(target: HTMLElement): StyleSnapshot {
  return {
    height: target.style.height,
    minHeight: target.style.minHeight,
    width: target.style.width,
    overflow: target.style.overflow,
    display: target.style.display,
  };
}

function restoreStyle(target: HTMLElement, snapshot: StyleSnapshot): void {
  target.style.height = snapshot.height;
  target.style.minHeight = snapshot.minHeight;
  target.style.width = snapshot.width;
  target.style.overflow = snapshot.overflow;
  target.style.display = snapshot.display;
}

export function mountBasecardEditor(ctx: BasecardEditorContext): () => void {
  const hostContainer = ctx.container as BasecardEditorContainer;
  hostContainer.__chipsBasecardEditorDispose?.();

  const ownerDocument = ctx.container.ownerDocument;
  const html = ownerDocument.documentElement as HTMLElement;
  const body = ownerDocument.body as HTMLElement;

  const htmlStyle = captureStyle(html);
  const bodyStyle = captureStyle(body);
  const containerStyle = captureStyle(ctx.container);

  html.style.width = "100%";
  html.style.height = "100%";
  html.style.minHeight = "0";
  html.style.overflow = "hidden";

  body.style.width = "100%";
  body.style.height = "100%";
  body.style.minHeight = "0";
  body.style.overflow = "hidden";

  ctx.container.style.display = "flex";
  ctx.container.style.width = "100%";
  ctx.container.style.height = "100%";
  ctx.container.style.minHeight = "0";
  ctx.container.style.overflow = "hidden";

  while (ctx.container.firstChild) {
    ctx.container.removeChild(ctx.container.firstChild);
  }

  const root = createBasecardEditorRoot({
    initialConfig: ctx.initialConfig,
    onChange: ctx.onChange,
    resolveResourceUrl: ctx.resolveResourceUrl,
    releaseResourceUrl: ctx.releaseResourceUrl,
    importResource: ctx.importResource,
    importArchiveBundle: ctx.importArchiveBundle,
    deleteResource: ctx.deleteResource,
    convertTiffToPng: ctx.convertTiffToPng,
  }) as HTMLElement & {
    __chipsDispose?: () => void;
  };

  ctx.container.appendChild(root);

  let disposed = false;
  const cleanup = () => {
    if (disposed) {
      return;
    }
    disposed = true;
    root.__chipsDispose?.();
    restoreStyle(html, htmlStyle);
    restoreStyle(body, bodyStyle);
    restoreStyle(ctx.container, containerStyle);
    if (hostContainer.__chipsBasecardEditorDispose === cleanup) {
      delete hostContainer.__chipsBasecardEditorDispose;
    }

    while (ctx.container.firstChild) {
      ctx.container.removeChild(ctx.container.firstChild);
    }
  };

  hostContainer.__chipsBasecardEditorDispose = cleanup;

  return cleanup;
}

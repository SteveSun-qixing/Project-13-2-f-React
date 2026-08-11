import type { BasecardEditorContext } from "../index";
import { normalizeBasecardConfig } from "../schema/card-config";
import { registerContainerCleanup, runPreviousContainerCleanup } from "../shared/container-lifecycle";
import { createBasecardEditorRoot } from "./panel";

type StyleSnapshot = {
  height: string;
  minHeight: string;
  width: string;
  overflow: string;
  display: string;
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
  const { container, initialConfig, onChange } = ctx;
  runPreviousContainerCleanup(container);

  const ownerDocument = container.ownerDocument;
  const html = ownerDocument.documentElement as HTMLElement;
  const body = ownerDocument.body as HTMLElement;

  const htmlStyle = captureStyle(html);
  const bodyStyle = captureStyle(body);
  const containerStyle = captureStyle(container);

  html.style.width = "100%";
  html.style.height = "100%";
  html.style.minHeight = "0";
  html.style.overflow = "hidden";

  body.style.width = "100%";
  body.style.height = "100%";
  body.style.minHeight = "0";
  body.style.overflow = "hidden";

  container.style.display = "flex";
  container.style.width = "100%";
  container.style.height = "100%";
  container.style.minHeight = "0";
  container.style.overflow = "hidden";

  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }

  const root = createBasecardEditorRoot({
    initialConfig: normalizeBasecardConfig(initialConfig),
    onChange: (next) => onChange(next as unknown as Record<string, unknown>),
    resolveResourceUrl: ctx.resolveResourceUrl,
    releaseResourceUrl: ctx.releaseResourceUrl,
    importResource: ctx.importResource,
    deleteResource: ctx.deleteResource,
  });

  container.appendChild(root);

  return registerContainerCleanup(container, () => {
    root.__chipsDispose?.();
    restoreStyle(html, htmlStyle);
    restoreStyle(body, bodyStyle);
    restoreStyle(container, containerStyle);

    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
  });
}

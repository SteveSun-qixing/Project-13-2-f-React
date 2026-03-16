import type { BasecardEditorContext } from "../index";
import { createBasecardEditorRoot } from "./panel";

export function mountBasecardEditor(
  ctx: BasecardEditorContext
): () => void {
  const {
    container,
    initialConfig,
    onChange,
    resolveResourceUrl,
    releaseResourceUrl,
    importResource,
    deleteResource,
  } = ctx;

  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }

  const root = createBasecardEditorRoot({
    initialConfig,
    onChange,
    resolveResourceUrl,
    releaseResourceUrl,
    importResource,
    deleteResource,
  });

  container.appendChild(root);

  return () => {
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
  };
}

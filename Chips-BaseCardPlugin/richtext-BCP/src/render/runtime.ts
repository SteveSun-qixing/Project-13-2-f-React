import { Editor, defaultValueCtx, editorViewOptionsCtx, rootCtx } from "@milkdown/core";
import { commonmark } from "@milkdown/preset-commonmark";
import { gfm } from "@milkdown/preset-gfm";
import type { Editor as MilkdownEditor } from "@milkdown/core";
import type { BasecardRenderContext } from "../index";
import { formatMessage } from "../lib/messages";
import { normalizeBasecardConfig } from "../schema/card-config";
import { configureRichTextMarkdown, richTextMarkdownPlugins } from "../shared/markdown-extensions";
import { loadMarkdownFromConfig, rewriteRelativeResourceUrls } from "../shared/resource-links";
import { VIEW_STYLE_TEXT } from "./view";

type ViewState = {
  editor?: MilkdownEditor;
  disposed: boolean;
  resolvedResources: Set<string>;
};

export function mountBasecardView(ctx: BasecardRenderContext): () => void {
  const { container } = ctx;
  const config = normalizeBasecardConfig(ctx.config as unknown as Record<string, unknown>);
  const state: ViewState = {
    disposed: false,
    resolvedResources: new Set<string>(),
  };

  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }

  const style = document.createElement("style");
  style.textContent = VIEW_STYLE_TEXT;
  container.appendChild(style);

  const root = document.createElement("div");
  root.className = "chips-richtext-card";
  root.setAttribute("data-card-type", config.card_type);
  container.appendChild(root);

  const surface = document.createElement("div");
  surface.className = "chips-richtext-card__surface";
  root.appendChild(surface);

  const status = document.createElement("div");
  status.className = "chips-richtext-card__status";
  root.appendChild(status);

  const setStatus = (message: string, type: "info" | "error") => {
    status.textContent = message;
    status.className = `chips-richtext-card__status${type === "error" ? " chips-richtext-card__status--error" : ""}`;
    status.hidden = false;
  };

  const hideStatus = () => {
    status.hidden = true;
    status.textContent = "";
  };

  setStatus(formatMessage("basecard.status.loading"), "info");

  void (async () => {
    try {
      const markdown = await loadMarkdownFromConfig(config, {
        resolveResourceUrl: ctx.resolveResourceUrl,
      });
      if (state.disposed) {
        return;
      }

      state.editor = await Editor.make()
        .config((editorCtx) => {
          editorCtx.set(rootCtx, surface);
          editorCtx.set(defaultValueCtx, markdown);
          configureRichTextMarkdown(editorCtx);
          editorCtx.update(editorViewOptionsCtx, (prev) => ({
            ...prev,
            editable: () => false,
            attributes: {
              ...(typeof prev.attributes === "object" ? prev.attributes : {}),
              spellcheck: "false",
              autocapitalize: "off",
              autocorrect: "off",
              translate: "no",
            },
          }));
        })
        .use(commonmark)
        .use(gfm)
        .use(richTextMarkdownPlugins)
        .create();

      if (state.disposed) {
        await state.editor.destroy();
        return;
      }

      const resolved = await rewriteRelativeResourceUrls(surface, ctx.resolveResourceUrl, ctx.openResource);
      resolved.forEach((resourcePath) => state.resolvedResources.add(resourcePath));
      hideStatus();
    } catch (error) {
      if (state.disposed) {
        return;
      }
      surface.innerHTML = "";
      setStatus(
        `${formatMessage("basecard.status.renderFailed")}：${error instanceof Error ? error.message : String(error)}`,
        "error",
      );
    }
  })();

  return () => {
    state.disposed = true;
    const destroyPromise = state.editor?.destroy();
    if (destroyPromise) {
      void destroyPromise;
    }
    if (ctx.releaseResourceUrl) {
      for (const resourcePath of state.resolvedResources) {
        void ctx.releaseResourceUrl(resourcePath);
      }
    }
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
  };
}

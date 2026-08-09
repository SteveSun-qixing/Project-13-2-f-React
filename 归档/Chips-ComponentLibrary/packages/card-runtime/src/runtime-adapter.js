import { toStandardError } from "./standard-error.js";
import {
  CardDisplayAdapterMethod,
  CompositeWindowMode
} from "./sdk-contract.js";

function assertFunction(target, key) {
  if (!target || typeof target[key] !== "function") {
    throw new Error(`CARD_RUNTIME_ADAPTER_INVALID:${key}`);
  }
}

export function validateCardDisplayAdapter(adapter) {
  assertFunction(adapter, CardDisplayAdapterMethod.RESOLVE_COVER_FRAME);
  assertFunction(adapter, CardDisplayAdapterMethod.RESOLVE_COMPOSITE_WINDOW);
  return true;
}

function normalizeCoverFrameResult(result, fallbackCardId) {
  if (!result || typeof result !== "object") {
    throw new Error("CARD_RUNTIME_ADAPTER_INVALID:resolveCoverFrame.result");
  }

  if (typeof result.coverUrl !== "string" || result.coverUrl.length === 0) {
    throw new Error("CARD_RUNTIME_ADAPTER_INVALID:resolveCoverFrame.coverUrl");
  }

  return {
    cardId: typeof result.cardId === "string" && result.cardId.length > 0 ? result.cardId : fallbackCardId,
    title: typeof result.title === "string" ? result.title : "",
    ratio: typeof result.ratio === "string" ? result.ratio : undefined,
    coverUrl: result.coverUrl
  };
}

function normalizeCompositeWindowResult(result, fallbackCardFile) {
  if (!result || typeof result !== "object") {
    throw new Error("CARD_RUNTIME_ADAPTER_INVALID:resolveCompositeWindow.result");
  }

  if (typeof result.frameUrl !== "string" || result.frameUrl.length === 0) {
    throw new Error("CARD_RUNTIME_ADAPTER_INVALID:resolveCompositeWindow.frameUrl");
  }

  return {
    cardId: typeof result.cardId === "string" && result.cardId.length > 0 ? result.cardId : fallbackCardFile,
    frameUrl: result.frameUrl,
    nodeCount: typeof result.nodeCount === "number" ? result.nodeCount : 0
  };
}

export async function loadCoverFrameData(adapter, input, options = {}) {
  validateCardDisplayAdapter(adapter);

  try {
    const result = await adapter.resolveCoverFrame({
      cardId: input.cardId,
      cardFile: input.cardFile,
      signal: options.signal
    });

    return normalizeCoverFrameResult(result, input.cardId || input.cardFile || "");
  } catch (error) {
    throw toStandardError(error, "CARD_RUNTIME_COVER_RESOLVE_FAILED");
  }
}

export async function loadCompositeWindowData(adapter, input, options = {}) {
  validateCardDisplayAdapter(adapter);

  try {
    const mode = input.mode || CompositeWindowMode.VIEW;
    if (mode !== CompositeWindowMode.VIEW && mode !== CompositeWindowMode.PREVIEW) {
      throw new Error("CARD_RUNTIME_ADAPTER_INVALID:resolveCompositeWindow.mode");
    }

    const result = await adapter.resolveCompositeWindow({
      cardFile: input.cardFile,
      mode,
      signal: options.signal
    });

    return normalizeCompositeWindowResult(result, input.cardFile || "");
  } catch (error) {
    throw toStandardError(error, "CARD_RUNTIME_COMPOSITE_RESOLVE_FAILED");
  }
}

/**
 * 演示文稿状态管理 Hook
 * 管理整个 PPTX 演示文稿的状态
 */
import { useCallback, useReducer, useRef, useState } from "react";
import { message } from "antd";
import type { Client } from "chips-sdk";
import {
  openPptx,
  savePptx,
  commitSaved,
  type OpenedPptx,
  type SlideDeck,
  type Slide,
  type SlideSize,
  createBlankPptx,
  listSlideLayouts,
  type SlideLayoutInfo,
} from "../../../engine/pptx-engine/src/index";
import { buildRenderSlide, type RenderSlide } from "../../../engine/pptx-render/src/index";
import type {
  DeckState,
  DeckOperationResult,
  SlideThumbnail,
  ZoomState,
  PptxParseOptions,
  ElementType,
  SlideElement,
} from "../types";

/** 兜底画布尺寸（16:9，单位 EMU），与 createBlankPptx 空白模板的 sldSz 保持一致 */
const FALLBACK_SLIDE_SIZE: SlideSize = { cx: 12192000, cy: 6858000 };

/** 保存结果：成功时附带序列化字节，供宿主 onSave 回调复用，避免二次压缩 */
export interface SaveFileResult extends DeckOperationResult {
  bytes?: Uint8Array;
}

// 初始状态
const initialDeckState: DeckState = {
  deck: null,
  archive: null,
  slides: [],
  currentSlideIndex: 0,
  selectedElementIds: [],
  isLoading: false,
  error: null,
  isDirty: false,
  filePath: null,
};

// Action 类型
type DeckAction =
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "SET_DECK"; payload: { deck: SlideDeck; archive: OpenedPptx["archive"] } }
  | { type: "SET_SLIDES"; payload: Slide[] }
  | { type: "SET_CURRENT_SLIDE"; payload: number }
  | { type: "SET_SELECTED_ELEMENTS"; payload: string[] }
  | { type: "ADD_SELECTED_ELEMENT"; payload: string }
  | { type: "REMOVE_SELECTED_ELEMENT"; payload: string }
  | { type: "CLEAR_SELECTION" }
  | { type: "SET_DIRTY"; payload: boolean }
  | { type: "SET_FILE_PATH"; payload: string | null }
  | { type: "RESET" };

// Reducer 函数
function deckReducer(state: DeckState, action: DeckAction): DeckState {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, isLoading: action.payload };
    case "SET_ERROR":
      return { ...state, error: action.payload, isLoading: false };
    case "SET_DECK":
      return {
        ...state,
        deck: action.payload.deck,
        archive: action.payload.archive,
        slides: action.payload.deck.slides,
        isLoading: false,
        isDirty: false,
        error: null,
      };
    case "SET_SLIDES":
      return { ...state, slides: action.payload };
    case "SET_CURRENT_SLIDE":
      return {
        ...state,
        currentSlideIndex: Math.max(0, Math.min(action.payload, state.slides.length - 1)),
      };
    case "SET_SELECTED_ELEMENTS":
      return { ...state, selectedElementIds: action.payload };
    case "ADD_SELECTED_ELEMENT":
      if (state.selectedElementIds.includes(action.payload)) {
        return state;
      }
      return { ...state, selectedElementIds: [...state.selectedElementIds, action.payload] };
    case "REMOVE_SELECTED_ELEMENT":
      return {
        ...state,
        selectedElementIds: state.selectedElementIds.filter((id) => id !== action.payload),
      };
    case "CLEAR_SELECTION":
      return { ...state, selectedElementIds: [] };
    case "SET_DIRTY":
      return { ...state, isDirty: action.payload };
    case "SET_FILE_PATH":
      return { ...state, filePath: action.payload };
    case "RESET":
      return initialDeckState;
    default:
      return state;
  }
}

// 缩放状态初始值
const initialZoomState: ZoomState = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  fitMode: "fit",
};

/**
 * 演示文稿状态管理 Hook
 */
export function useDeck(client?: Client) {
  const [state, dispatch] = useReducer(deckReducer, initialDeckState);
  const [zoomState, setZoomState] = useReducer(
    (s: ZoomState, a: Partial<ZoomState>) => ({ ...s, ...a }),
    initialZoomState,
  );
  const [isSaving, setIsSaving] = useState(false);
  const openedPptxRef = useRef<OpenedPptx | null>(null);
  const isSavingRef = useRef(false);

  /**
   * 加载 PPTX 文件
   */
  const loadFile = useCallback(
    async (
      data: ArrayBuffer | Uint8Array | Blob,
      fileName?: string,
    ): Promise<DeckOperationResult> => {
      dispatch({ type: "SET_LOADING", payload: true });
      dispatch({ type: "SET_ERROR", payload: null });

      try {
        let bytes: Uint8Array;
        if (data instanceof Blob) {
          bytes = new Uint8Array(await data.arrayBuffer());
        } else if (data instanceof Uint8Array) {
          bytes = data;
        } else {
          bytes = new Uint8Array(data);
        }
        const opened: OpenedPptx = await openPptx(bytes);
        openedPptxRef.current = opened;
        dispatch({
          type: "SET_DECK",
          payload: { deck: opened.deck, archive: opened.archive },
        });
        if (fileName) {
          dispatch({ type: "SET_FILE_PATH", payload: fileName });
        }
        return { success: true };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "加载文件失败";
        dispatch({ type: "SET_ERROR", payload: errorMessage });
        return { success: false, error: errorMessage };
      }
    },
    [],
  );

  /**
   * 创建空白演示文稿
   */
  const createNew = useCallback(async (): Promise<DeckOperationResult> => {
    dispatch({ type: "SET_LOADING", payload: true });

    try {
      const bytes = await createBlankPptx();
      return await loadFile(bytes, "新建演示文稿.pptx");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "创建演示文稿失败";
      dispatch({ type: "SET_ERROR", payload: errorMessage });
      return { success: false, error: errorMessage };
    }
  }, [loadFile]);

  /**
   * 保存演示文稿
   *
   * 链路：引擎 savePptx 序列化 → 万能文件会话写回（file.session.open →
   * write → persist → close）→ commitSaved 把补丁烘焙回 archive 并清除脏标记。
   * 任一步骤失败时保留脏状态，下次保存重试。
   */
  const saveFile = useCallback(async (): Promise<SaveFileResult> => {
    const opened = openedPptxRef.current;
    if (!opened) {
      return { success: false, error: "没有打开的演示文稿" };
    }
    if (isSavingRef.current) {
      return { success: false, error: "正在保存中，请稍候" };
    }

    isSavingRef.current = true;
    setIsSaving(true);
    try {
      const bytes = await savePptx(opened);

      if (client && state.filePath) {
        const session = await client.file.session.open({
          filePath: state.filePath,
          format: "pptx",
        });
        try {
          await client.file.session.write({ sessionId: session.sessionId, bytes });
          await client.file.session.persist({ sessionId: session.sessionId });
        } finally {
          await client.file.session
            .close({ sessionId: session.sessionId })
            .catch(() => undefined);
        }
      }

      // 序列化与会话写回均成功后，把补丁烘焙进 archive 并清除元素脏标记
      commitSaved(opened);
      dispatch({ type: "SET_DIRTY", payload: false });
      message.success("保存成功");
      return { success: true, bytes };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "保存失败";
      message.error(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  }, [client, state.filePath]);

  /**
   * 关闭当前演示文稿
   */
  const closeFile = useCallback(() => {
    openedPptxRef.current = null;
    dispatch({ type: "RESET" });
  }, []);

  /**
   * 切换到指定幻灯片
   */
  const goToSlide = useCallback(
    (index: number) => {
      if (index >= 0 && index < state.slides.length) {
        dispatch({ type: "SET_CURRENT_SLIDE", payload: index });
        dispatch({ type: "CLEAR_SELECTION" });
      }
    },
    [state.slides.length],
  );

  /**
   * 切换到上一张幻灯片
   */
  const previousSlide = useCallback(() => {
    goToSlide(state.currentSlideIndex - 1);
  }, [goToSlide, state.currentSlideIndex]);

  /**
   * 切换到下一张幻灯片
   */
  const nextSlide = useCallback(() => {
    goToSlide(state.currentSlideIndex + 1);
  }, [goToSlide, state.currentSlideIndex]);

  /**
   * 选择元素
   */
  const selectElement = useCallback(
    (elementId: string, addToSelection = false) => {
      if (addToSelection) {
        dispatch({ type: "ADD_SELECTED_ELEMENT", payload: elementId });
      } else {
        dispatch({ type: "SET_SELECTED_ELEMENTS", payload: [elementId] });
      }
    },
    [],
  );

  /**
   * 清除选择
   */
  const clearSelection = useCallback(() => {
    dispatch({ type: "CLEAR_SELECTION" });
  }, []);

  /**
   * 获取当前幻灯片
   */
  const getCurrentSlide = useCallback((): Slide | null => {
    return state.slides[state.currentSlideIndex] ?? null;
  }, [state.slides, state.currentSlideIndex]);

  /**
   * 获取当前幻灯片的渲染数据
   */
  const getCurrentRenderSlide = useCallback(
    (options: PptxParseOptions): RenderSlide | null => {
      const slide = getCurrentSlide();
      if (!slide || !state.deck) {
        return null;
      }
      return buildRenderSlide(slide, state.deck.size, options);
    },
    [getCurrentSlide, state.deck],
  );

  /**
   * 获取所有幻灯片缩略图
   */
  const getSlideThumbnails = useCallback(
    (options: PptxParseOptions): SlideThumbnail[] => {
      const fitWidthPx = Math.min(options.fitWidthPx, 200);
      return state.slides.map((slide, index) => {
        let renderSlide: RenderSlide | null = null;
        try {
          renderSlide = buildRenderSlide(slide, state.deck?.size ?? FALLBACK_SLIDE_SIZE, {
            ...options,
            fitWidthPx,
          });
        } catch {
          renderSlide = null;
        }
        return {
          index,
          slide,
          renderSlide,
          isSelected: state.selectedElementIds.length > 0,
          isCurrent: index === state.currentSlideIndex,
        };
      });
    },
    [state.slides, state.deck, state.currentSlideIndex, state.selectedElementIds],
  );

  /**
   * 获取元素类型
   */
  const getElementType = useCallback((element: SlideElement): ElementType => {
    return element.type as ElementType;
  }, []);

  /**
   * 设置缩放级别
   */
  const setZoom = useCallback(
    (scale: number, fitMode?: ZoomState["fitMode"]) => {
      setZoomState({
        scale: Math.max(0.1, Math.min(4, scale)),
        ...(fitMode !== undefined ? { fitMode } : {}),
      });
    },
    [],
  );

  /**
   * 标记为已修改
   */
  const markDirty = useCallback(() => {
    dispatch({ type: "SET_DIRTY", payload: true });
  }, []);

  /**
   * 获取可用布局列表
   */
  const getAvailableLayouts = useCallback((): SlideLayoutInfo[] => {
    if (!state.archive) {
      return [];
    }
    return listSlideLayouts(state.archive);
  }, [state.archive]);

  return {
    // 状态
    deck: state.deck,
    /** 当前打开的压缩包（PackageArchive），与 deck 同源于 openPptx 结果 */
    archive: state.archive,
    slides: state.slides,
    currentSlideIndex: state.currentSlideIndex,
    selectedElementIds: state.selectedElementIds,
    isLoading: state.isLoading,
    error: state.error,
    isDirty: state.isDirty,
    isSaving,
    filePath: state.filePath,
    zoomState,

    // 操作
    loadFile,
    createNew,
    saveFile,
    closeFile,
    goToSlide,
    previousSlide,
    nextSlide,
    selectElement,
    clearSelection,
    getCurrentSlide,
    getCurrentRenderSlide,
    getSlideThumbnails,
    getElementType,
    setZoom,
    markDirty,
    getAvailableLayouts,
  };
}

/** 导出类型 */
export type UseDeckReturn = ReturnType<typeof useDeck>;

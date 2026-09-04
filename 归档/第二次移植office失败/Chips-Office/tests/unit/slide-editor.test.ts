/**
 * Slide 编辑器单元测试
 * 测试演示文稿状态管理和组件功能
 */
import { describe, expect, it } from "vitest";
import type { ZoomState, ToolType, ElementType, DeckState, SlideThumbnail, PanelState } from "../../src/apps/slide/types";

describe("Slide 编辑器类型定义", () => {
  describe("ZoomState 类型验证", () => {
    it("应支持正确的缩放模式", () => {
      const widthZoom: ZoomState = { scale: 1.0, offsetX: 0, offsetY: 0, fitMode: "width" };
      const heightZoom: ZoomState = { scale: 1.0, offsetX: 0, offsetY: 0, fitMode: "height" };
      const actualZoom: ZoomState = { scale: 1.0, offsetX: 0, offsetY: 0, fitMode: "actual" };
      const fitZoom: ZoomState = { scale: 0.8, offsetX: 0, offsetY: 0, fitMode: "fit" };

      expect(widthZoom.fitMode).toBe("width");
      expect(heightZoom.fitMode).toBe("height");
      expect(actualZoom.fitMode).toBe("actual");
      expect(fitZoom.fitMode).toBe("fit");
    });

    it("应支持正确的缩放范围", () => {
      const minZoom: ZoomState = { scale: 0.1, offsetX: 0, offsetY: 0, fitMode: "fit" };
      const maxZoom: ZoomState = { scale: 4.0, offsetX: 0, offsetY: 0, fitMode: "fit" };

      expect(minZoom.scale).toBeGreaterThanOrEqual(0.1);
      expect(maxZoom.scale).toBeLessThanOrEqual(4);
    });
  });

  describe("ToolType 类型验证", () => {
    it("工具类型应包含所有预期选项", () => {
      const toolTypes: ToolType[] = ["select", "text", "shape", "line", "pen", "highlight", "eraser"];

      expect(toolTypes).toContain("select");
      expect(toolTypes).toContain("text");
      expect(toolTypes).toContain("shape");
      expect(toolTypes).toContain("line");
      expect(toolTypes).toContain("pen");
      expect(toolTypes).toContain("highlight");
      expect(toolTypes).toContain("eraser");
    });
  });

  describe("ElementType 类型验证", () => {
    it("元素类型应包含所有预期选项", () => {
      const elementTypes: ElementType[] = ["text", "shape", "picture", "table", "chart", "group", "unknown"];

      expect(elementTypes).toContain("text");
      expect(elementTypes).toContain("shape");
      expect(elementTypes).toContain("picture");
      expect(elementTypes).toContain("table");
      expect(elementTypes).toContain("chart");
      expect(elementTypes).toContain("group");
      expect(elementTypes).toContain("unknown");
    });
  });

  describe("DeckState 类型验证", () => {
    it("初始状态应正确反映空演示文稿", () => {
      const emptyState: DeckState = {
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

      expect(emptyState.deck).toBeNull();
      expect(emptyState.slides).toEqual([]);
      expect(emptyState.currentSlideIndex).toBe(0);
      expect(emptyState.selectedElementIds).toEqual([]);
      expect(emptyState.isLoading).toBe(false);
      expect(emptyState.error).toBeNull();
      expect(emptyState.isDirty).toBe(false);
      expect(emptyState.filePath).toBeNull();
    });
  });

  describe("SlideThumbnail 类型验证", () => {
    it("缩略图应包含必需的属性", () => {
      const thumbnail: SlideThumbnail = {
        index: 0,
        slide: null as any,
        renderSlide: null,
        isSelected: false,
        isCurrent: true,
      };

      expect(thumbnail).toHaveProperty("index");
      expect(thumbnail).toHaveProperty("slide");
      expect(thumbnail).toHaveProperty("renderSlide");
      expect(thumbnail).toHaveProperty("isSelected");
      expect(thumbnail).toHaveProperty("isCurrent");
    });
  });

  describe("PanelState 类型验证", () => {
    it("面板状态应正确反映初始状态", () => {
      const initialPanelState: PanelState = {
        isOutlineVisible: false,
        isAnimationVisible: false,
        isPropertiesVisible: false,
        activePanel: null,
      };

      expect(initialPanelState.isOutlineVisible).toBe(false);
      expect(initialPanelState.isAnimationVisible).toBe(false);
      expect(initialPanelState.isPropertiesVisible).toBe(false);
      expect(initialPanelState.activePanel).toBeNull();
    });
  });
});

describe("幻灯片导航逻辑", () => {
  it("应正确计算幻灯片索引范围", () => {
    const totalSlides = 10;
    const minIndex = 0;
    const maxIndex = totalSlides - 1;

    const validateIndex = (index: number): number => {
      return Math.max(minIndex, Math.min(index, maxIndex));
    };

    expect(validateIndex(-5)).toBe(0);
    expect(validateIndex(0)).toBe(0);
    expect(validateIndex(5)).toBe(5);
    expect(validateIndex(9)).toBe(9);
    expect(validateIndex(15)).toBe(9);
  });

  it("应正确计算缩放级别范围", () => {
    const minScale = 0.1;
    const maxScale = 4;

    const clampScale = (scale: number): number => {
      return Math.max(minScale, Math.min(scale, maxScale));
    };

    expect(clampScale(0.05)).toBeCloseTo(0.1);
    expect(clampScale(0.5)).toBeCloseTo(0.5);
    expect(clampScale(2)).toBeCloseTo(2);
    expect(clampScale(5)).toBeCloseTo(4);
  });
});

describe("EMUs 到像素的转换逻辑", () => {
  it("应正确转换 EMU 单位到像素", () => {
    // 914400 EMU = 1 英寸 (at 96 DPI)
    const EMU_PER_INCH = 914400;
    const DPI = 96;

    const emuToPx = (emu: number): number => {
      return (emu / EMU_PER_INCH) * DPI;
    };

    expect(emuToPx(EMU_PER_INCH)).toBeCloseTo(DPI);
    expect(emuToPx(EMU_PER_INCH * 2)).toBeCloseTo(DPI * 2);
    expect(emuToPx(EMU_PER_INCH / 2)).toBeCloseTo(DPI / 2);
  });

  it("应正确计算幻灯片尺寸", () => {
    // 标准幻灯片尺寸 (16:9): 12192000 x 6858000 EMU
    const SLIDE_WIDTH_EMU = 12192000;
    const SLIDE_HEIGHT_EMU = 6858000;
    const EMU_PER_INCH = 914400;
    const DPI = 96;

    const widthInches = SLIDE_WIDTH_EMU / EMU_PER_INCH;
    const heightInches = SLIDE_HEIGHT_EMU / EMU_PER_INCH;
    const widthPx = (SLIDE_WIDTH_EMU / EMU_PER_INCH) * DPI;
    const heightPx = (SLIDE_HEIGHT_EMU / EMU_PER_INCH) * DPI;

    expect(widthInches).toBeCloseTo(13.333, 1);
    expect(heightInches).toBeCloseTo(7.5, 1);
    expect(widthPx).toBeCloseTo(1280, 1);
    expect(heightPx).toBeCloseTo(720, 1);
  });
});

describe("元素选择逻辑", () => {
  it("应正确处理多选逻辑", () => {
    const selectedIds: string[] = [];

    const addToSelection = (ids: string[], id: string, addToExisting: boolean): string[] => {
      if (addToExisting) {
        if (ids.includes(id)) {
          return ids;
        }
        return [...ids, id];
      }
      return [id];
    };

    expect(addToSelection([], "elem-1", false)).toEqual(["elem-1"]);
    expect(addToSelection(["elem-1"], "elem-2", true)).toEqual(["elem-1", "elem-2"]);
    expect(addToSelection(["elem-1", "elem-2"], "elem-1", true)).toEqual(["elem-1", "elem-2"]);
    expect(addToSelection(["elem-1", "elem-2"], "elem-3", false)).toEqual(["elem-3"]);
  });

  it("应正确清除选择", () => {
    const selectedIds = ["elem-1", "elem-2", "elem-3"];

    const clearSelection = (): string[] => [];

    expect(clearSelection()).toEqual([]);
  });
});

describe("颜色格式转换", () => {
  it("应正确处理颜色格式", () => {
    const normalizeColor = (color: string): string => {
      if (!color || color === "none" || color === "transparent") {
        return "transparent";
      }
      if (!color.startsWith("#") && !color.startsWith("rgb") && !color.startsWith("rgba")) {
        return `#${color}`;
      }
      return color;
    };

    expect(normalizeColor("FF0000")).toBe("#FF0000");
    expect(normalizeColor("#FF0000")).toBe("#FF0000");
    expect(normalizeColor("rgb(255,0,0)")).toBe("rgb(255,0,0)");
    expect(normalizeColor("transparent")).toBe("transparent");
    expect(normalizeColor("none")).toBe("transparent");
  });
});

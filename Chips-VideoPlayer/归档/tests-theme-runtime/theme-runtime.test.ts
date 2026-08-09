import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_THEME_STATE, readDocumentThemeState } from "../../src/runtime/theme-runtime";

describe("video player theme runtime", () => {
  const originalDocumentDescriptor = Object.getOwnPropertyDescriptor(globalThis, "document");

  afterEach(() => {
    if (originalDocumentDescriptor) {
      Object.defineProperty(globalThis, "document", originalDocumentDescriptor);
      return;
    }

    Reflect.deleteProperty(globalThis, "document");
  });

  it("无 DOM 环境时使用正式默认主题快照", () => {
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: undefined,
    });

    expect(readDocumentThemeState()).toEqual(DEFAULT_THEME_STATE);
  });

  it("从 Host 注入的 documentElement 属性恢复主题 id 与版本", () => {
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: {
        documentElement: {
          getAttribute(name: string) {
            if (name === "data-chips-theme-id") {
              return "chips-official.dark-theme";
            }

            if (name === "data-chips-theme-version") {
              return "2.0.0";
            }

            return null;
          },
        },
      },
    });

    expect(readDocumentThemeState()).toEqual({
      themeId: "chips-official.dark-theme",
      version: "2.0.0",
    });
  });
});

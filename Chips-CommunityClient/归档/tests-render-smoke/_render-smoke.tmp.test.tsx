// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { act } from "react";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createRoot, type Root } from "react-dom/client";
import { App } from "../../src/App";

describe("render smoke (临时验证)", () => {
  it("应能挂载 App 根组件而不抛异常", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root: Root = createRoot(container);

    let error: unknown = null;
    try {
      await act(async () => {
        root.render(<App />);
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    } catch (nextError) {
      error = nextError;
    }

    await act(async () => {
      root.unmount();
    });
    container.remove();
    expect(error).toBeNull();
  });
});

// @vitest-environment jsdom
import { describe, expect, it, afterEach } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { ReactNode } from "react";
import { EmbeddedDocumentFrame } from "../src/components/EmbeddedDocumentFrame";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function renderFrame(ui: ReactNode): { container: HTMLElement; unmount: () => void } {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(ui);
  });
  return {
    container,
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

function getFrameSurface(container: HTMLElement): HTMLElement {
  const surface = container.querySelector(".chips-embedded-document-frame");
  if (!(surface instanceof HTMLElement)) {
    throw new Error("EmbeddedDocumentFrame surface not found.");
  }
  return surface;
}

function getIframe(container: HTMLElement): HTMLIFrameElement {
  const frame = container.querySelector("iframe");
  if (!(frame instanceof HTMLIFrameElement)) {
    throw new Error("iframe not found.");
  }
  return frame;
}

function mockSurfaceWidth(container: HTMLElement, width: number): void {
  const surface = getFrameSurface(container);
  Object.defineProperty(surface, "clientWidth", {
    configurable: true,
    get: () => width,
  });
}

function resizeWindow(): void {
  window.dispatchEvent(new Event("resize"));
}

function reportHeight(container: HTMLElement, height: number, source?: MessageEventSource | null): void {
  const iframe = getIframe(container);
  window.dispatchEvent(
    new MessageEvent("message", {
      data: { type: "chips.embedded-frame:height", height },
      source: source === undefined ? iframe.contentWindow : source,
    }),
  );
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("EmbeddedDocumentFrame", () => {
  it("ratio 模式保持原有宽高比行为", () => {
    const { container, unmount } = renderFrame(
      <EmbeddedDocumentFrame srcDoc="<p>hi</p>" ratio="16:5" sandbox="allow-scripts" />,
    );
    const surface = getFrameSurface(container);
    expect(surface.style.aspectRatio).toBe("16 / 5");
    expect(getIframe(container).getAttribute("srcdoc")).not.toContain("chips.embedded-frame:height");
    unmount();
  });

  it("autoHeight 模式向 srcDoc 注入高度上报脚本", () => {
    const { container, unmount } = renderFrame(
      <EmbeddedDocumentFrame
        srcDoc="<section>content</section>"
        autoHeight
        maxHeightFactor={3}
        sandbox="allow-scripts"
      />,
    );
    expect(getIframe(container).getAttribute("srcdoc")).toContain("chips.embedded-frame:height");
    expect(getIframe(container).getAttribute("srcdoc")).toContain("<section>content</section>");
    unmount();
  });

  it("autoHeight 模式下加载遮罩背景透明", () => {
    const { container, unmount } = renderFrame(
      <EmbeddedDocumentFrame srcDoc="<p>hi</p>" autoHeight sandbox="allow-scripts" />,
    );
    const surface = getFrameSurface(container);
    const overlay = surface.querySelector("div[style*='position: absolute']");
    expect(overlay).toBeTruthy();
    expect((overlay as HTMLElement).style.background).toBe("transparent");
    unmount();
  });

  it("autoHeight 无测量值时回退到 maxHeightFactor 与容器宽度的乘积", () => {
    const { container, unmount } = renderFrame(
      <EmbeddedDocumentFrame srcDoc="<p>hi</p>" autoHeight maxHeightFactor={3} sandbox="allow-scripts" />,
    );
    mockSurfaceWidth(container, 200);
    act(() => {
      resizeWindow();
    });
    expect(getFrameSurface(container).style.height).toBe("600px");
    unmount();
  });

  it("autoHeight 按上报高度显示，并以 maxHeightFactor 为上限", () => {
    const { container, unmount } = renderFrame(
      <EmbeddedDocumentFrame srcDoc="<p>hi</p>" autoHeight maxHeightFactor={3} sandbox="allow-scripts" />,
    );
    mockSurfaceWidth(container, 200);
    act(() => {
      resizeWindow();
    });
    act(() => {
      reportHeight(container, 400);
    });
    expect(getFrameSurface(container).style.height).toBe("400px");
    act(() => {
      reportHeight(container, 900);
    });
    expect(getFrameSurface(container).style.height).toBe("600px");
    unmount();
  });

  it("autoHeight 无 maxHeightFactor 时不设上限", () => {
    const { container, unmount } = renderFrame(
      <EmbeddedDocumentFrame srcDoc="<p>hi</p>" autoHeight sandbox="allow-scripts" />,
    );
    mockSurfaceWidth(container, 200);
    act(() => {
      resizeWindow();
    });
    expect(getFrameSurface(container).style.height).toBe("");
    act(() => {
      reportHeight(container, 500);
    });
    expect(getFrameSurface(container).style.height).toBe("500px");
    unmount();
  });

  it("非本帧来源的上报消息被忽略", () => {
    const { container, unmount } = renderFrame(
      <EmbeddedDocumentFrame srcDoc="<p>hi</p>" autoHeight sandbox="allow-scripts" />,
    );
    act(() => {
      reportHeight(container, 300, null);
    });
    expect(getFrameSurface(container).style.height).toBe("");
    unmount();
  });

  it("测量完成后隐藏加载遮罩", () => {
    const { container, unmount } = renderFrame(
      <EmbeddedDocumentFrame srcDoc="<p>hi</p>" autoHeight sandbox="allow-scripts" />,
    );
    const surface = getFrameSurface(container);
    const iframe = getIframe(container);
    act(() => {
      iframe.dispatchEvent(new Event("load"));
    });
    expect(surface.querySelector(".ant-spin")).toBeTruthy();
    act(() => {
      reportHeight(container, 320);
    });
    expect(surface.querySelector(".ant-spin")).toBeNull();
    expect(surface.style.height).toBe("320px");
    unmount();
  });
});

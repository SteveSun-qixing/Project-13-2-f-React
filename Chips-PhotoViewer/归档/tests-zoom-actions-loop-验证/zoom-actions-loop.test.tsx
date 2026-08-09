import React, { useCallback, useEffect, useRef, useState } from "react";
import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

interface CameraLike {
  handleZoom: (direction: "in" | "out") => void;
}

function Child({ register }: { register: (a: unknown) => void }): React.ReactElement {
  const camera: CameraLike = { handleZoom: () => undefined };
  const renderCount = useRef(0);
  renderCount.current += 1;

  useEffect(() => {
    register({ zoomIn: () => camera.handleZoom("in") });
    return () => register(null);
  }, [camera, register]);

  return <span data-render-count={renderCount.current} />;
}

function Parent(): React.ReactElement {
  const [actions, setActions] = useState<unknown>(null);
  const register = useCallback((a: unknown) => setActions(a), []);
  return <Child register={register} />;
}

describe("zoomActions 模式渲染循环复现", () => {
  const containers: HTMLDivElement[] = [];
  const roots: Root[] = [];

  function mount(node: React.ReactElement): HTMLDivElement {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    containers.push(container);
    roots.push(root);
    act(() => {
      root.render(node);
    });
    return container;
  }

  afterEach(() => {
    roots.forEach((root) => root.unmount());
    containers.forEach((container) => container.remove());
    containers.length = 0;
    roots.length = 0;
  });

  it("复现 camera 新引用 + setState 注册导致的无限渲染", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    let crashed = false;
    try {
      mount(<Parent />);
    } catch {
      crashed = true;
    }
    errorSpy.mockRestore();
    expect(crashed).toBe(true);
  });
});

// @vitest-environment jsdom
import React, { act, useCallback, useEffect, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
testGlobal.IS_REACT_ACT_ENVIRONMENT = true;

interface ZoomActionsLike {
  zoomIn: () => void;
}

const BROKEN_RENDER_CAP = 80;

let bumpParentTick: (() => void) | null = null;
const registeredActions = { current: null as ZoomActionsLike | null };
let zoomInCallCount = 0;
let brokenPatternMaxRenderCount = 0;

function ZoomChild({ register }: { register: (actions: ZoomActionsLike | null) => void }): React.ReactElement {
  const renderCountRef = useRef(0);
  renderCountRef.current += 1;
  const cameraRef = useRef<ZoomActionsLike | null>(null);
  cameraRef.current = {
    zoomIn: () => {
      zoomInCallCount += 1;
    },
  };

  useEffect(() => {
    register({ zoomIn: () => cameraRef.current?.zoomIn() });
    return () => register(null);
  }, [register]);

  return <span data-render-count={renderCountRef.current} />;
}

function RefChannelParent(): React.ReactElement {
  const [, setTick] = useState(0);
  bumpParentTick = () => setTick((value) => value + 1);

  const register = useCallback((actions: ZoomActionsLike | null): void => {
    registeredActions.current = actions;
  }, []);

  return <ZoomChild register={register} />;
}

function BrokenZoomChild({ register }: { register: (actions: ZoomActionsLike | null) => void }): React.ReactElement {
  const renderCountRef = useRef(0);
  renderCountRef.current += 1;
  brokenPatternMaxRenderCount = Math.max(brokenPatternMaxRenderCount, renderCountRef.current);
  if (renderCountRef.current > BROKEN_RENDER_CAP) {
    throw new Error(`检测到渲染循环：组件已渲染 ${renderCountRef.current} 次`);
  }

  const camera: ZoomActionsLike = { zoomIn: () => undefined };

  useEffect(() => {
    register({ zoomIn: () => camera.zoomIn() });
    return () => register(null);
  }, [camera, register]);

  return <span data-render-count={renderCountRef.current} />;
}

function BrokenParent(): React.ReactElement {
  const [, setActions] = useState<ZoomActionsLike | null>(null);
  const register = useCallback((actions: ZoomActionsLike | null): void => {
    setActions(actions);
  }, []);

  return <BrokenZoomChild register={register} />;
}

describe("zoomActions ref 通道渲染循环回归", () => {
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

  beforeEach(() => {
    bumpParentTick = null;
    registeredActions.current = null;
    zoomInCallCount = 0;
    brokenPatternMaxRenderCount = 0;
  });

  afterEach(() => {
    roots.forEach((root) => root.unmount());
    containers.forEach((container) => container.remove());
    containers.length = 0;
    roots.length = 0;
  });

  it("能检测到旧的 setState 注册通道导致的无限渲染（回归守卫）", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    let threw = false;
    try {
      mount(<BrokenParent />);
    } catch {
      threw = true;
    }
    errorSpy.mockRestore();

    expect(threw).toBe(true);
    expect(brokenPatternMaxRenderCount).toBeGreaterThan(10);
  });

  it("ref 注册通道下渲染次数稳定且动作通道可调用最新 camera", () => {
    const container = mount(<RefChannelParent />);
    const readRenderCount = (): string | null =>
      container.querySelector("[data-render-count]")?.getAttribute("data-render-count") ?? null;

    expect(readRenderCount()).toBe("1");

    act(() => bumpParentTick?.());
    act(() => bumpParentTick?.());

    expect(readRenderCount()).toBe("3");

    expect(registeredActions.current).not.toBeNull();
    registeredActions.current?.zoomIn();
    expect(zoomInCallCount).toBe(1);

    act(() => {
      roots[0]?.unmount();
    });
    expect(registeredActions.current).toBeNull();
  });
});

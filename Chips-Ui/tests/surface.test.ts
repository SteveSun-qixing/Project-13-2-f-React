import { describe, expect, it } from "vitest";
import type { PlatformLaunchContext } from "chips-sdk";
import {
  resolveHostSceneId,
  resolveLaunchParams,
  resolveSurfaceKind,
} from "../src/runtime/surface";

const baseContext: PlatformLaunchContext = {
  pluginId: "com.chips.test",
  sceneId: "scene.top",
  kind: "window",
  launchParams: { trigger: "app-shortcut" },
};

describe("resolveHostSceneId", () => {
  it("surfaceContext 优先", () => {
    const ctx: PlatformLaunchContext = {
      ...baseContext,
      surfaceContext: {
        sceneId: "scene.inner",
        kind: "window",
        presentation: { title: "t" },
        launchParams: { inner: true },
      },
    };
    expect(resolveHostSceneId(ctx, "fallback")).toBe("scene.inner");
  });

  it("无 surfaceContext 时回退顶层 sceneId", () => {
    expect(resolveHostSceneId(baseContext, "fallback")).toBe("scene.top");
  });

  it("均缺失时回退 fallback", () => {
    expect(resolveHostSceneId({ launchParams: {} }, "fallback")).toBe("fallback");
    expect(resolveHostSceneId(null, "fallback")).toBe("fallback");
    expect(resolveHostSceneId(undefined, "fallback")).toBe("fallback");
  });
});

describe("resolveSurfaceKind", () => {
  it("surfaceContext 优先", () => {
    const ctx: PlatformLaunchContext = {
      ...baseContext,
      surfaceContext: {
        sceneId: "scene.inner",
        kind: "tab",
        presentation: { title: "t" },
        launchParams: {},
      },
    };
    expect(resolveSurfaceKind(ctx)).toBe("tab");
  });

  it("回退顶层 kind，缺省为 window", () => {
    expect(resolveSurfaceKind(baseContext)).toBe("window");
    expect(resolveSurfaceKind({ launchParams: {} })).toBe("window");
    expect(resolveSurfaceKind(null)).toBe("window");
  });
});

describe("resolveLaunchParams", () => {
  it("合并 surfaceContext 与顶层 launchParams（surface 优先，默认）", () => {
    const ctx: PlatformLaunchContext = {
      ...baseContext,
      surfaceContext: {
        sceneId: "scene.inner",
        kind: "window",
        presentation: { title: "t" },
        launchParams: { trigger: "file-association", inner: true },
      },
    };
    expect(resolveLaunchParams(ctx)).toEqual({ trigger: "file-association", inner: true });
  });

  it("surfacePriority: false 时顶层 launchParams 覆盖 surfaceContext", () => {
    const ctx: PlatformLaunchContext = {
      ...baseContext,
      surfaceContext: {
        sceneId: "scene.inner",
        kind: "window",
        presentation: { title: "t" },
        launchParams: { trigger: "file-association", inner: true },
      },
    };
    expect(resolveLaunchParams(ctx, { surfacePriority: false })).toEqual({
      trigger: "app-shortcut",
      inner: true,
    });
  });

  it("无 surfaceContext 时返回顶层 launchParams", () => {
    expect(resolveLaunchParams(baseContext)).toEqual({ trigger: "app-shortcut" });
    expect(resolveLaunchParams(null)).toEqual({});
  });
});

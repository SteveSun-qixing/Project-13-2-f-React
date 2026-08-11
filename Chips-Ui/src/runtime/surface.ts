import type { PlatformLaunchContext } from "chips-sdk";

/**
 * launch context 解析门面（工单137 收口）。
 * 各应用插件共享的 surface/scene/launchParams 解析逻辑统一收拢于此，
 * 语义与各应用原有本地实现逐字等价（surfaceContext 优先，逐级 fallback）。
 */

export function resolveHostSceneId(
  launchContext: PlatformLaunchContext | null | undefined,
  fallbackSceneId: string,
): string {
  return launchContext?.surfaceContext?.sceneId ?? launchContext?.sceneId ?? fallbackSceneId;
}

export function resolveSurfaceKind(
  launchContext: PlatformLaunchContext | null | undefined,
): string {
  return launchContext?.surfaceContext?.kind ?? launchContext?.kind ?? "window";
}

export interface ResolveLaunchParamsOptions {
  /**
   * 合并顺序（保持各应用原有语义，工单137 核实）：
   * - true（默认）：surfaceContext.launchParams 覆盖顶层 launchParams
   *   （MusicPlayer/PhotoViewer/CardViewer/EcoSettingsPanel 原语义）
   * - false：顶层 launchParams 覆盖 surfaceContext.launchParams
   *   （BookReader/RichTextEditor 原语义）
   */
  surfacePriority?: boolean;
}

export function resolveLaunchParams(
  launchContext: PlatformLaunchContext | null | undefined,
  options: ResolveLaunchParamsOptions = {},
): Record<string, unknown> {
  const { surfacePriority = true } = options;
  const topLevel = launchContext?.launchParams ?? {};
  const surfaceLevel = launchContext?.surfaceContext?.launchParams ?? {};

  return surfacePriority
    ? { ...topLevel, ...surfaceLevel }
    : { ...surfaceLevel, ...topLevel };
}

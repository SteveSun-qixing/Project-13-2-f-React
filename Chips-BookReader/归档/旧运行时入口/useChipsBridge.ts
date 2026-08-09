export interface ChipsBridgeLike {
  on?: (event: string, handler: (payload: unknown) => void) => (() => void) | void;
  emit?: (event: string, payload?: unknown) => Promise<unknown>;
  platform?: {
    getLaunchContext?: () => {
      launchParams?: Record<string, unknown>;
    };
  };
}

export function useChipsBridge(): ChipsBridgeLike {
  const bridge = (window as Window & { chips?: ChipsBridgeLike }).chips;
  if (!bridge) {
    throw new Error("window.chips 未注入，请确认在 Host 环境中运行或检查 Bridge 配置。");
  }
  return bridge;
}

export function useChipsBridge(): any {
  const bridge = (window as any).chips;
  if (!bridge) {
    // 为了在开发阶段尽早暴露问题，这里直接抛错
    throw new Error("window.chips 未注入，请确认在 Host 环境中运行或检查 Bridge 配置。");
  }
  return bridge;
}


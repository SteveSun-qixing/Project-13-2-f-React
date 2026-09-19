/**
 * 窗口运行环境上下文（`ChipsProvider` / `useChips`）。
 *
 * 契约：《08-@chips-ui共享层使用指南》§2.3——`ChipsContextValue` 只暴露 `appId` 与 `surface`；
 * `ChipsProvider` 同时安装 fork antd 主题根（Design Tokens）、简体中文环境与 antd App 上下文。
 */

import { createContext, useContext } from 'react';

/** 应用窗口形态；`tray` 表面不装载窗口 UI。 */
export type ChipsSurface = 'window' | 'desktop';

/** 窗口运行环境值。 */
export interface ChipsContextValue {
  /** 应用插件 ID，与 manifest `id` 一致。 */
  readonly appId: string;
  /** 应用窗口形态：标准窗口 / 桌面层。 */
  readonly surface: ChipsSurface;
}

/** 窗口运行环境上下文；未挂载 `ChipsProvider` 时为 `null`。 */
export const ChipsContext = createContext<ChipsContextValue | null>(null);

/**
 * 读取窗口运行环境。
 *
 * @returns 当前窗口的 `appId` 与 `surface`
 * @throws {Error} 未在 `ChipsProvider` 内调用时抛出简体中文错误
 */
export function useChips(): ChipsContextValue {
  const value = useContext(ChipsContext);
  if (value === null) {
    throw new Error('useChips 必须在 ChipsProvider 内使用。');
  }
  return value;
}

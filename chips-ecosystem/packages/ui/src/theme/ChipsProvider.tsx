/**
 * 窗口级 UI 根环境。
 *
 * 契约：《08-@chips-ui共享层使用指南》§2.3、§3.1。
 * - 应用窗口 UI 入口（`render.js` 默认导出组件）挂载一次，包裹整个应用界面树；
 * - 同一窗口内不得重复挂载，也不得在子树上另建主题根；
 * - 主题根（Design Tokens + 简体中文 + antd App 上下文）由 fork antd 的 `ChipsThemeRoot` 安装，
 *   浅色 / 深色由系统外观驱动（R5，无用户自选主题）。
 */

import { ChipsThemeRoot } from '@chips/antd';
import React from 'react';
import type { ReactElement, ReactNode } from 'react';

import { resolveAppleTheme } from '../tokens';
import { ChipsContext } from './context';
import type { ChipsContextValue, ChipsSurface } from './context';
import { useSystemAppearance } from './use-system-appearance';

export interface ChipsProviderProps {
  /** 应用插件 ID，与 manifest `id` 一致。 */
  appId: string;
  /** 应用窗口形态：标准窗口 / 桌面层；`tray` 表面不装载窗口 UI。 */
  surface: ChipsSurface;
  children: ReactNode;
}

/**
 * 窗口运行环境根：安装一次主题根，并通过 `useChips()` 暴露运行环境标识。
 *
 * @param props 运行环境属性
 * @returns 包裹主题根与上下文的元素
 */
export function ChipsProvider({ appId, surface, children }: ChipsProviderProps): ReactElement {
  const appearance = useSystemAppearance();
  const theme = React.useMemo(() => resolveAppleTheme(appearance), [appearance]);
  const value = React.useMemo<ChipsContextValue>(() => ({ appId, surface }), [appId, surface]);

  return (
    <ChipsContext.Provider value={value}>
      <ChipsThemeRoot theme={theme}>{children}</ChipsThemeRoot>
    </ChipsContext.Provider>
  );
}

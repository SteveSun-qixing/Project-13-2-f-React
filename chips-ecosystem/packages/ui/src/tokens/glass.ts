/**
 * 薯片玻璃质感基线（《统一视觉规范》§2.6）。
 *
 * 毛玻璃只用于工具栏、侧边栏、标题栏与弹层；正文内容区禁止毛玻璃，禁止增加第三层玻璃。
 * 手法固定为 `saturate(180%) blur(20px)`，背景取当前外观的布局底色（浅色 `#f5f5f7`、
 * 深色 `#1c1c1e`，即 `colorBgLayout`），因此本文件集中唯一的字面值（§1.3 允许共享层
 * 保留 §2.6 基线字面值）。
 */

import type { GlobalToken } from '@chips/antd';
import type { CSSProperties } from 'react';

/** 悬浮层毛玻璃手法（§2.6）。 */
export const CHIPS_GLASS_BLUR = 'saturate(180%) blur(20px)';

/**
 * 工具栏 / 标题栏玻璃样式：布局底色 + 毛玻璃。
 *
 * @param token `theme.useToken()` 的全局令牌
 * @param borderDirection 底部细线方向；`none` 表示不画细线
 * @returns 内联样式对象（业务组件只读）
 */
export function chipsGlassSurface(
  token: GlobalToken,
  borderDirection: 'bottom' | 'none' = 'bottom'
): CSSProperties {
  return {
    background: token.colorBgLayout,
    backdropFilter: CHIPS_GLASS_BLUR,
    WebkitBackdropFilter: CHIPS_GLASS_BLUR,
    ...(borderDirection === 'bottom' ? { borderBottom: `1px solid ${token.colorSplit}` } : {}),
  };
}

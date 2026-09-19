/**
 * 系统外观解析：`prefers-color-scheme` → `ChipsAppearance`。
 *
 * 约定（《09-统一视觉规范》§2.8）：浅色与深色由系统外观驱动；页面内不得出现切换主题控件。
 * 无 `matchMedia` 的运行环境（SSR / 测试 / 旧壳）按浅色收口，不抛错。
 */

import { useEffect, useState } from 'react';

import type { ChipsAppearance } from '../tokens';

/** 深色外观的媒体查询。 */
export const DARK_APPEARANCE_QUERY = '(prefers-color-scheme: dark)';

/**
 * 读取当前系统外观。
 *
 * @returns 当前外观；无法判定时为 `light`
 */
export function readSystemAppearance(): ChipsAppearance {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light';
  }
  return window.matchMedia(DARK_APPEARANCE_QUERY).matches ? 'dark' : 'light';
}

/**
 * 订阅系统外观变化。
 *
 * @returns 当前外观（随系统外观变化更新）
 */
export function useSystemAppearance(): ChipsAppearance {
  const [appearance, setAppearance] = useState<ChipsAppearance>(readSystemAppearance);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }
    const media = window.matchMedia(DARK_APPEARANCE_QUERY);
    const handleChange = (event: MediaQueryListEvent): void => {
      setAppearance(event.matches ? 'dark' : 'light');
    };
    setAppearance(media.matches ? 'dark' : 'light');
    media.addEventListener('change', handleChange);
    return () => {
      media.removeEventListener('change', handleChange);
    };
  }, []);

  return appearance;
}

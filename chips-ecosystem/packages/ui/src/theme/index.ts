/** 窗口运行环境：`ChipsProvider`、`useChips` 与系统外观解析。 */

export { ChipsProvider } from './ChipsProvider';
export type { ChipsProviderProps } from './ChipsProvider';
export { ChipsContext, useChips } from './context';
export type { ChipsContextValue, ChipsSurface } from './context';
export {
  DARK_APPEARANCE_QUERY,
  readSystemAppearance,
  useSystemAppearance,
} from './use-system-appearance';

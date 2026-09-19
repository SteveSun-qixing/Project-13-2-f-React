/**
 * Design Tokens 数值实现（浅色 / 深色双外观）。
 *
 * 唯一事实源：《薯片生态文档库/02-开发规范/09-统一视觉规范》§二（全局 Token 基线）、
 * §3.4（22 个组件的组件级基线）、§2.8（深色映射规则）。
 *
 * 约定：
 * - 浅色与深色是同一套苹果风格的两种外观，由系统外观驱动，平台不提供切换入口（R5）；
 * - 深色在 token 层显式钉住 §2.1 的深色值（不依赖算法从浅色语义值推导，§2.8 明确禁止该实现）；
 * - 深色中未列差异的结构值（圆角、尺寸、字号、间距、字重）与浅色逐项一致；
 * - 未列出的颜色项不写覆盖，交深色算法从深色种子派生；
 * - 本文件是共享层内部实现，业务代码不得导入、复制或覆盖其中数值（`08-@chips-ui共享层使用指南` §2.5）。
 */

import { theme } from '@chips/antd';
import type { ThemeConfig } from '@chips/antd';

/** 外观类型；由系统外观（`prefers-color-scheme` / 壳层 `nativeTheme`）决定。 */
export type ChipsAppearance = 'light' | 'dark';

type TokenConfig = NonNullable<ThemeConfig['token']>;
type ComponentsConfig = NonNullable<ThemeConfig['components']>;

/** 与外观无关的字体、圆角、动效基线（§2.2~§2.4、§2.7）。 */
const sharedTokens: TokenConfig = {
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "PingFang SC", "Helvetica Neue", "Microsoft YaHei", sans-serif',
  fontFamilyCode: '"SF Mono", "JetBrains Mono", "Menlo", "Consolas", "PingFang SC", monospace',
  fontSize: 14,
  fontSizeSM: 12,
  fontSizeLG: 16,
  fontSizeXL: 20,
  fontSizeHeading1: 34,
  fontSizeHeading2: 28,
  fontSizeHeading3: 22,
  fontSizeHeading4: 20,
  fontSizeHeading5: 17,
  lineHeight: 1.5,
  fontWeightStrong: 600,
  borderRadius: 10,
  borderRadiusLG: 12,
  borderRadiusSM: 8,
  borderRadiusXS: 6,
  motionDurationFast: '0.15s',
  motionDurationMid: '0.25s',
  motionDurationSlow: '0.4s',
  motionEaseInOut: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
  motionEaseOut: 'cubic-bezier(0.22, 1, 0.36, 1)',
};

/** 浅色全局 Token（《统一视觉规范》§2.1 浅色列）。 */
const lightTokens: TokenConfig = {
  ...sharedTokens,
  colorPrimary: '#0a84ff',
  colorInfo: '#0a84ff',
  colorLink: '#0a84ff',
  colorPrimaryHover: '#3395ff',
  colorPrimaryActive: '#0060df',
  colorPrimaryBg: 'rgba(10,132,255,0.08)',
  colorPrimaryBgHover: 'rgba(10,132,255,0.12)',
  colorPrimaryBorder: 'rgba(10,132,255,0.35)',
  colorSuccess: '#34c759',
  colorSuccessBg: 'rgba(52,199,89,0.10)',
  colorWarning: '#ff9f0a',
  colorWarningBg: 'rgba(255,159,10,0.10)',
  colorError: '#ff3b30',
  colorErrorBg: 'rgba(255,59,48,0.10)',
  colorBgSpotlight: '#3a3a3c',
  colorBgMask: 'rgba(0,0,0,0.25)',
  colorTextBase: '#1d1d1f',
  colorTextSecondary: '#6e6e73',
  colorTextTertiary: '#86868b',
  colorTextQuaternary: '#c7c7cc',
  colorTextPlaceholder: '#8e8e93',
  colorTextDisabled: '#c7c7cc',
  colorBgBase: '#f5f5f7',
  colorBgLayout: '#f5f5f7',
  colorBgContainer: '#ffffff',
  colorBgElevated: '#ffffff',
  colorBorder: 'rgba(0,0,0,0.10)',
  colorBorderSecondary: 'rgba(0,0,0,0.06)',
  colorSplit: 'rgba(0,0,0,0.06)',
  colorFillSecondary: 'rgba(0,0,0,0.05)',
  colorFillTertiary: 'rgba(0,0,0,0.03)',
  colorFillQuaternary: 'rgba(0,0,0,0.02)',
  boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.06)',
  boxShadowSecondary: '0 2px 4px rgba(0,0,0,0.05), 0 8px 24px rgba(0,0,0,0.10)',
  boxShadowTertiary: '0 1px 2px rgba(0,0,0,0.04), 0 2px 6px rgba(0,0,0,0.05)',
};

/** 深色全局 Token（《统一视觉规范》§2.1 深色列；仅替换颜色与阴影，结构与浅色一致）。 */
const darkTokens: TokenConfig = {
  ...sharedTokens,
  colorPrimary: '#0a84ff',
  colorInfo: '#0a84ff',
  colorLink: '#0a84ff',
  colorPrimaryHover: '#3395ff',
  colorPrimaryActive: '#0060df',
  colorPrimaryBg: 'rgba(10,132,255,0.16)',
  colorPrimaryBgHover: 'rgba(10,132,255,0.24)',
  colorPrimaryBorder: 'rgba(10,132,255,0.50)',
  colorSuccess: '#30d158',
  colorSuccessBg: 'rgba(48,209,88,0.16)',
  colorWarning: '#ff9f0a',
  colorWarningBg: 'rgba(255,159,10,0.16)',
  colorError: '#ff453a',
  colorErrorBg: 'rgba(255,69,58,0.16)',
  colorBgSpotlight: '#48484a',
  colorBgMask: 'rgba(0,0,0,0.55)',
  colorTextBase: '#f5f5f7',
  colorTextSecondary: 'rgba(235,235,245,0.60)',
  colorTextTertiary: 'rgba(235,235,245,0.30)',
  colorTextQuaternary: 'rgba(235,235,245,0.18)',
  colorTextPlaceholder: 'rgba(235,235,245,0.30)',
  colorTextDisabled: 'rgba(235,235,245,0.18)',
  colorBgBase: '#1c1c1e',
  colorBgLayout: '#1c1c1e',
  colorBgContainer: '#2c2c2e',
  colorBgElevated: '#2c2c2e',
  colorBorder: '#48484a',
  colorBorderSecondary: '#3a3a3c',
  colorSplit: '#3a3a3c',
  colorFillSecondary: 'rgba(120,120,128,0.32)',
  colorFillTertiary: 'rgba(120,120,128,0.24)',
  colorFillQuaternary: 'rgba(120,120,128,0.18)',
  boxShadow: '0 1px 2px rgba(0,0,0,0.30), 0 4px 12px rgba(0,0,0,0.36)',
  boxShadowSecondary: '0 2px 4px rgba(0,0,0,0.36), 0 8px 24px rgba(0,0,0,0.48)',
  boxShadowTertiary: '0 1px 2px rgba(0,0,0,0.30), 0 2px 6px rgba(0,0,0,0.36)',
};

/**
 * 组件级基线（《统一视觉规范》§3.4 浅色列）。
 *
 * 结构值（圆角、尺寸、字号、间距、字重）与颜色值同表给出；深色配置只覆盖颜色差异项。
 */
const lightComponents: ComponentsConfig = {
  Button: {
    borderRadius: 8,
    borderRadiusSM: 7,
    borderRadiusLG: 10,
    contentFontSize: 14,
    primaryColor: '#ffffff',
    primaryShadow: 'none',
    defaultShadow: 'none',
    dangerShadow: 'none',
    defaultBorderColor: 'rgba(0,0,0,0.12)',
    defaultBg: '#ffffff',
    defaultColor: '#1d1d1f',
    defaultHoverBg: '#f5f5f7',
    defaultActiveBg: '#ebebed',
    textHoverBg: 'rgba(0,0,0,0.05)',
    paddingInline: 16,
    paddingInlineSM: 12,
    paddingInlineLG: 20,
    onlyIconSize: 18,
  },
  Input: {
    colorBgContainer: '#f2f2f7',
    colorBorder: 'transparent',
    hoverBorderColor: 'rgba(0,0,0,0.15)',
    activeBorderColor: '#0a84ff',
    activeShadow: '0 0 0 3px rgba(10,132,255,0.25)',
    hoverBg: '#e5e5ea',
    activeBg: '#ffffff',
    borderRadius: 10,
    borderRadiusLG: 10,
    paddingInline: 12,
  },
  Select: {
    selectorBg: '#f2f2f7',
    hoverBorderColor: 'rgba(0,0,0,0.15)',
    activeBorderColor: '#0a84ff',
    optionSelectedBg: 'rgba(10,132,255,0.10)',
    optionActiveBg: 'rgba(0,0,0,0.05)',
    optionSelectedFontWeight: 600,
    borderRadius: 8,
    borderRadiusLG: 10,
  },
  Modal: {
    borderRadiusLG: 14,
    titleFontSize: 17,
    titleColor: '#1d1d1f',
    contentBg: '#ffffff',
    headerBg: 'transparent',
    footerBg: 'transparent',
  },
  Card: {
    borderRadiusLG: 12,
    headerFontSize: 15,
    headerBg: 'transparent',
    bodyPadding: 20,
    headerPadding: 16,
  },
  Table: {
    headerBg: 'transparent',
    headerColor: '#6e6e73',
    headerSplitColor: 'transparent',
    borderColor: 'rgba(0,0,0,0.06)',
    rowHoverBg: 'rgba(0,0,0,0.03)',
    rowSelectedBg: 'rgba(10,132,255,0.10)',
    rowSelectedHoverBg: 'rgba(10,132,255,0.14)',
    cellPaddingBlock: 14,
    cellFontSize: 13,
    headerBorderRadius: 8,
  },
  Menu: {
    itemBorderRadius: 8,
    itemColor: '#1d1d1f',
    itemHoverBg: 'rgba(0,0,0,0.05)',
    itemSelectedBg: 'rgba(10,132,255,0.10)',
    itemSelectedColor: '#0a84ff',
    subMenuItemBg: 'transparent',
    itemMarginInline: 4,
    itemHeight: 34,
    popupBg: 'rgba(255,255,255,0.96)',
  },
  Segmented: {
    trackBg: '#f2f2f7',
    trackPadding: 2,
    itemColor: '#6e6e73',
    itemHoverColor: '#1d1d1f',
    itemSelectedColor: '#1d1d1f',
    itemSelectedBg: '#ffffff',
    itemHoverBg: 'rgba(255,255,255,0.5)',
    itemActiveBg: 'rgba(0,0,0,0.03)',
    borderRadius: 9,
    borderRadiusLG: 9,
    borderRadiusSM: 9,
  },
  Switch: {
    colorPrimary: '#34c759',
    colorPrimaryHover: '#34c759',
    handleBg: '#ffffff',
    trackHeight: 30,
    handleSize: 26,
    trackPadding: 2,
  },
  Slider: {
    trackBg: '#0a84ff',
    trackHoverBg: '#3395ff',
    handleColor: '#ffffff',
    handleActiveColor: '#ffffff',
    handleSize: 22,
    handleLineWidth: 3,
    handleActiveOutlineColor: 'rgba(10,132,255,0.25)',
    railBg: 'rgba(0,0,0,0.12)',
    railHoverBg: 'rgba(0,0,0,0.15)',
    dotBorderColor: 'rgba(0,0,0,0.15)',
    dotActiveBorderColor: '#0a84ff',
  },
  Checkbox: {
    colorPrimary: '#0a84ff',
    borderRadiusSM: 5,
  },
  Radio: {
    colorPrimary: '#0a84ff',
    buttonBg: 'transparent',
    radioSize: 18,
  },
  Tabs: {
    itemColor: '#6e6e73',
    itemHoverColor: '#1d1d1f',
    itemSelectedColor: '#1d1d1f',
    inkBarColor: '#0a84ff',
    titleFontSize: 14,
    horizontalItemPadding: '12px 0',
    horizontalItemGutter: 24,
    cardBg: 'transparent',
  },
  Rate: {
    starColor: '#ff9f0a',
    starBg: 'rgba(0,0,0,0.10)',
    starSize: 22,
  },
  Progress: {
    defaultColor: '#0a84ff',
    remainingColor: 'rgba(0,0,0,0.08)',
    lineBorderRadius: 4,
  },
  Tag: {
    defaultBg: 'rgba(0,0,0,0.05)',
    defaultColor: '#6e6e73',
    fontSize: 12,
  },
  Badge: {
    indicatorHeight: 18,
    textFontWeight: 600,
  },
  List: {
    itemPadding: '12px 16px',
    headerBg: 'transparent',
    footerBg: 'transparent',
  },
  Result: {
    titleFontSize: 20,
    subtitleFontSize: 14,
  },
  Message: {
    contentBg: 'rgba(255,255,255,0.96)',
  },
  Skeleton: {
    gradientFromColor: 'rgba(0,0,0,0.04)',
    gradientToColor: 'rgba(0,0,0,0.09)',
  },
  Pagination: {
    itemBg: 'transparent',
    itemActiveBg: 'rgba(10,132,255,0.10)',
    itemActiveColor: '#0a84ff',
  },
};

/**
 * 深色差异项（《统一视觉规范》§3.4 深色差异列）。
 *
 * 只列与浅色不同的颜色取值；未列项继承浅色结构值（§2.8「未列出的项浅深一致」）。
 * `#f5f5f7` 等深色文字值取 §2.1 的深色主文本/次级文本，避免浅色写死残留（V10）。
 */
const darkComponentDiffs: ComponentsConfig = {
  Button: {
    defaultBg: 'rgba(120,120,128,0.24)',
    defaultHoverBg: 'rgba(120,120,128,0.32)',
    defaultActiveBg: 'rgba(120,120,128,0.36)',
    defaultBorderColor: '#48484a',
    defaultColor: '#f5f5f7',
    textHoverBg: 'rgba(255,255,255,0.08)',
  },
  Input: {
    colorBgContainer: 'rgba(120,120,128,0.24)',
    hoverBg: 'rgba(120,120,128,0.32)',
    hoverBorderColor: '#48484a',
    activeBg: '#3a3a3c',
    activeShadow: '0 0 0 3px rgba(10,132,255,0.45)',
  },
  Select: {
    selectorBg: 'rgba(120,120,128,0.24)',
    optionActiveBg: 'rgba(255,255,255,0.08)',
    optionSelectedBg: 'rgba(10,132,255,0.20)',
  },
  Modal: {
    contentBg: '#2c2c2e',
    titleColor: '#f5f5f7',
  },
  Table: {
    headerColor: 'rgba(235,235,245,0.60)',
    borderColor: '#3a3a3c',
    rowHoverBg: 'rgba(255,255,255,0.05)',
    rowSelectedBg: 'rgba(10,132,255,0.20)',
    rowSelectedHoverBg: 'rgba(10,132,255,0.28)',
  },
  Menu: {
    itemColor: '#f5f5f7',
    itemHoverBg: 'rgba(255,255,255,0.08)',
    itemSelectedBg: 'rgba(10,132,255,0.20)',
    popupBg: 'rgba(44,44,46,0.96)',
  },
  Segmented: {
    trackBg: 'rgba(120,120,128,0.24)',
    itemSelectedBg: '#3a3a3c',
    itemColor: 'rgba(235,235,245,0.60)',
    itemHoverColor: '#f5f5f7',
    itemSelectedColor: '#f5f5f7',
    itemHoverBg: 'rgba(255,255,255,0.08)',
  },
  Switch: {
    colorPrimary: '#30d158',
    colorPrimaryHover: '#30d158',
  },
  Slider: {
    handleActiveOutlineColor: 'rgba(10,132,255,0.45)',
    railBg: 'rgba(255,255,255,0.16)',
    railHoverBg: 'rgba(255,255,255,0.24)',
    dotBorderColor: '#48484a',
  },
  Tabs: {
    itemColor: 'rgba(235,235,245,0.60)',
    itemHoverColor: '#f5f5f7',
    itemSelectedColor: '#f5f5f7',
  },
  Rate: {
    starBg: 'rgba(255,255,255,0.16)',
  },
  Progress: {
    remainingColor: 'rgba(255,255,255,0.12)',
  },
  Tag: {
    defaultBg: 'rgba(120,120,128,0.24)',
    defaultColor: 'rgba(235,235,245,0.60)',
  },
  Message: {
    contentBg: 'rgba(44,44,46,0.96)',
  },
  Skeleton: {
    gradientFromColor: 'rgba(255,255,255,0.06)',
    gradientToColor: 'rgba(255,255,255,0.12)',
  },
  Pagination: {
    itemActiveBg: 'rgba(10,132,255,0.20)',
  },
};

/** 深色组件基线：浅色结构值 + 深色颜色差异。 */
function buildDarkComponents(): ComponentsConfig {
  const merged: Record<string, unknown> = {};
  for (const [name, config] of Object.entries(lightComponents)) {
    merged[name] = {
      ...(config ?? {}),
      ...(darkComponentDiffs[name as keyof ComponentsConfig] ?? {}),
    };
  }
  return merged;
}

/**
 * 浅色外观主题配置（《08》§2.5 的 `appleTheme`）。
 *
 * 未在《统一视觉规范》§3.4 列出的组件沿用全局 token，不单独定制（白名单与
 * `packages/antd/src/theme/theme-policy.ts` 一致）。
 */
export const appleTheme: ThemeConfig = {
  algorithm: theme.defaultAlgorithm,
  token: lightTokens,
  components: lightComponents,
};

/** 深色外观主题配置；与 `appleTheme` 同源同结构，仅按 §2.1、§3.4 深色列覆盖颜色。 */
export const appleThemeDark: ThemeConfig = {
  algorithm: theme.darkAlgorithm,
  token: darkTokens,
  components: buildDarkComponents(),
};

/**
 * 按外观解析主题配置。
 *
 * @param appearance 系统外观
 * @returns 对应外观的主题配置
 */
export function resolveAppleTheme(appearance: ChipsAppearance): ThemeConfig {
  return appearance === 'dark' ? appleThemeDark : appleTheme;
}

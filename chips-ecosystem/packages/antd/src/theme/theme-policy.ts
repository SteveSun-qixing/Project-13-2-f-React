import type { MappingAlgorithm, ThemeConfig } from 'antd';

/**
 * 主题配置组件级定制白名单：《09-统一视觉规范》§3.4 列出的 22 个组件。
 * 白名单之外的组件沿用全局 token，不单独定制；需要定制时先修订视觉规范，再更新本清单。
 */
export const CHIPS_THEME_COMPONENT_ALLOWLIST = [
  'Button',
  'Input',
  'Select',
  'Modal',
  'Card',
  'Table',
  'Menu',
  'Segmented',
  'Switch',
  'Slider',
  'Checkbox',
  'Radio',
  'Tabs',
  'Rate',
  'Progress',
  'Tag',
  'Badge',
  'List',
  'Result',
  'Message',
  'Skeleton',
  'Pagination',
] as const;

export type ChipsThemeComponent = (typeof CHIPS_THEME_COMPONENT_ALLOWLIST)[number];

/** 主题配置允许的顶层字段；主题算法、令牌与组件级定制之外一律由主题根接管。 */
export const CHIPS_THEME_CONFIG_KEYS = ['algorithm', 'token', 'components'] as const;

const COMPONENT_ALLOWLIST: ReadonlySet<string> = new Set(CHIPS_THEME_COMPONENT_ALLOWLIST);
const THEME_CONFIG_KEYS: ReadonlySet<string> = new Set(CHIPS_THEME_CONFIG_KEYS);

/** 主题配置违反 fork antd 桥接约定时抛出的错误。 */
export class ChipsThemeConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ChipsThemeConfigError';
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isMappingAlgorithm(value: unknown): value is MappingAlgorithm | MappingAlgorithm[] {
  if (typeof value === 'function') {
    return true;
  }
  return (
    Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === 'function')
  );
}

/**
 * 校验 `@chips/ui` 交给 `ChipsThemeRoot` 的主题配置。
 *
 * 约定：数值与组件级定制由共享层提供，主题根的安装机制（`locale`、`inherit`、`hashed`、
 * `cssVar`、`App` 上下文）由 fork 独占；出现越权字段或白名单之外的组件级定制直接拒绝，
 * 保证《09-统一视觉规范》是视觉数值的唯一事实源。
 *
 * @param config 共享层主题配置
 * @throws ChipsThemeConfigError 配置结构不符合桥接约定
 */
export function validateChipsThemeConfig(config: ThemeConfig): void {
  if (!isPlainObject(config)) {
    throw new ChipsThemeConfigError('主题配置必须是对象。');
  }

  for (const key of Object.keys(config)) {
    if (!THEME_CONFIG_KEYS.has(key)) {
      throw new ChipsThemeConfigError(
        `主题配置不允许字段 ${key}；只允许 ${CHIPS_THEME_CONFIG_KEYS.join('、')}。`
      );
    }
  }

  if (config.algorithm !== undefined && !isMappingAlgorithm(config.algorithm)) {
    throw new ChipsThemeConfigError('主题配置的 algorithm 必须是主题算法函数或非空算法函数数组。');
  }

  if (config.token !== undefined && !isPlainObject(config.token)) {
    throw new ChipsThemeConfigError('主题配置的 token 必须是对象。');
  }

  if (config.components !== undefined) {
    if (!isPlainObject(config.components)) {
      throw new ChipsThemeConfigError('主题配置的 components 必须是对象。');
    }
    for (const componentName of Object.keys(config.components)) {
      if (!COMPONENT_ALLOWLIST.has(componentName)) {
        throw new ChipsThemeConfigError(
          `主题配置不允许定制组件 ${componentName}；组件级定制白名单见 packages/antd/src/theme/theme-policy.ts。`
        );
      }
    }
  }
}

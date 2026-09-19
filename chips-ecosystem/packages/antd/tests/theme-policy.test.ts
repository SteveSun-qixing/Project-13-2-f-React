import { describe, expect, it } from 'vitest';
import {
  CHIPS_CSS_VAR_KEY,
  CHIPS_CSS_VAR_PREFIX,
  CHIPS_THEME_COMPONENT_ALLOWLIST,
  CHIPS_THEME_CONFIG_KEYS,
  ChipsThemeConfigError,
  toChipsCssVarName,
  validateChipsThemeConfig,
} from '../src/index';
import type { ThemeConfig } from '../src/index';

const validTheme: ThemeConfig = {
  token: { colorPrimary: '#0a84ff', borderRadius: 10 },
  components: { Button: { borderRadius: 8 }, Table: { cellPaddingBlock: 14 } },
};

describe('toChipsCssVarName', () => {
  it('前缀与作用域常量固定', () => {
    expect(CHIPS_CSS_VAR_PREFIX).toBe('chips');
    expect(CHIPS_CSS_VAR_KEY).toBe('css-var-chips');
  });

  it('按 antd CSS 变量规则生成 kebab-case 变量名', () => {
    expect(toChipsCssVarName('colorPrimary')).toBe('--chips-color-primary');
    expect(toChipsCssVarName('colorPrimaryBgHover')).toBe('--chips-color-primary-bg-hover');
    expect(toChipsCssVarName('fontSizeHeading1')).toBe('--chips-font-size-heading-1');
    expect(toChipsCssVarName('borderRadiusLG')).toBe('--chips-border-radius-lg');
    expect(toChipsCssVarName('zIndexPopupBase')).toBe('--chips-z-index-popup-base');
    expect(toChipsCssVarName('marginXXS')).toBe('--chips-margin-xxs');
  });
});

describe('validateChipsThemeConfig', () => {
  it('接受共享层的合法主题配置', () => {
    expect(() => validateChipsThemeConfig(validTheme)).not.toThrow();
    expect(() => validateChipsThemeConfig({ algorithm: [() => ({}) as never] })).not.toThrow();
  });

  it('组件级定制白名单为视觉规范的 22 个组件', () => {
    expect(CHIPS_THEME_CONFIG_KEYS).toEqual(['algorithm', 'token', 'components']);
    expect([...CHIPS_THEME_COMPONENT_ALLOWLIST]).toHaveLength(22);
    expect(CHIPS_THEME_COMPONENT_ALLOWLIST).toContain('Button');
    expect(CHIPS_THEME_COMPONENT_ALLOWLIST).toContain('Message');
    expect(CHIPS_THEME_COMPONENT_ALLOWLIST).not.toContain('ConfigProvider');
  });

  it('拒绝主题根独占字段', () => {
    for (const key of ['inherit', 'hashed', 'cssVar', 'zeroRuntime', 'locale']) {
      const config = { ...validTheme, [key]: true };
      expect(() => validateChipsThemeConfig(config), `应拒绝字段 ${key}`).toThrow(
        ChipsThemeConfigError
      );
    }
  });

  it('拒绝白名单之外的组件级定制', () => {
    expect(() =>
      validateChipsThemeConfig({ components: { Tree: { colorPrimary: '#000000' } } })
    ).toThrow(/不允许定制组件 Tree/);
  });

  it('拒绝非法 algorithm 与 token', () => {
    expect(() => validateChipsThemeConfig({ algorithm: [] as never })).toThrow(
      /algorithm 必须是主题算法函数/
    );
    expect(() => validateChipsThemeConfig({ algorithm: true as never })).toThrow(
      /algorithm 必须是主题算法函数/
    );
    expect(() => validateChipsThemeConfig({ token: 'colorPrimary' as never })).toThrow(
      /token 必须是对象/
    );
    expect(() => validateChipsThemeConfig({ components: [] as never })).toThrow(
      /components 必须是对象/
    );
  });

  it('拒绝非对象配置', () => {
    expect(() => validateChipsThemeConfig(null as never)).toThrow(/主题配置必须是对象/);
    expect(() => validateChipsThemeConfig([] as never)).toThrow(/主题配置必须是对象/);
  });

  it('错误类型名与提示为简体中文', () => {
    try {
      validateChipsThemeConfig({ components: { Tree: {} } });
      expect.unreachable('应当抛出 ChipsThemeConfigError');
    } catch (error) {
      expect(error).toBeInstanceOf(ChipsThemeConfigError);
      expect((error as Error).name).toBe('ChipsThemeConfigError');
      expect((error as Error).message).toContain('不允许定制组件');
    }
  });
});

import { theme, validateChipsThemeConfig } from '@chips/antd';
import { describe, expect, it } from 'vitest';

import { appleTheme, appleThemeDark, resolveAppleTheme } from './apple-theme';

describe('Design Tokens 浅色基线（《统一视觉规范》§2.1）', () => {
  it('强调色为系统蓝且无第二强调色', () => {
    expect(appleTheme.token?.colorPrimary).toBe('#0a84ff');
    expect(appleTheme.token?.colorInfo).toBe('#0a84ff');
    expect(appleTheme.token?.colorLink).toBe('#0a84ff');
    expect(appleTheme.token?.colorPrimaryHover).toBe('#3395ff');
    expect(appleTheme.token?.colorPrimaryActive).toBe('#0060df');
  });

  it('语义色取 iOS 系统色', () => {
    expect(appleTheme.token?.colorSuccess).toBe('#34c759');
    expect(appleTheme.token?.colorWarning).toBe('#ff9f0a');
    expect(appleTheme.token?.colorError).toBe('#ff3b30');
  });

  it('文本与背景种子按基线钉住', () => {
    expect(appleTheme.token?.colorTextBase).toBe('#1d1d1f');
    expect(appleTheme.token?.colorTextSecondary).toBe('#6e6e73');
    expect(appleTheme.token?.colorTextTertiary).toBe('#86868b');
    expect(appleTheme.token?.colorTextQuaternary).toBe('#c7c7cc');
    expect(appleTheme.token?.colorBgBase).toBe('#f5f5f7');
    expect(appleTheme.token?.colorBgContainer).toBe('#ffffff');
    expect(appleTheme.token?.colorBgLayout).toBe('#f5f5f7');
  });

  it('边框、填充与遮罩按基线钉住', () => {
    expect(appleTheme.token?.colorBorder).toBe('rgba(0,0,0,0.10)');
    expect(appleTheme.token?.colorBorderSecondary).toBe('rgba(0,0,0,0.06)');
    expect(appleTheme.token?.colorFillSecondary).toBe('rgba(0,0,0,0.05)');
    expect(appleTheme.token?.colorFillTertiary).toBe('rgba(0,0,0,0.03)');
    expect(appleTheme.token?.colorFillQuaternary).toBe('rgba(0,0,0,0.02)');
    expect(appleTheme.token?.colorBgSpotlight).toBe('#3a3a3c');
    expect(appleTheme.token?.colorBgMask).toBe('rgba(0,0,0,0.25)');
  });

  it('字体、圆角与动效按基线钉住', () => {
    expect(appleTheme.token?.fontSize).toBe(14);
    expect(appleTheme.token?.fontSizeSM).toBe(12);
    expect(appleTheme.token?.fontSizeLG).toBe(16);
    expect(appleTheme.token?.fontSizeXL).toBe(20);
    expect(appleTheme.token?.fontSizeHeading1).toBe(34);
    expect(appleTheme.token?.fontSizeHeading5).toBe(17);
    expect(appleTheme.token?.lineHeight).toBe(1.5);
    expect(appleTheme.token?.fontWeightStrong).toBe(600);
    expect(appleTheme.token?.borderRadius).toBe(10);
    expect(appleTheme.token?.borderRadiusSM).toBe(8);
    expect(appleTheme.token?.borderRadiusLG).toBe(12);
    expect(appleTheme.token?.borderRadiusXS).toBe(6);
    expect(appleTheme.token?.motionDurationFast).toBe('0.15s');
    expect(appleTheme.token?.motionDurationMid).toBe('0.25s');
    expect(appleTheme.token?.motionDurationSlow).toBe('0.4s');
  });

  it('基础间距取 4 的阶梯（sizeUnit/sizeStep 不覆写）', () => {
    expect(appleTheme.token?.sizeUnit).toBeUndefined();
    expect(appleTheme.token?.sizeStep).toBeUndefined();
  });

  it('使用浅色算法且组件级定制通过 fork 白名单校验', () => {
    expect(appleTheme.algorithm).toBe(theme.defaultAlgorithm);
    expect(() => {
      validateChipsThemeConfig(appleTheme);
    }).not.toThrow();
  });
});

describe('Design Tokens 深色基线（《统一视觉规范》§2.1、§2.8）', () => {
  it('深色种子显式钉住，不依赖算法从浅色推导', () => {
    expect(appleThemeDark.token?.colorTextBase).toBe('#f5f5f7');
    expect(appleThemeDark.token?.colorBgBase).toBe('#1c1c1e');
    expect(appleThemeDark.token?.colorBgLayout).toBe('#1c1c1e');
    expect(appleThemeDark.token?.colorBgContainer).toBe('#2c2c2e');
    expect(appleThemeDark.token?.colorBgElevated).toBe('#2c2c2e');
    expect(appleThemeDark.token?.colorBorder).toBe('#48484a');
    expect(appleThemeDark.token?.colorBorderSecondary).toBe('#3a3a3c');
    expect(appleThemeDark.token?.colorSplit).toBe('#3a3a3c');
    expect(appleThemeDark.token?.colorTextSecondary).toBe('rgba(235,235,245,0.60)');
    expect(appleThemeDark.token?.colorTextTertiary).toBe('rgba(235,235,245,0.30)');
    expect(appleThemeDark.token?.colorFillSecondary).toBe('rgba(120,120,128,0.32)');
    expect(appleThemeDark.token?.colorFillTertiary).toBe('rgba(120,120,128,0.24)');
    expect(appleThemeDark.token?.colorBgSpotlight).toBe('#48484a');
    expect(appleThemeDark.token?.colorBgMask).toBe('rgba(0,0,0,0.55)');
  });

  it('深色语义色按基线取值', () => {
    expect(appleThemeDark.token?.colorSuccess).toBe('#30d158');
    expect(appleThemeDark.token?.colorWarning).toBe('#ff9f0a');
    expect(appleThemeDark.token?.colorError).toBe('#ff453a');
    expect(appleThemeDark.token?.colorPrimary).toBe('#0a84ff');
  });

  it('强阴影档位与浅色不同（深色底保持层次）', () => {
    expect(appleThemeDark.token?.boxShadow).not.toBe(appleTheme.token?.boxShadow);
    expect(appleThemeDark.token?.boxShadowSecondary).not.toBe(appleTheme.token?.boxShadowSecondary);
  });

  it('结构值（字体、圆角、动效）与浅色一致', () => {
    const structuralKeys = [
      'fontFamily',
      'fontFamilyCode',
      'fontSize',
      'fontSizeSM',
      'fontSizeLG',
      'fontSizeXL',
      'fontSizeHeading1',
      'fontSizeHeading2',
      'fontSizeHeading3',
      'fontSizeHeading4',
      'fontSizeHeading5',
      'lineHeight',
      'fontWeightStrong',
      'borderRadius',
      'borderRadiusSM',
      'borderRadiusLG',
      'borderRadiusXS',
      'motionDurationFast',
      'motionDurationMid',
      'motionDurationSlow',
      'motionEaseInOut',
      'motionEaseOut',
    ] as const;
    for (const key of structuralKeys) {
      expect(appleThemeDark.token?.[key]).toBe(appleTheme.token?.[key]);
    }
  });

  it('使用深色算法且组件级定制通过 fork 白名单校验', () => {
    expect(appleThemeDark.algorithm).toBe(theme.darkAlgorithm);
    expect(() => {
      validateChipsThemeConfig(appleThemeDark);
    }).not.toThrow();
  });
});

describe('组件级基线（《统一视觉规范》§3.4）', () => {
  it('按钮：圆角、内边距、图标尺寸与无投影', () => {
    const button = appleTheme.components?.Button;
    expect(button?.borderRadius).toBe(8);
    expect(button?.borderRadiusSM).toBe(7);
    expect(button?.borderRadiusLG).toBe(10);
    expect(button?.paddingInline).toBe(16);
    expect(button?.paddingInlineSM).toBe(12);
    expect(button?.paddingInlineLG).toBe(20);
    expect(button?.onlyIconSize).toBe(18);
    expect(button?.primaryShadow).toBe('none');
    expect(button?.defaultShadow).toBe('none');
    expect(button?.dangerShadow).toBe('none');
    expect(button?.primaryColor).toBe('#ffffff');
    expect(button?.defaultBg).toBe('#ffffff');
  });

  it('按钮深色差异只替换颜色并保留结构值', () => {
    const dark = appleThemeDark.components?.Button;
    expect(dark?.defaultBg).toBe('rgba(120,120,128,0.24)');
    expect(dark?.defaultHoverBg).toBe('rgba(120,120,128,0.32)');
    expect(dark?.defaultActiveBg).toBe('rgba(120,120,128,0.36)');
    expect(dark?.defaultBorderColor).toBe('#48484a');
    expect(dark?.defaultColor).toBe('#f5f5f7');
    expect(dark?.textHoverBg).toBe('rgba(255,255,255,0.08)');
    expect(dark?.borderRadius).toBe(8);
    expect(dark?.paddingInline).toBe(16);
    expect(dark?.primaryShadow).toBe('none');
  });

  it('输入框：浅灰底与聚焦环，深色按映射替换', () => {
    expect(appleTheme.components?.Input?.colorBgContainer).toBe('#f2f2f7');
    expect(appleTheme.components?.Input?.activeShadow).toBe('0 0 0 3px rgba(10,132,255,0.25)');
    expect(appleTheme.components?.Input?.borderRadius).toBe(10);
    expect(appleThemeDark.components?.Input?.colorBgContainer).toBe('rgba(120,120,128,0.24)');
    expect(appleThemeDark.components?.Input?.activeBg).toBe('#3a3a3c');
    expect(appleThemeDark.components?.Input?.activeShadow).toBe('0 0 0 3px rgba(10,132,255,0.45)');
    expect(appleThemeDark.components?.Input?.borderRadius).toBe(10);
  });

  it('表格：去边框、行选中浅蓝，深色按映射替换', () => {
    expect(appleTheme.components?.Table?.headerSplitColor).toBe('transparent');
    expect(appleTheme.components?.Table?.rowSelectedBg).toBe('rgba(10,132,255,0.10)');
    expect(appleTheme.components?.Table?.cellFontSize).toBe(13);
    expect(appleThemeDark.components?.Table?.headerColor).toBe('rgba(235,235,245,0.60)');
    expect(appleThemeDark.components?.Table?.rowSelectedHoverBg).toBe('rgba(10,132,255,0.28)');
    expect(appleThemeDark.components?.Table?.cellFontSize).toBe(13);
  });

  it('分段控件、勾选、开关与弹窗的关键基线', () => {
    expect(appleTheme.components?.Segmented?.borderRadius).toBe(9);
    expect(appleThemeDark.components?.Segmented?.borderRadius).toBe(9);
    expect(appleThemeDark.components?.Segmented?.itemSelectedBg).toBe('#3a3a3c');
    expect(appleTheme.components?.Checkbox?.borderRadiusSM).toBe(5);
    expect(appleThemeDark.components?.Checkbox?.borderRadiusSM).toBe(5);
    expect(appleTheme.components?.Radio?.radioSize).toBe(18);
    expect(appleTheme.components?.Switch?.trackHeight).toBe(30);
    expect(appleThemeDark.components?.Switch?.colorPrimary).toBe('#30d158');
    expect(appleTheme.components?.Modal?.borderRadiusLG).toBe(14);
    expect(appleThemeDark.components?.Modal?.contentBg).toBe('#2c2c2e');
    expect(appleThemeDark.components?.Modal?.borderRadiusLG).toBe(14);
  });

  it('菜单、标签、消息与骨架的深色取值不残留浅色字面值', () => {
    expect(appleThemeDark.components?.Menu?.itemSelectedBg).toBe('rgba(10,132,255,0.20)');
    expect(appleThemeDark.components?.Menu?.popupBg).toBe('rgba(44,44,46,0.96)');
    expect(appleThemeDark.components?.Tag?.defaultBg).toBe('rgba(120,120,128,0.24)');
    expect(appleThemeDark.components?.Message?.contentBg).toBe('rgba(44,44,46,0.96)');
    expect(appleThemeDark.components?.Skeleton?.gradientFromColor).toBe('rgba(255,255,255,0.06)');
    expect(appleThemeDark.components?.Pagination?.itemActiveBg).toBe('rgba(10,132,255,0.20)');
  });

  it('未列差异的组件在深色下保留浅色结构值（分页项尺寸与列表间距）', () => {
    expect(appleThemeDark.components?.List?.itemPadding).toBe(
      appleTheme.components?.List?.itemPadding
    );
    expect(appleThemeDark.components?.Segmented?.trackPadding).toBe(
      appleTheme.components?.Segmented?.trackPadding
    );
  });
});

describe('resolveAppleTheme', () => {
  it('按外观返回对应配置', () => {
    expect(resolveAppleTheme('light')).toBe(appleTheme);
    expect(resolveAppleTheme('dark')).toBe(appleThemeDark);
  });
});

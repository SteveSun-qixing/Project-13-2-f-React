# ADR-009: 主题系统 Design Tokens 方案

## 状态

**已接受** - 2026-09-19

**修订说明**：本 ADR 描述的是设计阶段的主题系统方案，完整实现和废弃历史详见 [薯片生态白皮书 task030 修订部分]。

## 背景

薯片生态需要一套统一的主题系统，确保所有插件和组件的视觉风格一致。传统主题系统存在以下问题：

1. **硬编码样式**：组件内直接写死颜色、间距等值
2. **不一致性**：不同组件使用不同的值
3. **修改困难**：改一处需要改多处
4. **主题切换复杂**：需要大量 CSS 覆盖

Design Tokens 是解决这些问题的行业最佳实践，通过声明式的设计变量实现视觉一致性。

## 决策

采用 **Design Tokens** 作为薯片生态主题系统的基础：

### Tokens 分层结构

```
┌─────────────────────────────────────────────────────────────┐
│                    Design Tokens 分层                        │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Level 1: Primitive Tokens (原始值)                    │  │
│  │  color.blue.500: #007AFF                             │  │
│  │  color.gray.100: #F5F5F7                             │  │
│  │  spacing.4: 16px                                     │  │
│  │  radius.md: 12px                                      │  │
│  └───────────────────────────────────────────────────────┘  │
│                         │                                    │
│                         ▼                                    │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Level 2: Semantic Tokens (语义值)                      │  │
│  │  color.primary: {color.blue.500}                      │  │
│  │  color.background: {color.gray.100}                   │  │
│  │  color.text: {color.gray.900}                        │  │
│  │  color.textSecondary: {color.gray.600}                 │  │
│  └───────────────────────────────────────────────────────┘  │
│                         │                                    │
│                         ▼                                    │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Level 3: Component Tokens (组件值)                     │  │
│  │  button.primary.bg: {color.primary}                    │  │
│  │  button.primary.color: {color.white}                  │  │
│  │  input.border.color: {color.border}                   │  │
│  │  card.bg: {color.surface}                             │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 完整 Token 定义

#### 颜色系统

```typescript
// tokens/color.ts
export const colorTokens = {
  // 主色
  primary: '#007AFF',           // Apple Blue
  primaryHover: '#0056CC',
  primaryActive: '#004499',
  
  // 功能色
  success: '#34C759',
  warning: '#FF9500',
  error: '#FF3B30',
  info: '#5AC8FA',
  
  // 中性色
  white: '#FFFFFF',
  black: '#000000',
  
  // 灰色阶梯
  gray50: '#FAFAFA',
  gray100: '#F5F5F7',
  gray200: '#E8E8ED',
  gray300: '#D2D2D7',
  gray400: '#BEBEC3',
  gray500: '#AEAEB2',
  gray600: '#86868B',
  gray700: '#636366',
  gray800: '#48484A',
  gray900: '#2C2C2E',
  gray950: '#1C1C1E',
  
  // 语义色
  text: '#1D1D1F',
  textSecondary: '#86868B',
  textTertiary: '#AEAEB2',
  textDisabled: '#D2D2D7',
  
  background: '#F5F5F7',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  
  border: '#D2D2D7',
  borderStrong: '#AEAEB2',
  
  // 玻璃效果
  glassBg: 'rgba(255, 255, 255, 0.72)',
  glassBorder: 'rgba(255, 255, 255, 0.2)',
};
```

#### 间距系统

```typescript
// tokens/spacing.ts
export const spacingTokens = {
  // 基础单位
  base: '4px',
  
  // 间距阶梯
  0: '0px',
  0.5: '2px',
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  8: '32px',
  10: '40px',
  12: '48px',
  16: '64px',
  
  // 语义间距
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  '2xl': '48px',
  '3xl': '64px',
};
```

#### 圆角系统

```typescript
// tokens/borderRadius.ts
export const radiusTokens = {
  // 基础圆角
  none: '0px',
  sm: '4px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  '2xl': '24px',
  '3xl': '32px',
  full: '9999px',
  
  // 语义圆角
  button: '8px',
  input: '8px',
  card: '12px',
  modal: '16px',
  sheet: '24px',
};
```

#### 阴影系统

```typescript
// tokens/shadow.ts
export const shadowTokens = {
  // 扁平阴影
  none: 'none',
  sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
  
  // 常规阴影
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  
  // 玻璃阴影
  glass: '0 8px 32px rgba(0, 0, 0, 0.08), inset 0 0 0 1px rgba(255, 255, 255, 0.2)',
  
  // Apple 风格阴影
  appleSm: '0 2px 8px rgba(0, 0, 0, 0.08)',
  appleMd: '0 4px 16px rgba(0, 0, 0, 0.12)',
  appleLg: '0 8px 32px rgba(0, 0, 0, 0.16)',
  
  // 内阴影
  insetSm: 'inset 0 1px 2px rgba(0, 0, 0, 0.05)',
  insetMd: 'inset 0 2px 4px rgba(0, 0, 0, 0.1)',
};
```

#### 字体系统

```typescript
// tokens/typography.ts
export const typographyTokens = {
  fontFamily: {
    system: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif',
    mono: '"SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, monospace',
  },
  
  fontSize: {
    '2xs': '10px',
    xs: '12px',
    sm: '13px',
    md: '14px',
    base: '14px',
    lg: '16px',
    xl: '18px',
    '2xl': '20px',
    '3xl': '24px',
    '4xl': '28px',
    '5xl': '32px',
    '6xl': '40px',
    '7xl': '48px',
  },
  
  fontWeight: {
    thin: '100',
    extralight: '200',
    light: '300',
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
    black: '900',
  },
  
  lineHeight: {
    none: '1',
    tight: '1.25',
    snug: '1.375',
    normal: '1.5',
    relaxed: '1.625',
    loose: '2',
  },
  
  letterSpacing: {
    tighter: '-0.05em',
    tight: '-0.025em',
    normal: '0',
    wide: '0.025em',
    wider: '0.05em',
    widest: '0.1em',
  },
};
```

### 主题配置

```typescript
// themes/apple-light.ts
export const appleLightTheme = {
  name: 'apple-light',
  type: 'light',
  
  colors: {
    primary: '#007AFF',
    background: '#F5F5F7',
    surface: '#FFFFFF',
    text: '#1D1D1F',
    // ... 其他颜色
  },
  
  spacing: {
    base: '4px',
    // ... 其他间距
  },
  
  radius: {
    button: '8px',
    card: '12px',
    // ... 其他圆角
  },
  
  shadows: {
    sm: '0 2px 8px rgba(0, 0, 0, 0.08)',
    md: '0 4px 16px rgba(0, 0, 0, 0.12)',
    // ... 其他阴影
  },
  
  typography: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
    fontSize: {
      body: '14px',
      // ... 其他字号
    },
    // ... 其他排版
  },
};
```

### 与 antd 集成

```typescript
// theme-provider.tsx
import { ConfigProvider } from 'antd';
import { createTheme, ThemeConfig } from '@chips/ui';

export function ChipsThemeProvider({ 
  children, 
  theme = 'apple-light' 
}: { 
  children: React.ReactNode;
  theme?: 'apple-light' | 'apple-dark';
}) {
  const antdTheme: ThemeConfig = {
    token: {
      // 主色
      colorPrimary: tokens.colors.primary,
      
      // 圆角
      borderRadius: tokens.radius.md,
      
      // 字体
      fontFamily: tokens.typography.fontFamily.system,
      fontSize: tokens.typography.fontSize.md,
      
      // 其他...
    },
    components: {
      Button: {
        borderRadius: tokens.radius.button,
        controlHeight: tokens.sizing.md,
      },
      Input: {
        borderRadius: tokens.radius.input,
      },
      Card: {
        borderRadius: tokens.radius.card,
      },
      // 其他组件配置...
    },
  };
  
  return (
    <ConfigProvider theme={antdTheme}>
      {children}
    </ConfigProvider>
  );
}
```

## 后果

### 优势

1. **一致性**：所有组件使用同一套 token
2. **可维护性**：修改 token 一处，全局生效
3. **主题切换**：不同主题只需切换 token 值
4. **Design Token 标准**：符合行业最佳实践
5. **跨平台**：token 可导出给不同平台使用
6. **文档友好**：token 名称语义化，易于理解

### 劣势

1. **初始设计成本**：需要仔细设计 token 结构
2. **学习曲线**：开发者需要理解 token 命名规范
3. **工具支持**：需要配套的设计工具和文档

### 风险

1. **token 膨胀**：如果不加控制，token 数量可能过多
2. **命名不一致**：不同人可能用不同命名方式

## 实现计划

### Phase 1: Token 定义
- 定义 Primitive Tokens
- 定义 Semantic Tokens
- 定义 Component Tokens

### Phase 2: 工具链
- 设计 Token 输出工具
- 配置 Style Dictionary
- 建立设计与代码同步流程

### Phase 3: 集成
- 集成到 @chips/ui
- 配置 antd 主题
- 编写使用文档

## 参考资料

- [Design Tokens Format](https://design-tokens.github.io/community-group/format/)
- [Style Dictionary](https://amzn.github.io/style-dictionary/)
- [Ant Design Design Tokens](https://ant.design/docs/react/customize-theme-variable)

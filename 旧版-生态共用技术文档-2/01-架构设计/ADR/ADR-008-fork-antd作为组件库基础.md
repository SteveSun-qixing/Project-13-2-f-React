# ADR-008: fork antd 作为组件库基础

## 状态

**已接受** - 2026-09-19

## 背景

薯片生态需要一套统一的基础组件库，支撑所有官方插件的 UI 开发。组件库需要满足以下要求：

1. **功能完整**：覆盖表单、数据显示、导航、反馈等场景
2. **类型安全**：TypeScript 完整支持
3. **主题定制**：支持深度定制视觉风格
4. **可访问性**：符合 WCAG 标准
5. **性能优良**：渲染性能好，包体可控
6. **维护成本**：社区活跃，长期维护

## 决策

采用 **fork antd (Ant Design)** 作为薯片生态组件库基础：

- 基于 antd 5.x 版本 fork
- 定制视觉风格为薯片生态苹果风格
- 贡献不提交上游，保持独立维护
- 逐步扩展薯片生态特有组件

### 技术选型对比

| 特性 | antd | Material UI | Chakra UI | Radix UI |
|------|------|-------------|-----------|----------|
| TypeScript 支持 | 完整 | 完整 | 完整 | 完整 |
| 主题定制 | ConfigProvider | ThemeProvider | ChakraProvider | 有限 |
| 组件数量 | 70+ | 50+ | 50+ | 20+ |
| 维护状态 | 活跃 | 活跃 | 活跃 | 活跃 |
| 包体大小 | ~400KB | ~300KB | ~250KB | ~50KB |
| React 版本 | 16+ | 17+ | 16+ | 16+ |

### fork 策略

```
┌─────────────────────────────────────────────────────────────┐
│                    @chips/ui (Forked antd)                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                   Base Components                      │  │
│  │  - Button, Input, Select, Checkbox, Radio, Switch     │  │
│  │  - Table, List, Tree, Grid                           │  │
│  │  - Modal, Drawer, Popover, Tooltip                   │  │
│  │  - Menu, Tabs, Breadcrumb, Pagination                │  │
│  │  - Form, DatePicker, TimePicker, Upload              │  │
│  │  - Alert, Message, Notification, Progress             │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Chips-Specific Components                │  │
│  │  - CardFrame                                         │  │
│  │  - BoxLayout                                         │  │
│  │  - DocumentViewer                                    │  │
│  │  - PluginCard                                        │  │
│  │  - WorkspaceBar                                      │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                  Design Tokens                         │  │
│  │  - Apple Light Theme                                  │  │
│  │  - Apple Dark Theme                                   │  │
│  │  - Spacing Scale                                      │  │
│  │  - Typography Scale                                   │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 视觉风格定制

薯片生态采用苹果风格（Apple-inspired Design），核心特征：

1. **玻璃拟态（Glassmorphism）**
2. **柔和阴影**
3. **大圆角**
4. **渐变背景**
5. **毛玻璃效果**

```typescript
// chips-ui/theme/tokens/apple-light.ts
export const appleLightTokens = {
  color: {
    primary: '#007AFF',           // Apple Blue
    success: '#34C759',           // Apple Green
    warning: '#FF9500',           // Apple Orange
    error: '#FF3B30',             // Apple Red
    background: '#F5F5F7',
    surface: 'rgba(255, 255, 255, 0.72)',
    text: '#1D1D1F',
    textSecondary: '#86868B',
  },
  borderRadius: {
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
  },
  shadows: {
    sm: '0 2px 8px rgba(0, 0, 0, 0.08)',
    md: '0 4px 16px rgba(0, 0, 0, 0.12)',
    lg: '0 8px 32px rgba(0, 0, 0, 0.16)',
    glass: '0 8px 32px rgba(0, 0, 0, 0.08), inset 0 0 0 1px rgba(255, 255, 255, 0.2)',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
  },
  typography: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif',
    fontSize: {
      xs: '12px',
      sm: '13px',
      md: '14px',
      lg: '16px',
      xl: '20px',
      '2xl': '24px',
      '3xl': '32px',
    },
  },
};
```

### 组件分类

```typescript
// @chips/ui/components/
// ├── 基础组件 (Primitive)
// │   ├── Button/
// │   ├── Icon/
// │   └── Typography/
// │
// ├── 表单组件 (Form)
// │   ├── Input/
// │   ├── Select/
// │   ├── Checkbox/
// │   ├── Radio/
// │   ├── Switch/
// │   ├── Slider/
// │   ├── DatePicker/
// │   └── Upload/
// │
// ├── 数据显示 (Data Display)
// │   ├── Table/
// │   ├── List/
// │   ├── Tree/
// │   ├── Card/
// │   └── Image/
// │
// ├── 导航组件 (Navigation)
// │   ├── Menu/
// │   ├── Tabs/
// │   ├── Breadcrumb/
// │   └── Pagination/
// │
// ├── 反馈组件 (Feedback)
// │   ├── Modal/
// │   ├── Drawer/
// │   ├── Popover/
// │   ├── Tooltip/
// │   ├── Alert/
// │   ├── Message/
// │   ├── Notification/
// │   └── Progress/
// │
// └── 生态组件 (Chips-specific)
//     ├── CardFrame/
//     ├── BoxLayout/
//     ├── DocumentViewer/
//     ├── PluginCard/
//     └── WorkspaceBar/
```

## 后果

### 优势

1. **功能完整**：antd 提供 70+ 组件，覆盖几乎所有场景
2. **成熟稳定**：经过大量生产项目验证
3. **TypeScript 优先**：完整类型定义
4. **主题灵活**：ConfigProvider 支持深度定制
5. **生态完善**：丰富的文档和社区支持
6. **可扩展**：基于 antd 的组件可复用大部分逻辑
7. **性能优化**：antd 5.x 使用 CSS-in-JS，性能优秀

### 劣势

1. **包体较大**：完整导入约 400KB（可 tree-shaking）
2. **学习成本**：需要学习 antd 的使用方式
3. **fork 维护成本**：需要独立维护版本
4. **与上游同步**：需要定期同步上游更新

### 风险

1. **antd 版本升级**：可能破坏定制代码
2. **上游停止维护**：目前风险较低
3. **定制冲突**：深度定制可能与上游设计冲突

## 替代方案

### 方案 1：使用原始 antd

**优点**：
- 无需维护 fork
- 自动获得上游更新

**缺点**：
- 无法深度定制视觉风格
- 无法添加生态特有组件

**结论**：不采用。无法满足视觉风格统一需求。

### 方案 2：从零构建组件库

**优点**：
- 完全可控
- 包体最小

**缺点**：
- 开发周期长
- 需要实现 70+ 组件
- 维护成本极高

**结论**：不采用。成本过高，不现实。

### 方案 3：使用 headless 组件库

**优点**：
- 完全自定义视觉
- 包体小

**缺点**：
- 需要额外配置样式
- 缺少完整组件集

**结论**：不采用。无法满足开箱即用的需求。

## 实现计划

### Phase 1: fork 初始化
- fork antd 5.x 仓库
- 清理不需要的组件
- 配置构建系统

### Phase 2: 视觉定制
- 定义 Design Tokens
- 定制基础组件样式
- 实现玻璃拟态效果

### Phase 3: 生态组件
- 实现 CardFrame
- 实现 BoxLayout
- 实现 DocumentViewer
- 实现其他生态组件

### Phase 4: 文档与发布
- 编写组件文档
- 配置 npm 发布
- 建立版本管理策略

## 版本管理策略

```typescript
// package.json
{
  "name": "@chips/ui",
  "version": "5.0.0-chips.1",
  // 基于 antd 5.x.y
  "peerDependencies": {
    "antd": "^5.12.0"
  }
}
```

版本同步策略：
- 跟随 antd 主版本号
- 添加 chips 版本后缀
- 定期合并 antd 上游更新

## 参考资料

- [Ant Design 官方文档](https://ant.design/docs/react/introduce-cn)
- [Ant Design 源码](https://github.com/ant-design/ant-design)
- Apple Human Interface Guidelines

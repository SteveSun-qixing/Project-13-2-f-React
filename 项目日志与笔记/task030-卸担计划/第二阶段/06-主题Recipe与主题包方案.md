# 06 主题 Recipe 与主题包方案

## 1. 先解决方向冲突

第一阶段把旧 `ThemePack` 归档、默认应用改为 `@chips/ui` 的 Apple theme，这能降低应用接线复杂度，但如果把 Theme Runtime 和主题包能力全部删除，就无法继续支持“主题是独立生态扩展”的原始目标。

本方案建议保留 Host-owned Theme Runtime，重做主题作者体验：

```text
应用作者：默认消费 @chips/ui，不写主题代码
普通视觉作者：填写 theme recipe，生成主题包
Host：安装/选择/作用域/注入/回退
组件/UI：只消费 ConfigProvider + CSS variables
```

是否开放外部主题安装由 M0-D2 决定。即使最终只保留单一 Apple 主题，也应使用同一套 Recipe 编译和校验，不能退回散落硬编码。

## 2. 主题包职责

主题包只提供静态外观产物：

- `manifest.yaml`：themeId、displayNameKey、version、entry、scope、资源清单；
- `theme.css`：CSS 变量、组件选择器、字体和图标资源声明；
- `tokens.json`：解析后 token 快照；
- `theme.config.json`：编译元数据和生成器版本；
- `fonts/`、`icons/`、`preview/`：受校验的资源和预览页面；
- `contracts/`：编译器生成的主题覆盖/完整性报告，不由作者手写整套组件合同。

主题包禁止：

- import React 或业务应用代码；
- 直接访问 `window.chips`、SDK、文件系统或 Host service；
- 将组件逻辑复制进主题；
- 在 CSS 中写插件业务选择器或依赖 DOM 私有结构；
- 在单个包内暗中混合两个 `themeId` 的外观；
- 使用远程网络字体、远程 CSS 或未声明的资源。

## 3. Recipe 输入模型

### 3.1 最小主题源文件

```text
theme/
├── theme.config.ts       # themeId、显示名、平台目标、生成器版本
├── palette.ts             # 色板和语义色
├── typography.ts          # 字体族、字号、行高、字重
├── shape.ts               # 圆角、边框、阴影
├── density.ts             # 控件高度、间距、列表密度
├── motion.ts              # 时长、缓动、reduce-motion 策略
├── icons.ts               # 图标风格和资源声明（可选）
├── overrides.ts           # 仅允许的组件 token 覆写（可选）
└── preview/               # 由脚手架生成的主题画廊入口
```

普通主题作者最多修改前六个文件；`icons.ts` 和 `overrides.ts` 只在确有需求时创建。

### 3.2 语义模型

Recipe 必须先描述语义，再映射 antd token：

```ts
export default defineThemeRecipe({
  themeId: "com.example.ocean-light",
  appearance: "light",
  palette: {
    accent: "#0a84ff",
    surface: "#ffffff",
    canvas: "#f5f5f7",
    text: "#1d1d1f",
    textMuted: "#6e6e73",
    positive: "#34c759",
    warning: "#ff9f0a",
    negative: "#ff3b30",
  },
  typography: { family: "system-ui", baseSize: 14, scale: 1.125 },
  shape: { radius: 10, controlRadius: 8, elevation: "soft" },
  density: "comfortable",
  motion: { duration: "normal", reduceMotion: "respect-system" },
});
```

编译器负责：

1. 计算语义色的 hover/active/disabled/focus/contrast 变体；
2. 将语义 token 映射到 antd global/component token；
3. 生成 `:root`/scope CSS variables 和 antd `ThemeConfig` JSON；
4. 检查对比度、非法值、循环引用和不支持的 token；
5. 根据 `overrides` 生成少量组件覆写，拒绝未登记的选择器；
6. 生成 manifest、合同报告、预览和构建摘要。

## 4. 主题层级和作用域

保留 Host 侧作用域概念，但对作者隐藏解析顺序：

```text
Host 默认主题
  → 用户选定主题
  → App / surface 作用域覆写（仅 Host 治理）
  → iframe/document 注入完整 CSS
```

主题包作者只需声明 `themeId`、`appearance` 和允许的覆盖范围。不得让应用通过任意 CSS selector 覆盖 Host 主题；应用局部状态使用 `data-state` 和语义 class，由共享 token 解释。

## 5. 生成产物和目录

建议新脚手架命名为 `chips-scaffold-theme-recipe`，目录如下：

```text
theme-package/
├── manifest.yaml
├── package.json
├── src/
│   ├── theme.config.ts
│   ├── palette.ts
│   └── overrides.ts
├── tokens/
│   ├── resolved.json
│   └── diagnostics.json
├── dist/
│   ├── theme.css
│   ├── tokens.json
│   ├── theme.config.json
│   └── contracts.json
├── fonts/
├── icons/
├── preview/
│   ├── index.html
│   └── matrix.json
└── tests/
```

生成命令：

```bash
chipsdev-r theme create --mode recipe
npm run build:theme
npm run validate:theme
npm run preview:theme
npm test
```

禁止作者直接维护 `dist/`；每次 build 先清理并完整生成，输出 `generatorVersion`、输入摘要和 source hash，防止陈旧产物被发布。

## 6. Theme Runtime 消费流程

1. Host 安装包并校验 theme manifest、资源路径、CSS 规则和 token schema。
2. Theme Runtime 解析当前 `themeId`，生成主题快照和完整 CSS。
3. plugin window preload 只在权限和页面类型允许时注入 CSS、`data-chips-theme-id`、版本和诊断属性。
4. `@chips/ui` 从注入状态确定使用的 `ThemeConfig`；没有自定义主题时使用 `appleTheme`。
5. 生成的 iframe/document HTML 注入同一份完整 CSS，包括 `@font-face`，不从父页面假设继承。
6. 主题切换发出 `theme.changed`；需要响应的设置面板/治理 UI 使用 SDK typed event，普通业务页面由 Host 自动更新样式。
7. 解析失败回退默认主题，报告 `themeId/themeVersion/missingTokenCount/invalidRuleCount`。

## 7. 主题作者的开发和预览体验

主题预览必须包含固定矩阵：

- Button/Input/Select/Form/Dialog/Drawer/Menu/Tabs/Table/List/Tree/DatePicker/Upload；
- hover、active、focus-visible、disabled、loading、error、empty、selected、checked；
- 中文长文案、数字、窄窗口、宽窗口、系统字体缺失；
- Desktop Host、Browser preview、iframe/document；
- `prefers-reduced-motion`、高对比度和键盘操作。

预览页面从生成的 `dist` 读取 CSS 和 tokens，不能直接 import 源文件绕过构建。CLI 提供 `theme inspect` 展示：

```text
themeId / version / appearance
resolved token count / missing token count
CSS byte size / font byte size
unsupported override count / contrast failures
```

## 8. 主题验收标准

- 主题源只需 Recipe 层文件，不能要求手写所有组件文件；
- 必需 token 覆盖率 100%，未支持 token 必须显式列在报告，不静默丢弃；
- CSS、tokens、manifest、contracts、fonts 的 source hash 一致；
- 构建产物可被 Host 安装并在真实 surface 和 iframe 中渲染；
- 所有可见文字和无障碍文案走 key 或 Host/antd 正式 locale；
- 不加载远程资源，不放宽插件 CSP；
- 两个不同 themeId 的包可在同一测试 Host 上切换，并且旧页面无残留 CSS；
- 主题失败可回退默认，不会因为单个 token 或字体缺失让页面无法打开。


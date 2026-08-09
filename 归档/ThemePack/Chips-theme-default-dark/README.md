# 薯片官方 · 暗夜主题

这是基于 Chips 官方主题脚手架演进出的暗夜主题插件工程。主题遵循薯片生态的主题系统设计与插件规范，以完整主题包方式交付，不在包内混合多模式切换。

## 基本信息

- 插件 ID：`theme.theme.chips-official-default-dark-theme`
- 主题 ID：`chips-official.default-dark-theme`
- 版本：`1.0.0`
- 描述：`Chips 官方暗夜主题`
- 风格定位：`克制 / 沉静 / 清晰 / 高对比暗色工作界面`

## 目录结构

```text
.
├─ manifest.yaml          # 插件与主题配置
├─ package.json           # NPM 配置与脚本
├─ tsconfig.json          # TypeScript 配置
├─ chips.config.mjs       # Chips Dev 配置
├─ tokens/                # 设计 Token 源文件（五层结构输入）
├─ src/                   # 构建与校验脚本
├─ styles/                # 主题 CSS 文件
├─ 视觉设计语言/          # 暗夜主题外观与样式设计语言
├─ icons/                 # 图标资源规范说明
├─ fonts/                 # 字体资源规范说明
├─ contracts/             # 主题契约与最小功能集声明
├─ preview/               # 预览资源
└─ tests/                 # 本地测试与校验用例
```

## 常用命令

- `npm run build`：构建主题 Token 与 CSS，输出到 `dist/`。
- `npm run validate:theme`：对构建结果进行主题契约校验，覆盖组件库当前正式 contract 基线。
- `npm test`：运行本地单元测试。
- `chipsdev package`：生成符合插件安装契约的 `.cpk` 主题包。

## 视觉与交付原则

- 一包一外观：本主题只承载暗夜外观，不在包内提供 light/dark 切换。
- 统一运行时：所有颜色、边框、焦点与容器层次均通过正式 Theme Runtime token 链路提供。
- 简约审美：避免多余装饰、复杂纹理和强动效，强调长时间使用时的稳定与可读性。
- 完整交付：保留契约、文档、测试、`.cpk` 打包产物与 Host 联调所需结构。

## 视觉语言

- 暗夜主题包视觉设计语言：`视觉设计语言/00-文档索引.md`
- 本目录描述暗夜主题的外观、样式、材质、色彩、阴影、动效和 token 落地口径，不承载应用结构、页面信息架构或业务流程设计。

# richtext-BCP 基础卡片插件图标来源说明

- 正式设计源目录：`design-assets/Basecardicon/`
- 对应设计源文件：`richtext-BCP.png/.ico/.icns/.svg`
- Material Symbols 名称：`article`
- 官方 SVG 缓存：`design-assets/material-symbols/svg/rounded/article.svg`
- 生成脚本：`scripts/generate-plugin-material-icons.ts`
- 同步时间：2026-05-29

## 当前工程内纳入版本控制的文件

- `basecard-icon.png`
- `basecard-icon.ico`
- `basecard-icon.icns`
- `basecard-icon.svg`

## 使用边界

- 基础卡片插件没有 `manifest.ui.launcher.icon`，这些文件不属于系统入口图标链路；
- 运行时图标描述符以 `src/index.ts -> basecardDefinition.icon` 为准；
- 编辑面板悬浮工具框与右键菜单图标统一使用 `@ant-design/icons`（task030 起废弃 `ChipsIcon + IconDescriptor` 组件库图标链路）。

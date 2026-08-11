# 基础卡片模板静态图标说明

- 正式设计源目录：`design-assets/Basecardicon/`
- 模板占位图标：`basecard-icon.svg`（Material Symbols `style`）
- 官方 SVG 缓存：`design-assets/material-symbols/svg/rounded/style.svg`
- SVG 生成脚本：`scripts/generate-plugin-material-icons.ts`
- PNG/ICO/ICNS 渲染脚本：`scripts/sync-plugin-icons.mjs`（`chips iconmaker generate` 命令行链路）

## 资产角色

- 该文件是基础卡片模板内的静态身份占位资源，生成工程后保存为 `assets/icons/basecard-icon.svg`；
- 正式身份图标链路：生成工程后通过 `scripts/generate-plugin-material-icons.ts` 为插件登记 `basecard` 目标产出 SVG，再通过 `scripts/sync-plugin-icons.mjs` 渲染 `basecard-icon.png/.ico/.icns` 四件套；
- 基础卡片插件没有 `manifest.ui.launcher.icon`，这些文件不属于系统入口图标链路；
- 运行时图标描述符以 `src/index.ts -> basecardDefinition.icon` 为准，编辑引擎、查看器和治理页统一通过 `ChipsIcon + IconDescriptor` 渲染，不消费本 SVG 文件。

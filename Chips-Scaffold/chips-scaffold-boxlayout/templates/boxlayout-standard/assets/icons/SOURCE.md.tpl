# 箱子布局模板静态图标说明

- 正式设计源目录：`design-assets/Layouticon/`
- 模板占位图标：`layout-icon.svg`（Material Symbols `grid_view`）
- 官方 SVG 缓存：`design-assets/material-symbols/svg/rounded/grid_view.svg`
- 生成脚本：`scripts/generate-plugin-material-icons.ts`

## 资产角色

- 该文件是布局模板内的静态身份占位资源，生成工程后保存为 `assets/icons/layout-icon.svg`；
- 正式身份图标链路：生成工程后通过 `scripts/generate-plugin-material-icons.ts` 为插件登记 `layout` 目标，产出 `layout-icon.png/.ico/.icns/.svg` 四件套；
- 箱子布局插件没有 `manifest.ui.launcher.icon`，这些文件不属于系统入口图标链路；
- 运行时图标描述符以 `src/index.ts -> layoutDefinition.icon` 为准，编辑引擎、查看器和治理页统一通过 `ChipsIcon + IconDescriptor` 渲染，不消费本 SVG 文件。

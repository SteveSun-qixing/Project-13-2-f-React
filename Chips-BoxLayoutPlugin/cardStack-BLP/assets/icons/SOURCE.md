# cardStack-BLP 箱子布局插件图标来源说明

- 正式设计源目录：`design-assets/Layouticon/`
- 对应设计源文件：`cardStack-BLP.png/.ico/.icns/.svg`
- Material Symbols 名称：`style`
- 官方 SVG 缓存：`design-assets/material-symbols/svg/rounded/style.svg`
- SVG 生成脚本：`scripts/generate-plugin-material-icons.ts`
- PNG/ICO/ICNS 渲染脚本：`scripts/sync-plugin-icons.mjs`（`chips iconmaker generate` 命令行链路）
- 同步时间：2026-08-29

## 当前工程内纳入版本控制的文件

- `layout-icon.png`
- `layout-icon.ico`
- `layout-icon.icns`
- `layout-icon.svg`

## 使用边界

- 箱子布局插件没有 `manifest.ui.launcher.icon`，这些文件不属于系统入口图标链路；
- 运行时图标描述符以 `src/index.ts -> layoutDefinition.icon` 为准；
- 查看器、编辑器和治理页渲染图标时仍应使用 `ChipsIcon + IconDescriptor`。

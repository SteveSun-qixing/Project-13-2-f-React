# ColorPicker 模块插件图标来源说明

- 正式设计源目录：`design-assets/Moduleicon/`
- 对应设计源文件：`ColorPicker.png/.ico/.icns/.svg`
- Material Symbols 名称：`palette`
- 官方 SVG 缓存：`design-assets/material-symbols/svg/rounded/palette.svg`
- SVG 生成脚本：`scripts/generate-plugin-material-icons.ts`
- PNG/ICO/ICNS 渲染脚本：`scripts/sync-plugin-icons.mjs`（`chips iconmaker generate` 命令行链路）
- 同步时间：2026-08-29

## 当前工程内纳入版本控制的文件

- `module-icon.png`
- `module-icon.ico`
- `module-icon.icns`
- `module-icon.svg`

## 使用边界

- 模块插件没有 `manifest.ui.launcher.icon`，这些文件不属于系统入口图标链路；
- 当前作为模块静态身份资源保存在工程内，供模块治理、物料清点和后续运行时展示链路复用；
- 运行时 UI 图标仍应使用 `ChipsIcon + IconDescriptor`。

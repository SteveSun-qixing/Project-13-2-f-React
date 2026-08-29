# VideoPlayer 应用插件图标来源说明

- 正式设计源目录：`design-assets/Appicon/`
- 对应设计源文件：`VideoPlayer.png/.ico/.icns/.svg`
- Material Symbols 名称：`movie`
- 官方 SVG 缓存：`design-assets/material-symbols/svg/rounded/movie.svg`
- SVG 生成脚本：`scripts/generate-plugin-material-icons.ts`
- PNG/ICO/ICNS 渲染脚本：`scripts/sync-plugin-icons.mjs`（`chips iconmaker generate` 命令行链路）
- 同步时间：2026-08-29

## 当前工程内纳入版本控制的文件

- `app-icon.png`
- `app-icon.ico`
- `app-icon.icns`
- `app-icon.svg`

## 使用边界

- `app-icon.ico` 是 `manifest.yaml -> ui.launcher.icon` 的正式声明文件；
- Host 会按平台选择 `ico / icns / png` 作为系统入口图标；
- 这些文件只属于系统入口与安装分发链路，不属于运行时 `ChipsIcon` 图标模型。

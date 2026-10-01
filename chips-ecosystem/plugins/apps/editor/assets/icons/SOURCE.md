# 编辑引擎应用插件图标来源说明

- 正式设计源目录：`design-assets/Appicon/`
- 对应设计源文件：`EditingEngine.svg`（SVG 为唯一源）
- Material Symbols 名称：`edit_note`
- 上游 SVG 缓存（锁定提交）：`design-assets/material-symbols/svg/rounded/edit_note.svg`
- SVG 生成脚本：`scripts/generate-plugin-material-icons.ts`
- PNG/ICO/ICNS 渲染脚本：`scripts/sync-plugin-icons.mjs`（`chips iconmaker generate` 命令行链路）
- 同步时间：2026-10-01（W5 编辑器搬运臂：四格式随包自旧仓 `Chips-EditingEngine/assets/icons/`
  同批次产物逐字复制，sha256 与旧仓逐一核对一致；设计源与生成链口径不变）

## 当前包内纳入版本控制的文件

- `app-icon.svg`（设计源与平台中立主图；`manifest.yaml -> ui.launcher.icon` 声明此文件）
- `app-icon.png`（平台中立主图位图）
- `app-icon.ico`（平台派生容器）
- `app-icon.icns`（平台派生容器）

## 使用边界

- `app-icon.svg` 是设计源与平台中立主图；
- `manifest.yaml -> ui.launcher.icon` 只声明 `app-icon.svg` 或 `app-icon.png`，不声明平台专属容器；
- `app-icon.ico` 与 `app-icon.icns` 是平台派生的系统入口容器，由平台变体解析链按平台选择；
- 这些文件只属于系统入口与安装分发链路，不属于运行时 UI 图标链路（运行时 UI 图标统一经 `@chips/ui` 图标出口渲染）；
- 图标资产更新必须先更新 `design-assets/Appicon/` 正式设计源并重渲染四格式，再同步本包并更新本文件。

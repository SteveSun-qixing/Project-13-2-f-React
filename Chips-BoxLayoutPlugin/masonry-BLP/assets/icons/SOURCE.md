# masonry-BLP 箱子布局插件图标来源说明

- 正式设计源目录：`design-assets/Layouticon/`
- 对应设计源文件：`masonry-BLP.svg`（SVG 为唯一源）
- Material Symbols 名称：`dashboard`
- 上游 SVG 缓存（锁定提交）：`design-assets/material-symbols/svg/rounded/dashboard.svg`
- SVG 生成脚本：`scripts/generate-plugin-material-icons.ts`
- PNG/ICO/ICNS 渲染脚本：`scripts/sync-plugin-icons.mjs`（`chips iconmaker generate` 命令行链路）
- 同步时间：2026-08-29

## 当前工程内纳入版本控制的文件

- `layout-icon.svg`（设计源与平台中立主图）
- `layout-icon.png`（平台中立主图位图）
- `layout-icon.ico`（平台派生容器）
- `layout-icon.icns`（平台派生容器）

## 使用边界

- 箱子布局插件没有 `manifest.ui.launcher.icon`，这些文件不属于系统入口图标链路；
- `layout-icon.svg` 是身份四件套的设计源与平台中立主图，`.png` / `.ico` / `.icns` 为同批派生物；
- 清单 `capabilities.layouts[].icon` 只声明各布局类型的平台中立主图（`assets/icons/<布局短名>.svg`）；
- 运行时 UI 图标统一经 `@chips/ui` 图标出口渲染。

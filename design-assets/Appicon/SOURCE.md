# 应用启动图标源目录说明

- 适用目录：`design-assets/Appicon/`
- 同步时间：2026-08-29
- SVG 生成脚本：`scripts/generate-plugin-material-icons.ts`
- PNG/ICO/ICNS 渲染脚本：`scripts/sync-plugin-icons.mjs`（`chips iconmaker generate` 命令行链路）
- 上游 SVG 缓存：`design-assets/material-symbols/svg/rounded/`
- 视觉基线：白色背景、黑色 Material Symbols Rounded 图标。
- 转换链路：官方 Material Symbols Rounded SVG -> 512px 白底黑色 SVG（本脚本）-> Chip-iconMaker CLI 渲染 PNG/ICO/ICNS。

## 目录职责

- 本目录保存应用插件系统入口图标的正式设计源；
- 对应运行时消费链路为 `manifest.ui.launcher.icon`、Host 安装复制、快捷方式解析、安装分发与启动台入口；
- 本目录不是运行时 UI 图标目录，运行时 UI 图标统一使用 `ChipsIcon + IconDescriptor`；
- 模块、基础卡片、布局和主题身份图标分别使用各自的设计源目录，不混入本目录。

## 当前正式命名基线

| 源文件基名 | Material Symbols 名称 | 对应工程 | 正式输出物 |
| --- | --- | --- | --- |
| `AppIcon` | `apps` | `Chips-Scaffold/chips-scaffold-app/templates/app-standard` | `Chips-Scaffold/chips-scaffold-app/templates/app-standard/assets/icons/app-icon.png/.ico/.icns/.svg` |
| `BookReader` | `menu_book` | `Chips-BookReader` | `Chips-BookReader/assets/icons/app-icon.png/.ico/.icns/.svg` |
| `CommunityClient` | `public` | `Chips-CommunityClient` | `Chips-CommunityClient/assets/icons/app-icon.png/.ico/.icns/.svg` |
| `CardViewer` | `dashboard` | `Chips-CardViewer` | `Chips-CardViewer/assets/icons/app-icon.png/.ico/.icns/.svg` |
| `EcoSettingsPanel` | `settings` | `Chips-EcoSettingsPanel` | `Chips-EcoSettingsPanel/assets/icons/app-icon.png/.ico/.icns/.svg` |
| `EditingEngine` | `edit_note` | `Chips-EditingEngine` | `Chips-EditingEngine/assets/icons/app-icon.png/.ico/.icns/.svg` |
| `IconMaker` | `palette` | `Chip-iconMaker` | `Chip-iconMaker/assets/icons/app-icon.png/.ico/.icns/.svg` |
| `MusicPlayer` | `library_music` | `Chips-MusicPlayer` | `Chips-MusicPlayer/assets/icons/app-icon.png/.ico/.icns/.svg` |
| `PhotoViewer` | `image` | `Chips-PhotoViewer` | `Chips-PhotoViewer/assets/icons/app-icon.png/.ico/.icns/.svg` |
| `RichTextEditor` | `draw` | `Chips-RichTextEditor` | `Chips-RichTextEditor/assets/icons/app-icon.png/.ico/.icns/.svg` |
| `UniversalFileViewer` | `folder_open` | `Chips-UniversalFileViewer` | `Chips-UniversalFileViewer/assets/icons/app-icon.png/.ico/.icns/.svg` |
| `VideoPlayer` | `movie` | `Chips-VideoPlayer` | `Chips-VideoPlayer/assets/icons/app-icon.png/.ico/.icns/.svg` |

## 更新规则

- 图标调整时，先更新本目录正式 SVG 源文件，再通过 `scripts/generate-plugin-material-icons.ts` 同步 SVG 设计源，并通过 `scripts/sync-plugin-icons.mjs`（`chips iconmaker generate`）重新渲染 PNG/ICO/ICNS；
- 不再使用字体码位、HTML 文本渲染或截图方式生成图标，避免出现乱码；
- 每次改动本目录资产，必须同步更新本文件与对应工程 `assets/icons/SOURCE.md`；
- 运行时 UI 图标仍通过生态正式 `ChipsIcon + IconDescriptor` 链路渲染。

# 模块插件静态图标源目录说明

- 适用目录：`design-assets/Moduleicon/`
- 同步时间：2026-08-11
- SVG 生成脚本：`scripts/generate-plugin-material-icons.ts`
- PNG/ICO/ICNS 渲染脚本：`scripts/sync-plugin-icons.mjs`（`chips iconmaker generate` 命令行链路）
- 上游 SVG 缓存：`design-assets/material-symbols/svg/rounded/`
- 视觉基线：白色背景、黑色 Material Symbols Rounded 图标。
- 转换链路：官方 Material Symbols Rounded SVG -> 512px 白底黑色 SVG（本脚本）-> Chip-iconMaker CLI 渲染 PNG/ICO/ICNS。

## 目录职责

- 本目录保存模块插件静态身份图标的正式设计源；
- 工程内同步到 `assets/icons/module-icon.*`，用于模块治理、物料清点和后续展示链路；
- 模块插件没有 `manifest.ui.launcher.icon`，这些文件不属于系统入口图标链路；
- 应用插件启动图标源目录仍为 `design-assets/Appicon/`。

## 当前正式命名基线

| 源文件基名 | Material Symbols 名称 | 对应工程 | 正式输出物 |
| --- | --- | --- | --- |
| `CardtoHTML` | `html` | `Chips-ModulePlugin/Chips-CardtoHTML-Plugin` | `Chips-ModulePlugin/Chips-CardtoHTML-Plugin/assets/icons/module-icon.png/.ico/.icns/.svg` |
| `ColorPicker` | `palette` | `Chips-ModulePlugin/Chips-ColorPicker` | `Chips-ModulePlugin/Chips-ColorPicker/assets/icons/module-icon.png/.ico/.icns/.svg` |
| `CommunityUploader` | `cloud_upload` | `Chips-ModulePlugin/Chips-CommunityUploader-Plugin` | `Chips-ModulePlugin/Chips-CommunityUploader-Plugin/assets/icons/module-icon.png/.ico/.icns/.svg` |
| `FileConversion` | `sync_alt` | `Chips-ModulePlugin/Chips-FileConversion-Plugin` | `Chips-ModulePlugin/Chips-FileConversion-Plugin/assets/icons/module-icon.png/.ico/.icns/.svg` |
| `HtmltoImage` | `image_search` | `Chips-ModulePlugin/Chips-HtmltoImage-Plugin` | `Chips-ModulePlugin/Chips-HtmltoImage-Plugin/assets/icons/module-icon.png/.ico/.icns/.svg` |
| `HtmltoPDF` | `picture_as_pdf` | `Chips-ModulePlugin/Chips-HtmltoPDF-Plugin` | `Chips-ModulePlugin/Chips-HtmltoPDF-Plugin/assets/icons/module-icon.png/.ico/.icns/.svg` |

## 更新规则

- 图标调整时，先更新本目录正式 SVG 源文件，再通过 `scripts/generate-plugin-material-icons.ts` 同步 SVG 设计源，并通过 `scripts/sync-plugin-icons.mjs`（`chips iconmaker generate`）重新渲染 PNG/ICO/ICNS；
- 不再使用字体码位、HTML 文本渲染或截图方式生成图标，避免出现乱码；
- 每次改动本目录资产，必须同步更新本文件与对应工程 `assets/icons/SOURCE.md`；
- 运行时 UI 图标仍通过生态正式 `ChipsIcon + IconDescriptor` 链路渲染。

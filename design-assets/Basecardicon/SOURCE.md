# 基础卡片插件静态图标源目录说明

- 适用目录：`design-assets/Basecardicon/`
- 同步时间：2026-08-11
- SVG 生成脚本：`scripts/generate-plugin-material-icons.ts`
- PNG/ICO/ICNS 渲染脚本：`scripts/sync-plugin-icons.mjs`（`chips iconmaker generate` 命令行链路）
- 上游 SVG 缓存：`design-assets/material-symbols/svg/rounded/`
- 视觉基线：白色背景、黑色 Material Symbols Rounded 图标。
- 转换链路：官方 Material Symbols Rounded SVG -> 512px 白底黑色 SVG（本脚本）-> Chip-iconMaker CLI 渲染 PNG/ICO/ICNS。

## 目录职责

- 本目录保存基础卡片插件静态身份图标的正式设计源；
- 工程内同步到 `assets/icons/basecard-icon.*`，用于插件静态身份、物料清点和后续展示链路；
- 基础卡片运行时图标仍以 `basecardDefinition.icon` 与 `ChipsIcon + IconDescriptor` 为准；
- 本目录不属于 `manifest.ui.launcher.icon` 系统入口链路。

## 当前正式命名基线

| 源文件基名 | Material Symbols 名称 | 对应工程 | 正式输出物 |
| --- | --- | --- | --- |
| `book-BCP` | `menu_book` | `Chips-BaseCardPlugin/book-BCP` | `Chips-BaseCardPlugin/book-BCP/assets/icons/basecard-icon.png/.ico/.icns/.svg` |
| `hyperlink-BCP` | `link` | `Chips-BaseCardPlugin/hyperlink-BCP` | `Chips-BaseCardPlugin/hyperlink-BCP/assets/icons/basecard-icon.png/.ico/.icns/.svg` |
| `image-BCP` | `image` | `Chips-BaseCardPlugin/image-BCP` | `Chips-BaseCardPlugin/image-BCP/assets/icons/basecard-icon.png/.ico/.icns/.svg` |
| `music-BCP` | `music_note` | `Chips-BaseCardPlugin/music-BCP` | `Chips-BaseCardPlugin/music-BCP/assets/icons/basecard-icon.png/.ico/.icns/.svg` |
| `richtext-BCP` | `article` | `Chips-BaseCardPlugin/richtext-BCP` | `Chips-BaseCardPlugin/richtext-BCP/assets/icons/basecard-icon.png/.ico/.icns/.svg` |
| `score-BCP` | `star` | `Chips-BaseCardPlugin/score-BCP` | `Chips-BaseCardPlugin/score-BCP/assets/icons/basecard-icon.png/.ico/.icns/.svg` |
| `video-BCP` | `play_circle` | `Chips-BaseCardPlugin/video-BCP` | `Chips-BaseCardPlugin/video-BCP/assets/icons/basecard-icon.png/.ico/.icns/.svg` |
| `webpage-BCP` | `language` | `Chips-BaseCardPlugin/webpage-BCP` | `Chips-BaseCardPlugin/webpage-BCP/assets/icons/basecard-icon.png/.ico/.icns/.svg` |

## 更新规则

- 图标调整时，先更新本目录正式 SVG 源文件，再通过 `scripts/generate-plugin-material-icons.ts` 同步 SVG 设计源，并通过 `scripts/sync-plugin-icons.mjs`（`chips iconmaker generate`）重新渲染 PNG/ICO/ICNS；
- 不再使用字体码位、HTML 文本渲染或截图方式生成图标，避免出现乱码；
- 每次改动本目录资产，必须同步更新本文件与对应工程 `assets/icons/SOURCE.md`；
- 运行时 UI 图标仍通过生态正式 `ChipsIcon + IconDescriptor` 链路渲染。

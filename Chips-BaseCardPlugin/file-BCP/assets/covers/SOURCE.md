# 文件基础卡片默认封面来源说明

- 适用目录：`assets/covers/`
- 设计基线：生态统一苹果风格（背景 `#f5f5f7`、描边 `rgba(0,0,0,0.08)`、类别强调色取自苹果系统色板）。
- 设计方式：按文件类别手工绘制的矢量默认封面，几何图形风格在全部封面之间保持一致。
- 生成脚本：无（本目录为手工设计源，直接在工程内维护）。

## 资产角色

- 本目录保存文件基础卡片的“文件类型默认封面”；
- 查看态按文件后缀解析类别后消费对应封面；后缀未登记任何类别时，回退为带后缀文字的文件图标占位；
- 封面属于插件静态资源，通过 `new URL(..., import.meta.url)` 打包引用，不进入 manifest、不属于系统入口图标链路；
- 运行时图标描述符以 `src/index.ts -> basecardDefinition.icon` 为准。

## 当前正式命名基线

| 文件名 | 文件类别 | 强调色 |
| --- | --- | --- |
| `file-cover-document.svg` | document（文档） | `#0a84ff` |
| `file-cover-spreadsheet.svg` | spreadsheet（表格） | `#30d158` |
| `file-cover-presentation.svg` | presentation（演示文稿） | `#ff9f0a` |
| `file-cover-archive.svg` | archive（压缩包 / 磁盘镜像） | `#ac8e68` |
| `file-cover-audio.svg` | audio（音频） | `#ff375f` |
| `file-cover-video.svg` | video（视频） | `#bf5af2` |
| `file-cover-image.svg` | image（图像） | `#64d2ff` |
| `file-cover-text.svg` | text（纯文本 / Markdown） | `#8e8e93` |
| `file-cover-code.svg` | code（代码 / 配置） | `#5e5ce6` |

## 更新规则

- 调整封面视觉时直接更新对应 SVG，并保持 96x96 画布、20px 圆角与统一几何风格；
- 新增文件类别时，同步更新 `src/shared/file-types.ts`、`src/shared/default-covers.ts` 与本文件。

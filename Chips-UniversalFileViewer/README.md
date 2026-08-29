# Chips-UniversalFileViewer 万能文件查看器

薯片生态的通用文件预览应用插件（`type: app`）。定位是**专用查看器之外的兜底查看入口**：薯片图片查看器、视频播放器、书籍阅读器、音乐播放器等专用查看器优先接管各自格式；当 Host 打开某文件时没有已安装的专用查看器，则由本插件兜底预览。

## 能力总览

预览引擎基于开源项目 [open-file-viewer](https://github.com/xushanpei/open-file-viewer) core 包二次开发移植（MIT License，版权与许可声明见 `src/viewer-engine/LICENSE.open-file-viewer`），覆盖：

- 图片：jpg / png / gif / webp / avif / svg / bmp / tiff / heic 等
- 音视频：mp4 / webm / mov / mkv / mp3 / wav / flac / hls 等
- 文本代码：txt / md / json / yaml / csv / 100 余种代码语言（Prism 高亮）
- PDF / EPUB / XPS / OFD
- Office：docx / xlsx / pptx / doc / xls / ppt / odt / ods / odp / rtf 等
- 压缩包：zip / rar / 7z / tar / gz / bz2 / xz
- 邮件：eml / msg / mbox
- 绘图白板：drawio / excalidraw / tldraw / xmind
- CAD（DXF）/ 3D 模型 / GIS / 设计资产（PSD、字体、SQLite、Parquet 等）

重依赖（xlsx、three、mermaid、pptx-renderer 等）均通过动态 import 懒加载，首屏体积不受影响。DWG 二进制格式因上游可选依赖为 GPL-3.0 未启用，按兜底卡片提示处理。

## 生态接入

- **能力声明**：manifest `capabilities` 以 `@fallback` 兜底层级声明 `resource-handler:view:<mime>@fallback` 与 `file-handler:<ext>@fallback`；Host 处理器解析保证专用查看器（primary 层级）永远优先于兜底声明。
- **启动恢复**：`launchParams.resourceOpen`（`filePath ?? targetPath ?? resourceId`）为正式入口；兼容消费 `chips.book-card` 图片序列 payload（图片队列兜底场景）。
- **资源装载**：音视频经 `resource.resolve` 取 URI 串流；本地路径走 `file.read` 字节；Host 托管资源走 `resource.readBinary`；http(s) 交由引擎按 URL 加载。
- **默认查看器治理**：文件类型与处理器的映射关系由 Host `fileOpen.defaults` 配置与 `plugin.listHandlers` 接口统一治理，设置入口见生态设置面板「文件打开方式」。

## 工程命令

```bash
npm run dev        # 开发调试（chipsdev-r server）
npm run verify     # lint + typecheck + test + build + validate + preview:smoke + quality:gate
npm run build      # 构建产物到 dist/
chipsdev-r package # 打包生成 .cpk
```

## 目录结构

```
src/
├─ app/                  # AppRoot / AppRuntimeProvider（启动编排）/ AppShell / scene-registry
├─ commands/             # 命令定义与应用内命令注册
├─ components/           # UniversalViewerStage 舞台
├─ views/                # EngineViewer（引擎桥接）/ ViewerToolbar（antd 工具栏）
├─ runtime/              # chips 客户端与启动上下文读取
├─ utils/                # 启动目标归一 / 资源装载 / 引擎插件装配
├─ viewer-engine/        # open-file-viewer core 移植（二次开发层）
├─ lib/messages.ts       # 简体中文文案表
└─ testing/              # 测试渲染辅助与 Host mock
```

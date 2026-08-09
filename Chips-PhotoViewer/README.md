# 图片查看器

> 插件 ID：`com.chips.photo-viewer`

## 1. 项目定位

`Chips-PhotoViewer` 是薯片生态内的标准 `type: app` 应用插件，首版只负责：

1. 查看图片；
2. 缩放图片；
3. 保存图片副本。

## 2. 当前正式能力

- 通过 `launchParams.resourceOpen` 或 `launchParams.targetPath` 打开图片；
- 在应用内手动选择图片文件；
- 接收 Host 文件关联分发的图片文件；
- 放大、缩小、适应窗口、实际大小；
- 保存图片副本；
- 接入主题系统与多语言系统。

支持格式：

- `.png`
- `.jpg`
- `.jpeg`
- `.webp`
- `.gif`
- `.bmp`
- `.svg`
- `.avif`

## 3. Host 接入结论

- Host 正式资源打开链路会优先通过 `launchParams.resourceOpen` 把图片资源交给图片查看器；
- 当 Host 还能解析出本地文件路径时，会继续补充 `launchParams.targetPath`；
- Host 现在会通过通用 `file-handler:<ext>` 链路把图片文件路由到图片查看器；
- macOS 安装器会根据内置 app 插件 manifest 的 `file-handler:<ext>` 能力条件注册图片文件关联；
- 如果 Host 发行包没有携带 `Chips-PhotoViewer`，安装器不会注册这些图片类型，因此 Host 不会接住这些图片文件。

## 4. 项目文档

- `需求文档/01-图片查看器需求文档.md`
- `技术文档/01-图片查看器技术文档.md`
- `开发计划/01-图片查看器开发计划.md`

## 5. 快速开始

```bash
cd /Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f/Chips-PhotoViewer
npm run run
```

如果需要直接使用命令行，也可以：

```bash
cd /Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f/Chips-PhotoViewer
chipsdev-r run
```

说明：

- `chipsdev-r` 由生态根工作区提供，不需要全局安装；
- `Chips-PhotoViewer/package.json` 已通过 `volta.extends` 继承生态根工具链配置，支持在当前子工程目录直接执行 `chipsdev-r`。

开发服务器模式：

```bash
cd /Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f/Chips-PhotoViewer
npm run dev
```

## 6. 正式脚本

- `npm run run`
- `npm run lint`
- `npm test`
- `npm run build`
- `npm run validate`

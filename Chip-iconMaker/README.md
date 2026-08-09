# 图标工坊

图标工坊是薯片生态 `type: app` 应用插件，用于从图片或图标字体生成 PNG、ICO 与 ICNS 图标资源包。应用运行在 Host 托管 surface 中，内容区直接呈现左侧参数控制、右侧固定实时预览的工作台结构，最外层只使用主题背景色，组件区使用主题 surface 背景，不额外叠加结构描边、应用标题、命令状态或语言切换壳层。

## 功能

- 图片来源：支持 SVG、PNG、JPG、WebP、GIF 拖拽或点击导入，提供缩略图预览和清除操作。
- 字体来源：内置薯片生态 Material Symbols 完整 codepoints 字体资产与系统 Emoji 图标源，高级设置中支持上传自定义 TTF、OTF、WOFF、WOFF2 图标字体。
- 视觉设置：字体模式支持 6 个常用渐变背景、纯黑、纯白和常用前景色块；图片模式不显示背景选择。
- 高级设置：默认折叠，保留上次参数；支持 PNG、ICO、ICNS 多选输出、固定档位输出尺寸、图片适应/填充模式。
- 生成下载：根据当前参数在前端 Canvas 中合成图标，生成所选格式并使用 ZIP Store 打包为 `icons.zip` 下载。

## 架构

- 运行时：Host 托管 surface 应用，入口为 `dist/index.html`。
- 前端：React + antd（`appleTheme`，`@chips/ui` 共享层提供苹果风格主题与运行时），界面文案使用简体中文直写；纯结构容器使用原生 HTML，真实控件使用 antd。
- 系统能力：命令注册与调用等均通过 Chips SDK / Host Bridge 正式链路。
- 图标生成：浏览器安全的 Canvas 渲染、ICO/ICNS 二进制编码与 ZIP Store 打包，不依赖 Python、Swift、Electron、Node 文件系统或 macOS 命令行工具。
- 字体资产：`assets/fonts/material-symbols/` 保存 Material Symbols 三套 variable font 的 WOFF2 产物、完整 codepoints 与来源追溯。

## 脚本

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run validate
```

## 迁移说明

原开源项目同时包含 Python GUI/CLI 与 Swift AppKit 实现，依赖 Pillow、cairosvg、iconutil、sips 与本地文件系统。迁移后只保留产品能力与图像生成算法意图，运行时重构为薯片应用插件的 React 工作台，避免在应用插件中引入并行运行时或平台私有调用。

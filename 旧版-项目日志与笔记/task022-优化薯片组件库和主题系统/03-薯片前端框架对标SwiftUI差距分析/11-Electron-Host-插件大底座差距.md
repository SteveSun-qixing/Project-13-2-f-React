# 差距分析：Electron / Host / 插件大底座

## 1. 重新调查依据

本章节重新核对了以下资料后编写：

- `生态设计原稿/02-极致模块化架构.md`
- `生态共用技术文档/架构设计/03-插件架构设计.md`
- `生态共用技术文档/架构设计/13-Bridge三层设计.md`
- `生态共用技术文档/架构设计/14-Host服务域设计.md`
- `生态共用技术文档/协议与接口标准/02-Bridge-API规范.md`
- `生态共用技术文档/插件开发/06-Manifest配置规范.md`
- `生态共用技术文档/插件开发/08-SDK使用指南.md`
- `Chips-Host/技术文档/01-薯片主机总体架构设计.md`
- `Chips-Host/技术文档/08-Electron宿主化与IPC通道打通.md`
- `Chips-Host/技术文档/11-L8声明式UI实现说明.md`
- `Chips-Host/技术文档/12-L9统一渲染层实现说明.md`

## 2. 当前底座真实口径

当前薯片底座不是“前端组件库 + Electron 窗口”，而是：

- Host 主责 L1-L9 运行时链路。
- 插件运行时由 Host 统一托管。
- 插件访问系统能力只能走 Host 正式链路。
- `window.chips.*` 是公共接口形状，不是 Electron 私有特性。
- `surface` 是新的跨平台界面容器主语义。
- `window` 只是 Desktop 下 `surface(kind=window)` 的兼容别名。
- 当前 Host 已注册 19 个服务域：file、resource、config、theme、i18n、surface、transfer、association、window、plugin、module、platform、log、credential、card、box、zip、serializer、control-plane。
- L8 声明式 UI 在 Host 内部已有实现说明，覆盖 `View/Stack/Grid/Form/List`、声明树、组合模式、事件与副作用。
- L9 统一渲染层在 Host 内部已有实现说明，覆盖 Normalize、Validate、Theme Resolve、Layout Compute、Render Commit、Effect Dispatch。

## 3. 与 SwiftUI 对标时的关键差距

### 3.1 Host 大底座已有，但前端框架产品化不足

Host 侧已经有很多底座能力，但应用开发者还不能像 SwiftUI 那样自然地通过一个统一前端框架消费它们。

表现：

- L8/L9 已有 Host 内部实现，但还没有成为所有应用脚手架默认开发体验。
- surface、plugin session、theme preload、Bridge、Runtime Client、UI Hooks 与组件库之间还缺完整上层 API。
- App/Scene/Document/Command 仍需要进一步产品化。

### 3.2 `surface` 语义没有充分进入前端框架文档

很多文档或方案容易写成 `Window = BrowserWindow`。但当前正式口径是：

- `surface.open(target=plugin)` 是主链路。
- Desktop 当前落为 `window`。
- Web/Mobile/Headless 已预留 surface 映射。

如果前端框架继续以 window 为中心设计，会偏离生态长期架构。

### 3.3 常用模块沉淀在 Host，但 UI 消费层还不够统一

Host 已有 file/resource/config/theme/i18n/card/box/plugin/module 等服务域，但前端框架还需要统一消费方式：

- `useChipsResource`
- `useChipsConfig`
- `useChipsTheme`
- `useChipsI18n`
- `useChipsCard`
- `useChipsBox`
- `useChipsPlugin`
- `useChipsSurface`

否则开发者会散落调用 SDK 或 `window.chips.invoke(...)`。

### 3.4 插件结构与组件库扩展的关系需要更清晰

组件库不能承担 Host 服务职责。比如：

- 文件选择、资源打开、外部链接、窗口打开不应由组件直接访问 Electron。
- ResourcePicker、DocumentScene、PluginCard 等组件需要通过注入的 Runtime Client/SDK 能力消费 Host 服务。
- 组件库只输出无头结构、状态和 a11y；系统能力由 Host 大底座提供。

## 4. 差距等级

严重等级：高。

原因：如果不把 Electron + Host + 插件大底座写清楚，后续前端框架可能退化成普通 React 组件库，无法支撑生态级软件平台。

## 5. 后续判断

后续重构方案必须新增一条主线：

> 所有通用系统能力优先沉淀在 Host 服务域；前端框架只提供声明式消费入口；插件通过 Bridge/Runtime Client/SDK 使用能力；Desktop 通过 Electron surface 落地。


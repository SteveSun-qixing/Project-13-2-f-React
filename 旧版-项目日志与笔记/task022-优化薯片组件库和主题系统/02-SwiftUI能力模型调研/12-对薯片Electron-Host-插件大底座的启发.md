# SwiftUI 调研补充：对薯片 Electron / Host / 插件大底座的启发

## 1. 为什么必须单独补充这一章

SwiftUI 的底层是 Apple 平台系统框架，而薯片的底层是 Electron + Host + 插件结构。两者对标时不能只比较控件名称，也不能把薯片前端框架误写成一个普通 Web UI 库。

薯片真正要构建的是“大底座”：

- Host 承载常用系统模块和运行时能力。
- 插件只声明能力、界面和权限。
- 应用前端通过 Bridge / Runtime Client / SDK 使用 Host 能力。
- Electron BrowserWindow 只是 Desktop 的当前 surface 落地形态，不是公共架构唯一形态。

## 2. SwiftUI 与薯片底座的对应关系

| SwiftUI 所依赖的平台能力 | 薯片对应底座能力 |
|---|---|
| 系统管理 App/Scene 生命周期 | Host plugin runtime + surface service |
| 系统窗口与文档模型 | Host surface/window/document/card/box 服务 |
| 系统菜单、命令、工具栏 | Host command/surface/platform/shortcut 相关能力 |
| 系统样式和平台控件 | L10 无头组件 + L11 主题运行时 |
| 系统本地化环境 | Host i18n service + ChipsEnvironment |
| 系统存储与文档 | Host file/resource/card/box/config 服务 |
| 系统辅助功能 | 组件 a11y contract + 浏览器/平台辅助能力 |
| Instruments 和 Xcode Preview | chips preview / quality gate / perf audit |

## 3. 薯片不能照搬 SwiftUI 的地方

1. SwiftUI 的 `WindowGroup` 直接映射系统窗口；薯片应优先映射为 `surface`，Desktop 下才落为 Electron BrowserWindow。
2. SwiftUI 的文档模型依赖 Apple document infrastructure；薯片的 Document 应同时覆盖 `.card`、`.box`、资源文件、主题包和插件包，并通过 Host 服务处理。
3. SwiftUI 控件样式来自系统；薯片控件视觉必须来自主题包 token 和 contract。
4. SwiftUI App 运行在 Apple runtime；薯片 app 运行在 Host 插件会话中，必须受权限、Bridge、工作区和插件生命周期约束。
5. SwiftUI 可以直接使用系统 API；薯片插件绝不能直接使用 Node/Electron 原生能力，只能走 `window.chips.*` 或 SDK。

## 4. 对薯片框架设计的核心启发

薯片前端框架需要把 SwiftUI 的“系统接管复杂性”转译为“Host 大底座接管复杂性”：

- App/Scene 由 Host 插件运行时管理。
- Window 由 `surface` 语义管理，Desktop 才落为 BrowserWindow。
- Document 由 Host `card/box/resource/file` 等服务管理。
- View/Modifier 由 Host 内置 L8/L9 与组件库共同承载。
- Theme/i18n/environment 由 Host preload 和 provider 注入。
- Commands/menus/toolbars/shortcuts 由 Host service + 前端命令 registry 统一。
- Preview/perf/a11y 由 chipsdev、Host mock 和真实 chipsdev 工作区共同支持。

## 5. 调研结论

薯片对标 SwiftUI 的正确表达应是：

> 用 Electron + Host + 插件系统构建一套类似 SwiftUI 简洁度的开发框架，而不是复制 Apple UI，也不是只扩展 React 组件库。

这意味着后续所有对标文档都必须明确 Host 大底座边界：常用能力应沉淀在 Host 服务和生态公共协议中，插件只通过正式链路消费，组件库只负责无头 UI 能力，主题系统只负责视觉表达。


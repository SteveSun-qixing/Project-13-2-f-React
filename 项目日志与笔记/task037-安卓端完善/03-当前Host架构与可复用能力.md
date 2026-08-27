# 当前 Host 架构与可复用能力

## 1. 当前正式运行形态

正式共用文档和代码一致：当前只交付 Desktop Host Shell 与 Headless Host Shell。

桌面链路：

`Electron app-entry -> DesktopHostShell -> DesktopPalAdapter -> HostCore -> Kernel/Services/PluginRuntime -> Electron IPC/preload -> window.chips.*`

无头链路：

`Node process -> HeadlessHostShell -> HeadlessPalAdapter -> HostCore -> Kernel/Services/PluginRuntime`

`HostApplication` 目前只是 `DesktopHostShell` 的别名，因此不存在自动选择移动宿主的总入口。

## 2. 已经为移动端预留的公共设计

这些资产有复用价值：

- `HostKind` 已包含 `mobile`；
- `PalPlatformId` 已包含 `android/ios`；
- Surface 已有 `route/modal/sheet/fullscreen`；
- 插件 manifest 固定声明 `desktop/web/mobile/headless`；
- App manifest 可为 mobile 指定 `fullscreen`；
- 插件启动会根据当前 `hostKind` 检查 `runtime.targets`；
- Kernel 的中心路由、事件、权限上下文、配额模型不是 Electron 专有语义；
- SDK 通过 `BridgeAdapter` 隔离上层 API 与底层 transport；
- React 应用插件以 HTML/JS/CSS 交付，适合 WebView surface；
- `.card/.box/.cpk` 都是可移植数据格式，不依赖 Android 数据库。

## 3. 可直接保留的部分

原则上可跨端复用，但仍需去除 Node 类型污染并补跨端测试：

- Kernel router、registry、event bus、lifecycle；
- 标准错误、路由描述符、schema 和权限模型；
- 插件 manifest 解析的纯数据规则；
- Runtime Client 和 SDK 的大部分类型化 API；
- Declarative UI 与 Unified Rendering 中不触碰 Node API的纯计算部分；
- 卡片/箱子的纯结构校验、YAML/JSON 数据模型；
- 主题 token 解析与 i18n 纯逻辑；
- Surface、launchContext 和命令上下文公共模型。

## 4. 需要通过 port 重构后复用的部分

| 模块 | 当前问题 | 目标 |
|---|---|---|
| HostCore 日志 | 直接 `fs/path` | 注入 LogStore/Storage port |
| Card/Box/Zip | 直接 Node 文件系统、路径、临时目录、crypto | 以 Storage/Archive/Crypto port 驱动 |
| PluginRuntime | 扫描本地目录、复制/替换目录 | 注入 PluginStore 与事务安装器 |
| ModuleRuntime | Node `require/import(file://)` | 独立可移植执行器契约 |
| Render protocol | Electron protocol/net | Android WebView resource resolver |
| Surface | BrowserWindow | Android Activity/Fragment/WebView surface manager |
| Bridge | Electron IPC/contextBridge | Android message port transport |
| Installer | macOS payload | Gradle、APK/AAB 与 Android 首次启动引导 |

## 5. 当前分层不完全符合设计原稿

设计原稿要求平台差异收敛到 PAL，但当前 Host Services 仍存在大量 Node 直连。最典型证据：

- `HostCore` 直接使用 `fs/path/process.cwd()`；
- card、box、zip、packer 服务直接导入 Node 文件系统和路径模块；
- module runtime 直接读取 schema、解析文件路径并动态 import；
-服务注册文件仍直接创建 Electron BrowserWindow 做离屏渲染；
- Bridge API transport 引入 Node `EventEmitter`。

所以 Android 工作不是新增一个 adapter 后全部自动运行。必须先把真正的平台边界补完整。

## 6. 对“插件完全解耦”的准确解释

插件解耦意味着插件不应直接依赖 Host 内部实现，系统能力经 Bridge/SDK 调用。这对 Android 非常有利，但只解决调用边界，不解决运行载体。

插件仍需要 Host 提供：

- 安装和可信校验；
- HTML/模块入口加载；
- surface 和 session；
- Bridge transport；
- 文件、网络、资源、主题、多语言等服务；
- 进程死亡后的恢复；
- Android 平台的权限和 URI 映射。

结论：插件解耦减少了插件改造量，但不能替代 Mobile Host 的开发。

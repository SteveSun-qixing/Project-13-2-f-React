# Android 平台官方技术调研

## 1. Electron 不能作为 Android 交付方案

Electron 官方说明的跨平台目标是 Windows、macOS、Linux。现有 Host 以 Electron `app-entry`、BrowserWindow、ipcMain/ipcRenderer 和 contextBridge 为核心，因此不能将当前包直接打成 Android APK。

官方参考：[Electron Introduction](https://www.electronjs.org/docs/latest/)

结论：Android 需要新的 Host Shell。可以复用 Web 插件和部分 TypeScript Core，但不能复用 Electron 壳。

## 2. 可以承接 Electron/Web 项目的移动框架

用户记忆中的框架方向是存在的，最接近的是 Capacitor；Tauri 2 也已正式支持 Android/iOS，Node.js Mobile 则解决移动应用内嵌 Node runtime 的问题。它们解决的层级不同。

### 2.1 Capacitor

Capacitor 可以加入现有现代 Web 项目，使用 Android WebView 承载 HTML/CSS/JavaScript，并通过 Kotlin/Java 插件访问原生能力。社区还有反向的 Electron platform，用同一 Capacitor Web 应用生成桌面 Electron 壳。

官方参考：

- [Capacitor Documentation](https://capacitorjs.com/docs)
- [Capacitor Community Electron Platform](https://capacitor-community.github.io/electron/)

对 Chips 的价值：

- React 应用插件和 Web surface 可直接沿用；
- Android 工程、WebView 生命周期、原生插件和构建链路有现成基础；
- 可以把 `window.chips.*` 实现成一个大型但分层的 Capacitor 原生插件/自定义 transport。

限制：Capacitor 不提供 Electron 主进程、Node.js、BrowserWindow、ipcMain、任意本地文件系统或当前模块插件 runtime。只使用 Capacitor，仍必须迁移 Host Core/Services 或另外嵌入 Node runtime。

### 2.2 Tauri 2

Tauri 2 正式支持 Android/iOS，Web 前端运行在系统 WebView，核心逻辑可以放在 Rust，移动平台插件使用 Kotlin/Java 和 Swift。Tauri 已有 capability/permission、command/event 和移动插件模型。

官方参考：

- [Tauri Mobile Prerequisites](https://v2.tauri.app/start/prerequisites/)
- [Tauri Mobile Plugin Development](https://v2.tauri.app/develop/plugins/develop-mobile/)

对 Chips 的价值：

- Shell、WebView、命令、权限和 Rust 后端比完全手写 Android 容器更成熟；
- Rust 适合实现 archive/crypto/storage/plugin verifier 等底层能力；
- 有机会让桌面和移动未来逐步统一到 Tauri runtime。

限制：现有 Host 后端是 TypeScript/Node，不是 Rust。采用 Tauri 2 意味着重写或迁移较多 Host Core/Services；Tauri plugin/capability 也不能直接替代 Chips Kernel/Bridge，必须由 Chips 语义包在外层，避免形成第二套公开 API。

### 2.3 Node.js Mobile

Node.js Mobile 提供 Android/iOS 可嵌入的 Node runtime，在后台线程运行，并要求 UI WebView 通过通信机制与 Node 交互。当前项目仓库仍在维护，发布页提供基于 Node 18.20.4 的 Android arm64-v8a 等构建。

官方参考：

- [Node.js Mobile repository](https://github.com/nodejs-mobile/nodejs-mobile)
- [Node.js Mobile FAQ](https://code.janeasystems.com/nodejs-mobile/faq)
- [Node.js API differences](https://code.janeasystems.com/nodejs-mobile/nodejs-apis-differences)

对 Chips 的价值：

- 最有机会复用 Kernel、服务注册、插件 runtime 和 TypeScript/Node 业务逻辑；
- UI WebView 与后台 Node 的双 runtime 模型和现有 Electron renderer/main 模型相近；
- `fs/path/crypto/ESM` 的迁移量可能显著低于 Rust/Kotlin 重写。

限制：并非所有 Node API 可用。`child_process/cluster` 不支持，`process.cwd()` 在 Android 可能是 `/`，文件系统只能使用应用沙箱，调试器、Intl、原生模块和多实例均有约束。当前 Chips 的子进程、桌面命令、Electron BrowserWindow、文件关联和 offscreen render 仍需 Android PAL；Node 18 基线也低于本仓 Node 22，需要实际兼容性和安全维护评估。

### 2.4 对 Chips 的候选结论

| 方案 | Web 插件复用 | Node Host 复用 | 原生能力 | 主要代价 |
|---|---|---|---|---|
| Capacitor | 高 | 低 | Kotlin/Java plugin | Host 后端另行迁移 |
| Tauri 2 | 高 | 低 | Rust + Kotlin | Host 后端迁移到 Rust/ports |
| Node.js Mobile + 原生 WebView | 高 | 较高 | 自建 Android binding | Shell/Bridge 工程量较大 |
| Capacitor + Node.js Mobile | 高 | 较高 | Capacitor + Node bridge | 双 runtime、集成与维护复杂 |
| Tauri 2 + Node sidecar/runtime | 高 | 中 | Rust/Kotlin + Node | 三层 runtime，复杂度最高 |

如果目标是“尽快迁移现有 TypeScript/Node Host”，可以把 **Capacitor + Node.js Mobile** 作为兼容性技术验证；这只是迁移成本最优化，不是全生态长期架构结论。

在“不考虑历史遗留、不考虑工程量”的前提下，长期首选应为 **React/TypeScript Web 插件运行时 + Rust 可移植 Host Core + Tauri 2 Shell + Android Kotlin PAL / iOS Swift PAL**。详细论证见 `17-全生态长期技术栈选型与Flutter全链路评估.md`。

## 3. WebView 本地内容加载

Android 官方推荐使用 `WebViewAssetLoader` 以 HTTPS-like URL 加载应用内或内部存储内容。`file://` 与 `data:` 是不透明 origin，限制 fetch/XHR，并容易诱导开发者打开危险的跨文件访问设置。

官方参考：

- [Load in-app content](https://developer.android.com/develop/ui/views/layout/webapps/load-local-content)
- [WebViewAssetLoader API](https://developer.android.com/reference/androidx/webkit/WebViewAssetLoader.html)
- [WebSettings API](https://developer.android.com/reference/android/webkit/WebSettings)

对 Chips 的含义：

- 不应把插件 `dist/index.html` 直接以 `file://` 加载；
- 需要 Host 私有的安全 origin 和路径处理器；
- 插件入口、主题 CSS、图标字体、卡片资源和 `chips-render` 文档应经过同一资源治理层；
- `allowFileAccessFromFileURLs` 与 `allowUniversalAccessFromFileURLs` 必须保持关闭。

## 4. JavaScript Bridge 安全

Android 官方明确警告：`addJavascriptInterface()` 允许 JavaScript 控制宿主应用；加载不可信 HTML 时会形成严重风险。Google Play 的 Device and Network Abuse 政策也将“向加载不可信内容的 WebView 注入 JavaScript interface”列为常见违规风险。

官方参考：

- [Build web apps in WebView](https://developer.android.com/develop/ui/views/layout/webapps/webview)
- [WebView API](https://developer.android.com/reference/android/webkit/WebView)
- [Google Play Device and Network Abuse](https://support.google.com/googleplay/android-developer/answer/16559646)

对 Chips 的含义：

- Bridge 不能是一个给任意 frame 的全能原生对象；
- Bridge 必须只对 Host 安装并验证的插件 origin 建立；
- 远程网页卡片必须与高权限插件 surface 分离；
- 每条消息必须在原生侧重建 caller context，不能信任 JS 自报 pluginId/permissions；
- 应优先评估 `WebMessagePort` / AndroidX WebKit 的受控消息监听方案，而不是暴露大量原生方法。

## 5. Android 文件模型

Android 的共享文档访问使用 Storage Access Framework。用户通过系统 picker 选择文档或目录，应用获得的是 URI 和授权，不是任意可长期读写的 POSIX 绝对路径。应用自己的插件、缓存和数据库应放在 app-specific/internal storage。

官方参考：

- [Storage Access Framework](https://developer.android.com/guide/topics/providers/document-provider)
- [Access documents and other files](https://developer.android.com/training/data-storage/shared/documents-files)
- [Access app-specific files](https://developer.android.com/training/data-storage/app-specific)
- [Android storage use cases](https://developer.android.com/training/data-storage/use-cases)

对 Chips 的含义：

- `.card/.box/.cpk` 外部文件入口要以 document handle/URI 为主；
- Host 可以导入到内部受控 workspace 后再用内部路径处理；
- “原位编辑”必须持有可持久化 URI 权限，并处理 provider 不支持随机访问/重命名/原子替换的情况；
- 保存导出需要 `ACTION_CREATE_DOCUMENT`；
- 导入需要 `ACTION_OPEN_DOCUMENT`；
- 选择 workspace 可评估 `ACTION_OPEN_DOCUMENT_TREE`，但必须接受 Android 11+ 对根目录授权的限制。

## 6. 生命周期与后台执行

Android 应用不能像桌面 Electron 一样假设长期后台运行。系统会依据 Activity/Service 状态和内存压力终止进程，`onDestroy()` 也不保证被调用。

官方参考：

- [Activity lifecycle](https://developer.android.com/guide/components/activities/activity-lifecycle)
- [Processes and app lifecycle](https://developer.android.com/guide/components/activities/process-lifecycle)

对 Chips 的含义：

- Host 必须把“可恢复”作为基础能力，而不是把进程常驻作为正确性前提；
- 文档 dirty state、插件 session、surface back stack、任务进度需落盘或可重建；
- 长任务必须映射到符合政策的 WorkManager、foreground service 或 user-initiated data transfer job；
- 后台上传/转换不能靠 JS 定时器或 Activity 内线程保活；
- 桌面 `tray/background/power.preventSleep` 语义不能原样复制。

## 7. 动态插件与 Google Play

Google Play 禁止从 Play 之外下载 dex/JAR/.so 等可执行代码；JavaScript 在 WebView/解释器中的运行不被一刀切禁止，但运行时加载的解释型代码不得导致政策违规。平台还对提供第三方软件体验的应用进行额外内容和安全审查。

官方参考：

- [Device and Network Abuse](https://support.google.com/googleplay/android-developer/answer/16559646)
- [Developer Program Policy](https://support.google.com/googleplay/android-developer/answer/17190352)

对 Chips 的含义：

- Android 插件包必须限定为 Web 资产或受控解释型模块，禁止插件携带 dex/JAR/.so；
- 插件不得获得直接 Android API 访问，只能走权限化 Bridge；
- 必须实现来源、签名、哈希、审核、撤销和内容政策机制；
- 本地开发侧载与 Play 生产分发应是两个明确模式；
- 当前“非 local 只要求 signature 字符串存在”远不足以支撑生产信任链。

## 8. 调研结论

Android 不是桌面 API 的另一组名称，而是不同的进程、存储、surface、安全和分发模型。最稳健的做法是保持 Chips 公共语义不变，在 PAL、Shell、Bridge transport 和资源解析层建立 Android 正式实现；对于无法等价的桌面能力，公开、可测试地声明 unsupported 或采用 manifest fallback。

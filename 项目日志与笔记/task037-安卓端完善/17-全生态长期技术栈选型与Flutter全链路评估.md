# 全生态长期技术栈选型与 Flutter 全链路评估

## 1. 评估问题

本章不再只回答“Android 怎么包装现有 Electron Host”，而是回答：

> 如果不考虑现有代码、历史兼容和改造工程量，只从未来 5–10 年的生态目标出发，哪套技术栈最适合 Chips Host、五类插件、卡片文档、编辑引擎、社区与多端交付？

评估范围包含：

- Desktop：Windows、macOS、Linux；
- Mobile：Android、iOS；
- Web：浏览器中的卡片阅读、社区与受限 Host；
- Headless：社区服务、转换、CI 和批处理；
- 五类插件：`app` / `card` / `layout` / `module` / `theme`；
- 卡片全链路：创建、编辑、组合、保存、打包、分发、打开、渲染、交互、导出、分享和恢复。

## 2. 先从生态不变量出发

当前设计原稿、共用契约和代码反复表明，Chips 不是一个普通的跨端 App，而是一个可安装内容与能力的 Host 平台。选型必须优先服务以下不变量：

1. Host 是唯一运行时承载，不把每个插件变成独立应用。
2. 第三方插件只能调用 `window.chips.*` / Bridge / SDK，不直接获得操作系统对象。
3. 服务间调用经过 Kernel 中心路由，PAL 吸收平台差异。
4. 卡片、箱子、插件是可分发的长期文档与软件资产，不应绑定单一 OS UI 框架。
5. 官方前端统一 React，卡片和布局依赖 DOM、CSS、HTML、iframe、受控 URL 与 Web 媒体能力。
6. 插件要能独立构建、签名、安装、禁用、撤销和热更新，不能每增加一张卡片就重新发布 Host。
7. Desktop、Mobile、Web 和 Headless 不必能力完全相同，但必须共用同一公共语义、能力快照和不支持错误模型。

因此，不能用“哪个框架画 UI 最漂亮”作为主选型标准。真正的问题是：哪个组合最适合承载可移植内核、Web 插件容器、原生 PAL 和可审计 Bridge。

## 3. 最终推荐技术栈

### 3.1 一句话结论

**最适合 Chips 全生态的长期技术栈是：React + TypeScript 的 Web 插件协议，Rust 实现可移植 Host Core，Desktop 保留 Electron 薄 Shell，Mobile 使用 Tauri 2 Shell，Android 使用 Kotlin PAL，iOS 使用 Swift PAL，Headless 直接运行 Rust Core。**

这个结论**不以保留现有 React/Electron/Node 代码为前提**。即使允许所有 Host、SDK、官方应用、卡片插件和工具链从零重写，Flutter 仍然不是首选。原因不是迁移成本，而是 Flutter 的优势中心是“编译期确定的跨端 UI 应用”，Chips 的优势中心则是“运行时安装、隔离、组合和分发第三方内容/能力”。

这不是“所有代码都写 Rust”，而是四层语言职责分工：

| 层级 | 首选技术 | 职责 |
|---|---|---|
| 插件界面与卡片内容 | React + TypeScript + HTML/CSS | app/card/layout 插件、编辑器、卡片渲染、社区 Web |
| 公共客户端契约 | TypeScript | `chips-sdk`、Bridge 类型、manifest 工具、测试辅助 |
| 跨端 Host Core | Rust | Kernel、服务路由、插件治理、存储、归档、加密、任务与审计 |
| Desktop Shell | Electron | 固定 Chromium、多窗口、媒体、离屏渲染、调试与分发 |
| Mobile Shell | Tauri 2 | Android/iOS WebView、Rust 集成、移动生命周期与打包 |
| Android 平台层 | Kotlin + Android Jetpack | Activity、SAF、Intent、WorkManager、Keystore、分享、通知 |
| iOS 平台层 | Swift | WKWebView、document picker、Keychain、background task、share |
| Headless / Server | Rust 二进制 | 无界面 Host、批处理、社区服务能力 |

### 3.2 目标架构

```text
                          Chips public contracts
                  manifest / Bridge / SDK / capability model
                                      |
       +------------------------------+------------------------------+
       |                              |                              |
 React/TS plugin runtime       Rust portable Host Core         Native PALs
 app/card/layout/theme         Kernel + services + policy      Kotlin / Swift
 Web DOM/CSS/iframe            storage/archive/crypto          OS lifecycle/API
       |                              |                              |
       +--------------- platform-selected Shell --------------------+
                                      |
                  Electron Chromium / Android WebView / WKWebView

 Headless: Rust Core without UI Shell
 Web: React/TS runtime + restricted Web PAL or remote Host connection
```

Tauri 官方架构本身就是 Rust + OS WebView + 消息传递，允许扩展 Rust 后端与 WebView 之间的 API；移动插件可在 Android 使用 Kotlin/Java，在 iOS 使用 Swift。这与 Chips 已定义的 Shell / PAL / Bridge / Kernel 分层在形状上最接近。

官方参考：

- [Tauri Architecture](https://v2.tauri.app/concept/architecture/)
- [Tauri Mobile Plugin Development](https://v2.tauri.app/develop/plugins/develop-mobile/)

Tauri 只是底层宿主工具，不应成为插件看得见的公共 API。对外仍只有 Chips Kernel route、`window.chips.*` 和 `chips-sdk`。

## 4. Flutter 能否实现卡片全链路

### 4.1 简短答案

**能实现，但分为两条完全不同的路：**

1. Flutter 做 Host 壳，卡片仍在 WebView 里运行 React/HTML：可以保留 Chips 卡片全链路，但 Flutter 只是壳，并没有替代 Web 卡片运行时。
2. 把卡片插件全部改为 Dart/Flutter Widget：可以从零做出类似的编辑和渲染功能，但会改变插件包、动态安装、主题、隔离、Web 运行和开发者生态，实际上是重建一套新的 Chips。

### 4.2 Flutter 作为壳时的全链路

Flutter 能承担：

- Host 导航、工具栏、窗口层和移动页面壳；
- 文件选择、分享、通知、相机等原生能力接入；
- 编辑引擎的画布、拖拽、缩放和原生交互；
- 用 `webview_flutter` 嵌入 Android WebView / iOS WKWebView；
- 通过 platform channel 调用 Kotlin/Swift 能力。

Flutter 官方的 WebView 插件是系统 WebView 的嵌入容器，Android 上为 WebView，iOS/macOS 上为 WKWebView。Flutter 的 platform channel 也能在 Dart 与 Kotlin/Swift 间传递消息。

官方参考：

- [Flutter WebView plugin](https://pub.dev/packages/webview_flutter)
- [Flutter architectural overview: platform channels](https://docs.flutter.dev/resources/architectural-overview)

用这种方式，卡片链路可以是：

```text
.card -> Host Core parse -> resolve card plugin -> create trusted WebView page
      -> load React card entry -> mount each base card -> Bridge/SDK
      -> edit config/resource -> Host transaction save -> package/export/share
```

但这会形成 `Flutter widget -> platform WebView -> React DOM -> iframe` 的嵌套。对单个阅读页可行，对包含大量独立基础卡片 iframe、透明背景、高度回报、拖拽命中、手势代理的编辑引擎，它会增加组合、输入、焦点、内存和调试成本。

### 4.3 Flutter Widget 不适合作为 Chips 卡片插件的正式格式

当前卡片契约的核心是动态 `.cpk` + `manifest.yaml` + ESM 入口 + DOM 容器挂载。这让同一个卡片插件能在 Desktop WebView、Mobile WebView 和浏览器运行。

如果改成 Flutter Widget，会出现以下根本冲突：

| Chips 需求 | Flutter Widget 模式的问题 |
|---|---|
| 第三方 `.cpk` 运行时安装 | Flutter Android release 使用 AOT；延迟组件也必须在整个 AAB 构建期编译和上传，不是任意第三方 Dart 插件商店 |
| 插件独立发布 | 新 Dart Widget 通常要与 Host 重新编译，无法等价现有 Web 资产插件 |
| 浏览器原生运行 | Flutter Web 是另一套渲染运行时，不是普通 DOM 卡片；与社区页面、HTML 导出和第三方嵌入集成更重 |
| iframe 隔离和 Web sandbox | Flutter Widget 树没有等价的浏览器 origin/CSP/iframe 边界，需要自建隔离、资源和消息模型 |
| CSS 主题包 | Flutter 主题是 Dart 对象体系，现有 token + CSS + `data-scope/part/state` 需要另外实现 |
| React 开发者生态 | 第三方开发者必须改用 Dart/Flutter，Web 组件、npm 与现有 SDK 无法直接消费 |
| HTML/PDF/图片导出 | 必须定义 Flutter scene 到文档输出的新通道；不再是直接消费卡片 HTML |

Flutter 的 Android deferred components 并不解决插件市场问题。官方明确说明：必须构建并上传整个 AAB，不支持不重新上传 AAB 的部分代码更新。

官方参考：[Flutter deferred components](https://docs.flutter.dev/perf/deferred-components)

### 4.4 Flutter 的准确结论

- **Flutter 能做一个完整的卡片应用。**
- **Flutter + WebView 能承载 Chips 卡片全链路。**
- **Flutter Widget 不适合成为 Chips 可动态安装、浏览器可运行的卡片插件标准。**
- **当卡片仍然在 WebView 运行时，Flutter 相比 Tauri 2 又多了 Dart/Flutter UI 层，却没有减少 Web 运行时。**

所以 Flutter 不是全生态主栈的最优解。它可用于一个与主 Host 契约分离的原生伴生应用，不应成为五类插件的基础运行时。

## 5. 全生态候选方案比较

| 方案 | 多端 Shell | Web 插件 | 动态插件 | Host Core 复用 | 原生能力 | Headless | 长期适配度 |
|---|---:|---:|---:|---:|---:|---:|---:|
| Electron thin Shell + Rust Core | Desktop 强，Mobile 另选 | 强 | 强 | Rust Core 统一 | Desktop 强 | 强 | **Desktop 最高** |
| Capacitor + TS | Mobile 强，Desktop 非核心 | 强 | Web 资产强 | 需自建 | Kotlin/Swift plugin | 弱 | 中 |
| Tauri 2 Mobile + Rust | Mobile 统一 | 强 | Web 资产强 | Rust Core 可统一 | Rust + Kotlin/Swift | 强 | **Mobile 最高** |
| Flutter + Dart | UI 统一 | 需额外 WebView | Dart 第三方热安装弱 | Dart Core 可跨端 | platform channel | Dart CLI 可做 | 中低 |
| Kotlin Multiplatform | Mobile/Desktop 可跨端 | 需额外 WebView | Web 资产可行 | Kotlin Core 可跨端 | Android 最强 | JVM/Native 可做 | 中高 |
| Node.js Mobile + WebView | Mobile 需自建 | 强 | JS 强 | 现有 Node 逻辑复用高 | 需自建 binding | Node 强 | 中低 |

### 5.1 Electron

Electron 是正式 Desktop Shell，但不承担 Mobile Shell，也不再定义 Host Core 的公共边界。对 Chips 而言，固定 Chromium、BrowserWindow/WebContents/session/protocol、离屏渲染、媒体和 DevTools 的价值，高于桌面强制与 Mobile 使用同一 Shell 所带来的表面统一。

但不应用过时理由选 Electron：官方只支持最新三个稳定大版，并以 8 周节奏升级；Electron 23 起已不支持 Windows 7/8/8.1。Electron 的优势是当代桌面 Web 运行时一致性和成熟能力，不是长期 LTS 或老系统兼容。

官方参考：[Electron Documentation](https://www.electronjs.org/docs/latest/)、[Electron Releases](https://www.electronjs.org/docs/latest/tutorial/electron-timelines)、[Windows 7/8/8.1 deprecation](https://www.electronjs.org/blog/windows-7-to-8-1-deprecation-notice)

### 5.2 Capacitor

Capacitor 是优秀的“Web App 进入手机”工具，也能用 Kotlin/Swift 插件扩展原生能力。但 Chips 的 Host 不只是一个 Web App，它还要长期承载 Kernel、文件事务、插件验证、无界面模块、任务、审计与 Headless。当这些都实现后，Capacitor 自身只剩容器价值，Host Core 仍要另行选择。

官方参考：[Capacitor Documentation](https://capacitorjs.com/docs)

### 5.3 Tauri 2

Tauri 2 的优势不是“包更小”这一个指标，而是其结构同时容纳：

- WebView 前端；
- 编译型 Rust 内核；
- Mobile Shell 与可选 Desktop Shell；
- command/event/capability/permission 机制；
- Kotlin/Swift 移动原生插件。

这与 Chips 的 Mobile 架构目标高度同构。但 Tauri capability 只是底层保护机制，不能替代 Chips 的 manifest 权限、Kernel 路由、Bridge caller context 和审计。Desktop 不强制迁移到 Tauri，避免为统一 Shell 牺牲 Chromium 一致性。

### 5.4 Node.js Mobile

Node.js Mobile 最大优势是复用 Node/TypeScript Host，最大问题是它会把未来内核锁在移动 Node fork 的 API、版本、原生模块交叉编译和线程通信上。`child_process/cluster` 等能力不可用，文件系统、`cwd`、调试与多实例也有差异。

它是“现有代码迁移器”，不是忽略历史后的最佳内核。

官方参考：

- [Node.js Mobile repository](https://github.com/nodejs-mobile/nodejs-mobile)
- [Node.js Mobile API differences](https://code.janeasystems.com/nodejs-mobile/nodejs-apis-differences)

### 5.5 Kotlin / Kotlin Multiplatform

Kotlin 是 Android PAL 的最佳选择，Kotlin Multiplatform 也已稳定支持 Android、iOS 和 Desktop 共享逻辑。但对 Chips 整个生态，它仍有两个问题：

1. 前端和插件仍是 Web，Compose Multiplatform 不能替代这层；
2. Desktop/Web/Headless 宿主与 Rust + Tauri 方案相比，需要组装更多自建容器与 WebView 边界。

因此 Kotlin 应是 Android 第一等平台实现，不必是整个 Host Core 的唯一语言。

官方参考：[Kotlin Multiplatform overview](https://kotlinlang.org/docs/multiplatform/kmp-overview.html)

## 6. 五类插件在新技术栈中的定位

### 6.1 app 插件

- 继续使用 React/TypeScript/HTML 入口；
- Desktop 可映射到 window/route/tab；
- Mobile 映射到 fullscreen/route/sheet/modal；
- 不允许感知 Tauri、Activity、WKWebView 或桌面窗口对象。

### 6.2 card 插件

- 仍以 ESM + DOM mount 为正式可移植格式；
- 每个基础卡片保持独立 Web 文档/隔离边界；
- Host 统一提供资源 URL、高度回报、主题、事件和生命周期；
- 这是 Flutter Widget 不应取代的关键层。

### 6.3 layout 插件

- 继续使用 Web 页面布局和 Host 箱子会话；
- 不直接读磁盘，不直接管理嵌套文档的绝对路径。

### 6.4 theme 插件

- 继续使用 token + CSS + 公开 part/state 契约；
- Shell 原生区域只消费经 Host 归一的少量语义 token，不反向要求插件提供 Flutter/Compose 主题。

### 6.5 module 插件

这是新架构需要重新定义的最关键部分。不应继续允许模块假设完整 Node/Electron 环境。建议分为：

- `portable` 模块：受限 JavaScript 或 WebAssembly，只访问 Kernel 下发的 capability，可在 Desktop/Mobile/Web/Headless 运行；
- `host-builtin` 模块：需要原生、高权限或后台能力的官方模块，与 Host 一同签名和发布，不作为任意下载代码执行；
- 平台不支持能力通过 manifest `runtime.targets` 和能力快照显式表达。

动态代码尤其是 Android/iOS 分发政策的长期风险点。Android 官方建议避免不必要的动态代码加载，并对来源、内部存储与完整性校验提出明确要求。

官方参考：[Android dynamic code loading risks](https://developer.android.com/privacy-and-security/risks/dynamic-code-loading)

## 7. 不应把“Tauri 插件”等同于“Chips 插件”

两者名字相同，但职责不同：

- Tauri plugin 是 Host 编译期/原生能力扩展，是 Shell 实现细节；
- Chips plugin 是用户可安装的应用、卡片、布局、模块和主题，是生态公共产品模型。

正确链路是：

```text
Chips plugin -> window.chips / SDK -> Chips permission + Kernel route
             -> PAL port -> Tauri command/plugin or native Kotlin/Swift API
```

不允许 Chips 插件直接 import Tauri JS API。

## 8. 最终技术决策

### 8.1 应当选择

1. **React + TypeScript + Web Platform**：生态 UI、卡片、箱子布局、插件开发与浏览器交付。
2. **Rust**：唯一可移植 Host Core 与 Headless Core。
3. **Electron**：Windows/macOS/Linux 的薄 Desktop Shell。
4. **Tauri 2**：Android/iOS 的 Mobile Shell/WebView 组装基础。
5. **Kotlin**：Android PAL 和需要 AndroidX/Jetpack 的平台能力。
6. **Swift**：iOS PAL 和 Apple 平台能力。
7. **受限 JavaScript/WebAssembly 模块运行时**：用于真正可跨端的无界面第三方模块，具体引擎和治理模型需独立 ADR 与安全原型。

### 8.2 不应选择

- 不用 Flutter/Compose 替换 Web 卡片插件标准；
- 不把 Capacitor 原生插件当成 Host Core；
- 不把 Node.js Mobile 当成新世代长期内核；
- 不让 Electron、Tauri、Flutter 或 Kotlin API 出现在 Chips 插件公开契约中；
- 不为桌面和移动分别维护两套 Kernel 业务逻辑。

## 9. 对现有设计文档的影响

`生态设计原稿/28-Chips生态概述.md` 中出现过“移动端 Capacitor”的技术指向，部分架构文档又以 Electron 主进程定义内核。这些是不同时期的落地假设，不应继续成为公共架构的技术锁定。

在用户确认本章选型后，应另立架构 ADR，然后统一修订：

- Host Core 语言与运行时定位；
- Desktop/Mobile/Web/Headless Shell 矩阵；
- 模块插件的可移植执行规格；
- `.cpk` 可执行资产的平台政策；
- Tauri 底层能力与 Chips PAL 的边界；
- Android/iOS 应用商店与插件市场安全治理。

## 10. 本章结论

Flutter 不是“做不到卡片全链路”，而是“要么仍然要依赖 WebView，要么就需要把整个插件生态改成 Dart/Flutter”。前者增加一层并未解决 Host Core，后者丢失 Chips 最有价值的 Web 可分发性和动态插件模型。

从全生态长期发展看，最合理的分工是：

> **Web 负责可分发的交互与内容，Rust 负责稳定的跨端 Host Core，Electron 负责桌面 Shell，Tauri 2 负责移动 Shell，Kotlin/Swift 负责移动原生能力。**

### 允许全量重写后的反事实检验

只有当产品目标同时改成以下形态时，Flutter 才会超过本章推荐栈：

- Host 是一个封闭的第一方应用，而不是第三方插件平台；
- 卡片类型和功能由 Host 发版时编译进应用，不再允许 `.cpk` 独立安装和更新；
- 不再要求同一卡片插件在普通浏览器、社区网页和第三方 Web 容器中原生运行；
- 接受 Dart/Flutter 作为主要第三方开发者生态；
- 优先级变成手机原生动画和 UI 一致性，而不是插件动态性、Web 可嵌入性和 Headless 能力。

这些不是技术实现替换，而是产品和生态定义的替换。在 Chips 现有长期目标不变时，允许全量重写不会改变技术选型排名。

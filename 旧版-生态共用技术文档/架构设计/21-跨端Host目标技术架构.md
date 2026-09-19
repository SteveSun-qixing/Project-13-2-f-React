# 跨端 Host 目标技术架构

> 状态：正式目标架构（已确认，待实施）  
> 决策日期：2026-08-12  
> 适用范围：Host、PAL、Bridge、SDK、五类插件、Desktop/Mobile/Web/Headless Shell、生态工具链  
> 实施计划：`项目日志与笔记/task037-安卓端完善/`

## 1. 状态声明

本文定义 Chips 生态的长期目标技术架构，已取代“Electron 是全生态唯一技术底座”和“所有平台必须强制使用同一 Shell 框架”的旧技术假设。生态统一的是 Host Core、公共契约、插件格式和行为，Shell 按平台需求择优。

在迁移完成前，必须区分两种状态：

- **目标架构**：本文定义的 React/Web 插件 + Rust Host Core + Desktop Electron Shell + Mobile Tauri 2 Shell + Kotlin/Swift PAL；
- **当前实现**：现有 `Chips-Host` 仍是 TypeScript/Node/Electron，Android、iOS 和 Web Host 尚未交付。

文档不得把目标架构误写为已上线能力，代码也不得因为当前实现尚为 Electron 而继续扩大 Electron/Node 公共契约。

## 2. 正式技术选型

| 领域 | 正式选型 | 职责 |
|---|---|---|
| 应用、卡片、布局 UI | React + TypeScript + HTML/CSS | Web 可分发界面和卡片运行时 |
| 插件客户端契约 | TypeScript | `chips-sdk`、Bridge 类型、manifest 工具和测试辅助 |
| Host Core | Rust | Kernel、Services、插件治理、数据、归档、安全、任务和审计 |
| Desktop Shell | Electron | 统一 Chromium、成熟多窗口、媒体、调试、离屏渲染和桌面分发 |
| Mobile Shell | Tauri 2 | Android/iOS WebView、Rust 集成、移动生命周期和平台打包 |
| Android PAL | Kotlin + Android Jetpack | Android 原生系统能力 |
| iOS PAL | Swift + Apple frameworks | iOS 原生系统能力 |
| Headless Host | Rust binary/library | 服务器、Worker、CI、批处理 |
| Web Host | React/TypeScript + Web PAL | 浏览器受限 Host 和远端 Host 连接 |
| 可移植 module 插件 | 受限 JavaScript 或 WebAssembly | 无原生代码的跨端无界面能力 |

Flutter、Capacitor、Node.js Mobile 和 Kotlin Multiplatform 不是全生态主栈。Electron 是正式 Desktop Shell，但不是 Host Core 的定义边界，Node.js 也不是插件的公共运行时。

## 3. 逻辑架构

```text
L12  App/Page Domain                 React/TypeScript
L11  UI style runtime                antd + @chips/ui + CSS tokens
L10  Shared UI components            React
L9   Unified rendering               Web adapters + Host render services
L8   Declarative/document runtime    TypeScript contracts
L7   UI hooks                        React hooks
L6   Runtime client                  chips-sdk TypeScript
L5   Bridge transport                Web message <-> Shell <-> Rust endpoint
L4   Plugin runtime                  Rust policy + Web/plugin executors
L3   Host services                   Rust service domains
L2   Host Kernel                     Rust router/registry/event/lifecycle
L1   PAL                             Rust traits + Kotlin/Swift/platform adapters
L0   Shell/OS                        Electron Desktop / Tauri Mobile / native PAL
```

逻辑层级是公共架构，不等于每一层必须单独进程或单独包。任何实现均必须遵循依赖方向，不得为了工程便利让插件绕过 Bridge 或让服务绕过 Kernel。

## 4. Host Core 边界

Rust Host Core 必须同时支持库内嵌入与独立 Headless 运行，其内部包含：

- 带 schema、权限、超时、幂等和重放保护的 Kernel route；
- 服务注册、依赖、启停、健康与熔断；
- 事件总线和可观测调用上下文；
- `.card` / `.box` / `.cpk` 解析、验证和事务写入；
- 插件安装、签名、权限、会话、撤销和审计；
- 资源句柄、文档句柄和受控 URL 治理；
- module provider 解析、任务、取消、恢复和资源限制；
- 日志、指标、审计和诊断快照。

Host Core 禁止直接依赖 Tauri window、Android Activity、WKWebView、Electron BrowserWindow、Node `fs/path/process`。这些能力只能经 PAL trait 或 Shell port 注入。

## 5. Shell 与 PAL 组合

| 平台 | Shell | PAL | 状态 |
|---|---|---|---|
| Windows/macOS/Linux | Electron Desktop Shell | Electron/Node desktop PAL + Rust shared PAL | 正式目标；需收敛为薄 Shell |
| Android | Tauri Mobile Shell | Kotlin Android PAL + Rust shared PAL | 目标；未实现 |
| iOS | Tauri Mobile Shell | Swift iOS PAL + Rust shared PAL | 目标；未实现 |
| Browser | WebHostShell | Web API PAL / remote Host transport | 目标；未实现 |
| Server/Worker/CLI | HeadlessHostShell | Rust headless PAL | 目标；现有为 Node |

PAL 每个分面必须返回真实 capability snapshot。无法等价的能力返回稳定 `PAL_UNSUPPORTED`，禁止空实现假成功。

## 6. Web 插件运行时

`app` / `card` / `layout` 插件仍是 Web 资产。正式宿主必须提供：

- 按插件、session、surface 建立的身份边界；
- 受控本地 HTTPS-like origin，不使用宽松 `file://`；
- CSP、导航、弹窗、下载、媒体和远程内容策略；
- Bridge bootstrap 与消息鉴权；
- 卡片独立文档/iframe 隔离；
- 资源 URL 发放、租约和回收；
- 后台、挂起、恢复和进程死亡后的 session 重建。

插件不得直接 import `@tauri-apps/api`、Electron、Node 或原生平台 SDK。

## 7. Chips 插件与 Shell 扩展的边界

- Chips plugin 是用户可安装的生态产品；
- Electron/Tauri/native extension 是 Host 编译期的底层平台扩展；
- Chips plugin 只调用 Chips 公共契约；
- Shell extension 只能位于 PAL/Shell 实现内部。

正式路径：

```text
Chips plugin -> window.chips / chips-sdk -> Bridge authorization
             -> Kernel route -> PAL port -> Electron/Tauri/native implementation
```

## 8. 五类插件目标模型

| 类型 | 目标执行形态 | 可下载原生代码 |
|---|---|---:|
| `app` | 受控 Web surface | 否 |
| `card` | ESM + DOM mount + 独立 Web 文档 | 否 |
| `layout` | ESM/Web page + Host box session | 否 |
| `theme` | token/CSS/assets | 否 |
| `module` portable profile | 受限 JS/Wasm executor | 否 |
| Host builtin capability | Rust/Tauri/Kotlin/Swift，随 Host 签名发布 | 不属于可下载 Chips plugin |

Android/iOS 生产模式的 `.cpk` 禁止携带 dex/JAR/.so/framework/dylib 等原生可执行载荷。

## 9. 跨语言契约源

Rust、TypeScript、Kotlin 和 Swift 不得各自手写一份公共类型。必须建立唯一契约源，至少覆盖：

- route descriptor；
- input/output JSON Schema；
- StandardError 与错误码；
- capability snapshot；
- manifest schema；
- Bridge envelope/handshake/event；
- DocumentHandle/ResourceHandle/SurfaceContext；
- plugin lifecycle/module job 状态。

代码生成必须可重复，CI 必须验证生成结果无 diff，契约必须使用跨实现 golden vectors 验证。

## 10. 安全不变量

1. Host 根据物理通道重建 caller context，不信任请求载荷自报身份。
2. 任何 route 都在 Kernel 校验 schema、权限、deadline 和重放策略。
3. 远程网页与安装插件使用不同 WebView/origin/capability profile。
4. 插件安装必须 staging -> 解包限制 -> manifest/schema -> 签名/hash -> 权限 -> 原子激活。
5. 资源使用句柄与租约，不向插件暴露本地绝对路径。
6. 可移植 module 必须限制 CPU、内存、时间、并发、网络和存储配额。

## 11. 迁移门禁

- 先稳定公共契约和金标向量，再迁移实现；
- Rust 实现必须与当前 TypeScript 实现做行为等价测试；
- Desktop Electron 必须收敛为薄 Shell/PAL，Kernel 与跨平台 Services 不得留在 Electron 私有实现中；
- 任何一端的能力都必须真实实现或返回正式 unsupported；
- 插件 manifest 的 `runtime.targets` 只能在该目标完成自动化认证后改为 supported；
- 不建立长期双 Kernel、双路由或双公共 API。

## 12. 不适用决策

以下决策未被采用：

- Flutter 作为五类插件主运行时；
- Capacitor 作为全生态 Host Core；
- Node.js Mobile 作为长期移动内核；
- Kotlin Multiplatform/Compose 作为插件 UI 公共格式；
- Tauri 2 强制替代 Desktop Electron Shell；
- Electron/Node API 作为 Host 公共语义。

选型对比证据和 Flutter 全链路评估见 task037 第 17 章。

## 13. 为什么 Desktop 保留 Electron

Desktop 保留 Electron 不是为了保留历史代码，而是 Chips 的桌面产品形态需要：

- 自带固定 Chromium，为卡片 DOM/CSS/iframe、编辑引擎、Canvas、WebGL、IME 和媒体提供可控渲染基线；
- BrowserWindow/WebContents/session/protocol/offscreen rendering 适合 Chips 复杂 surface 和文档导出；
- DevTools、崩溃定位、打包、签名、更新和桌面 CI 工具成熟；
- Desktop 无法从 Tauri 的移动支持获得直接收益，Mobile 本来就需要独立 PAL 和能力矩阵。

Electron 必须受以下边界约束：

- Renderer 保持 `nodeIntegration: false`、`contextIsolation: true`并启用 sandbox；
- 插件不获得 Electron/Node API；
- Kernel 和跨平台 Services 位于 Rust Core；
- Desktop Shell 通过认证的本地双向 RPC 连接 Rust Core；
- BrowserWindow、protocol、offscreen render、tray 等由 Desktop PAL 实现，不泄漏到公共契约。

## 14. Desktop Rust Core 部署模型

Desktop 默认把 Rust Host Core 构建为由 Electron Shell 管理的本地子进程，而不是把整个 Core 写成 Node native addon。

```text
Plugin WebView
  -> preload/window.chips
  -> Electron Bridge endpoint
  -> authenticated local bidirectional RPC
  -> Rust Host Core / Kernel route
  -> Rust service or reverse Desktop PAL request
  -> Electron BrowserWindow/protocol/offscreen/system implementation
```

子进程模型允许同一 Core 直接用于 Headless，将 Core 崩溃与 UI 隔离，并避免 Electron/Node ABI 锁死核心运行时。RPC 必须支持请求/响应、事件、取消、流、deadline、背压和 reverse PAL invocation，不得用临时 stdout JSON 代替正式传输。

# 安卓 Host 目标架构方案

## 1. 目标

Android 上仍然只安装一个 Chips Host。所有应用、卡片、布局、模块和主题仍是插件，不变成独立 APK。插件只能通过 `window.chips.*` / SDK 访问系统能力，服务间调用仍走 Kernel 路由。

## 2. 推荐分层

```text
Android Application
├── MobileHostShell (Kotlin)
│   ├── Activity / Navigation / SurfaceRegistry
│   ├── LifecycleCoordinator / StateRestore
│   ├── IntentRouter / ShareRouter / DocumentRouter
│   └── AndroidBridgeEndpoint
├── Android PAL (Kotlin + typed boundary)
│   ├── Storage / Selection / Transfer / Association
│   ├── Device / SystemUi / Background
│   ├── Notification / Clipboard / Screen
│   ├── ResourceResolver / Crypto / Credential
│   └── CapabilitySnapshot
├── Portable Host Runtime
│   ├── Kernel
│   ├── Services through ports
│   ├── Plugin registry / sessions / permissions
│   └── Theme / i18n / rendering contracts
└── Plugin Surfaces
    ├── trusted app WebView
    ├── nested card/layout frames
    └── isolated remote-content WebView without privileged Bridge
```

## 3. Host Core 的承载方式需要 ADR

必须在实现前对以下候选做原型和选型：

### 方案 A：嵌入可移植 JavaScript runtime

优点：可最大程度复用 TypeScript Kernel/Services。

风险：需要选择长期 JS 引擎和 Android binding；Node 标准库不可用；模块加载、异步、网络、调试、包体和安全沙箱都要正式设计。

### 方案 B：Kotlin 重写核心执行层，复用契约和 Web SDK

优点：与 Android 生命周期、线程、存储和安全模型最自然。

风险：Kernel/Services 形成第二份实现，必须靠契约测试保证桌面/Android 等价，维护成本高。

### 方案 C：混合模式

Kotlin 承担 Shell/PAL/安全/生命周期，纯 TypeScript Core 在嵌入式 JS runtime 运行；Node 强绑定服务迁入原生 port。

这是当前最值得验证的方向，但不能在没有原型数据时直接冻结。ADR 必须比较：许可证、维护状态、包体、冷启动、调试、ESM、Promise、内存、线程、Android API 等级、供应链风险。

## 4. 核心 ports

HostCore 不应继续直接依赖 Node API。至少抽出：

- `StoragePort`：文件/目录/流/事务写/元数据；
- `PathPort` 或跨平台虚拟路径模型；
- `ArchivePort`：ZIP/CPK/card/box；
- `CryptoPort`：hash、random、signature；
- `ClockPort` 与 `IdPort`；
- `LogStorePort`；
- `PluginStorePort`；
- `ModuleExecutorPort`；
- `ResourceResolverPort`；
- `NetworkPort`；
- `CredentialPort`；
- `SurfacePort`；
- `BridgeEndpointPort`。

这些 port 是 Host 内部架构，不应扩散成插件私有 API。插件仍消费现有公共路由。

## 5. Surface 模型

Android 建议映射：

| 公共 SurfaceKind | Android 实现 |
|---|---|
| `fullscreen` | 主 Activity 中全屏 destination/WebView |
| `route` | Navigation back stack destination |
| `sheet` | BottomSheet/Dialog destination |
| `modal` | Dialog/全屏 modal destination |
| `tab` | Host 内标签/页面容器，按产品需求启用 |
| `window` | Android 上归一为 fullscreen 或明确 unsupported |

不要让插件读取 Activity/Fragment/WebView 对象。插件只看到 Surface 公共状态。

## 6. 插件目录与运行资料

建议内部存储结构：

```text
files/
├── host/
│   ├── config/
│   ├── logs/
│   ├── sessions/
│   └── databases/
├── plugins/
│   ├── installed/<pluginId>/<version>/
│   └── staging/<transactionId>/
├── workspaces/<workspaceId>/
└── imports/<transactionId>/
cache/
├── render/
├── webview/
└── downloads/
```

安装必须 staging -> 校验 -> 原子激活；不能像当前桌面实现那样假设目录替换总是安全且进程不会被杀。

## 7. 首条金链路

第一条完整业务链路应选择 CardViewer，而不是编辑引擎：

1. 安装 debug Host；
2. Host 首次启动并加载内置诊断 surface；
3. 通过系统 picker 选择 `.card`；
4. Host 导入/解析文档；
5. 启动 CardViewer fullscreen surface；
6. CardViewer 经 `window.chips.*` 调用 card/resource/plugin 服务；
7. 基础卡片和主题资源在受控 origin 下渲染；
8. 返回后台、旋转、系统杀进程后恢复；
9. 通过 Android share sheet 导出/分享。

这条链路通过后，才进入编辑器和完整模块插件能力。

## 8. 为什么不选择 React Native

React Native 适合原生组件树，不适合直接承载现有 HTML/iframe/动态 Web 插件契约。改用 React Native 会迫使插件重写，破坏五类插件格式统一和现有渲染架构。因此 Android Shell 应原生化，但插件 surface 继续使用 Web 技术。

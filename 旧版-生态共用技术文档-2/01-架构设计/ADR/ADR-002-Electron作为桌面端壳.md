# ADR-002: Electron 作为桌面端壳

## 状态

**已接受** - 2026-09-19

## 背景

薯片生态需要选择一个桌面端运行时框架，支撑以下核心需求：

1. **跨平台运行**：支持 macOS、Windows、Linux 三大桌面平台
2. **Web 技术栈**：前端使用 React 技术栈，需要原生渲染能力
3. **多窗口管理**：支持应用插件的独立窗口需求
4. **系统集成**：文件系统访问、系统托盘、快捷键注册等系统能力
5. **安全隔离**：插件运行在受控的沙箱环境中
6. **性能要求**：冷启动时间 < 2s，内存占用合理

## 决策

采用 **Electron** 作为薯片桌面端运行时框架，基于 Electron 28+ 版本构建薯片主机。

### 技术选型依据

| 需求 | Electron 方案 | Tauri 方案 | 自研 Chromium 方案 |
|------|---------------|------------|---------------------|
| 跨平台 | 优秀 | 优秀 | 需大量适配工作 |
| Web 技术栈 | 原生支持 | 需 WebView | 从头实现 |
| 多窗口 | 完善支持 | 有限支持 | 需自研 |
| 系统集成 | 完善 API | Rust 后端 | 需自研 |
| 安全隔离 | Context Isolation | 优秀 | 需自研 |
| 开发效率 | 高 | 中 | 低 |
| 包体大小 | 约 120MB | 约 15MB | 不适用 |
| 社区生态 | 成熟 | 成长中 | 无 |

### Electron 架构适配

```
┌─────────────────────────────────────────────────────────┐
│                    Electron Main Process                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
│  │   Rust      │  │   Node.js   │  │   Electron      │ │
│  │   Core      │  │   Runtime   │  │   Main API     │ │
│  │  (N-API)    │  │  (Cordis)   │  │  (Window/IPC)  │ │
│  └─────────────┘  └─────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────┘
                           │
                     IPC (N-API)
                           │
┌─────────────────────────────────────────────────────────┐
│                   Electron Renderer Process              │
│  ┌─────────────────────────────────────────────────┐   │
│  │              React Application                   │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────────────┐ │   │
│  │  │  App    │  │  Bridge │  │  Plugin Runtime │ │   │
│  │  │Runtime  │  │ Client  │  │  (Cordis)       │ │   │
│  │  └─────────┘  └─────────┘  └─────────────────┘ │   │
│  └─────────────────────────────────────────────────┘   │
│                           │                             │
│                    contextBridge                        │
│                    (window.chips.*)                     │
└─────────────────────────────────────────────────────────┘
```

### 版本策略

- **Electron 版本**：锁定在 LTS 版本（Electron 28+）
- **Chromium 版本**：跟随 Electron 版本，自动获得安全更新
- **Node.js 版本**：Electron 内置，不单独管理
- **升级策略**：跟随 Electron 官方升级周期，每季度评估一次升级

## 后果

### 优势

1. **成熟的跨平台能力**：Electron 经过十余年发展，跨平台能力成熟稳定
2. **完善的 Web 支持**：原生支持所有 Web API，无需额外适配
3. **丰富的系统集成**：文件系统、系统托盘、通知、快捷键等 API 完善
4. **强大的多窗口支持**：BrowserWindow API 支持复杂的多窗口场景
5. **成熟的安全模型**：Context Isolation、Preload Scripts 等机制成熟
6. **活跃的社区生态**：大量开源项目和最佳实践可参考
7. **完善的调试工具**：Chrome DevTools 原生支持

### 劣势

1. **包体较大**：Electron 包含完整 Chromium，约 120MB
2. **内存占用**：相比 Tauri 原生方案，内存占用较高
3. **启动性能**：冷启动时间约 1.5-2s，略慢于原生方案
4. **资源消耗**：多窗口场景下资源消耗较大

### 风险

1. **Electron 停止维护**：目前 Electron 社区活跃，风险较低
2. **安全漏洞**：Chromium 内核漏洞需及时跟进安全更新
3. **平台特性差异**：三个平台的 Electron 实现可能有细微差异

## 替代方案

### 方案 1：采用 Tauri

**优点**：
- 包体小（约 15MB）
- 内存占用低
- Rust 原生性能

**缺点**：
- WebView 依赖操作系统 WebView2/WebKit
- 多窗口支持有限
- 前端必须使用 WebView，无法直接使用 React DOM
- 插件隔离需要额外实现

**结论**：不采用。WebView 方案限制了前端技术栈的灵活性，且多窗口支持不足。

### 方案 2：自研 Chromium Runtime

**优点**：
- 完全可控
- 可针对性优化

**缺点**：
- 开发周期极长（Chromium 代码量巨大）
- 维护成本极高
- 需要处理大量平台适配工作
- 安全风险完全自担

**结论**：不采用。成本过高，不现实。

### 方案 3：Electron + 自研渲染层

**优点**：
- 结合 Electron 成熟度与定制化能力

**缺点**：
- 增加定制复杂度

**结论**：作为备选方案，主要使用标准 Electron 能力，定制保持在最小范围。

## 实施细节

### 目录结构

```
chips-host/
├── electron/
│   ├── main/
│   │   ├── index.ts          # 主进程入口
│   │   ├── window.ts          # 窗口管理
│   │   ├── ipc.ts            # IPC 处理器
│   │   └── tray.ts           # 系统托盘
│   ├── preload/
│   │   └── index.ts          # Preload 脚本
│   └── renderer/
│       ├── index.html        # 渲染进程入口
│       └── ...
├── src/
│   ├── core/                 # Rust 核心
│   ├── cordis/               # Cordis 运行时
│   └── services/             # Host 服务
└── package.json
```

### 构建配置

- 使用 electron-builder 进行打包
- 支持 macOS（dmg/pkg）、Windows（nsis/squirrel）、Linux（AppImage/deb）
- 启用 Context Isolation 和 Node Integration 禁用
- 启用安全标志：`webSecurity: true`, `allowRunningInsecureContent: false`

## 参考资料

- [Electron 官方文档](https://www.electronjs.org/docs)
- [Electron Security Best Practices](https://www.electronjs.org/docs/tutorial/security)
- [electron-builder 文档](https://www.electron.build/)

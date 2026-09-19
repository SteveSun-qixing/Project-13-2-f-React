# ADR-003: Rust 核心 + Node Native Module 架构

## 状态

**已接受** - 2026-09-19

## 背景

薯片生态需要高性能、高安全性的核心运行时能力，包括：

1. **文件处理**：卡片和箱子文件的解析、验证、打包
2. **资源管理**：文件系统的抽象、资源缓存、权限控制
3. **插件运行时**：插件加载、验证、隔离
4. **系统集成**：平台能力抽象、安全沙箱
5. **性能要求**：处理大型文件（GB 级）时保持流畅

这些能力对性能要求极高，同时需要保证内存安全。JavaScript/TypeScript 在处理大量计算时性能有限，而 Rust 是目前最佳的系统级选择。

## 决策

采用 **Rust 核心 + Node Native Module** 架构：

- **Rust**：实现核心业务逻辑（文件处理、资源管理、插件验证、安全沙箱）
- **Node.js (N-API)**：提供 Rust 与 JavaScript 之间的桥接层
- **TypeScript**：处理前端逻辑和 Host 服务编排

### 架构层次

```
┌─────────────────────────────────────────────────────────────┐
│                      React Frontend                         │
│                    (TypeScript + React)                     │
└─────────────────────────────────────────────────────────────┘
                              │
                    Bridge API (window.chips.*)
                              │
┌─────────────────────────────────────────────────────────────┐
│                     Host Services Layer                     │
│              (TypeScript - Service Orchestration)            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │  File    │ │ Resource │ │  Config  │ │  Plugin  │      │
│  │ Service  │ │ Service  │ │ Service  │ │ Service  │      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
└─────────────────────────────────────────────────────────────┘
                              │
                    Native Module API (N-API)
                              │
┌─────────────────────────────────────────────────────────────┐
│                    Rust Core (Native Module)                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                    Cordis Runtime                     │  │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────────┐   │  │
│  │  │  Module    │ │  Service   │ │    Event       │   │  │
│  │  │  Loader    │ │  Registry  │ │    Bus         │   │  │
│  │  └────────────┘ └────────────┘ └────────────────┘   │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                   Core Modules                        │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐  │  │
│  │  │   ZIP    │ │ Resource │ │  Crypto  │ │  PAL   │  │  │
│  │  │ Handler  │ │ Manager  │ │ (SHA256) │ │ (Platform│  │  │
│  │  └──────────┘ └──────────┘ └──────────┘ │ Abst.) │  │  │
│  │                                       └────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### N-API 集成策略

| 场景 | 实现方式 | 理由 |
|------|----------|------|
| 同步调用 | `napi_call_function` | 简单操作，如文件信息获取 |
| 异步计算 | `napi_create_async_work` | CPU 密集型任务，如文件解析 |
| 流式处理 | Stream API | 大文件处理，如 ZIP 解压 |
| 事件通知 | `napi_emit_event` | 进度报告、状态变更 |

### 错误处理模型

```
┌─────────────────────────────────────────────────────────────┐
│                      Error Flow                             │
│                                                             │
│  JavaScript                    Rust Core                    │
│      │                            │                         │
│      │  invoke("card.parse")      │                         │
│      │ ──────────────────────────>│                         │
│      │                            │  Parse card file         │
│      │                            │  (potential error)       │
│      │                            │                         │
│      │  Promise<reject(Error)>    │                         │
│      │ <──────────────────────────│                         │
│      │                            │                         │
│  Error {                            │                         │
│    code: "CARD_SCHEMA_INVALID",    │                         │
│    message: "...",                 │                         │
│    details: { line: 42, col: 5 }  │                         │
│  }                                │                         │
│      │                            │                         │
└─────────────────────────────────────────────────────────────┘
```

## 后果

### 优势

1. **极致性能**：Rust 编译为原生机器码，处理速度远超 JavaScript
2. **内存安全**：Rust 的所有权系统和借用检查器保证内存安全，无需 GC
3. **零成本抽象**：高性能的同时保持良好的抽象层次
4. **并发安全**：Rust 的类型系统帮助编写正确的并发代码
5. **安全沙箱**：Rust 可以实现更严格的安全验证
6. **小型二进制**：相比 Electron 完整捆绑，Rust 核心包体小
7. **跨平台一致**：Rust 编译器确保各平台行为一致

### 劣势

1. **学习曲线**：Rust 所有权模型对 TypeScript 开发者有较高学习成本
2. **开发效率**：编译型语言修改-验证循环较慢
3. **调试复杂度**：Rust 错误处理和调试需要额外学习
4. **构建复杂性**：需要配置 Rust 工具链和 N-API 绑定
5. **类型映射**：TypeScript 与 Rust 类型之间的映射需要手动维护

### 风险

1. **Rust 版本更新**：需要跟踪 Rust 和 N-API 版本兼容性
2. **编译环境**：开发者需要安装 Rust 工具链
3. **跨平台编译**：不同平台的 Rust 交叉编译配置复杂
4. **依赖管理**：Rust crate 版本需要严格管理

## 替代方案

### 方案 1：纯 TypeScript 实现

**优点**：
- 开发效率高
- 无需额外工具链
- 类型系统统一

**缺点**：
- 性能不足（处理大型文件卡顿）
- 内存安全问题（内存泄漏风险）
- 无法实现高效的安全沙箱

**结论**：不采用。无法满足性能和安全要求。

### 方案 2：WebAssembly

**优点**：
- 跨平台性更好
- 可在浏览器中运行
- 性能接近原生

**缺点**：
- 与系统 API 集成有限
- 调试困难
- 生态不如 Rust 成熟
- 无法访问原生平台能力

**结论**：不采用。无法满足系统集成需求。

### 方案 3：Rust + wasm-bindgen

**优点**：
- 统一使用 Rust

**缺点**：
- 仍然受 WebAssembly 限制
- 无法直接调用 Node.js API

**结论**：不采用。Electron 环境下 N-API 是更成熟的选择。

## 实现计划

### Phase 1: 基础架构
- 搭建 Rust 项目结构
- 配置 N-API 构建系统
- 实现基础模块加载
- 编写 TypeScript 类型定义

### Phase 2: 核心模块
- 实现 ZIP 处理模块
- 实现资源管理模块
- 实现文件验证模块
- 实现 PAL 抽象层

### Phase 3: 性能优化
- 实现流式处理
- 优化内存使用
- 添加性能监控

## 技术规范

### Cargo.toml 配置示例

```toml
[package]
name = "chips-core"
version = "1.0.0"
edition = "2021"

[lib]
crate-type = ["cdylib", "rlib"]

[dependencies]
napi = "2.12"
napi-derive = "2.12"
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
zip = "0.6"
sha2 = "0.10"
thiserror = "1"
tracing = "0.1"

[build-dependencies]
napi-build = "2"

[profile.release]
lto = true
opt-level = "z"
codegen-units = 1
```

### TypeScript 类型定义示例

```typescript
// chips-core.d.ts
declare module '@chips/core' {
  export interface ParseResult {
    metadata: CardMetadata;
    structure: CardStructure;
    resources: ResourceInfo[];
  }

  export interface ParseOptions {
    validate?: boolean;
    extractResources?: boolean;
  }

  export function parseCard(
    path: string,
    options?: ParseOptions
  ): Promise<ParseResult>;

  export function packCard(
    outputPath: string,
    metadata: CardMetadata,
    structure: CardStructure
  ): Promise<void>;
}
```

## 参考资料

- [N-API 官方文档](https://nodejs.org/api/n-api.html)
- [napi-rs 框架](https://github.com/napi-rs/napi-rs)
- [Rust N-API 最佳实践](https://github.com/napi-rs/docs)

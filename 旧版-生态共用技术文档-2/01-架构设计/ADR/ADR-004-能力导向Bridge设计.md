# ADR-004: 能力导向 Bridge 设计

## 状态

**已接受** - 2026-09-19

## 背景

薯片生态采用中心路由架构，所有服务间调用必须经过内核路由。插件作为独立模块，无法直接访问系统能力，必须通过 Bridge 与 Host 通信。

传统 Bridge 设计往往以「API 集合」形式暴露能力，导致以下问题：

1. **接口膨胀**：随着功能增加，API 数量爆炸性增长
2. **语义模糊**：一个 API 往往同时包含多种能力
3. **权限耦合**：无法细粒度控制权限
4. **版本管理困难**：API 变更影响所有调用方

薯片生态采用**能力导向**设计，以「能力（Capability）」为核心组织接口，每个能力代表一个完整的业务语义单元。

## 决策

采用 **能力导向 Bridge 设计**，以 Capability 为核心抽象：

### 能力模型

```
┌─────────────────────────────────────────────────────────────┐
│                       Capability                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                   File Capability                     │    │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────────────┐ │    │
│  │  │  read()   │ │  write()  │ │    list()        │ │    │
│  │  └───────────┘ └───────────┘ └───────────────────┘ │    │
│  │  Actions: read, write, list, stat, watch            │    │
│  │  Permissions: file.read, file.write                  │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### 三层 Bridge 架构

| 层级 | 名称 | 职责 | 边界 |
|------|------|------|------|
| L5 | Bridge Transport | IPC 传输、消息编解码 | window.chips.* |
| L6 | Runtime Client | 能力封装、错误归一、重试 | SDK 核心 |
| L7 | UI Hooks | 面向页面的调用接口 | React 组件 |

### 能力定义规范

```typescript
// 能力接口定义示例
interface FileCapability {
  // 能力标识
  readonly capability: 'file';
  
  // 动作定义
  actions: {
    // 读取文件内容
    read: {
      params: {
        path: string;
        encoding?: 'utf-8' | 'base64' | 'binary';
        start?: number;
        end?: number;
      };
      result: {
        content: string | ArrayBuffer;
        metadata: FileMetadata;
      };
      permissions: ['file.read'];
    };
    
    // 写入文件
    write: {
      params: {
        path: string;
        content: string | ArrayBuffer;
        mode?: 'create' | 'overwrite' | 'append';
      };
      result: {
        bytesWritten: number;
      };
      permissions: ['file.write'];
      idempotent: false;
    };
    
    // 列出目录
    list: {
      params: {
        path: string;
        recursive?: boolean;
        filter?: string[];
      };
      result: {
        entries: FileEntry[];
      };
      permissions: ['file.read'];
    };
  };
}
```

### IPC 消息格式

```typescript
// 请求格式
interface BridgeRequest {
  id: string;              // 请求唯一标识
  capability: string;      // 能力名称
  action: string;           // 动作名称
  params: unknown;          // 参数
  timeout?: number;         // 超时时间(ms)
  requestId?: string;       // 幂等去重ID
}

// 响应格式
interface BridgeResponse {
  id: string;              // 请求标识
  result?: unknown;         // 成功结果
  error?: BridgeError;      // 错误信息
  duration: number;         // 处理时长
}

// 错误格式
interface BridgeError {
  code: string;             // 错误码
  message: string;          // 错误信息
  details?: unknown;        // 详细信息
  retryable?: boolean;      // 是否可重试
}
```

### 权限模型

```yaml
# manifest.yaml 中声明
permissions:
  - file.read       # 读取文件
  - file.write      # 写入文件
  - resource.read   # 读取资源
  - window.control  # 控制窗口
```

### 调用示例

```typescript
// TypeScript 调用示例
import { useCapability } from '@chips/sdk';

// 在 React 组件中使用
function FileList({ path }) {
  const { invoke, loading, error } = useCapability('file');
  
  useEffect(() => {
    invoke('list', { path, recursive: true })
      .then(result => console.log(result.entries));
  }, [path]);
  
  // 渲染...
}

// 直接调用示例
const file = await window.chips.capabilities.file;
const entries = await file.list({ path: '/documents' });
```

## 后果

### 优势

1. **语义清晰**：每个能力代表一个完整的业务领域，易于理解
2. **权限细化**：动作级别权限控制，最小权限原则
3. **接口稳定**：能力内部重构不影响 API 契约
4. **版本管理**：能力可以独立演进
5. **自动生成文档**：能力定义可自动生成 API 文档
6. **类型安全**：TypeScript 类型自动推导
7. **易于测试**：每个能力可独立测试

### 劣势

1. **设计复杂度**：需要仔细设计能力边界
2. **迁移成本**：现有 API 需要重构为能力模型
3. **学习曲线**：开发者需要理解能力概念

### 风险

1. **能力边界设计不当**：可能导致接口臃肿或过度碎片化
2. **能力膨胀**：随着功能增加，能力数量可能失控

## 替代方案

### 方案 1：传统 API 集合

**优点**：
- 实现简单
- 开发者熟悉

**缺点**：
- 接口膨胀
- 权限耦合
- 难以演进

**结论**：不采用。无法满足长期可维护性需求。

### 方案 2：gRPC 接口

**优点**：
- 成熟的接口定义
- 跨语言支持

**缺点**：
- Overhead 较高
- 不适合 Electron IPC

**结论**：不采用。Electron IPC 使用 postMessage/invoke 更高效。

## 能力清单

| 能力名称 | 描述 | 核心动作 |
|----------|------|----------|
| `file` | 文件系统操作 | read, write, list, stat, watch |
| `resource` | 统一资源管理 | resolve, readMetadata, readBinary |
| `config` | 配置管理 | get, set, batchSet, reset |
| `window` | 窗口管理 | open, close, focus, resize, setTitle |
| `plugin` | 插件管理 | install, uninstall, enable, disable, query |
| `module` | 模块调用 | listProviders, invoke, jobGet, jobCancel |
| `platform` | 平台能力 | getInfo, openExternal, getClipboard |
| `log` | 日志系统 | write, query, export |
| `credential` | 凭证管理 | get, set, delete, rotate |
| `card` | 卡片解析 | parse, validate, render |
| `box` | 箱子操作 | pack, unpack, listEntries, openView |
| `dialog` | 对话框 | openFile, saveFile, message, confirm |
| `clipboard` | 剪贴板 | read, write |
| `shell` | 系统命令 | execute |

## 参考资料

- [Electron IPC 最佳实践](https://www.electronjs.org/docs/tutorial/ipc)
- [Capability-based Security](https://en.wikipedia.org/wiki/Capability-based_security)

# Host服务域设计

> **版本**：vNext 架构设计冻结稿  
> **层级**：L3 Host Services  
> **适用阶段**：阶段18及后续重构实施阶段


## 架构归属声明（2026-03-06）

- Host 主责 L1-L9 运行时链路（含 Runtime Client、Declarative UI、Unified Rendering）并随 Host 发布。
- 组件库主责 L10 Component Headless，只负责状态机、结构与 a11y。
- SDK 仅作为开发者工具包提供类型、封装、脚手架与测试辅助，不承载运行时主实现。
- 用户设备仅安装 Host 即可运行；SDK 仅在开发与集成阶段按需使用。

## 服务域概述

Host服务域是薯片生态运行在主进程中的核心服务集合，为上层插件和应用提供各种系统级能力。

**L3层级定位**：

| 层级 | 名称 | 核心职责 | 只允许依赖 | 禁止依赖 |
|---|---|---|---|---|
| L2 | Host Kernel | router/registry/event/lifecycle | PAL | 应用页面代码 |
| **L3** | **Host Services** | **file/resource/config/theme/i18n 等** | **Kernel** | **插件 UI** |

**依赖约束**：
- L3只允许依赖L2（Kernel）
- L3禁止依赖插件UI（L12）

---

## 服务域清单（16个服务）

| 序号 | 服务域 | 说明 | 核心动作面 |
|------|--------|------|------------|
| 1 | `file` | 文件系统操作服务 | read/write/stat/list |
| 2 | `resource` | 资源解析与读取服务 | resolve/readMetadata/readBinary |
| 3 | `config` | 配置管理服务 | get/set/batchSet/reset |
| 4 | `theme` | 主题管理服务 | list/apply/getCurrent/getAllCss/resolve/contract.get |
| 5 | `i18n` | 国际化服务 | getCurrent/setCurrent/translate/listLocales |
| 6 | `window` | 窗口管理服务 | open/focus/resize/setState |
| 7 | `plugin` | 插件管理服务 | install/enable/disable/uninstall/query |
| 8 | `module` | 模块管理服务 | mount/unmount/query/list |
| 9 | `platform` | 平台系统能力服务 | getInfo/getCapabilities/openExternal/dialog*/clipboard*/shell*/notificationShow/tray*/shortcut*/power*/ipc* |
| 10 | `log` | 日志服务 | write/query/export |
| 11 | `credential` | 凭证管理服务 | get/set/delete/rotate |
| 12 | `card` | 卡片文件服务 | parse/render/validate |
| 13 | `box` | 箱子文件服务 | pack/unpack/inspect |
| 14 | `zip` | ZIP压缩服务 | compress/extract/list |
| 15 | `serializer` | 序列化服务 | encode/decode/validate |
| 16 | `control-plane` | 控制平面服务 | health/check/metrics/diagnose |

---

## 统一约束

### 动作命名规范

- 动作名采用 `namespace.action` 格式
- 例如：`file.read`、`theme.apply`、`i18n.setCurrent`

### 幂等性标注

- 幂等动作必须标注 `idempotent=true`
- 幂等动作可安全重试

### 防重放策略

- 非幂等动作必须定义防重放策略
- 使用 `requestId` 去重窗口

### 统一错误对象

```typescript
interface StandardError {
  code: string;           // 错误码
  message: string;       // 错误消息
  details?: unknown;     // 错误详情
  retryable?: boolean;   // 是否可重试
}
```

---

## 服务详情

### 1. file 服务

| 项目 | 内容 |
|------|------|
| 服务名 | `file` |
| 核心动作 | read/write/stat/list/watch/exists/mkdir/delete/copy/move |
| 输入基线 | path + options |
| 输出基线 | content/meta/ack |
| 幂等性 | read/stat/list/exists 幂等 |
| 权限边界 | `file.read` / `file.write` / `file.manage` |
| 典型错误 | `FILE_NOT_FOUND`, `FILE_PERMISSION_DENIED` |

```typescript
// file 服务接口
interface FileService {
  read(path: string, options?: FileReadOptions): Promise<FileContent>;
  write(path: string, content: FileContent, options?: FileWriteOptions): Promise<void>;
  stat(path: string): Promise<FileStat>;
  list(dir: string, options?: FileListOptions): Promise<FileEntry[]>;
  watch(path: string): Promise<FileWatchSubscription>;
  exists(path: string): Promise<{ exists: boolean }>;
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  delete(path: string, options?: { recursive?: boolean }): Promise<void>;
  copy(source: string, destination: string, options?: { overwrite?: boolean }): Promise<void>;
  move(source: string, destination: string, options?: { overwrite?: boolean }): Promise<void>;
}
```

### 2. resource 服务

| 项目 | 内容 |
|------|------|
| 服务名 | `resource` |
| 核心动作 | resolve/readMetadata/readBinary |
| 输入基线 | resourceId |
| 输出基线 | uri/meta/blob |
| 幂等性 | resolve/read* 幂等 |
| 权限边界 | `resource.read` |
| 典型错误 | `RESOURCE_NOT_FOUND` |

### 3. config 服务

| 项目 | 内容 |
|------|------|
| 服务名 | `config` |
| 核心动作 | get/set/batchSet/reset |
| 输入基线 | key/value |
| 输出基线 | ack/snapshot |
| 幂等性 | get 幂等 |
| 权限边界 | `config.read` / `config.write` |
| 典型错误 | `CONFIG_KEY_INVALID` |

### 4. theme 服务

| 项目 | 内容 |
|------|------|
| 服务名 | `theme` |
| 核心动作 | list/apply/getCurrent/getAllCss/resolve/contract.get |
| 输入基线 | themeId/chain |
| 输出基线 | themeState/css |
| 幂等性 | list/get*/resolve 幂等 |
| 权限边界 | `theme.read` / `theme.write` |
| 典型错误 | `THEME_NOT_FOUND`, `THEME_CONTRACT_INVALID` |

**公开接口（固定6个）**：
```typescript
interface ThemeService {
  list(publisher?: string): Promise<ThemeMeta[]>;
  apply(id: string): Promise<void>;
  getCurrent(appId?: string, pluginId?: string): Promise<ThemeState>;
  getAllCss(): Promise<{ css: string; themeId: string }>;
  resolve(chain: string[]): Promise<ResolvedTokens>;
  contract.get(component?: string): Promise<ThemeContract>;
}
```

**运行时补充（2026-03-10）**：

- `theme.list/getCurrent/getAllCss/resolve/apply` 只面向当前工作区中“已启用”的主题插件，不再把“仅安装未启用”的主题视为可用主题；
- 主题插件发生 `install/enable/disable/uninstall` 后，Host 必须同步刷新 `state.themes` 与当前主题状态；
- `theme.apply` 成功后发布 `theme.changed` 事件，供 preload、应用壳层和复合卡片窗口统一刷新；
- `getAllCss` 返回值同时携带 `css` 与 `themeId`，供调用方建立显式主题快照。

### 5. i18n 服务

| 项目 | 内容 |
|------|------|
| 服务名 | `i18n` |
| 核心动作 | getCurrent/setCurrent/translate/listLocales |
| 输入基线 | locale/key |
| 输出基线 | locale/text |
| 幂等性 | get*/translate 幂等 |
| 权限边界 | `i18n.read` / `i18n.write` |
| 典型错误 | `I18N_KEY_MISSING` |

### 6. window 服务

| 项目 | 内容 |
|------|------|
| 服务名 | `window` |
| 核心动作 | open/focus/resize/setState |
| 输入基线 | windowConfig |
| 输出基线 | windowState |
| 幂等性 | focus 幂等 |
| 权限边界 | `window.control` |
| 典型错误 | `WINDOW_NOT_FOUND` |

**窗口主题补充（2026-03-10）**：

- 当调用方未显式传入 `chrome.backgroundColor`，且窗口不是透明窗口时，Host 应从当前主题解析结果中优先读取 `chips.sys.color.canvas`，其次读取 `chips.sys.color.surface` 作为原生窗口背景；
- 应用不能再通过硬编码白色背景覆盖主题系统。

### 7. plugin 服务

| 项目 | 内容 |
|------|------|
| 服务名 | `plugin` |
| 核心动作 | list/get/getSelf/getCardPlugin/getLayoutPlugin/install/enable/disable/uninstall/query |
| 输入基线 | pluginManifest |
| 输出基线 | pluginInfo / pluginRecord / status |
| 幂等性 | list/get/getSelf/getCardPlugin/getLayoutPlugin/query 幂等 |
| 权限边界 | `plugin.read` / `plugin.manage` |
| 典型错误 | `PLUGIN_INVALID`, `PLUGIN_PERMISSION_DENIED`, `PLUGIN_CONTEXT_MISSING` |

### 8. module 服务

| 项目 | 内容 |
|------|------|
| 服务名 | `module` |
| 核心动作 | mount/unmount/query/list |
| 输入基线 | `slot + module` |
| 输出基线 | `ack / moduleRecord / moduleRecord[]` |
| 幂等性 | query/list 幂等 |
| 权限边界 | `module.manage` |
| 典型错误 | `MODULE_CONFLICT` |

补充约束：

- `module.mount` 的正式输入是 `{ slot, module }`，不再使用 `moduleId` 简化形态；
- `query` 返回 `{ module: ModuleRecord | null }`，`list` 返回 `{ modules: ModuleRecord[] }`；
- 基础卡片编辑器宿主不再借用 `module` 服务承载。

### 9. platform 服务

| 项目 | 内容 |
|------|------|
| 服务名 | `platform` |
| 核心动作 | getInfo/getCapabilities/openExternal/dialog*/clipboard*/shell*/notificationShow/tray*/shortcut*/power*/ipc* |
| 输入基线 | none/url |
| 输出基线 | info/ack |
| 幂等性 | get* 幂等 |
| 权限边界 | `platform.read` / `platform.external` |
| 典型错误 | `PLATFORM_UNSUPPORTED` |

> 说明：Bridge 子域 `dialog/clipboard/shell` 在服务层统一映射为 `platform.*` 动作，不单独扩展新的服务域命名空间。

### 10. log 服务

| 项目 | 内容 |
|------|------|
| 服务名 | `log` |
| 核心动作 | write/query/export |
| 输入基线 | record/filter |
| 输出基线 | ack/bundle |
| 幂等性 | list/get/getSelf/getCardPlugin/getLayoutPlugin/query 幂等 |
| 权限边界 | `log.write` / `log.read` |
| 典型错误 | `LOG_EXPORT_FAILED` |

### 11. credential 服务

| 项目 | 内容 |
|------|------|
| 服务名 | `credential` |
| 核心动作 | get/set/delete/rotate |
| 输入基线 | secretRef |
| 输出基线 | secret/meta |
| 幂等性 | get 幂等 |
| 权限边界 | `credential.manage` |
| 典型错误 | `CREDENTIAL_DENIED`, `CREDENTIAL_EXPIRED` |

### 12. card 服务

| 项目 | 内容 |
|------|------|
| 服务名 | `card` |
| 核心动作 | parse/getBaseCard/render/renderBaseCardEditor/validate/updateBaseCard |
| 输入基线 | `cardFile / nodeId / config` |
| 输出基线 | `ast / baseCard / view / editor` |
| 幂等性 | parse/getBaseCard/validate 幂等 |
| 权限边界 | `card.read` / `card.write` |
| 典型错误 | `CARD_SCHEMA_INVALID` |

**卡片渲染补充（2026-03-10）**：

- `card.render` 生成复合卡片和基础卡片文档时，必须同时注入主题包 CSS 与解析后的变量；
- 渲染服务不得追加固定 `color-scheme: light` 或其他会覆盖主题包色彩模式声明的样式；
- 复合卡片主题变更后的刷新由上层窗口组件基于主题运行时缓存键触发，`card` 服务负责输出纯净、可重建的主题化文档。
- `card.getBaseCard` 必须返回标准化后的基础卡片编辑模型：`{ nodeId, cardType, pluginId, title, contentPath, config }`。
- `card.renderBaseCardEditor` 必须返回可直接写入 iframe `srcdoc` 的宿主文档，并携带 `protocolVersion` 与对应 `baseCard` 元信息。
- `card.updateBaseCard` 继续承担“单个基础卡片配置编辑”的高层语义写链路。
- 对 EditingEngine 这类基础设施级应用，若已获得 `file.manage` + `zip.manage`，允许按正式文件格式直接完成 `.card` 的解包、结构改写、内容写回、`metadata.yaml.modified_at` 更新与重新打包；Host 不要求再为每个结构动作追加专用业务 route。
- 普通业务插件仍不得绕过正式文件格式规范私改压缩包内容；直接文件编排只面向承担文档治理责任的基础设施级应用。
- 基础卡片编辑器 iframe 消息协议冻结为：
  - 子 iframe -> 宿主：`chips.basecard-editor:ready / config-change / config-synced / fatal-error`
  - 宿主 -> 子 iframe：`chips.basecard-editor:sync-config`

### 13. box 服务

| 项目 | 内容 |
|------|------|
| 服务名 | `box` |
| 核心动作 | pack/unpack/inspect |
| 输入基线 | inputPath |
| 输出基线 | artifact/meta |
| 幂等性 | inspect 幂等 |
| 权限边界 | `box.pack` |
| 典型错误 | `BOX_FORMAT_INVALID` |

### 14. zip 服务

| 项目 | 内容 |
|------|------|
| 服务名 | `zip` |
| 核心动作 | compress/extract/list |
| 输入基线 | files / path |
| 输出基线 | zip/meta/entries |
| 幂等性 | list 幂等 |
| 权限边界 | `zip.manage` |
| 典型错误 | `ZIP_CORRUPTED` |

### 15. serializer 服务

| 项目 | 内容 |
|------|------|
| 服务名 | `serializer` |
| 核心动作 | encode/decode/validate |
| 输入基线 | payload + schema |
| 输出基线 | bytes/object |
| 幂等性 | decode/validate 幂等 |
| 权限边界 | `serializer.use` |
| 典型错误 | `SERIALIZE_FAILED` |

### 16. control-plane 服务

| 项目 | 内容 |
|------|------|
| 服务名 | `control-plane` |
| 核心动作 | health/check/metrics/diagnose |
| 输入基线 | scope |
| 输出基线 | report |
| 幂等性 | 幂等 |
| 权限边界 | `control.read` / `control.write` |
| 典型错误 | `CONTROL_TIMEOUT` |

---

## 服务实现模板

### 目录结构
```
services/
├── file/
│   ├── types.ts        # 输入输出类型
│   ├── constants.ts    # 动作名/错误码
│   ├── service.ts      # 注册与实现
│   └── *.test.ts       # 单元测试
└── ...
```

### types.ts 示例
```typescript
// 输入类型
interface FileReadRequest {
  path: string;
  encoding?: 'utf-8' | 'binary';
  options?: FileReadOptions;
}

// 输出类型
interface FileReadResponse {
  content: string | Buffer;
  meta: FileStat;
}

// 动作定义
interface FileActions {
  read: {
    request: FileReadRequest;
    response: FileReadResponse;
  };
  write: {
    request: FileWriteRequest;
    response: FileWriteResponse;
  };
}
```

### constants.ts 示例
```typescript
// 服务名
export const SERVICE_NAME = 'file';

// 动作名
export const ACTIONS = {
  READ: 'file.read',
  WRITE: 'file.write',
  STAT: 'file.stat',
  LIST: 'file.list',
  EXISTS: 'file.exists',
  MKDIR: 'file.mkdir',
  DELETE: 'file.delete',
  COPY: 'file.copy',
  MOVE: 'file.move',
} as const;

// 错误码
export const ERRORS = {
  NOT_FOUND: 'FILE_NOT_FOUND',
  PERMISSION_DENIED: 'FILE_PERMISSION_DENIED',
  INVALID_PATH: 'FILE_INVALID_PATH',
} as const;
```

### service.ts 示例
```typescript
import { Kernel } from '@chips/kernel';
import { SERVICE_NAME, ACTIONS, ERRORS } from './constants';
import type { FileReadRequest, FileReadResponse } from './types';

export function register(kernel: Kernel) {
  kernel.registerService({
    name: SERVICE_NAME,
    actions: {
      [ACTIONS.READ]: {
        schemaIn: 'schemas/file.read.request.json',
        schemaOut: 'schemas/file.read.response.json',
        permission: ['file.read'],
        timeoutMs: 5000,
        idempotent: true,
        retries: 0,
        handler: async (input: FileReadRequest, ctx): Promise<FileReadResponse> => {
          // 实现逻辑
        },
      },
    },
  });
}
```

---

## 验收标准

### 服务域验收
- 16个服务域完整实现
- 每个服务动作面符合清单规范

### 契约验收
- 每个服务导出 types.ts/constants.ts/service.ts
- 每动作存在同名契约测试 `<action>.contract.test.ts`
- 输入输出符合JSON Schema

### 低颗粒度接口补充约束（2026-03-11）

- Host 在 `file`、`zip` 等基础服务域优先提供稳定的底层能力面，而不是按编辑引擎每一个交互动作拆 route；
- 编辑引擎、资源管理器等基础设施级应用应在应用层完成业务编排，在 Host 层复用统一文件/压缩/渲染服务；
- 当服务域声明 `namespace.manage` 时，`namespace.manage` 自动覆盖该命名空间下的精确权限检查；
- 该粗粒度权限只用于承担生态底层治理责任的应用，不改变普通插件最小权限原则。

### 权限验收
- 权限边界清晰
- 最小权限原则遵循

### 幂等性验收
- 幂等动作正确标注
- 防重放策略定义

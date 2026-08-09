# 03 Host、SDK、Bridge 收口方案

## 1. 目标

应用开发简单的前提不是让应用绕过 Host，而是让 Host 的正式能力有一个稳定、可发现、可测试的调用门面。第二阶段不改变 Host 是唯一运行时承载这一红线，只把重复接线收回到共享门面和 SDK 正式入口。

## 2. Host 侧任务

### 2.1 固定插件 session 初始化顺序

每个 app surface 必须按以下顺序初始化：

1. 解析并校验 `manifest.yaml`；
2. 校验 runtime target、surface kind、权限和 capabilityFallbacks；
3. 创建 plugin session 和 surface state；
4. 生成不可变的 `PlatformLaunchContext`；
5. 安装最小权限 Bridge；
6. 注入默认主题或主题包 CSS；
7. 加载页面入口；
8. 页面关闭时发送 `surface.closed`，然后清理 command、event、resource URL 和 session。

上述顺序必须由 Host 集成测试锁定，应用不再自己猜测 `surfaceId`、`sessionId`、主题版本或启动参数来源。

### 2.2 Bridge 契约

继续使用 `window.chips.*` 的正式入口：

- `invoke(action, payload?)`；
- `invokeScoped(action, payload, { token })`；
- `on/once` 返回取消订阅函数；
- `emit/emitScoped` 返回 `Promise<void>`；
- 错误保留 `code/messageKey/requestId/traceId/permission/retryable`。

第二阶段需要补齐的是消费体验，而不是增加第二套 action：

1. 对所有页面侧常用 action 生成 SDK typed API；
2. 给每个 action 生成 permission、timeout、retryable 和错误码元数据；
3. 让 `chipsdev validate` 检查应用声明的权限覆盖其实际 SDK API 使用；
4. 在 mock Host 中复现成功、拒绝、超时、重试、surface 关闭和事件取消。

### 2.3 command 收口

Host command registry 是唯一语义源。command 记录必须继续使用正式字段：

```ts
interface CommandDefinition {
  commandId: string;
  titleKey: string;
  descriptionKey?: string;
  ariaLabelKey?: string;
  icon?: IconDescriptor;
  shortcut?: CommandShortcut | CommandShortcut[];
  scope?: CommandScope;
  permission?: string | string[];
  handlerId: string;
  menuPlacement?: CommandMenuPlacement[];
  toolbarPlacement?: CommandToolbarPlacement[];
  paletteKeywords?: string[];
}
```

应用内部可以使用中文 key 到文案 bundle 的静态映射；不得把 `title` 原始字符串作为 Host command schema 的第二种形式。`@chips/ui` 负责将定义转换为菜单、工具栏、命令面板和上下文菜单的 UI，但不拥有跨应用 command registry。

运行时要求：

- 注册成功后保存 `commandId` 和 `sessionId`，组件卸载或 surface 关闭时注销；
- 同一 `commandId` 重复注册时显式失败，不静默覆盖；
- Host 只校验 owner、scope、权限和状态，不执行页面函数；
- 页面收到 `command.invoked` 后根据 `handlerId` 分发本地 handler；
- 快捷键在输入框、文本编辑区和 IME 组合状态下不能误触发；
- 所有 shortcut listener 统一由一个 Provider 安装，禁止每个按钮注册 window listener。

### 2.4 Theme Runtime 的收口

如果 M0-D2 通过，Host 继续拥有主题运行时：

- `theme.list/apply/getCurrent/getAllCss/resolve/contract.get` 为唯一正式 route；
- Host 负责主题包安装、manifest 校验、作用域、父主题、回退和版本；
- 页面默认不调用 `theme.*`，只消费 Host 注入的 CSS 和 `@chips/ui` 解析后的 ConfigProvider；
- 具备治理权限的设置面板才能查询或切换主题；
- iframe、卡片、布局文档必须注入完整主题 CSS（包括 `@font-face`），不能只注入 token 变量；
- Theme Runtime 失败时回退到已验证的默认主题，并输出标准诊断，不让页面白屏。

如果 M0-D2 不通过，Host 仍应保留一个内部默认主题注入能力，避免各应用自己写 CSS；只是关闭外部主题插件安装入口。

### 2.5 Host 可观测性

每个 surface 和 route 日志至少包含：

```text
traceId, requestId, pluginId, sessionId, surfaceId,
namespace, action, durationMs, result, errorCode
```

必须能从应用测试失败追溯到 Host route，而不是只看到页面“加载失败”。`chipsdev doctor` 和设置面板诊断入口应展示当前 surface、主题、command 注册和最近一次 Bridge 错误摘要。

## 3. SDK 侧任务

### 3.1 SDK 只做类型化封装

保留 `createClient`、domain API、错误归一、transport 选择和 testing mock。禁止：

- 在 SDK 中启动 React Provider；
- 在 SDK 中注入 CSS 或实现主题解析；
- 在 SDK 中维护 command UI；
- 在 SDK 中读取 Electron/Node 私有对象；
- 用 SDK 的“便利方法”绕开 route manifest、权限和 Host service。

### 3.2 SDK API 分层

```text
chips-sdk
├── api/        # Client domain API，正式协议封装
├── contracts/  # action、error、manifest、theme、command 类型
├── testing/    # mock Host/client/Bridge/event/error
├── tooling/    # chipsdev validate/inspect/doctor/generate
└── index       # 公开稳定入口，避免使用内部路径
```

所有新增 API 必须同时添加：输入输出类型、权限说明、标准错误、mock Host 分支、单元测试、公共文档入口和 changelog 记录。

### 3.3 `@chips/ui` 的 client 注入方式

应用入口只出现一次：

```tsx
import { createClient } from "chips-sdk";
import { mountChipsApp } from "@chips/ui/app";
import { App } from "./App";

mountChipsApp({
  client: createClient({ environment: "auto" }),
  render: <App />,
});
```

`mountChipsApp` 内部负责：

1. `ConfigProvider`、antd locale、默认 `appleTheme`；
2. `ChipsProvider`、launch context 和 Browser no-Host 状态；
3. `CommandProvider`、统一 shortcut listener 和命令面板；
4. 应用级 Error Boundary、loading/empty/error 约定；
5. 页面卸载时统一清理事件、命令和资源。

应用若有特殊治理权限，可以显式传入 `runtime` 配置，但必须通过 `@chips/ui/app` 的 typed option，不得重新复制 Provider 树。

### 3.4 Browser 和测试运行态

`environment: "auto"` 在 Host 页面使用 Bridge，在普通浏览器/单测中使用空能力或测试 transport。无 Host 状态必须是明确的 `capabilities`，而不是捕获异常后让业务继续假设能力存在：

```ts
interface ChipsRuntimeCapabilities {
  host: boolean;
  platform: "desktop" | "web" | "mobile" | "headless";
  actions: ReadonlySet<string>;
}
```

需要系统能力的页面必须显示受控空态或禁用操作，并通过标准错误码告诉用户原因。

## 4. 文件级落点

| 位置 | 工作 |
|---|---|
| `Chips-Host/src/preload/` | 核对 Bridge 最小权限、事件清理、主题完整 CSS 注入和 command 生命周期 |
| `Chips-Host/src/runtime/` | 固定 session/surface 生命周期、route 元数据和诊断字段 |
| `Chips-SDK/src/api/` | 补齐 typed API、command/theme/surface 类型和错误 |
| `Chips-SDK/src/testing/` | 成功/拒绝/超时/事件/主题/command mock |
| `Chips-SDK/src/tooling/` | manifest 权限审计、theme inspect、生成验证和 doctor |
| `Chips-Ui/src/runtime/` | `mountChipsApp`、runtime capabilities、命令 Host adapter |
| `Chips-Ui/src/components/` | AppChrome、StateBoundary、嵌入容器等生态特有组合 |
| `Chips-Scaffold/chips-scaffold-app/` | 只保留薄入口和业务示例，删除重复运行时模板 |
| `生态共用技术文档/` | 工单134闭环后更新正式公共入口 |

## 5. 收口验证

必须用真实链路验证：

1. `chipsdev-r create app` 生成工程；
2. 生成工程执行 `npm run typecheck`、`npm test`、`npm run build`、`npm run validate`、`npm run package`；
3. `chipsdev-r run` 在真实 Host surface 中打开；
4. 调用一次 `platform.getInfo`、一次受限 action、一次 command register/invoke；
5. 关闭 surface 后检查事件取消、命令注销和资源释放；
6. 在普通浏览器 preview 中检查 no-Host 态。


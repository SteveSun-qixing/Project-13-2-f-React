Deepseek Harness的设计哲学，架构设计特点，技术设计方法

DeepSeek Harness 的设计哲学、架构特点与技术方法，共同指向一个核心目标：**构建一个能够自我进化（Self-Evolving）的 Agent 运行时**。其核心主张是 **“一切皆插件”（Everything is a Plugin）**，旨在将传统 Harness 的固定结构彻底解耦，实现极致的灵活性与可扩展性。

### 🧠 设计哲学：一切皆插件

DeepSeek Harness 的设计哲学是对传统 Agent 框架的一次根本性重塑。它不满足于仅将工具作为插件，而是将**模型适配器、工具注册表、会话日志，乃至 Agent 主循环（Agent Loop）本身**全部设计为可插拔的组件。这意味着框架中不存在一个“不可修改的特权核心”，整个 Harness 就是由插件拼装而成，为 Agent 在运行过程中生成、替换自己的组件（即“自进化”）奠定了基础。

这一哲学的背后，是解决一个被忽视的根本问题：**动态组合的可靠性**。如果 Agent 要修改自己的运行时，那么修改后必须能够安全地“撤销”和“重组”。为此，DeepSeek 与北京大学合作发表了论文《一套处理时空可组合性的编程范式》，其核心正是 **Cordis 元框架**，它解决了两个关键难题：

- **时间可组合性 (Temporal Composability)**：确保插件卸载时，其产生的所有副作用（如事件监听、资源占用）能被完整撤销，如同“后悔药”一般。
- **空间可组合性 (Spatial Composability)**：解决组件间的动态依赖问题，当某个服务被替换或消失时，依赖它的组件能自动协调生命周期。

### 🏗️ 架构设计特点：基于 Cordis 的插件树

DeepSeek Harness 的架构建立在 Cordis 插件系统之上，形成了一棵可动态配置的“插件树”。

**分层装配架构**
运行实例并非写死的模块，而是通过 **Profile、Bundle 和 Patch** 逐层合成：

- **Profile**：具名部署组合（如 Web、Headless），声明需要加载的 Bundle。
- **Bundle**：可分发的配置层，包含配置行和对应的插件代码，提供通用能力（模型、工具、会话等）。
- **Patch**：允许在部署时替换、插入或修改配置行，实现无需 Fork 源码的灵活定制。

**三大核心机制**
支撑这一架构的关键机制包括：

1. **可逆副作用 (Reversible Effects)**：这是 Cordis 的纪律性要求。插件对系统的任何修改（服务注册、事件监听）都会被记录，卸载时可逐层撤销，解决了传统插件框架常见的状态残留与“系统变脏”问题。
2. **服务/事件协作 (Service/Event Collaboration)**：插件间通过声明式的**服务**进行能力依赖，通过**类型化事件**进行跨插件协作和策略拦截。所有生命周期事件都是可监听的扩展点，为干预 Agent 行为提供了明确入口。
3. **作用域与预设复用 (Scope & Preset)**：通过 **Scope 作用域隔离**，同一进程内可以运行多个拥有不同人格、提示词和工具集的 Agent。Agent 的插件挂载在自己的 `agent.ctx` 中，实现了能力的精细化隔离与复用。

### ⚙️ 技术设计方法：面向长任务的可靠性

在“一切皆插件”的架构之上，DeepSeek Harness 针对长任务可靠运行的核心痛点，采用了系统化的设计方法。

**可替换的 Loop 机制**
为了应对不同场景，Harness 提供了多套执行机制，而非一个通用的 Loop：

- **基础 Agent Loop**：驱动默认的轮次与步骤执行。
- **Goal Round**：在当前会话中持续执行，保留完整的对话上下文。
- **Ralph Run**：由多个独立的子 Agent 轮次组成，不继承父级对话历史，通过共享工作区和结构化交接报告传递信息，适合需要“重新开始”的复杂任务。

**事件驱动的持久化状态**
会话状态通过**仅追加的、类型化的 SessionEvent 日志**来管理，这是系统唯一的真源。这种事件溯源（Event Sourcing）设计使得会话**完全可回放**，为长任务审计、调试和从崩溃中恢复提供了坚实基础。

**按需暴露的工具 Schema**
模型理解的“外部世界”完全由 Harness 暴露的工具 Schema 定义。工具的名称、描述、参数和返回结果共同构成了模型的行动空间。Harness 可以**按需动态暴露**工具，而非一次性加载全部工具，有助于在长任务中控制上下文长度和保持模型焦点。

**分层权限控制与多维验证**
针对无人值守任务，Harness 设计了分层权限控制，例如在特定预设模式下可启用“自动批准”结合 LLM 分类器作为工具调用的唯一关口。同时，它强调**多维验证体系**，明确将“测试全部通过且应用正常启动”等客观标准作为任务完成的依据，而非仅依赖 Agent 的自我声明，以解决“验收失真”问题。

### 💎 总结

DeepSeek Harness 的设计是一场围绕 **“动态可组合性”** 的深度工程实践。它以 **Cordis 元框架**为基石，通过**可逆副作用**和**作用域隔离**确保了“一切皆插件”架构的可靠性；再以**事件溯源日志**和**可替换的 Loop 机制**等方法，将这种架构优势转化为面向长任务的实际工程能力。其最终愿景，是让 Agent 能够像飞机在空中更换零件一样，在不停止服务的情况下，安全地修改和进化自身的运行时。

# DeepSeek Harness 架构

改动 `packages/` 下的任何内容之前，请先阅读本文。本文假定你已了解 Cordis；如果尚未了解，请先阅读[入门](https://deepseek-harness.github.io/deepseek-harness/reference/cordis-primer)或[教程](https://deepseek-harness.github.io/deepseek-harness/develop/cordis-tutorial/)。

建议使用 agent（智能体）探索代码库并理解其架构。

## Cordis

[Cordis](https://deepseek-harness.github.io/deepseek-harness/reference/cordis-primer) 是 dsh 底层的框架：插件向共享上下文贡献服务、类型化事件和可逆的副作用。产品的每一部分都是插件，包括模型适配器、工具注册表、会话日志，以及 agent loop（智能体循环）本身，因此每个都可以从配置替换。

不存在需要打补丁的特权内核：扩展 dsh 的方式是把插件挂载到其他插件旁边，而各项注册都是副作用，会在其插件卸载时撤销。

## Profile 与组合包

运行中的 `dsh` 是一棵插件树，由启动时按序叠加的各层组合而成。

**profile** 是存放在 Harness home 中的具名组装。它列出自己叠放的组合包，存放自己安装的树外插件，并保存用户自己的 `cordis.patch.yml`。`web`、`headless`、`sdk`、`sdk-minimal` 和 `acp` 作为模板随发行版交付。

**组合包**是 Cordis 配置项及其挂载代码的分发格式，因此它插入的内容始终可被其上各层 patch。

两者都在各自的 `package.json` 中通过 `dsh` 字段声明自己：`dsh.profile` 列出一个 profile 的组合包，`dsh.bundle` 指向一个组合包的 patch 文件。

[`dsh-base`](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/bundle/base/README.zh.md) 是 `web`、`headless`、`sdk` 与 `acp` profile 的共享第一层：模型适配器、工具、持久化、沙箱与审批策略、设置、凭据、遥测。[`dsh-web-app`](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/bundle/web-app/README.zh.md) 增加浏览器应用，[`dsh-headless`](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/bundle/headless/README.zh.md) 增加不带服务器的一次性运行器，[`dsh-sdk-app`](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/bundle/sdk-app/README.zh.md) 增加 SDK JSON-RPC 服务器，[`dsh-acp-app`](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/bundle/acp-app/README.zh.md) 增加仅用于自动化的 ACP 服务器。[`dsh-sdk-minimal`](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/bundle/sdk-minimal/README.zh.md) 是刻意保留的例外：一个组合包拥有完整的显式 SDK 配置树，不应用 `dsh-base`。

各层按此顺序应用在空条目列表之上：先按 profile 列出的顺序应用每个组合包，然后是 profile 的 `cordis.patch.yml`，然后是 home 级的那份，最后是任意 `--patch` overlay。一条 patch 按 id 定位某个条目并替换其整个 config，或插入新条目。

自定义 profile 默认实时重载 patch。随附的 `web` profile 使用实时重载；`headless`、`sdk`、`sdk-minimal` 和 `acp` 则只在启动时应用一次所有配置层，因为一次性应用或 stdio 应用拥有工作之后，替换其依赖会破坏该生命周期。

要查看你的机器启动的配置树：



```
dsh --profile web --dump-config
```

它打印出的任何条目，都可以由你自己的 patch 替换。

组装机制见 [app-boot](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/boot/app-boot/README.zh.md#profiles)；配置字段见生成的[配置目录](https://deepseek-harness.github.io/deepseek-harness/reference/config-catalog)。

## 应用启动

所有受支持的 Node 应用都从 `dsh` CLI 与具名 profile 启动。随附应用是 `dsh web`（刻意为 `--profile web` 保留的别名）、`dsh --profile headless`、`dsh --profile sdk`、`dsh --profile sdk-minimal` 与 `dsh --profile acp`。TypeScript SDK 会解析其同版本 `dsh` 依赖并选择 `sdk`；自定义插件组合继续由 profile 与有序 patch 文件表达，而不是另一个可执行文件或内联应用树。`sdk-minimal` 是位于同一 launcher 后的仓库自有独立组合包，而不是由调用方提供的 Cordis 配置树。

Vendored CLI、仅用于构建和测试的可执行文件、进程内直接挂载插件以及私有浏览器 WebWorker 预览都不属于 Harness 应用启动器。[`verify-application-entrypoints`](https://github.com/deepseek-ai/deepseek-harness/blob/master/scripts/verify-application-entrypoints.ts)将每个包 bin、可执行源码与根 demo 归入显式类别，并拒绝任何绕过 `dsh` 的 Node 应用路径。

Python SDK 遵循相同的应用架构。其运行时 wheel 把普通 `dsh` CLI 打包为 `deepseek-harness-sdk-runtime-<platform>-<arch>`，客户端默认以显式 Harness home 启动 `dsh --profile sdk`。极简示例选择随附的 `sdk-minimal` profile。Python 暴露 profile 选择与有序 patch 文件，而不是完整 Cordis 树；持久外部插件通过 `dsh plugin` 安装。已删除的私有直读配置载体没有兼容 bin 或回退 parser。

## 桌面应用

[Electron 桌面应用](https://github.com/deepseek-ai/deepseek-harness/blob/master/apps/desktop/README.zh.md)持有保留的 `$DSH_HOME/profiles/desktop` npm 项目。每个签名 Electron 发行版绑定一个确切 dsh 版本并携带第一方离线 seed；启动时通过内置 pnpm 把该版本安装进可写 profile，同时保留旧 profile 中桌面插件的确切版本。CLI profile 与 Desktop 共享 `$DSH_HOME` 下受支持的产品数据，但绝不共享可执行包、插件激活、lockfile 或 `node_modules`。

Electron 通过内置的上游 Node.js 进程启动私有 Desktop Host 包；该包从保留 profile 加载已安装的 dsh 后端与匹配的客户端图。一元 RPC、Remote stream 与版本匹配的客户端资源经带版本的分帧字节管道传输，Node IPC 只保留生命周期控制，再通过安全的 `dsh-app://` 协议到达渲染进程；因此桌面组合不会开放 Web server 或 loopback 端口。只有壳自有 UI 能通过内置 pnpm 及其私有 `$DSH_HOME/desktop/pnpm/store` 执行插件事务。

## 核心包

以下是向 Cordis 树贡献内容的部分核心包。

| 包                                                           | 职责                                             | `ctx` 键             |
| :----------------------------------------------------------- | :----------------------------------------------- | :------------------- |
| [`core/session`](https://deepseek-harness.github.io/deepseek-harness/reference/subsystems/session) | 仅追加的 `SessionEvent` 日志和内存存储           | `ctx.sessions`       |
| [`core/system-prompt`](https://deepseek-harness.github.io/deepseek-harness/reference/subsystems/system-prompt) | 提示词片段与工具 schema 的组装                   | `ctx.systemPrompt`   |
| [`core/tools`](https://deepseek-harness.github.io/deepseek-harness/reference/subsystems/tools) | 作用域化的工具注册表和带把关的执行流水线         | `ctx.tools`          |
| [`core/agent`](https://deepseek-harness.github.io/deepseek-harness/reference/subsystems/core) | `Agent` 接口、活跃 agent 注册表和 `agent/*` 事件 | `ctx.agents`         |
| [`core/agent-loop`](https://deepseek-harness.github.io/deepseek-harness/reference/subsystems/core) | 实现该接口的默认驱动器                           | `ctx.agentLoop`      |
| [`core/scope`](https://deepseek-harness.github.io/deepseek-harness/reference/subsystems/scope) | 按 agent 划分作用域的注册原语                    | 库，无 ctx 键        |
| [`llm/llm`](https://deepseek-harness.github.io/deepseek-harness/reference/subsystems/llm-streaming) | 消息与流式词汇表，以及适配器 seam                | `ctx.llm`            |
| [`webhook/webhook`](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/webhook.zh.md) | 已认证 delivery 的分派和 Workspace Session 创建  | `ctx.webhookRuntime` |



## 事件

事件就是扩展点，而选对事件域是大多数改动的第一个决定。

- **会话事件**是追加到日志并通过 `session/event` 广播的持久事实。当某个事实必须在重新加载后仍然存在时，使用它。
- **Agent 事件**（`agent/*`）携带活跃 `Agent`：inbox、步骤、状态、请求、验证、续跑。要观察或拦截进行中的工作时，使用它。
- **能力事件**无需导入循环即可向某个 seam（`fs/*`、`tools/*`、`telemetry/*`）附加策略和适配器。

[事件映射](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/event-producer-consumer.zh.md)列出每个事件的生产方与消费方。



## 轮次流程

一个**步骤**是一次模型请求加上它调用的工具。一个**轮次**包含零个或多个步骤：它在领取首条输入之前打开，并在不再欠下任何工作时关闭。



```
turn/start
  claim next-step input plus one queued message
  assemble prompt sections + tool schemas; project runtime context
  -> agent/pre-step                   reject | enter(messages, startsRequestSeries?)
     reject, or a first enter rewritten empty -> close the turn with no step
     step/start
     agent/request -> prepareCall (cancellation commits neither system nor users)
     reconcile system/message using the prepared call capability
     append entered messages as user/message; log request/header and request/context as needed
     derive and freeze model history from the log
     stream the bound prepared call -> llm/stream -> agent/assistant-stream start
       agent/assistant-stream chunk*
       assistant/message | assistant/attempt -> agent/assistant-stream end
     tool/call* -> tools/pre-execute -> tools/execute -> tools/post-execute -> tool/result*
     step/end
     tools owe another request, or next-step input arrived -> claim -> next step
  -> agent/turn-stopping
turn/end
```

`turn/*`、`step/*`、`system/message`、`user/message`、`assistant/message`、`assistant/attempt` 和 `tool/*` 是持久会话事件；其余是分属三个事件域的实时扩展点。`agent/assistant-stream` 发布进程本地 start、瞬态 chunk 与 end frame。loop 会在 committed end frame 前把完整紧凑 stream 提交为一个 message 或仅日志 attempt；Web Session-follow adapter 是该 live event 唯一的远程消费方。`agent/pre-step`、`agent/request`、`llm/stream` 和三个 `tools/*` 事件是 waterfall（瀑布式事件），其监听器必须调用 `next()` 才能委托下去；`agent/turn-stopping` 是 serial 事件，没有 `next()`。

输入通过同一个 inbox 到达驱动器。有些消息会立即唤醒它；注入的上下文会留在 inbox 中，直到另一条消息将其唤醒。

`agent/pre-step` 决定接纳的输入。监听器可以改写或拒绝已领取消息；首次领取被拒绝或为空时，关闭不含步骤的持久轮次。enter 决策可设置 `startsRequestSeries`：循环记录新的 `request/header`（原因为 `series`，或在封装同时变化时为携带 `startsSeries: true` 的 `change`）。包装监听器通过 `{ ...decision, messages }` 保留该声明。组装与 `step/start` 之后，`agent/request` 和 `prepareCall()` 先解析实际路由，再提交系统提示词与已接纳用户消息；在任一异步阶段取消都不会提交这两者。提示词准入依据已准备调用的能力，而非先前的 `request/context`。每次尝试同步协调同一份已渲染组装结果、仅在首次尝试追加用户消息、按需记录 header/context、派生并冻结请求，再通过绑定调用发起流式请求。重试不重复组装或 `agent/pre-step`。附接后的 surface 替换开启新请求序列，包括恢复后的首次 pre-step 中发生的替换；未变化的恢复延续序列。首次接纳的步骤在用户消息之前预留系统头节点，即使提示词为空（不产生协议消息）。提示词仅通过 `system/message` 历史传递：空渲染文本清除所有生效的系统节点，模型不再看到旧提示词；具备能力的路由可在缓存前缀之后追加非空更新；不具备能力的路由与新请求序列将非空提示词文本归并到首个系统节点，并为非空的后续系统节点记录空内容替换（[决策](https://github.com/deepseek-ai/deepseek-harness/blob/master/.agents/notes/implemented/architecture/2026-09-02-system-prompt-as-surface-node.zh.md)；[决策规则](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/core/agent-loop/README.zh.md#understand-the-implementation)）。

循环发送不可变请求，同时保留实时取消能力。只有已由该循环完整冻结的消息对象身份才能复用冻结证明；[agent-loop](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/core/agent-loop/README.zh.md)拥有请求构造规则。

详情见[时序图](https://deepseek-harness.github.io/deepseek-harness/reference/agent-lifecycle)、[工具流水线](https://deepseek-harness.github.io/deepseek-harness/reference/tool-execution-pipeline)和[取消与错误恢复](https://deepseek-harness.github.io/deepseek-harness/reference/subsystems/core#the-agent-handle)。

## 会话日志

会话日志是模型所见上下文的来源。`deriveMessages()` 从中投影出模型历史。每个 `assistant/message` 都嵌入产生其组装内容的精确紧凑带时间 stream；`assistant/attempt` 保留已到达 settlement 的失败、重试、取消与 stream error attempt，且不添加模型历史。fork、恢复、transcript（文本记录）、遥测与持久化都从这些持久 settlement 派生，实时 UI 增量则来自 `agent/assistant-stream`；如果进程在 settlement 前硬中断，则不会留下持久 attempt stream（见[决策](https://github.com/deepseek-ai/deepseek-harness/blob/master/.agents/notes/implemented/architecture/2026-09-01-v2-embedded-assistant-streams.zh.md)）。

Session 消费方只了解当前逻辑格式。仅 header 的 `stat` 与 `list` 会重新扫描每个 Session 目录，选择数值最高的规范 generation，并在不加载事件或发布后继的情况下转换受支持的历史 header。已存储 Session 的 `open` 选择同一 generation，拒绝未来版本，或只 Decode 并组合一次构建时静态确定的相邻迁移链，再返回经过校验的当前逻辑事件。只读 open 直接使用这份内存结果，不发布后继；写 open 则先编码、校验并在未改变源的旁边排他发布最终版本命名的后继。未被后续事件封住的普通中断尾部仍由句柄消费方修复；只有在后续 `turn/start` 已经封住一种有限的已发布 restart 时，migration 才会插入缺失的 interrupted `turn/end`。JSONL v0 使用 `session.jsonl[.zstd]`，v1 及后续版本使用小写 `session.vN.jsonl[.zstd]`；已提交 generation 路径绝不重命名、替换或删除。JSONL provider 负责物理 framing、压缩、generation 选择与排他发布，每个相邻迁移包只负责一个 `vN -> vN+1` 步骤（[决策](https://github.com/deepseek-ai/deepseek-harness/blob/master/.agents/notes/implemented/architecture/2026-08-31-released-session-format-migrations.zh.md)）。

**模型可见即已记录。** 抵达模型请求的一切都必须能从日志重建，并由一项运行时不变量断言这一点。因此，新增一项模型可见输入就需要新增一个会话事件：扩展 `SessionEventMap` 并从日志渲染。

**投影 seam。** `dsh-session-projection` 提供 `ctx.sessionProjections`：已注册单元增量折叠已提交事件，host 消费方通过 `stateOf()` 读取单个类型化状态，载体通过 `snapshot()` 批量取得裁剪后的客户端视图。host 读取方要么在激活时要求该服务，要么在注册表或必需 key 缺席时明确失败。贡献方可以保留 `ctx.inject(['sessionProjections'], ...)` 注册，但不能为缺失的 host 值静默提供默认值。agent loop 为读取方注册共享的 `turnBoundary` 状态（[决策](https://github.com/deepseek-ai/deepseek-harness/blob/master/.agents/notes/implemented/architecture/2026-08-19-session-projection-mandatory-seam.zh.md)）。

## 能力 seam

一个 **seam** 是一项可替换能力，包含三种角色：声明接口的 **Service Definition**、实现它的 **Service Provider**，以及使用它的 **Consumer**（通常是面向模型的工具）。一个包可以合并承担多个角色，但单一角色本身不是 seam；添加一项能力意味着把三者一并设计（[能力图](https://deepseek-harness.github.io/deepseek-harness/reference/capability-seams)）。

seam 正是替换一个提供方就能改变整个产品的原因。文件系统与进程提供方共享同一个执行世界，因此把它们指向远程沙箱，也就把 Bash、PTY 和 LSP 一并搬了过去，无需提供方专用 fork。[subagent 提供方](https://deepseek-harness.github.io/deepseek-harness/reference/subsystems/subagent)在同一个接口之后同样千差万别，从新建一个子 agent，到把一个轮次委派给另一个产品。

[实验性 Agent Teams](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/agent-team.zh.md) 是 `ctx.agentTeams` 上公开发布、显式启用的协作 seam，在可继续 subagent 之上提供持久 roster、任务板和 mailbox。

## 新行为的归属位置

新行为附加到已有文档记录的扩展点。改动循环本身时，本映射随之更新。

| 目标                         | 机制                                                         |
| :--------------------------- | :----------------------------------------------------------- |
| 添加模型提供方               | 在 `ctx.llm` 上注册其适配器                                  |
| 添加面向模型的能力           | 在 `ctx.tools` 上注册；其 schema 加入提示词组装              |
| 让某个会话拥有不同的能力集合 | 组装一个 agent preset；其中的服务行需要 `isolate` realm      |
| 添加 shell 执行              | 注册 `ctx.shell` 后端；本地后端通过 `ctx.subprocess` spawn 进程 |
| 添加持久化终端执行           | 注册 `ctx.terminals` 后端和 `dsh-tool-terminal`              |
| 添加用户命令                 | 在 `ctx.commands` 上注册；它无需模型轮次即可分派             |
| 添加后台工作                 | 在 `ctx.jobs` 上注册；`job_*` 工具负责收集或停止             |
| 从外部 webhook 启动 Session  | 在 `ctx.webhookRuntime` 上注册可信规则，并挂载提供方适配器   |
| 添加文件系统访问或策略       | 注册 `ctx.fs` 提供方，或监听 `fs/*` 事件                     |
| 限制所启动的进程             | 使用 `ctx.sandbox` 后端；消费方在启动进程前包装 argv         |
| 拦截请求、工具或轮次         | 使用相应的 `agent/*` 或 `tools/*` 事件；`agent/turn-stopping` 会停止轮次 |
| 添加模型可见上下文           | 调用 `agent.inject()`；它会落到下一次获准的请求中            |
| 添加 UI 或编辑器集成         | 驱动 `ctx.agents` 并从 `session/event` 渲染                  |
| 添加 Web Client Chat 节点    | 注册 `ConversationNodeDefinition` + keyed renderer           |
| 添加持久会话状态             | 扩展 `SessionEventMap`；从日志渲染和回放                     |
| 生成会话标题                 | 注册唯一的 `ctx.sessionTitle` 提供方                         |
| 管理同会话目标               | 使用 `ctx.goals`；通过 `agent/*` 续跑                        |
| 在轮次边界 fork 会话         | `ctx.agents.create({ sessionId, seed, meta: { parentSession, seedLength } })`——只有经 agent-loop 发布的会话才会持久化 |
| 在新后端存储会话             | 基于共享的句柄脚手架实现 `SessionPersistence`（`create`/`open`/`stat`/`list`/`export`） |
| 将注册项限定到单个 agent     | 使用该 agent 的 `agent.ctx`                                  |

[扩展实操手册](https://deepseek-harness.github.io/deepseek-harness/reference/cookbook/extension-cookbook)将功能映射到能力，并索引[包](https://deepseek-harness.github.io/deepseek-harness/reference/cookbook/adding-a-package)、[工具](https://deepseek-harness.github.io/deepseek-harness/reference/cookbook/adding-a-tool)、[LLM（大语言模型）适配器](https://deepseek-harness.github.io/deepseek-harness/reference/cookbook/adding-an-llm-adapter)和[设置卡片](https://deepseek-harness.github.io/deepseek-harness/reference/cookbook/adding-a-settings-card)的分步指南。[Conversation 子系统](https://deepseek-harness.github.io/deepseek-harness/reference/subsystems/conversation)负责 Chat node 组装。



# Cordis 入门

Cordis 是 DeepSeek Harness 底层以 vendor 方式引入的插件框架。本文介绍 harness 插件作者在阅读[子系统页面](https://deepseek-harness.github.io/deepseek-harness/reference/subsystems/core)上生成的服务/事件参考之前需要了解的 Cordis 核心概念；[Cordis 教程](https://deepseek-harness.github.io/deepseek-harness/develop/cordis-tutorial/)则通过实践逐一讲解这些概念。vendor 源码与同步流程见 [vendor/README.md](https://github.com/deepseek-ai/deepseek-harness/blob/master/vendor/README.md)。

## 五个核心概念

- **插件是实现 Service 的对象。** 它可以是一个带有可选 `inject` 和 `apply(ctx)` 字段的函数，也可以是一个 `Service` 子类，其生命周期由 Cordis 挂载到当前上下文中。
- **上下文是服务的容器。** 一个服务占据一个稳定的 `ctx.<key>`（如 `ctx.tools`、`ctx.llm`、`ctx.sessions`）；其他插件通过 key 查找服务，而非导入具体实现。
- **通过 `inject` 声明服务依赖。** 插件声明所需的服务后，会等待这些服务就绪才启动；加载顺序通过服务依赖表达，而非手动编排启动序列。
- **类型化事件用于通信。** 服务通过 TypeScript 声明合并注册事件名，然后以 `emit`、`waterfall`（瀑布式事件）、`parallel`、`serial` 或 `bail` 方式分发，分别对应监听者观察、包装、并行扇出、按序执行或停在首个 bail 值。
- **注册是可逆的副作用。** 提示词片段、工具 schema、适配器、提供方和监听器通过 `ctx.effect()` 或 `ctx.on()` 安装，reload 和 teardown 时会按预期撤销。



## 分发模式

每个事件具有以下分发模式之一，且只能通过对应方法分发。

| 模式        | 是否 await？ | 分发顺序                                         | 是否有返回值？ |
| :---------- | :----------- | :----------------------------------------------- | :------------- |
| `emit`      | 否           | 监听器按注册顺序观察                             | 否             |
| `waterfall` | 否           | 监听器按注册顺序观察                             | 是             |
| `parallel`  | 是           | 所有监听器并行观察事件                           | 否             |
| `serial`    | 是           | 监听器按注册顺序观察                             | 是             |
| `bail`      | 否           | 监听器按注册顺序观察，直到某个监听器返回 bail 值 | 是             |

分发模式是事件公开约定的一部分。新的 harness 事件通过 `@mode` 标签记录模式，以便生成的目录可以将声明与分发调用点做交叉校验。



## Cordis Waterfall 语义

`ctx.waterfall` 是环绕中间件。监听器接收 `(...args, next)`。调用 `next()` 会执行下游监听器；下游返回值通过 `next()` 返回当前包装层，可由该层包装后继续向外返回。不调用 `next()` 直接返回则短路。

协作式监听器通常修改一个共享的请求或决策对象，然后委托。监听器也可以选择完全替换结果，下游监听器将只看到替换后的结果。仅当监听器必须在普通注册之前运行时才使用 `prepend: true`。

对于单决策事件，短路是设计意图。策略监听器在拥有决策权时可以不调用 `next()` 直接返回，而仅做标注或观察的监听器则必须委托。



## Loader 配置

`@deepseek-ai/cordis-plugin-include` 将 `!!js` 解析为表达式节点。Loader 在声明的注入激活后，基于该插件上下文（`ctx.serviceName`）插值条目的 `config`，并在每次挂载决策时基于 loader 上下文插值其 `disabled` 字段；Include 会保留嵌套行表达式，直到目标行激活。其余条目元数据保持字面值。由环境选择插件时，请使用 overlay。

## 实践规则

将行为封装为插件：工具流水线事件属于 `ctx.tools`，模型流式输出属于 `ctx.llm`，实时 agent（智能体）协调属于 `ctx.agents`。拦截和策略优先使用事件；直接能力调用优先使用服务方法。

每个注册都应有对应的 disposer（资源释放函数）：要么从 `ctx.effect()` 返回一个，要么使用 Cordis 提供的辅助方法自动处理。如果 teardown 顺序有要求，请将相关工作放在同一个 effect 中，以确保资源按预期顺序释放。


相关参考链接：
https://deepseek-harness.github.io/deepseek-harness/develop/cordis-tutorial/
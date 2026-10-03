# RFC-G9 服务端产品域边界规则

- 日期：2026-10-03 ｜ 提出方：W6 服务端迁移臂（server/community 首臂接管续完，G9 扩权批） ｜ 状态：已生效
- 影响面：`chips-ecosystem/tools/gates/gates.config.json`（`boundaries.rules` 新增 `server` 规则，其余规则原样保留）；G9 门禁对 `server/community`、`server/personal` 两产品域的判定结果；`《02-仓库映射与新工作区》`§一已登记的 CPS→`server/community`、PS→`server/personal` 归属行的门禁落地配套。

## 一、问题

`chips-ecosystem/server/` 顶层目录随 W6 落地（`pnpm-workspace.yaml` 已扩 glob `server/community/packages/*`、`server/personal/packages/*`），工作区包发现面随之覆盖两服务端产品域。G9 边界门禁的 `classify` 对未命中任何规则的包一律判 `BOUNDARY001`（工作区包未在门禁配置登记规则，fail-closed 缺省拒收）：`server/community/packages/server` 一经发现即计红，服务端两仓任何代码落盘都无法过闸。

同时，服务端产品域的依赖事实与平台侧包系存在结构性差异，不能套用既有规则：

1. **Node 内置模块合法**：服务端是独立 Node 进程产品（《社区平台设计》§1.1「不加载 Cordis、不注册平台能力」；《08 服务端部署与运维》§2.1 Node >= 20 基线），`node:crypto`、`node:path`、`node:url` 等内置导入是其正式运行时依赖面；而 `plugins`/`examples` 规则的 `forbidNodeBuiltins: true` 口径（浏览器插件运行环境）对 server 不适用。
2. **禁依赖 `@chips/*` 运行时包**：服务端产品与平台运行时完全解耦（《社区平台设计》§2.3：不在平台进程内、不注册能力、不接收平台事件），`@chips/ui`、`@chips/sdk`、`@chips/bridge` 等运行时包一律不得进入 server 依赖面；与平台的一切交互只经 HTTP API 契约与卡片传输协议（《11 契约》《16 协议》），无代码级依赖。

## 二、裁定

### 2.1 规则登记（fail-closed 扩表）

`boundaries.rules` 新增 `server` 规则（置于 `tools` 规则之后、`tests` 规则之前；`classify` 按数组顺序首个命中生效，server 包路径与既有规则互不重叠）：

```json
{
  "id": "server",
  "match": "server/*/packages/*",
  "allowedInternal": []
}
```

字段口径逐项说明：

| 字段 | 取值 | 理由 |
|---|---|---|
| `match` | `server/*/packages/*` | 覆盖 `server/community/packages/*` 与 `server/personal/packages/*` 全部在册包。派单口径记作 `server/**/packages/*`；本门禁 glob 引擎为段匹配（`matchSegment` 不支持跨段 `**`，`**` 段语义与 `*` 等价、均只匹配单一段），而工作区树 `server/<产品>/packages/<包>` 中段恒为一段，两种写法判定结果完全相同，故按引擎实际语义登记为 `server/*/packages/*`（依据命令：`node -e "import('./tools/gates/lib/walk.mjs').then(m=>console.log(m.matchGlob('server/*/packages/*','server/community/packages/server'), m.matchGlob('server/**/packages/*','server/community/packages/server')))"` → `true true`）。若未来出现更深嵌套（`server/a/b/packages/c`），按 fail-closed 缺省判 `BOUNDARY001` 并走新 RFC 扩表，不在本规则内预留。 |
| `forbidNodeBuiltins` | 省略 | Node 内置模块是服务端正式运行时依赖（§一.1），不设禁面。 |
| `forbiddenModules` | 省略 | 无预判必须逐名禁止的第三方模块；未登记依赖按工作区「未经登记零引入」纪律另行把关，门禁面不重复设表。 |
| `allowedInternal` | `[]` | `@chips/*` 运行时包零放行：`dependencies`/`peerDependencies`/`optionalDependencies` 中出现任何 `@chips/*` 判 `BOUNDARY010`，源码 import 判 `BOUNDARY020`，未声明内部依赖 import 判 `BOUNDARY021`（`allowedDevInternal` 全局项 `@chips/testing`、`@chips/cli` 继承全局口径，不受本规则扩权）。 |

### 2.2 边界语义（本规则的两条硬边界）

1. **平台五目录禁依赖 server**：`packages/`（host/bridge/sdk/ui/antd/cli 等平台目录）、`plugins/`、`tools/`、`tests/`、`examples/` 五目录的既有规则不改（`allowedInternal` 均不含 server 包名），平台侧对 `server/community`、`server/personal` 的任何依赖声明或源码导入由 `BOUNDARY010`/`BOUNDARY020`/`BOUNDARY021` 照常拦截——服务端产品是独立部署进程，平台运行时不感知其存在（《社区平台设计》§2.3）。
2. **server 禁 import `@chips/*` 运行时包、能力调用经 HTTP/传输协议**：server 包对平台的唯一合法交互是作为《11-社区平台API契约》《16-卡片传输协议》的**服务端实现方**对外提供 HTTP API；客户端侧（插件、Host）经平台网络能力与传输链路访问。server 自身不 import 平台运行时包获取能力，一切系统能力（对象存储、数据库、队列）由服务端产品自己的部署依赖承载（《08》§四）。

### 2.3 fail-closed 保持

本裁定只做「新域登记」，不做「豁免扩容」：未命中规则仍判 `BOUNDARY001`；命中 `server` 规则的包仍受 `BOUNDARY010`（依赖面）、`BOUNDARY020`（源码导入面）、`BOUNDARY021`（未声明内部依赖）、`BOUNDARY011`（workspace: 协议）全套拦截。`@chips/*` 白名单为零项空表，新增放行必须走后续 RFC 逐名登记，不得先斩后奏。

## 三、理由

1. **独立产品域而非平台组件**：服务端两仓是「服务端产品」（ADR-010、《14》§1.1），进程、部署、运行时与平台完全独立；门禁规则按「域」建表而非按「包」逐个登记，与 `plugins`/`examples` 的域级规则同构，未来 `server/` 新增产品仓（如治理服务、审计服务）自动纳入同一边界语义，无需逐包改表。
2. **Node 内置合法是事实口径**：服务端（含既有迁移实现 `node:crypto` 口令哈希、`node:path` 迁移产物定位）对 Node 内置的依赖不可消除也不应消除；沿用 `forbidNodeBuiltins: true` 只会制造无意义红面，违反门禁「登记事实边界」的定位。
3. **零放行 `@chips/*` 是架构红线**：服务端经 Bridge/SDK 消费平台能力在架构上不成立（无平台进程承载）；唯一共享面是文件格式与协议契约（纯规范，无代码），故 `allowedInternal: []` 是唯一与《14》§2.3 相容的取值。

## 四、验收

- `npx -y pnpm@9 run gates:boundaries` EXIT=0：`server/community/packages/server`（及同日并行的 `server/personal/packages/server`）的 `BOUNDARY001` 全部消除，工作区包发现面 `server/community/packages/server`、`server/personal/packages/server` 双双被 `server` 规则截获（2026-10-03 实测，报告 `reports/boundaries/boundaries.json`）；
- 反向验证（fail-closed 保持，2026-10-03 实测）：向 `@chips/community-server` 临时声明 `@chips/ui` 依赖 → `BOUNDARY010` 命中；源码临时 `import { config } from '@chips/ui'` → `BOUNDARY020` 命中；两验证物即删后复跑 EXIT=0（不入库）；
- `server/community/packages/server` 包内四闸（test 74/74、typecheck、lint、build）全绿（2026-10-03 实测）；
- 依据命令：`grep -B2 -A3 '"id": "server"' tools/gates/gates.config.json`；`node tools/gates/check-boundaries.mjs --json` 违规计数为 0。

---

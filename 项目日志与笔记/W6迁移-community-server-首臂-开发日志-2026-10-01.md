# W6 迁移：community-server 首臂开发日志

> 日期：2026-10-01（接管续完收口 2026-10-03）
> 性质：W6 服务端两仓迁移·community-server 首臂（CPS 认证与账号域 + 内容只读域 + 分页/幂等/限流/错误归一中间件）——本臂为接管续完路：前一路限额中断，已留工程骨架与半成品 src/tests，本路接管盘点后续完至四闸全绿。
> 依据：《项目日志与笔记/W6开工前置-服务端两仓勘查-2026-10-01.md》派单行 2/3/4/10（首臂范围=账号域+内容只读域+四中间件）；《薯片生态文档库/05-接口与契约/11-社区平台API契约.md》（唯一权威，逐字段逐码对表）；《14-社区平台设计.md》域模型；《矩阵》CPS 部分（迁移裁决底数）。
> 独占面：`chips-ecosystem/server/community/packages/server/`；G9 扩权面 `tools/gates/gates.config.json`（server 规则）+《RFC-G9服务端产品域边界规则》；问题工单登记面（工单073）。其余一律不动。

---

## 一、接管盘点段（2026-10-03 接管实测）

前一路限额中断时的落盘状态（接管时逐文件审读）：

| 面 | 状态 |
|---|---|
| 工程骨架 | 完整可用：`package.json`（`@chips/community-server`，fastify ^4.26.2 / drizzle-orm ^0.44.2 / zod 4.5.4 / Node >=20，`test/typecheck/lint/build/db:generate` 脚本齐）、`tsconfig.json` + `tsconfig.build.json`、`drizzle.config.ts`、`vitest.config.ts`、`scripts/copy-db-migrations.mjs`；node_modules 已装 |
| src | 主体已落：app/server 入口、config/env（zod schema 校验，校验失败拒启）、errors（AppError + §7.3 码表 38 行逐字登记）、plugins（error-handler / authenticate / rate-limit / idempotency / conditional-get / request-id）、routes（health / auth / users / cards / boxes / rooms / discover）、services（auth / user / card / box / room）、lib（password scrypt / pagination / http-tokens）、db（client / migrate / init-admin + 6 实体 drizzle schema + 初始迁移 0000）、repositories（端口 types + drizzle 适配器）、dto/community.ts（契约 §4.3~§4.6 DTO 逐字段）、schemas/auth.schemas.ts |
| tests | 6 文件 74 用例已写（TDD 先测后码），接管时 **13 失败 / 53 通过 / 8 跳过**（含 8 个显式标注「归对象存储臂/写域臂」的 skip，见 §五臂边界） |
| gates | `gates.config.json` 已有 `server` 规则（`match: "server/*/packages/*"`、`allowedInternal: []`），但 **RFC 未写**（本臂补齐，《RFC-G9服务端产品域边界规则》） |
| 文档 | 开发日志（本文件）前一路未落盘 |

真实凭据零入库核验：包内无 `.env`、无密钥常量；`config/env-file.ts` 显式加载 `server/community/deploy/.env`（文件不存在静默跳过，进程环境优先）；测试基座 `testAppConfig()` 全量配置由代码构造，`databaseUrl` 指向无效地址且 PG 端口以内存 fake 替换（真库不进测试）。

## 二、续完修复记录（13 失败 → 74/74 全绿，逐根因）

### 2.1 实现翻正（4 项）

1. **过期令牌误判为非法**（`services/auth.service.ts` `verifyAccessToken`）：旧实现按 jsonwebtoken 错误名 `TokenExpiredError` 判过期，而本仓签名器为 @fastify/jwt（fast-jwt 内核），过期错误形态是 `code === 'FAST_JWT_EXPIRED'` 的 `TokenError`——全部 verify 失败被归入 `COMMUNITY_AUTH_TOKEN_INVALID`。翻正为按错误码判过期 → `COMMUNITY_AUTH_TOKEN_EXPIRED`（契约 §7.3 行）。根因：签名器错误面以旧仓 jsonwebtoken 心智写入，未对 fast-jwt 实测。
2. **改密吊销误伤当前会话**（`services/auth.service.ts` `issueSession` + `routes/users.ts` password 路由）：访问令牌的 `jti` 与刷新会话 `jti` 是两个随机值，「除当前会话外吊销」（契约 §4.3）以 `request.user.jti` 豁免时形同虚设（豁免的是访问令牌自己的随机 jti，刷新会话无一匹配）。翻正：**令牌对共享同一 `jti`＝登录会话标识（refresh_sessions 主键）**，受保护请求据此标识所属会话，改密后当前会话可刷新、其余会话 204。
3. **304 响应携带正文**（`plugins/conditional-get.plugin.ts`）：If-None-Match 命中后在 onSend 返回 `undefined`——Fastify onSend 语义中 undefined 是「不改动载荷」，已序列化正文原样发出。翻正为返回空串 `''`（契约 §6.4：304 无正文）。
4. **非法 JSON 请求体 500**（`plugins/error-handler.plugin.ts`）：Fastify 4 默认 JSON 解析器对非法 JSON 抛出的是 secure-json-parse 的 `SyntaxError`（仅置 `statusCode=400`，无 `FST_ERR_CTP_INVALID_JSON` 错误码），旧实现只按 FST 错误码分流 → 落入兜底 500。翻正：补 `SyntaxError && statusCode===400` 形态 → 400 `COMMUNITY_VALIDATION_ERROR`（契约 §7.3）。

### 2.2 实现补齐（4 项，契约对照缺件）

1. **`/users/me/cards`、`/users/me/boxes` 缺路由**（契约 §4.2「必须」两行）：`routes/users.ts` 补注册（认证必须、本人视角 `includeAll`）；find-my-way 静态段优先于参数段，与 `/users/:username/*` 无冲突。
2. **封面入口失败回退语义缺失**（`services/card.service.ts` `resolveCover`）：旧签名只看封面缓存记录，封面记录缺失且卡片 status=ready 时派生为 pending → 对「渲染失败」卡片返回 202 占位，而契约 §6.4 要求失败回退默认封面。翻正为三参决议：封面缓存 ready → 302（公开到封面缓存地址、私有到受控代理路径）；封面 error **或卡片级 viewState error** → 302 默认封面；其余 → 202 + Retry-After。`routes/cards.ts` 同步传双缓存。
3. **认证身份角色取自 JWT 快照**（`plugins/authenticate.plugin.ts`）：`request.user.role` 取令牌签发时快照，角色变更（提权/降权）在 access token 存活期内不生效。翻正：authenticate 已查库判 isActive，角色一并取数据库当前值——授权数据以系统记录为准，令牌 claim 仅签发快照。
4. **PATCH /users/me 空请求体放行**（`schemas/auth.schemas.ts`）：`displayName`/`bio` 双可选使 `{}` 通过校验，与用例「至少一个字段」口径不符。补 `.refine`（至少提供一字段），`AuthSchemas` 接口类型同步放宽为 `z.ZodType<…>`。

### 2.3 半成品测试翻正（5 项，与实现一致的用例缺陷逐一根因）

1. **夹具路由在 ready 后注册**（`tests/rate-limit-idempotency.test.ts`）：`registerAccount`（inject）先触发 `app.ready()`，随后 `app.get('/api/v1/__browse')` 等抛「Fastify instance is already listening. Cannot add route!」。翻正：夹具路由全部移到 beforeAll 首个 inject 之前（`__idem-boom` 原写在 it 内，一并前移）。
2. **fake 仓库实体 ID 非 UUID v4**（`tests/helpers/harness.ts`）：注册接口断言契约 §2.2「服务端实体 ID＝UUID v4」，而 fake `create` 落 `user-N-random` 兜底。翻正：`data.id ?? randomUUID()`（users/rooms/idempotency 三处），夹具显式传 id 的行不受影响。
3. **Cookie `secure` 断言形态不可达**（`tests/auth.contract.test.ts`）：light-my-request 经 set-cookie-parser 解析，仅当 Secure 属性存在才产出 `secure` 字段（缺省是 undefined 而非 false），`toBe(false)` 永假。翻正：改断言 set-cookie 原始头不含 `Secure`（实现行为本就符合契约「HTTPS 下 Secure」，nodeEnv=test 不携带）。
4. **房间 DTO 字段集断言未排序**（`tests/boxes-rooms-discover.test.ts`）：`Object.keys().sort()` 产出字母序（`boxCount` < `cardCount`），期望数组按契约声明序写 → 恒失败。翻正期望数组为字母序；DTO 字段集本身与契约 §4.4 逐字段一致，实现不动。
5. **两处用例数据/视角缺口**：①房间 contents 首请求漏带 owner 头（断言 total=3 是 owner 视角，用例自注「访客视角 total=2」自相矛盾）——补 `authHeader(owner.accessToken)`；②空间聚合断言 room-public cardCount=1 但夹具无任何房内卡片（中断遗留缺口）——补一张房内公开就绪卡片夹具（此时用户内容列表断言已运行完毕，不影响前序）。

### 2.4 lint 基线收口（前一路未跑 lint，128 错 → 0）

- `json() as T` 恒冗余：light-my-request `json<T = any>()` 的泛型经 `as` 断言目标反推，断言不改变类型。**48 处**统一翻正为显式类型参数 `json<T>()`（类型断言语义不丢，`no-unnecessary-type-assertion` 清零）；
- `require-await` 与无返回类型：6 插件工厂 + 7 路由注册函数无 await，按工作区 canonical 风格（W5 community-client 判例：无 await 即同步）翻正为同步函数并去掉 app.ts 调用点 await；`tests/helpers` 内存 fake 方法体为同步内存操作而端口要求 Promise 返回，翻正为显式 `Promise.resolve(...)` 返回；drizzle 适配器谓词函数补 `SQL<unknown> | undefined` 返回类型、删冗余 `as never`；boxes/cards 路由内部函数补返回类型；
- 顺带消除 `reply.redirect(302, url)` 弃用告警（Fastify 4.29 新签名 `redirect(url, 302)`），测试输出零警告。

## 三、设计裁定记录（契约未细化的落地点，均在本仓代码注释标注）

1. **幂等并发同键**（`plugins/idempotency.plugin.ts`，前一路裁定，接管复核维持）：契约 §6.2 未登记「处理中」业务码，并发同键请求（首响应未落库）按 409 `COMMUNITY_IDEMPOTENCY_CONFLICT` 处理，客户端重试在首响应落库后获得重放；5xx 不缓存为重放结果并释放占用。
2. **未知路由 404**（`plugins/error-handler.plugin.ts`，前一路裁定，复核维持）：契约 §7.3 未登记通用 404 业务码，按「请求目标不合法」归一为 404 + `COMMUNITY_VALIDATION_ERROR` 信封（唯一信封原则 §2.3）。
3. **空间聚合分页**（`routes/users.ts`，前一路裁定，复核维持）：`GET /users/:username/space` 是单对象信封（契约 §4.3 ICommunitySpace 无 pagination 字段），根目录卡片/箱子子列表按 `page/pageSize` 限页、页元信息不随单对象信封输出。
4. **登录会话标识统一**（本臂）：令牌对共享 `jti`（见 §2.2.2），「会话」的线级定义＝refresh_sessions 行，access token 携带其标识。
5. **授权角色实时取库**（本臂）：见 §2.2.3。
6. **封面入口三态决议**（本臂）：见 §2.2.2（封面缓存记录优先，卡片级 error 回退默认封面，其余 202）。

## 四、新增部署配置键（部署工件臂落 `.env.example` 时须一并登记）

`config/env.ts` 在 canonical 键（`08` §6.2：NODE_ENV/BASE_URL/PORT/HOST/DATABASE_URL/JWT_SECRET/JWT_ACCESS_EXPIRES_IN/JWT_REFRESH_EXPIRES_IN/ADMIN_USERNAME/ADMIN_PASSWORD/ENABLE_SWAGGER）与契约键（`CORS_ALLOWED_ORIGINS`、`CORS_EXTRA_ORIGINS`）之外，本臂新增运行策略键：

| 键 | 缺省 | 契约依据 |
|---|---|---|
| `AUTH_LOCK_THRESHOLD` / `AUTH_LOCK_DURATION_SECONDS` | 5 / 900 | §3.2（锁定阈值与时长由服务端配置） |
| `PASSWORD_MIN_LENGTH` | 8 | §3.2（口令长度由服务端策略配置） |
| `RATE_LIMIT_WINDOW_SECONDS` / `RATE_LIMIT_BROWSE_MAX` / `RATE_LIMIT_AUTH_MAX` / `RATE_LIMIT_TRANSFER_MAX` | 60 / 120 / 10 / 30 | §6.3（认证与传输档位比浏览更严格；阈值服务端配置） |
| `IDEMPOTENCY_RECORD_TTL_MINUTES` | 1440（下限 60） | §6.2（保留时间不低于上传会话有效期 60 分钟） |
| `RENDER_RETRY_AFTER_SECONDS` | 3 | §6.4（处理中 Retry-After） |
| `DEFAULT_COVER_URL` | `<BASE_URL>/default-cover.svg` | §6.4（封面失败回退默认封面） |

真实凭据零入库：`ADMIN_USERNAME/ADMIN_PASSWORD` 仅作首启引导（`db/init-admin.ts`），部署侧初始化后从环境移除或轮换（`08` §6.2）；`deploy/.env` 不入 Git（gitignore 已覆盖），本仓不含任何真实取值。

## 五、臂边界（本臂不做、不留占位的面）

- **头像/房间封面上传**（`POST /users/me/avatar`、`POST /rooms/:roomId/cover`）：multipart 字节入口依赖对象存储层，归对象存储臂（契约 §4.3/§4.4）；相关用例显式 skip 并标注归属。
- **内容写操作**（POST /rooms、PATCH/DELETE cards/boxes/rooms）：归内容写域臂（契约 §4.8/§4.9）。
- **传输控制面、对象存储、渲染 Worker、管理端**：归行 5/6/7/10；渲染缓存**读面**（render-status/view/cover 入口）在本臂按契约 §6.4 先行交付，读端口经 `RenderCacheRepository` 端口装配。
- **旧 SDK/host 耦合四点切断核验**：依赖清单零 `chips-host`、零旧 `@chips/ui` 直连、零跨仓 workspace 链接、无 host-runtime 路由残留（《矩阵》§2.3 四点逐项过）。
- **服务端产品红线核验**：零 Cordis/平台运行时导入、零能力注册、平台五目录零反向依赖（gates:boundaries EXIT=0 背书）。

## 六、G9 扩权（公共资产，RFC 已落）

- `tools/gates/gates.config.json` `boundaries.rules` 新增 `server` 规则：`match: "server/*/packages/*"`（派单口径 `server/**/packages/*` 在本门禁段匹配引擎下与其判定等价，RFC §2.1 有依据命令）、`forbidNodeBuiltins` 省略（Node 内置合法）、无 `forbiddenModules`、`allowedInternal: []`（server 禁 import `@chips/*` 运行时包）；平台五目录既有规则不动（平台侧禁依赖 server 保持），fail-closed 全链保持。
- 裁定文：《项目日志与笔记/RFC-G9服务端产品域边界规则/RFC-G9服务端产品域边界规则.md》（含边界语义、反向验证记录、验收命令）。
- 验收：`npx -y pnpm@9 run gates:boundaries` EXIT=0，`server/community/packages/server`（与同日并行的 `server/personal/packages/server`）BOUNDARY001 消除；反向验证 BOUNDARY010/020 如期命中后验证物即删。

## 七、问题工单登记

- **工单073**（`项目日志与笔记/工单073-G9边界门禁副作用导入检测缺口/任务说明.md`）：G9 边界门禁 `extractImports` 不捕获副作用导入（`import '包名';` 形态），BOUNDARY020/021 对该形态零检出、fail-closed 失守——本臂 RFC 反向验证时实测发现，登记后按独占目录纪律不改门禁代码（tools/gates 归门禁维护域），本轮继续推进可交付部分。

## 八、验证回执（2026-10-03 亲跑）

- `npx -y pnpm@9 test`：**74/74 全绿**（6 文件；8 skip 为臂边界标注面，归后续臂解锁）；
- `npx -y pnpm@9 typecheck`：EXIT=0；
- `npx -y pnpm@9 lint`（eslint + prettier --check）：EXIT=0（接管时 128 错 → 0）；
- `npx -y pnpm@9 build`：EXIT=0（tsc 产物 + `copy-db-migrations` 迁移产物拷贝）；
- `npx -y pnpm@9 run gates:boundaries`：EXIT=0（BOUNDARY001 消，反向验证 fail-closed 保持）。

---

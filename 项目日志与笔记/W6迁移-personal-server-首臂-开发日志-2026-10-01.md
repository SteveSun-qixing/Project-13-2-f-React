# W6 迁移：personal-server 首臂开发日志

> 日期：2026-10-01（首臂落盘完成 2026-10-03）
> 性质：W6 服务端两仓迁移·personal-server 首臂（派单行 12 前半：工程骨架 + 内容只读域 + API_TOKEN 鉴权中间件 + 错误归一 + PG 端口化）。
> 依据：《W6开工前置-服务端两仓勘查-2026-10-01.md》派单行 12（《矩阵》#1/#2/#3 底数）；《薯片生态文档库/05-接口与契约/12-个人服务器API契约.md》（唯一权威，路由/DTO/错误码逐字段逐码对表）；《15-个人服务器设计.md》§三/§五/§六/§十（域模型、鉴权、存储、错误语义）与 §四/§七（本臂不做，留后续臂）；旧仓 `Chips-PersonalServer/packages/server/src/`（只读冻结，迁移材料）。
> 独占面：`chips-ecosystem/server/personal/packages/server/`；`server/community/**`、`tools/gates/**`、平台 `packages/` 五目录、插件目录、旧仓与文档库一律零写。全程零 git 写操作。

---

## 一、本臂交付范围（对照派单行 12）

派单行 12 原文「骨架 + api-token 常量时间鉴权 + cards/boxes 内容接口 + 错误归一」；本臂按派单指令收敛为**内容只读域**（契约 §4.1 路由组中全部公开读 + `cards/manage` 管理读），写域与对象存储相关路由按下表留后续臂（README 已登记臂序）：

| 交付面 | 明细 |
|---|---|
| 工程骨架 | `package.json`（`@chips/personal-server` 0.1.0，private，MIT OR Apache-2.0，`type: module`，Node `>=20`，fastify `^4.26.2` 实装 4.29.1、drizzle-orm `^0.44.2` 实装 0.44.7、zod 4.5.4、drizzle-kit 0.31.11）、`tsconfig.json` + `tsconfig.build.json`（NodeNext，继承工作区 base）、`vitest.config.ts`（node 环境）、`drizzle.config.ts`（离线 generate）、`scripts/copy-db-migrations.mjs`、`.prettierignore`（指向根文件的同款符号链接，与 community 臂判例一致） |
| 路由（只读域） | `health`（§2.3 平铺信封例外）；cards：列表/详情/打开视图/状态/`view` 302/`cover` 302·占位页/`manage`（令牌）；boxes：列表/详情（含条目引用匹配）/`view` 只读文档。DTO 与契约 §4.2/§4.3 逐字段断言（测试以 `Object.keys().sort()` 全集断言，无多余字段） |
| 鉴权中间件 | `plugins/api-token.plugin.ts`：`isApiTokenValid`（先比长度再 `timingSafeEqual`，§5.2.2）+ `requireApiToken` 回调式 preHandler（Fastify 类型扩展 `types/fastify.d.ts`）；失败统一 `401 API_TOKEN_INVALID` 不区分原因 |
| 错误归一 | `errors/codes.ts`＝契约 §7.2 登记表逐行落点（含 `RESPONSE_INVALID` 仅登记不输出、`NOT_FOUND` 服务端可用——与 community 无通用 404 码的口径不同）；`plugins/error-handler.plugin.ts` 信封四字段 `code/message/details/retryable` + `details.traceId`（`genReqId: randomUUID`）；404 → `NOT_FOUND`；ZodError → 400 `VALIDATION_ERROR`；媒体类型 → 415 `FILE_TYPE_INVALID`；未归一 → 500 `INTERNAL_ERROR`（内部细节只进日志） |
| PG 端口化 | `repositories/types.ts`（`CardRepository`/`BoxRepository` 端口）+ `repositories/drizzle/index.ts`（生产适配器，`listPublic`/`listAll`/条目匹配谓词与测试 fake 同口径）+ `tests/helpers/harness.ts` 内存 fake（真实 PG 不进测试）；`db/`：client（`buildDb`）、migrate（启动自动迁移）、schema（cards 25 列 4 索引 / boxes 21 列 3 索引，列集与旧仓逐列一致＝《15》§3.5 沉淀模型）+ 初始迁移 `0000_parched_meteorite.sql`（drizzle-kit generate 离线产出，含三枚枚举类型） |
| 域服务纯逻辑 | `services/card.service.ts`（私密即不存在、`viewState`/`hasRenderArtifacts` 语义、coverRatio 回退 `metadata.cover_ratio`、查看/封面入口决议、默认占位页）、`services/box.service.ts`（条目引用匹配＝cardFileId 关联公开就绪卡、`embedded` scheme 判定、只读文档 HTML 全量转义）、`lib/pagination.ts`（§6.1 缺省/上限/四字段 pagination/ceil）、`lib/html.ts`、`types/box.ts`、`types/render-artifacts.ts`（§4.5 产物记录模型读侧守卫，写入方归传输臂） |
| 测试（先测后码） | 5 文件 45 用例全绿：`cards.contract.test.ts`（17，逐字段+分页+错误归一）、`boxes.contract.test.ts`（逐字段+条目匹配+XSS 转义+空结构兜底）、`auth.contract.test.ts`（鉴权三分支缺失/错误/放行 + CORS 三来源形态）、`card.service.test.ts` / `box.service.test.ts`（域逻辑真实夹具）。测试令牌为专用假值，真实凭据零入库零入测 |

## 二、后续臂边界登记（本臂不做，README 臂序表同步）

| 移交面 | 归属臂（派单行） | 接缝说明 |
|---|---|---|
| `PATCH/DELETE` 卡片与箱子（可见性切换、两阶段删除） | 内容写域臂（行 12 写半区，待排波） | `requireApiToken` 已就绪；产物清理语义见契约 §4.2.6/§4.2.7/§4.3.5 |
| card-transfer 控制面 + **渲染产物上传模型**（`includeRenderArtifacts`、恢复清单、upload_sessions schema 与迁移） | 传输控制面臂（行 13） | 产物写入 `cards.render_artifacts`，模型已定于 `src/types/render-artifacts.ts`；卡片/箱子创建落库服务随该臂迁移（旧 `card.service.create`/`recordRenderArtifacts` 等为材料） |
| 对象存储层（`storage/{s3,buckets,init}`、逻辑桶、公开读策略、DEP-5） | 对象存储臂（行 14） | 受控代理 `render-cache/:cacheVersion/*`、`cover-cache/:cacheVersion/*`、箱子封面 302（需 §6.3 公开对象 URL 拼装）、`GET /boxes/:id/download` 预签名下载随该臂落地；资产路径归一（契约 §9.2）与 `FILE_CORRUPT`（箱子格式校验属传输事务）同批 |
| env 键扩展 | 随上表两臂 | 本臂 schema 仅登记 8 键（`NODE_ENV/PORT/HOST/BASE_URL/DATABASE_URL/API_TOKEN/ENABLE_SWAGGER/CORS_EXTRA_ORIGINS`，见 `src/config/env.ts` 头注）；S3 键归行 14、限额/TTL 键归行 13 |

**两端差异（《15》§七）未做面**：单用户裁剪本身由本臂模型承载（无 users/rooms/渲染表）；其余差异（渲染产物上传、私密资源路由）随行 13/14 落地。

## 三、设计裁定记录（实现要点与旧仓差异，均有代码注释标注）

1. **`CARD_RENDER_NOT_READY` 409 翻正**：旧仓 `AppError.badRequest(CARD_RENDER_NOT_READY, …)` 硬编码 400，与契约 §7.1「409 状态冲突」不符。新 `AppError` 以登记表为唯一权威（码→HTTP→retryable 绑定），`CARD_RENDER_NOT_READY` 恒 409 且 `retryable: true`，`view` 无产物分支同步翻正。
2. **条目匹配端口归属**：按 cardFileId 取公开就绪卡片的查询放在 `CardRepository`（查询对象是卡片；与 community 臂同判），`BoxService` 经双端口注入消费；`findPublicReadyByCardFileIds` 空集合短路返回 `[]`（drizzle `inArray` 空数组不可执行）。
3. **鉴权钩子形态**：Fastify 4.29 回调式钩子（arity 3）为同步纯校验的规范形态——实测「同步函数正常返回 undefined 的 promise 式钩子」会悬挂请求链（401 抛错路径反而可达，已被三分支用例覆盖）；故 `requireApiToken` 采用 `done(err)/done()` 回调式，`done(err)` 直入统一错误归一。
4. **`reply.redirect` 新签名**：`redirect(code, url)` 为 FSTDEP021 弃用形态，统一使用 `redirect(url, 302)`（与 community 臂收口一致，测试输出零弃用告警）。
5. **open-view 的 `coverUrl` 取值**：维持旧实现（有封面产物时输出稳定入口路由 `/api/v1/cards/{id}/cover`，无则 null），列表/详情/状态维持 DB 字段透传；`entryUrl`（对象 URL/受控代理路由）语义由行 13 写入事务与行 14 代理路由收口后统一复核。
6. **`cards[]` 条目的 `cover_url?`**：契约 §4.3.2 可选字段，旧实现不输出，本臂维持不输出（快照模型无稳定映射来源， fabrication 即假数据）；行 13/14 落产物模型时复核。
7. **健康检查**：契约 §2.3 平铺三字段，不套信封、不引入组件注册表（community 的 HealthRegistry 是其契约 §2.5 组件面所需，个人服务器契约无此面）。
8. **manage 与公开读分页同口径**：§6.1 全局适用，管理读同样接受 `page/pageSize`（用例覆盖）。

## 四、工程与依赖

- 安装：持 `/tmp/w4-lockguard` 目录锁执行 `npx -y pnpm@9 install --filter @chips/personal-server`（7.5s，全部复用 store，零新增第三方包；fastify/zod/drizzle 系与 community 臂同版共享）。接锁时发现前路遗留**空且无安装进程的陈旧锁**（40+ 分钟），核实后移除并以带时间戳的 owner 标记重取，安装完毕即释放。
- 锁文件影响：`pnpm-lock.yaml` 仅新增 `server/personal/packages/server` importer 段（工作区注册新包的必然产物，无版本漂移）。
- 遗留修复三处（均经最小复现定根因）：① `findPublicReadyByCardFileIds` 初版误挂 `BoxRepository` → 挂回 `CardRepository`；② Fastify 同步 preHandler 悬挂（见 §三.3）；③ FSTDEP021（见 §三.4）。lint 基线：`json<T>()` 显式泛型替代 `as` 断言、无 await 函数同步化、内存 fake 以 `Promise.resolve` 显式兑现端口 Promise、夹具工厂去冗余断言。

## 五、验证（亲跑，包内正式脚本）

| 闸 | 命令 | 结果 |
|---|---|---|
| test | `pnpm test`（vitest run） | **5 文件 45/45 通过**，零弃用告警 |
| typecheck | `pnpm typecheck`（tsc --noEmit） | 绿 |
| lint | `pnpm lint`（eslint . && prettier --check .） | 绿（0 错 0 警） |
| build | `pnpm build`（tsc -p tsconfig.build.json + copy-db-migrations） | 绿，dist 含迁移资产 |

未跑 `gates:all`（按派单约束）；G9 server 规则由社区臂统一落，本臂受益未落笔。

## 六、移交清单

1. 行 13/14 臂：README 臂序表 + `src/config/env.ts` 头注的键位登记为扩展点；`src/types/render-artifacts.ts` 为产物写入模型唯一事实源。
2. 内容写域臂：`requireApiToken` 直接复用；PATCH 可见性切换需实现「产物对象按 keyPrefix 删除 + 状态回 pending」（§4.8），DELETE 两阶段语义（契约 §4.2.7）需资源清单枚举器。
3. 问题无新增登记：本臂未发现需立工单的架构缺口（文档与代码一致，契约无歧义项以 §三 裁定记录收口）。

**日志结束**

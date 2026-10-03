# @chips/personal-server · 薯片个人服务器 API

> 设计权威：《个人服务器设计》（`薯片生态文档库/01-架构设计/01-子系统设计/15-*.md`）
> 接口权威：《个人服务器 API 契约》（`薯片生态文档库/05-接口与契约/12-*.md`）
> 运行时 canonical：Node `>=20`、Fastify 4（`^4.26.x`）、Drizzle ORM + PostgreSQL、vitest；单用户单进程，无 Redis、无服务端渲染（《15》§1.1/§2.1）。

## 定位

单用户内容服务器：一台服务器对应一个创作者，作品（卡片/箱子）直接属于服务器本身；访客无需账号即可浏览；写权限只由 `API_TOKEN` 约束（PS-1/PS-6）。服务器不解析 `.card`、不解包 `.box`、不渲染（PS-2/PS-4）。

## 模块划分（《15》§2.2）

| 模块                | 职责                                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------------------- |
| `src/app.ts`        | 组装 Fastify：Helmet、CORS、Swagger（可关）、错误归一、API_TOKEN 插件与路由组；依赖经 `ServerDeps` 注入 |
| `src/config/`       | 环境变量 schema 校验与加载（`server/personal/deploy/.env`）；校验失败拒绝启动                           |
| `src/db/`           | Drizzle 客户端、schema 与迁移；启动时自动执行迁移                                                       |
| `src/errors/`       | `AppError` 与业务码登记表（契约 §7.2 的服务端落点）                                                     |
| `src/lib/`          | 分页、HTML 转义等纯函数                                                                                 |
| `src/plugins/`      | `error-handler`（统一错误信封）、`api-token`（常量时间令牌校验）                                        |
| `src/repositories/` | 仓库端口（`types.ts`）与 Drizzle 适配器（`drizzle/`）——PG 端口化接缝                                    |
| `src/routes/`       | `health`、`cards`、`boxes` 路由组                                                                       |
| `src/services/`     | 域服务纯逻辑（卡片、箱子）                                                                              |
| `src/types/`        | 箱子结构模型、渲染产物记录模型、Fastify 类型扩展                                                        |
| `tests/`            | 路由契约测试（逐字段对表契约）+ 域逻辑测试；内存 fake 仓库（真实 PG 不进测试）                          |

## 脚本

| 命令                                         | 说明                                                      |
| -------------------------------------------- | --------------------------------------------------------- |
| `pnpm dev`                                   | 开发启动（tsx watch，加载 `server/personal/deploy/.env`） |
| `pnpm build`                                 | `tsc -p tsconfig.build.json` + 迁移 SQL 拷贝随 dist 发布  |
| `pnpm typecheck` / `pnpm lint` / `pnpm test` | 三闸                                                      |
| `pnpm start`                                 | 运行 dist 产物（启动自动迁移）                            |
| `pnpm db:generate`                           | 由 `src/db/schema` 离线生成迁移 SQL                       |

## 臂序登记（W6 派单行表，本臂＝行 12 首臂）

本臂（行 12）交付：包工程骨架（清单/tsconfig×2/vitest/drizzle 配置）、**内容只读域**（health + cards/boxes 公开读与 `cards/manage` 管理读，DTO 逐字段对齐《12 契约》§4.2/§4.3）、**API_TOKEN 鉴权中间件**（常量时间比较，缺失/错误/放行三分支测试）、**错误归一**（§7.2 登记表驱动的统一信封）、**PG 端口化**（仓库端口 + Drizzle 适配器 + 内存 fake）。

后续臂按派单行表推进，接缝如下（禁止在本包内做临时实现）：

| 臂         | 派单行 | 交付内容（本臂不做）                                                                                                                                                                                                                                                                  | 接缝                                                                                                     |
| ---------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 控制面臂   | 行 13  | card-transfer 控制面与**渲染产物上传模型**（《15》§四）：upload_sessions schema 与迁移、会话/预签名/complete/abort、`includeRenderArtifacts` 两模式、恢复清单；写域路由 PATCH/DELETE 卡片与箱子（可见性切换/两阶段删除，复用本臂 `requireApiToken`）                                  | 产物写入 `cards.render_artifacts`（模型已定于 `src/types/render-artifacts.ts`）；卡片/箱子创建与落库服务 |
| 对象存储臂 | 行 14  | **与社区平台差异中的存储面**（《15》§六/§七）：`storage/{s3,buckets,init}.ts`、逻辑桶与公开读策略、DEP-5 整改；受控代理路由 `GET /cards/:id/render-cache/:v/*`、`GET /cards/:id/cover-cache/:v/*`、箱子封面 `GET /boxes/:id/cover`（302）、源文件预签名下载 `GET /boxes/:id/download` | 对象键布局与桶角色对齐《卡片传输协议》§6.2；资产路径归一（契约 §9.2）                                    |
| Web 前台臂 | 行 15  | `packages/web` 只读 SPA（antd + `@chips/ui`，简体中文文案）                                                                                                                                                                                                                           | 消费本包只读 API                                                                                         |
| 部署工件臂 | 行 16  | Dockerfile×2、compose×2、nginx、start-local-dev（剔除第三方云 compose.prod）；`.env.example` 按《08》§六再生                                                                                                                                                                          | 本臂 env 键见 `src/config/env.ts` 头注（S3/限额键由上表两臂追加 schema）                                 |

环境变量登记（本臂）：`NODE_ENV` / `PORT` / `HOST` / `BASE_URL` / `DATABASE_URL` / `API_TOKEN` / `ENABLE_SWAGGER` / `CORS_EXTRA_ORIGINS`。真实凭据零入库（`deploy/.env` 不入版本库）。

## 测试口径

- 路由契约测试逐字段断言《12 契约》DTO 与信封（`tests/*.contract.test.ts`）；
- 鉴权三分支：缺失 / 错误（含格式错误）/ 放行（`tests/auth.contract.test.ts`）；
- 域逻辑真实夹具（`tests/*.service.test.ts`）；真实 PG/S3 不进入测试（端口 fake）。

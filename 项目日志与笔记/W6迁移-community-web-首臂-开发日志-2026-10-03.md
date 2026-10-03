# W6 迁移 · community-web 首臂 开发日志（2026-10-03）

> 原子任务：社区平台 Web 前台（`server/community/packages/web`）首臂。分支「第五次重构」，未执行任何 git 写操作。
> 依据：《社区平台设计》§七/§2.2、《社区平台 API 契约》§2/§3/§7、《旧功能覆盖矩阵-服务端两仓-2026-09-20》#14、已交付 `@chips/community-server` 契约夹具。旧仓 `Chips-CommunityPlatformServer/packages/web` 只读未触碰。

## 一、交付范围（首臂）

**工程**：`server/community/packages/web/`（`@chips/community-web`，私有）。React 18.3.1 + TypeScript 5.9.3 + Vite 6.4.3 + Vitest 3.2.7（jsdom），全部与平台包（`packages/host`、`packages/ui`）版本逐字对齐（免登记口径）；测试工具为平台既有 `@testing-library/*` + `jest-dom` 同版本栈。`.prettierignore` 按工单 010 口径符号链接到根。

**红线落实**：server 产品不依赖平台包——零引入 `@chips/ui`、`@chips/antd`、antd；自持最小样式（`src/styles/global.css` 设计 token + 组件级纯 CSS，`ccw-` 前缀）；文案简体中文直写；无主题/多语言运行时（ADR-006）。

**模块（《14 设计》§2.2 Web 前台划分）**：

| 目录 | 内容 |
|---|---|
| `src/api/` | `client.ts`（fetch 封装：统一 JSON 信封、`X-Request-Id`、`credentials: 'include'`、401 自动刷新 single-flight、204 无正文）；`errors.ts`（契约 §7.3 业务码登记表客户端落点 + `CommunityApiError` + `COMMUNITY_RESPONSE_INVALID`/`HTTP_REQUEST_FAILED` 归一）；`dto.ts`（逐字段 DTO 形状校验）；`types.ts`（契约 §3.2/§4.3/§4.4 DTO + 统一作品视图模型）；`auth.ts`（注册/登录/登出）；`users.ts`（getMe + 会话用户口径收敛） |
| `src/contexts/` | `SessionContext.tsx`：accessToken 仅内存；启动恢复按刷新接口口径（200 恢复+getMe，204/失败收敛未登录）；登出尽力而为；会话丢失联动 |
| `src/components/` | 页头、页脚、作品网格、作品磁贴（卡片封面 iframe 嵌独立封面入口、箱子图片、首字占位、管理模式勾选） |
| `src/lib/` | `router.tsx`（自持 History 路由：Link/Navigate/`:param`/`@:param`/`*` 匹配，零第三方路由依赖）；`routes.ts`（路由壳口径、`/@:username` 判定、认证后分流）；`format.ts`（错误消息/封面比例/占位首字） |
| `src/pages/` | 欢迎页（根路由会话分流：匿名欢迎/普通用户跳 `/@username`/管理员跳 `/admin`）、社区简介、登录（`identifier` 邮箱或用户名）、注册（username `/^[a-z0-9-]{3,32}$/` + 邮箱 + 口令 8–128，与服务端 schema 同口径）、404 |
| `tests/` | 67 用例全绿：API 客户端契约测试（fetch mock 逐字段信封/DTO/错误归一/401 刷新）、会话上下文、组件、五页冒烟（jsdom 渲染 + 关键文案断言） |

**臂序（README 已登记）**：首臂 ✅ → 二臂 个人主页（ProfileHero + 作品网格接线 + `Promise.allSettled` 批删编排）→ 三臂 发布说明页（/workspace 守卫接线）+ 后台中转页 → 四臂 卡片/箱子内容直达页（document 壳、open-view 轮询、磁贴预取）。

## 二、矩阵裁决落实（#14 迁移适配）

- 移除宿主中转引用：HostedPluginSurface / DocumentPluginRoutePage / `lib/host-runtime.ts` 不迁移（《14》§6.5 废止）。
- 错误码对齐：旧 `AUTH_TOKEN_EXPIRED`/`NETWORK_ERROR` 等自造码全部替换为契约 §7.3 `COMMUNITY_*` 口径 + `HTTP_REQUEST_FAILED`；只按 `code` 分支。
- antd/@chips/ui 耦合切断：server 产品不依赖平台包，自持样式替代（首臂任务指令与 01.02 §2.2 红线口径）。
- 文案键表（`lib/messages.ts`）废弃，中文直写；AboutPage 旧文案中「主题/图标/多语言运行时」表述随 ADR-006 修正为独立服务端产品口径。
- 登录/注册表单对齐新契约：`identifier`（邮箱或用户名）、注册补 `email`、用户名小写连字符口径（旧版允许大写与下划线，已修正）。

## 三、关键技术决策

1. **零新增第三方依赖**：`react-router-dom` 不在工作区登记清单内，按「未经登记依赖零引入」改由 `lib/router.tsx` 自持（§2.2 本就规定 `lib/` 路由与工具模块），后续臂复用同一匹配器（已覆盖 `/@:username`、`/cards/:cardId`、`/boxes/:boxId`、`*`）。
2. **令牌口径**：浏览器 refresh token 完全交由 `HttpOnly` Cookie；客户端不持久化、不读取（登录/注册响应体中的 `refreshToken` 仅做 DTO 校验后丢弃，轮换经 `Set-Cookie` 原子完成）。accessToken 仅内存，进程刷新即失，启动走 refresh 恢复。
3. **传输层/认证域分层**：`client.request` 不落令牌（纯传输）；`CommunityAuthApi` 负责登录/注册后的内存令牌写入；刷新 single-flight 在客户端内聚，会话丢失经回调通知上下文。
4. **测试确定性**：mock fetch 队列（Response/Error 混排）+「先入队后渲染」约定——RTL `render` 会同步冲刷 effects，启动恢复必须先入队（本次调绿过程中实测修正）。

## 四、验证（亲跑，包内正式脚本）

| 闸 | 结果 |
|---|---|
| `pnpm test` | ✅ 4 文件 67 用例全通过 |
| `pnpm typecheck` | ✅（strict + exactOptionalPropertyTypes + noUncheckedIndexedAccess） |
| `pnpm lint` | ✅ eslint（全仓扁平配置）+ prettier --check |
| `pnpm build` | ✅ vite 6.4.3 产物 dist/（gzip 后 JS 53.76 kB） |

依赖安装持 `/tmp/w4-lockguard` 目录锁，装后释放；`pnpm-lock.yaml` 仅新增本包依赖解析；未跑 `gates:all`；未触碰 `server/community/packages/server/**`、`tools/gates/**`、`packages/` 平台目录、旧仓与文档库。

## 五、遗留与移交

- 二臂起按 README 臂序推进；详情臂交付时补充磁贴悬停预取（`open-view`/箱子详情预取属详情域）。
- 无新增问题工单：本次未发现文档与代码漂移；`14-设计` §7.4「前台 antd + @chips/ui」表述与 W6 首臂执行口径（server 产品不依赖平台包）存在行文差异，已按本臂任务指令执行，提请后续落文批统一（《14》§7.4 归属文档库，非本臂可改范围）。

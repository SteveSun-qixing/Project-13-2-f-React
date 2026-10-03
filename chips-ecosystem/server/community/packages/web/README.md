# @chips/community-web · 薯片社区平台 Web 前台

面向临时访客的浏览侧 SPA：欢迎页、社区简介、登录注册、个人主页与内容直达（《社区平台设计》§七）。浏览器端不提供上传、打包与完整下载入口；作品发布与完整下载由薯片客户端统一卡片传输链路完成。

产品红线：server 产品不依赖平台包（`@chips/ui`、`@chips/antd`、antd 均不引入）；自持最小样式（纯 CSS + 设计 token，见 `src/styles/global.css`）；界面文案简体中文直写；不承载主题与多语言运行时（ADR-006）。技术栈 React 18.3 + TypeScript + Vite（版本与平台包对齐），路由为 `src/lib/router.tsx` 自持实现（History API + 模式匹配），无第三方路由依赖。

## 目录（《14 设计》§2.2 Web 前台模块划分）

| 目录              | 内容                                                                              |
| ----------------- | --------------------------------------------------------------------------------- |
| `src/api/`        | API 客户端（fetch 封装、错误归一、DTO 逐字段对齐《11 契约》）、认证域与用户域封装 |
| `src/contexts/`   | 会话上下文：accessToken 仅内存、刷新 204 口径、登出尽力而为                       |
| `src/components/` | 页头、页脚、作品网格与磁贴（个人头图随个人主页臂交付）                            |
| `src/lib/`        | 自持路由（History + 模式匹配）、路由口径工具与展示工具                            |
| `src/pages/`      | 欢迎页、社区简介、登录、注册、404                                                 |
| `tests/`          | API 客户端契约测试（fetch mock 逐字段）、会话上下文与五页冒烟（jsdom）            |

## 迁移臂序（W6 服务端波 · 行 9 CPS Web 前台）

| 臂                 | 范围                                                                                                                                                                                             | 状态 |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---- |
| 首臂（本包已交付） | 工程骨架；`api/` 客户端（认证 / 用户域 + 错误归一）；`contexts/` 会话上下文；`components/` 页头、页脚、作品网格与磁贴；`pages/` 欢迎、简介、登录、注册、404；路由壳 `default`/`document` 口径    | ✅   |
| 二臂               | 个人主页（`/@:username`：ProfileHero 个人头图 + 作品网格接线，`users/:username` 卡箱列表混排、批量删除 `Promise.allSettled` 编排）                                                               | 待派 |
| 三臂               | 客户端发布说明页（`/workspace`，需登录守卫接线）+ 后台中转页（`/admin`）                                                                                                                         | 待派 |
| 四臂               | 卡片详情（`/cards/:cardId`）与箱子详情（`/boxes/:boxId`）内容直达页：`document` 路由壳、`open-view` / 渲染状态轮询、磁贴悬停预取（`card-open-view-prefetch` / `box-detail-prefetch` 随本臂交付） | 待派 |

备注：

- 旧仓（`Chips-CommunityPlatformServer/packages/web`，只读冻结）迁移裁决见《旧功能覆盖矩阵-服务端两仓-2026-09-20》#14：宿主中转（HostedPluginSurface / DocumentPluginRoute / host-runtime）按《14 设计》§6.5 废弃不迁移；文案键表（`lib/messages.ts`）按 ADR-006 废弃、中文文案直写。
- 后台 SPA（`packages/admin`）为独立包，不在本包范围。

## 脚本

| 命令                               | 说明                                                                                                           |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`                         | 本地开发（Vite dev server，`/api` 代理到社区 API；`COMMUNITY_WEB_PORT` / `COMMUNITY_API_PROXY_TARGET` 可覆盖） |
| `pnpm build`                       | TypeScript 检查 + Vite 生产构建                                                                                |
| `pnpm test` / `pnpm test:coverage` | Vitest（jsdom）单测与覆盖率                                                                                    |
| `pnpm typecheck` / `pnpm lint`     | 类型检查 / ESLint + Prettier                                                                                   |

## 验证口径

- API 客户端以《社区平台 API 契约》（§2 基础约定、§3 认证与令牌、§7 错误模型）为唯一权威，契约测试与已交付的 `@chips/community-server` 契约路由夹具同源对表。
- 页面路由与访问规则以《社区平台设计》§7.2 为唯一权威（根路由会话分流、访客守卫、404 兜底）。

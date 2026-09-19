# 薯片个人服务器 HTTP API 契约

**文档编号**：协议与契约 / 10
**文档版本**：v1.0
**最后核对时间**：2026-08-11
**适用范围**：所有需要与薯片个人服务器（`Chips-PersonalServer`）交互的客户端、工具与生态内其他系统。

## 1. 定位

个人服务器是薯片生态的**单用户内容服务器**：

- 没有多用户、账号、房间与后台治理概念，作品直接属于服务器本身；
- 卡片与箱子的**查看与封面渲染产物由客户端 Host 渲染后上传**，服务器不承担渲染；
- 写操作（上传、删除、更新）通过 `Authorization: Bearer <API_TOKEN>` 管理令牌保护，读操作公开；
- 其余概念与社区服务器同构：`card-transfer` 上传会话、网络资源卡片、对象存储直传、可逆恢复清单、下载计划。

公共协议（card-transfer 控制面、渲染产物角色、网络资源卡片格式、下载计划）以《协议与契约 / 09-社区平台API契约》为准，本文档只描述个人服务器与社区服务器的差异。

## 2. 基础约定

### 2.1 基础路径

- API 前缀：`/api/v1`
- 数据格式：JSON（UTF-8）
- 时间格式：ISO 8601
- 主键 ID：UUID v4

### 2.2 统一响应结构

与社区服务器一致：成功返回 `{ "data": ... }`（列表附带 `pagination`），失败返回 `{ "error": { "code", "message", "details?" } }`。

### 2.3 鉴权

- 公开读接口：`GET /api/v1/cards/*`、`GET /api/v1/boxes/*`、`GET /api/v1/health`，无需令牌；
- 写接口与传输控制面：`Authorization: Bearer <API_TOKEN>`，令牌由服务器环境变量 `API_TOKEN` 配置；
- 客户端传输模块的 `server.accessToken` 字段即携带该令牌。

## 3. 接口清单

### 3.1 健康检查

- `GET /api/v1/health`

### 3.2 内容展示

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/v1/cards` | 公开卡片分页列表（`visibility=public`，含未渲染作品） |
| GET | `/api/v1/cards/manage` | 全部卡片列表（含私有与未渲染，需令牌） |
| GET | `/api/v1/cards/:cardId` | 卡片详情 |
| GET | `/api/v1/cards/:cardId/open-view` | 轻量打开数据（`viewState: ready / pending / error`，不含完整 JSONB） |
| GET | `/api/v1/cards/:cardId/status` | 卡片状态（含 `hasRenderArtifacts`） |
| GET | `/api/v1/cards/:cardId/view` | 重定向到查看产物入口（无产物返回 `CARD_RENDER_NOT_READY`） |
| GET | `/api/v1/cards/:cardId/cover` | 重定向到封面产物入口（无产物返回默认占位 HTML） |
| GET | `/api/v1/cards/:cardId/render-cache/:cacheVersion/*` | 私有查看产物受控代理（支持 Range） |
| GET | `/api/v1/cards/:cardId/cover-cache/:cacheVersion/*` | 私有封面产物受控代理（支持 Range） |
| GET | `/api/v1/boxes` | 公开箱子分页列表 |
| GET | `/api/v1/boxes/:boxId` | 箱子详情（含条目引用匹配） |
| GET | `/api/v1/boxes/:boxId/view` | 箱子只读文档 HTML |
| GET | `/api/v1/boxes/:boxId/cover` | 箱子封面（重定向或占位 HTML） |
| GET | `/api/v1/boxes/:boxId/download` | 箱子源文件预签名下载 |

### 3.3 内容管理（需令牌）

| 方法 | 路径 | 说明 |
|---|---|---|
| PATCH | `/api/v1/cards/:cardId` | 修改可见性（变更时清理并移除渲染产物） |
| DELETE | `/api/v1/cards/:cardId` | 删除卡片（源文件、资源与渲染产物） |
| PATCH | `/api/v1/boxes/:boxId` | 修改可见性 |
| DELETE | `/api/v1/boxes/:boxId` | 删除箱子 |

### 3.4 传输控制面（需令牌）

与《协议与契约 / 09》第 7 章完全一致：

- `POST /api/v1/card-transfer/upload-sessions`（含 `includeRenderArtifacts`）
- `POST /api/v1/card-transfer/upload-sessions/:uploadId/objects:presign`
- `POST /api/v1/card-transfer/upload-sessions/:uploadId/complete`
- `POST /api/v1/card-transfer/upload-sessions/:uploadId/abort`
- `POST /api/v1/card-transfer/download-sessions`
- `GET /api/v1/card-transfer/download-sessions/:downloadId/plan`

差异：

- 创建会话请求体无 `roomId` 字段；
- `includeRenderArtifacts: true` 时 complete 必须提交 `renderArtifacts` 摘要（见 09 契约），服务器校验并发布产物；
- 未提交渲染产物时卡片保持 `pending`，查看页显示"尚未渲染"提示。

## 4. 渲染产物模型

客户端渲染产物写入卡片的 `render_artifacts` 记录：

```json
{
  "rendererVersion": "chips-client-renderer-1",
  "themeId": "chips-official.default-theme",
  "locale": "zh-CN",
  "view": {
    "cacheVersion": "会话ID",
    "bucket": "chips-card-render-cache",
    "keyPrefix": "{cardId}/{cacheVersion}",
    "entryObjectKey": "{cardId}/{cacheVersion}/index.html",
    "entryUrl": "公开对象存储 URL 或私有受控代理路由",
    "fileCount": 3,
    "sizeBytes": 1024
  },
  "cover": {
    "cacheVersion": "会话ID",
    "bucket": "chips-card-cover-cache",
    "keyPrefix": "{cardId}/{cacheVersion}",
    "entryObjectKey": "{cardId}/{cacheVersion}/index.html",
    "entryUrl": "公开对象存储 URL 或私有受控代理路由",
    "fileCount": 2,
    "sizeBytes": 512
  }
}
```

- 公开产物入口为对象存储 URL，私有产物入口为 `/api/v1/cards/:id/render-cache/:cacheVersion/:file` 或 `/cover-cache/...` 代理路由；
- 服务器不生成、不重建、不清理过期产物；产物生命周期与卡片一致（删除卡片时一并清理）。

## 5. 与社区服务器的差异汇总

| 维度 | 社区服务器 | 个人服务器 |
|---|---|---|
| 用户体系 | 多用户注册登录、角色、头像 | 无（单用户） |
| 鉴权 | JWT 双 token + Redis 吊销 | 管理令牌 `API_TOKEN` || 房间 | 支持 | 不支持 |
| 管理后台 | 独立 admin 前端 | 无 |
| 发现/搜索 | 有 | 无 |
| 卡片渲染 | 服务端 HeadlessHostShell + Worker 队列 | 客户端渲染上传 |
| 渲染产物生命周期 | 缓存 30 天 TTL + 过期清理 | 与卡片同生命周期 |
| 前端路由 | 欢迎/简介/登录/注册/个人主页/工作区/后台 | 主页/关于/发布/卡片/箱子 |
| 部署 | server + worker + web + admin | server + web |

## 6. 数据模型

### cards

- 无 `user_id` / `room_id`；
- `status`：`pending`（等待渲染产物）/ `ready` / `error`；
- 新增 `render_artifacts`（jsonb）与 `rendered_at`。

### boxes

- 无 `user_id` / `room_id`。

### upload_sessions

- 无 `user_id` / `room_id`；
- 新增 `include_render_artifacts`（boolean）；
- 幂等键全局唯一。

### 其他

- 无 `users`、`rooms`、`card_render_caches`、`card_render_jobs` 表。

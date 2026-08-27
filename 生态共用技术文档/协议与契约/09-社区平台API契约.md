# 薯片社区平台 HTTP API 契约

**文档编号**：协议与契约 / 09  
**文档版本**：v1.4  
**最后核对时间**：2026-08-06  
**适用范围**：所有需要与薯片社区平台服务器交互的客户端、工具与生态内其他系统。

## 1. 基础约定

### 1.1 基础路径

- 前台 API 前缀：`/api/v1`
- 后台 API 前缀：`/admin/api/v1`

### 1.2 数据格式

- 普通请求 / 响应：JSON
- 文件上传：`multipart/form-data`
- 字符集：UTF-8
- 时间格式：ISO 8601
- 主键 ID：UUID v4

### 1.3 统一响应结构

除 `GET /api/v1/health` 外，业务接口统一使用：

**成功：**

```json
{
  "data": {}
}
```

或：

```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

**错误：**

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Readable message",
    "details": {}
  }
}
```

### 1.4 健康检查例外

`GET /api/v1/health` 当前直接返回：

```json
{
  "status": "ok",
  "timestamp": "2026-03-25T00:00:00.000Z",
  "version": "1.0.0"
}
```

### 1.5 客户端来源与 CORS

- 开发模式（`NODE_ENV=development`）放行所有来源；
- 生产模式（`NODE_ENV=production`）放行：
  - `BASE_URL` 同源请求；
  - 薯片 Host 渲染进程客户端来源（Origin 以 `chips-render:` 开头，或 file:// 页面产生的 `null` Origin）；
  - `CORS_EXTRA_ORIGINS` 环境变量白名单（逗号分隔）中的来源；
- 上述请求均允许携带 `credentials`（`Access-Control-Allow-Credentials: true`）。

## 2. 认证契约

### 2.1 Access Token

受保护接口使用：

```http
Authorization: Bearer <access_token>
```

### 2.2 Refresh Token

当前第一方实现默认使用：

- Cookie 名称：`chips_refresh_token`
- HttpOnly
- path：`/api/v1/auth`
- `Secure` 属性跟随公共访问基地址协议：
  - `BASE_URL` 为 `https://...` 时启用 `Secure`
  - `BASE_URL` 为 `http://...` 时不启用 `Secure`

非浏览器客户端（例如薯片 Host 渲染进程中的桌面客户端应用插件）无法读取 HttpOnly Cookie，登录 / 注册响应体会同时返回 `refreshToken` 明文（见 2.3 节），由客户端自行安全保存，并在刷新时通过请求体提交。

### 2.3 登录 / 注册响应

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`

当前都会：

1. 在响应体中返回 `accessToken`
2. 在响应体中返回 `refreshToken`（供非浏览器客户端安全保存与刷新）
3. 在 Cookie 中写入 refresh token（浏览器同源场景继续使用 HttpOnly Cookie 链路）

```json
{
  "data": {
    "user": {},
    "accessToken": "access-token",
    "refreshToken": "refresh-token"
  }
}
```

### 2.4 刷新接口

`POST /api/v1/auth/refresh` 当前接受：

1. Cookie 中的 refresh token
2. 或请求体中的 `refreshToken`

当前返回口径：

- 若存在可恢复会话：返回 `200`，响应体只包含新的 `accessToken`，同时服务端会重新设置 refresh token Cookie；
- 若当前没有可恢复会话（例如未携带 refresh token、refresh token 已失效、已吊销或用户已不可用）：返回 `204 No Content`，表示“当前没有可恢复登录态”，不再把这类情况视为接口错误。

## 3. 权限总则

### 3.1 公开 / 私有

当前社区服务器的内容权限只分两类：

- `public`
- `private`

### 3.2 不可见资源的返回口径

以下资源对无权访问者通常按 404 处理，不暴露存在性：

- 私有房间
- 私有卡片
- 私有箱子

### 3.3 房间与房间内内容的关系

房间公开不代表房间内所有内容都公开。

正式契约：

- 房间本身可公开
- 但房间中的卡片 / 箱子仍以各自 `visibility` 为准
- 非所有者访问公开房间时，只能看到其中公开内容

### 3.4 房间计数口径

房间 DTO 中的：

- `cardCount`
- `boxCount`

表示“当前请求者可见内容数量”，而不是绝对原始总量。

## 4. 错误码

当前服务端已经实现的核心错误码包括：

- `AUTH_INVALID_CREDENTIALS`
- `AUTH_USER_EXISTS`
- `AUTH_ACCOUNT_LOCKED`
- `AUTH_TOKEN_INVALID`
- `AUTH_TOKEN_EXPIRED`
- `AUTH_INSUFFICIENT_PERMISSION`
- `USER_NOT_FOUND`
- `USER_ACCOUNT_DISABLED`
- `ROOM_NOT_FOUND`
- `ROOM_FORBIDDEN`
- `CARD_NOT_FOUND`
- `CARD_FORBIDDEN`
- `CARD_RENDER_ERROR`
- `CARD_RENDER_NOT_READY`
- `BOX_NOT_FOUND`
- `BOX_FORBIDDEN`
- `FILE_TYPE_INVALID`
- `FILE_TOO_LARGE`
- `FILE_CORRUPT`
- `UPLOAD_SESSION_NOT_FOUND`
- `UPLOAD_SESSION_EXPIRED`
- `VALIDATION_ERROR`
- `NOT_FOUND`
- `INTERNAL_ERROR`

## 5. 核心接口清单

### 5.1 认证

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`

### 5.2 用户

- `GET /api/v1/users/me`
- `PATCH /api/v1/users/me`
- `PUT /api/v1/users/me/password`
- `POST /api/v1/users/me/avatar`
- `GET /api/v1/users/:username`

### 5.3 空间与房间

- `GET /api/v1/users/:username/space`
- `POST /api/v1/rooms`
- `GET /api/v1/users/:username/rooms`
- `GET /api/v1/rooms/:roomId`
- `PATCH /api/v1/rooms/:roomId`
- `DELETE /api/v1/rooms/:roomId`
- `POST /api/v1/rooms/:roomId/cover`
- `GET /api/v1/rooms/:roomId/contents`

### 5.4 上传（卡片传输控制面）

社区卡片上传、下载和远程打开统一由客户端卡片传输模块完成，浏览器不调用这些接口。服务器只做控制面，不接收或代理 `.card` 文件字节。

- `POST /api/v1/card-transfer/upload-sessions`
- `POST /api/v1/card-transfer/upload-sessions/:uploadId/objects:presign`
- `POST /api/v1/card-transfer/upload-sessions/:uploadId/complete`
- `POST /api/v1/card-transfer/upload-sessions/:uploadId/abort`
- `POST /api/v1/card-transfer/download-sessions`
- `GET /api/v1/card-transfer/download-sessions/:downloadId/plan`
- `POST /api/v1/upload/box`（箱子上传保留 multipart 入口；`POST /api/v1/card-transfer/upload-sessions` 传 `contentType: 'box'` 走统一控制面链路）

旧 `POST /api/v1/upload-sessions`、`POST /api/v1/upload-sessions/:uploadId/resources/presign`、`POST /api/v1/upload-sessions/:uploadId/card`、`POST /api/v1/upload/card` 已移除，浏览器卡片上传接口不再存在。

### 5.5 卡片

- `GET /api/v1/cards/:cardId`
- `GET /api/v1/cards/:cardId/open-view`
- `GET /api/v1/cards/:cardId/status`
- `GET /api/v1/cards/:cardId/render-status`
- `GET /api/v1/cards/:cardId/open-view`
- `GET /api/v1/cards/:cardId/view`
- `GET /api/v1/cards/:cardId/cover`
- `GET /api/v1/cards/:cardId/render-cache/:cacheVersion/*`
- `GET /api/v1/cards/:cardId/cover-cache/:cacheVersion/*`
- `PATCH /api/v1/cards/:cardId`
- `DELETE /api/v1/cards/:cardId`
- `GET /api/v1/users/me/cards`
- `GET /api/v1/users/:username/cards`

### 5.6 箱子

- `GET /api/v1/boxes/:boxId`
- `GET /api/v1/boxes/:boxId/view`（只读箱子文档，`text/html`）
- `PATCH /api/v1/boxes/:boxId`
- `DELETE /api/v1/boxes/:boxId`
- `GET /api/v1/users/me/boxes`
- `GET /api/v1/users/:username/boxes`

### 5.7 发现与搜索

- `GET /api/v1/discover/cards`
- `GET /api/v1/discover/boxes`
- `GET /api/v1/search`

### 5.8 后台

- `GET /admin/api/v1/stats`
- `GET /admin/api/v1/users`
- `PATCH /admin/api/v1/users/:userId`
- `GET /admin/api/v1/content`
- `DELETE /admin/api/v1/content/:type/:id`

## 6. 核心资源 DTO 口径

### 6.1 Room

```json
{
  "id": "uuid",
  "userId": "uuid",
  "name": "房间名",
  "slug": "room-slug",
  "description": null,
  "coverUrl": null,
  "visibility": "public",
  "cardCount": 3,
  "boxCount": 1,
  "createdAt": "2026-03-25T00:00:00.000Z",
  "updatedAt": "2026-03-25T00:00:00.000Z"
}
```

### 6.2 Card Summary

`htmlUrl` 是历史兼容字段，当前新客户端不得把它作为卡片打开入口。卡片打开必须先读取 `GET /api/v1/cards/:cardId/open-view`，并在 `viewState = "cache_ready"` 时使用 `viewUrl`。

```json
{
  "id": "uuid",
  "title": "卡片标题",
  "coverUrl": "https://...",
  "coverRatio": "16:9",
  "htmlUrl": null,
  "status": "ready",
  "visibility": "public",
  "createdAt": "2026-03-25T00:00:00.000Z"
}
```

说明：

- `status = ready` 表示源 `.card` 已保存可用，不表示查看缓存已经生成；
- `coverUrl` 在卡片场景中是独立封面入口，通常为 `/api/v1/cards/:cardId/cover`；
- `htmlUrl` 为历史兼容字段，不作为社区前台正式打开入口。

### 6.3 Card Detail

`htmlUrl` 是历史兼容字段，详情接口保留该字段不代表它是查看主链路。新客户端应使用 `viewUrl`、`renderStatusUrl` 和 `open-view` 的轻量状态驱动打开。

```json
{
  "id": "uuid",
  "cardFileId": "abc123def0",
  "userId": "uuid",
  "roomId": "uuid",
  "title": "卡片标题",
  "coverUrl": "https://...",
  "coverRatio": "16:9",
  "htmlUrl": null,
  "sourceCardSha256": "hex",
  "viewUrl": "/api/v1/cards/uuid/view",
  "renderStatusUrl": "/api/v1/cards/uuid/render-status",
  "status": "ready",
  "visibility": "public",
  "fileSizeBytes": 1024,
  "cardMetadata": {},
  "cardStructure": {},
  "user": {
    "username": "alice",
    "displayName": "Alice",
    "bio": null,
    "avatarUrl": null,
    "createdAt": "2026-03-25T00:00:00.000Z"
  },
  "createdAt": "2026-03-25T00:00:00.000Z",
  "updatedAt": "2026-03-25T00:00:00.000Z"
}
```

### 6.4 Card Open View

`GET /api/v1/cards/:cardId/open-view` 返回打开卡片所需的轻量字段，不返回 `cardMetadata`、`cardStructure` 等详情热路径外的大 JSON 字段。

```json
{
  "id": "uuid",
  "title": "卡片标题",
  "coverUrl": "/api/v1/cards/uuid/cover",
  "coverRatio": "16:9",
  "viewUrl": "/api/v1/cards/uuid/view",
  "renderStatusUrl": "/api/v1/cards/uuid/render-status",
  "viewState": "cache_ready",
  "renderCache": {
    "status": "ready",
    "generatedAt": "2026-05-29T00:00:00.000Z",
    "lastAccessedAt": "2026-05-29T00:00:00.000Z",
    "expiresAt": "2026-06-28T00:00:00.000Z"
  },
  "status": "ready",
  "visibility": "public",
  "user": {
    "username": "alice",
    "displayName": "Alice",
    "bio": null,
    "avatarUrl": null,
    "createdAt": "2026-03-25T00:00:00.000Z"
  },
  "createdAt": "2026-03-25T00:00:00.000Z",
  "updatedAt": "2026-05-29T00:00:00.000Z"
}
```

### 6.5 Box Detail

`cards` 为 `structure.entries` 的社区匹配结果（`EnrichedBoxEntryRef`）：`url` 不以 `scheme://` 开头视为内嵌条目（`embedded: true`，`url` 为包内相对路径）；`snapshot.document_id` 匹配到社区公开就绪卡片时输出 `communityCardId / communityViewUrl / communityRenderStatusUrl`。

```json
{
  "id": "uuid",
  "boxFileId": "abc123def0",
  "userId": "uuid",
  "roomId": null,
  "title": "箱子标题",
  "coverUrl": null,
  "documentUrl": "/api/v1/boxes/uuid/view",
  "coverRatio": "3:4",
  "layoutPlugin": "chips-official.grid-layout",
  "visibility": "public",
  "fileSizeBytes": 2048,
  "metadata": {},
  "cards": [
    {
      "entry_id": "abc123def0",
      "url": "https://example.com/demo.card",
      "document_id": "abc123def0",
      "title": "引用卡片",
      "content_type": "chips/card",
      "embedded": false,
      "communityCardId": "uuid",
      "communityViewUrl": "/api/v1/cards/uuid/view",
      "communityRenderStatusUrl": "/api/v1/cards/uuid/render-status"
    },
    {
      "entry_id": "def456ghi1",
      "url": "cards/day-01.card",
      "title": "内嵌卡片",
      "embedded": true,
      "communityCardId": null
    }
  ],
  "user": {
    "username": "alice",
    "displayName": "Alice",
    "bio": null,
    "avatarUrl": null,
    "createdAt": "2026-03-25T00:00:00.000Z"
  },
  "createdAt": "2026-03-25T00:00:00.000Z",
  "updatedAt": "2026-03-25T00:00:00.000Z"
}
```

### 6.5.1 Box Read-Only Document

`GET /api/v1/boxes/:boxId/view` 返回 `text/html; charset=utf-8` 的只读箱子文档：

- 访问权限与 `GET /api/v1/boxes/:boxId` 一致（私有箱子非所有者按 404）；
- 内容为服务端根据已保存 metadata/structure 生成的静态 HTML：箱子名称、描述、条目列表；
- 条目匹配到社区卡片时输出 `/cards/:communityCardId` 链接；内嵌条目展示包内路径；外部条目展示 url；
- 所有用户内容均经过 HTML 转义；
- 该文档是 `documentUrl` 字段的当前落地目标（工单097 的暂行正式文档源，Host Web 导出能力补齐后替换）。

### 6.4.1 Box Summary

箱子列表、房间内容与发现/搜索中的箱子项使用 summary DTO。`coverRatio` 来自箱子表普通列，列表热路径不读取 `metadata` 或 `structure` JSONB。

```json
{
  "id": "uuid",
  "title": "箱子标题",
  "coverUrl": "https://...",
  "coverRatio": "3:4",
  "documentUrl": "/api/v1/boxes/uuid/view",
  "layoutPlugin": "chips-official.grid-layout",
  "visibility": "public",
  "createdAt": "2026-03-25T00:00:00.000Z"
}
```

### 6.5 Card Open View

`GET /api/v1/cards/:cardId/open-view` 用于社区前台卡片打开页的轻量读取。访问权限与 `GET /api/v1/cards/:cardId` 一致，私有卡片对非所有者仍按 404 处理。

该接口只读取打开页所需列；`coverRatio` 来自卡片表普通列，不从 `cardMetadata` JSONB 取值。接口不返回 `cardMetadata`、`cardStructure`、`fileSizeBytes` 等详情字段。

```json
{
  "id": "uuid",
  "title": "卡片标题",
  "coverUrl": "/api/v1/cards/uuid/cover",
  "coverRatio": "3:4",
  "htmlUrl": "https://.../index.html",
  "viewUrl": "/api/v1/cards/uuid/view",
  "renderStatusUrl": "/api/v1/cards/uuid/render-status",
  "viewState": "cache_ready",
  "renderCache": {
    "status": "ready",
    "generatedAt": "2026-03-25T00:00:00.000Z",
    "lastAccessedAt": "2026-03-25T00:00:00.000Z",
    "expiresAt": "2026-04-24T00:00:00.000Z"
  },
  "status": "ready",
  "visibility": "public",
  "user": {
    "username": "alice",
    "displayName": "Alice",
    "bio": null,
    "avatarUrl": null,
    "createdAt": "2026-03-25T00:00:00.000Z"
  },
  "createdAt": "2026-03-25T00:00:00.000Z",
  "updatedAt": "2026-03-25T00:00:00.000Z"
}
```

`viewState` 当前取值：

- `cache_ready`：当前查看缓存可用；
- `rendering`：源 `.card` 已保存，查看缓存正在生成或等待生成；
- `render_error`：最新查看缓存任务失败；
- `pending` / `processing` / `ready` / `error`：保留卡片源文件状态透传。

`open-view` 不返回完整 `cardMetadata`、`cardStructure` 或资源 manifest。

## 7. 上传与查看行为

### 7.0 架构边界

- 浏览器只有查看能力，不提供卡片上传和卡片下载入口；
- 上传、下载和客户端查看入口统一由客户端卡片传输模块（`community.card.transfer`，由 `Chips-CommunityUploader-Plugin` 提供）负责；
- API 服务器只做控制面：鉴权、会话、签名、元数据、恢复清单、状态和任务调度，不接收 multipart `.card`，不代理资源、网络资源卡片、查看缓存或下载文件字节；
- 文件字节全部走对象存储/CDN。

### 7.0.1 桌面客户端在线查看

- 桌面客户端在线查看社区卡片时，由 `community.card.transfer` 的 `openRemote` 能力执行：
  1. 创建下载会话并读取下载计划（`download-sessions` + `plan`）；
  2. 只下载网络资源卡片（`networkCard`）到用户设备临时目录，不还原资源、不打包完整离线包；
  3. 通过 Host `surface.open` 启动本地卡片查看器（`com.chips.card-viewer`），传入本地网络资源卡片路径；
  4. 本地卡片查看器解析网络资源卡片，资源按配置中的 CDN URL 在线加载渲染；
- 该链路只消费网络资源卡片本身（配置与封面），资源字节全部在线加载，不等同于完整回下载；
- 完整回下载（`download`）才把 CDN 资源全部拉取并还原为完整离线 `.card`。

### 7.1 卡片上传会话（客户端 → 控制面 → 对象存储）

客户端把完整离线卡片转换为网络资源卡片并上传。完整链路由客户端传输模块执行：

1. 客户端读取完整离线卡片，枚举内部资源；
2. 客户端创建上传会话；
3. 客户端分批申请对象存储 PUT 地址；
4. 客户端把资源文件直传对象存储；
5. 客户端把配置中的相对路径改写为对象存储/CDN URL，生成网络资源卡片；
6. 客户端把网络资源卡片直传对象存储；
7. 客户端提交资源清单、网络资源卡片对象位置和可逆恢复清单；
8. 服务器校验对象归属后保存版本状态，并按部署形态调度渲染：
   - 社区服务器模式：调度 Worker 生成网页查看缓存；
   - 个人服务器模式（会话开启 `includeRenderArtifacts`）：直接接收客户端渲染产物并发布，不调度渲染任务。

#### 渲染产物角色扩展

`objects:presign` 的对象角色新增 `render-file` 与 `cover-file`：

- `render-file`：客户端渲染的卡片查看产物文件（HTML 目录内的 `index.html` 与资源）；
- `cover-file`：卡片封面产物文件（`.card/cover.html` 与 `cardcover/*` 资源），或箱子的封面目录文件。

产物对象键规则（服务器按卡片可见性选择公开或私有渲染产物 bucket）：

```
{cardId}/{cacheVersion}/{relativePath}
```

- `cacheVersion` 由服务器在创建会话时确定（当前为会话 ID）；
- 公开卡片的产物写入公开 bucket（`chips-card-render-cache` / `chips-card-cover-cache`），入口以对象存储 URL 直接访问；
- 私有卡片的产物写入私有 bucket（`chips-card-render-cache-private` / `chips-card-cover-cache-private`），入口为服务器受控代理路由；
- complete 时服务器对已预签名的产物对象逐一校验对象归属与大小，然后写入卡片渲染产物记录。

`POST /api/v1/card-transfer/upload-sessions`

请求体：

```json
{
  "fileName": "demo.card",
  "roomId": null,
  "idempotencyKey": "client-generated-key",
  "includeRenderArtifacts": false,
  "client": {
    "name": "Chips Community Transfer Plugin",
    "version": "0.1.0",
    "platform": "darwin"
  }
}
```

请求体字段：

- `includeRenderArtifacts`（可选，默认 `false`）：客户端是否随本会话上传渲染产物。
  - `false`：仅上传源文件，渲染由服务器负责（社区服务器模式）；
  - `true`：客户端调用 Host 文件转换模块渲染查看产物并直传，服务器直接发布（个人服务器模式）。

响应：

```json
{
  "data": {
    "uploadId": "uuid",
    "cardId": "uuid",
    "versionId": "uuid",
    "expiresAt": "2026-08-05T01:00:00.000Z",
    "resourcePrefix": "cards/{cardId}/versions/{versionId}/resources",
    "networkCard": {
      "bucket": "chips-card-resources",
      "objectKey": "cards/{cardId}/versions/{versionId}/network-card/card.card",
      "publicUrl": "https://file.example/chips-card-resources/cards/{cardId}/versions/{versionId}/network-card/card.card"
    }
  }
}
```

`POST /api/v1/card-transfer/upload-sessions/:uploadId/objects:presign`

请求体：

```json
{
  "objects": [
    {
      "role": "resource",
      "relativePath": "video.mp4",
      "sizeBytes": 1024,
      "mimeType": "video/mp4"
    },
    {
      "role": "network-card",
      "sizeBytes": 2048,
      "mimeType": "application/vnd.chips.card+zip"
    },
    {
      "role": "render-file",
      "relativePath": "index.html",
      "sizeBytes": 512,
      "mimeType": "text/html"
    },
    {
      "role": "cover-file",
      "relativePath": "index.html",
      "sizeBytes": 256,
      "mimeType": "text/html"
    }
  ]
}
```

响应：

```json
{
  "data": {
    "objects": [
      {
        "role": "resource",
        "relativePath": "video.mp4",
        "bucket": "chips-card-resources",
        "objectKey": "cards/{cardId}/versions/{versionId}/resources/video.mp4",
        "publicUrl": "https://file.example/chips-card-resources/cards/{cardId}/versions/{versionId}/resources/video.mp4",
        "uploadUrl": "https://s3.example/...",
        "method": "PUT",
        "headers": {
          "content-type": "video/mp4",
          "x-amz-meta-chips-card-id": "uuid",
          "x-amz-meta-chips-card-version-id": "uuid",
          "x-amz-meta-chips-transfer-role": "resource"
        }
      }
    ]
  }
}
```

调用方必须使用响应中的 `method`、`headers` 和 `uploadUrl` 上传资源。

`POST /api/v1/card-transfer/upload-sessions/:uploadId/complete`

请求体为 JSON（不是 multipart）：

```json
{
  "title": "Demo Card",
  "cardFileId": "abc123def0",
  "coverRatio": "3:4",
  "networkCard": {
    "bucket": "chips-card-resources",
    "objectKey": "cards/{cardId}/versions/{versionId}/network-card/card.card",
    "publicUrl": "https://file.example/chips-card-resources/cards/{cardId}/versions/{versionId}/network-card/card.card",
    "sizeBytes": 2048,
    "mimeType": "application/vnd.chips.card+zip"
  },
  "resources": [
    {
      "originalRelativePath": "video.mp4",
      "networkUrl": "https://file.example/chips-card-resources/cards/{cardId}/versions/{versionId}/resources/video.mp4",
      "bucket": "chips-card-resources",
      "objectKey": "cards/{cardId}/versions/{versionId}/resources/video.mp4",
      "sizeBytes": 1024,
      "mimeType": "video/mp4"
    }
  ],
  "restoreManifest": {
    "schemaVersion": "1.0.0",
    "originalFileName": "demo.card",
    "cardId": "uuid",
    "versionId": "uuid",
    "resources": [],
    "zipEntries": []
  }
}
```

响应：

```json
{
  "data": {
    "cardId": "uuid",
    "versionId": "uuid",
    "status": "ready",
    "renderStatus": "queued",
    "renderStatusUrl": "/api/v1/cards/uuid/render-status",
    "communityUrl": "https://www.example.com/cards/uuid"
  }
}
```

服务器在 complete 阶段会：

1. 校验网络资源卡片对象归属与大小（通过对象存储 Head）；
2. 校验每个资源对象归属、路径和大小；
3. 保存网络资源卡片对象位置、资源清单和可逆恢复清单；
4. 按部署形态处理渲染：
   - 会话未开启渲染产物模式（社区服务器模式）：入队生成 view 缓存和 cover 缓存，响应含 `renderStatus: 'queued'`；
   - 会话开启渲染产物模式（个人服务器模式）：校验已预签名的 `render-file` / `cover-file` 产物对象，写入渲染产物记录并发布，响应不含 `renderStatus`，`status` 为 `ready`（成功接收产物）或 `pending`（未提交产物）。

`renderArtifacts` 提交格式（complete 请求体，可选）：

```json
{
  "renderArtifacts": {
    "rendererVersion": "chips-client-renderer-1",
    "themeId": "chips-official.default-theme",
    "locale": "zh-CN",
    "view": {
      "entryRelativePath": "index.html",
      "fileCount": 3,
      "sizeBytes": 1024
    },
    "cover": {
      "entryRelativePath": "index.html",
      "fileCount": 2,
      "sizeBytes": 512
    }
  }
}
```

- `rendererVersion`：客户端渲染器版本标识（必填）；
- `themeId` / `locale`：渲染所用主题与语言（可选，缺省由服务器记录默认值）；
- `view.entryRelativePath`：查看产物目录入口文件（通常为 `index.html`），必须已通过 `render-file` 角色预签名并上传；
- `cover.entryRelativePath`：封面产物目录入口文件，必须已通过 `cover-file` 角色预签名并上传。

`POST /api/v1/card-transfer/upload-sessions/:uploadId/abort`：取消上传会话，状态置为 `cancelled`。

### 7.1.1 箱子上传会话（客户端 → 控制面 → 对象存储）

箱子与卡片共用 `card-transfer` 控制面，通过请求体 `contentType: 'box'` 分流；字节仍直传对象存储，服务器不接收 multipart `.box`。控制面行为与卡片分支一致：创建会话 → 预签名 → 直传 → complete。

`POST /api/v1/card-transfer/upload-sessions`（`contentType: 'box'`）：

```json
{
  "contentType": "box",
  "fileName": "Travel.box",
  "roomId": null,
  "idempotencyKey": "client-generated-key",
  "client": {
    "name": "Chips Community Transfer Plugin",
    "version": "0.1.0",
    "platform": "darwin"
  }
}
```

响应（201）：

```json
{
  "data": {
    "uploadId": "uuid",
    "boxId": "uuid",
    "versionId": "uuid",
    "expiresAt": "2026-08-06T01:00:00.000Z",
    "resourcePrefix": "boxes/{boxId}/versions/{versionId}",
    "boxFile": {
      "bucket": "chips-box-files",
      "objectKey": "boxes/{boxId}/versions/{versionId}/box.box",
      "publicUrl": ""
    }
  }
}
```

说明：

- `chips-box-files` 为私有 bucket，`publicUrl` 恒为空字符串；
- 服务端同时落库一条箱子占位记录（`title` 来自 `fileName`），complete 阶段更新该记录。

`POST /api/v1/card-transfer/upload-sessions/:uploadId/objects:presign`（box 会话）：

- 只允许单个 `role: 'box-file'` 对象，key 固定为会话的 `boxFile.objectKey`；
- `contentType` 固定为 `application/vnd.chips.box+zip`；
- 拒绝 `resource` / `network-card` 角色。

```json
{
  "objects": [
    {
      "role": "box-file",
      "sizeBytes": 2048,
      "mimeType": "application/vnd.chips.box+zip"
    }
  ]
}
```

响应（200）：

```json
{
  "data": {
    "objects": [
      {
        "role": "box-file",
        "relativePath": null,
        "bucket": "chips-box-files",
        "objectKey": "boxes/{boxId}/versions/{versionId}/box.box",
        "publicUrl": "",
        "uploadUrl": "https://s3.example/...",
        "method": "PUT",
        "headers": {
          "content-type": "application/vnd.chips.box+zip",
          "x-amz-meta-chips-box-id": "uuid",
          "x-amz-meta-chips-box-version-id": "uuid",
          "x-amz-meta-chips-transfer-role": "box-file"
        }
      }
    ]
  }
}
```

`POST /api/v1/card-transfer/upload-sessions/:uploadId/complete`（box 会话，JSON 请求体）：

```json
{
  "title": "2026 旅行箱",
  "boxFileId": "b1C2d3E4f5",
  "layoutPlugin": "chips.layout.grid",
  "coverRatio": "3:4",
  "boxFile": {
    "bucket": "chips-box-files",
    "objectKey": "boxes/{boxId}/versions/{versionId}/box.box",
    "publicUrl": null,
    "sizeBytes": 2048,
    "mimeType": "application/vnd.chips.box+zip"
  },
  "metadata": {},
  "structure": {},
  "content": {}
}
```

服务器行为：

1. 校验 `boxFile.bucket === chips-box-files` 且 `objectKey === boxFile.objectKey`；
2. 通过对象存储 Head 校验 box 对象大小；
3. `BoxService.create` 落库（更新占位记录）：`boxFileId` / `layoutPlugin` / `coverRatio` 可从请求体显式传入，缺省时从 `metadata`（`box_id` / `active_layout_type` / `cover_ratio`）推导；`documentUrl` 写为 `/api/v1/boxes/{boxId}/view`；源对象信息写入 `source_box_*` 字段；
4. 上传会话置为 `source_ready` 并回写源对象字段；
5. 不写 `cards` 表、不入队卡片渲染。

响应（200）：

```json
{
  "data": {
    "boxId": "uuid",
    "versionId": "uuid",
    "status": "ready",
    "communityUrl": "https://www.example.com/boxes/uuid",
    "boxViewUrl": "/api/v1/boxes/uuid/view"
  }
}
```

`POST /api/v1/card-transfer/upload-sessions/:uploadId/abort`：与卡片分支同一通用中止语义。

### 7.2 卡片下载会话（客户端 → 控制面 → 对象存储）

下载会话只面向客户端传输模块，不暴露给浏览器页面使用。

`POST /api/v1/card-transfer/download-sessions`

请求体：

```json
{
  "cardId": "uuid",
  "versionId": "uuid",
  "client": {
    "name": "Chips Community Transfer Plugin",
    "version": "0.1.0",
    "platform": "darwin"
  }
}
```

响应：

```json
{
  "data": {
    "downloadId": "uuid",
    "cardId": "uuid",
    "versionId": "uuid",
    "planUrl": "/api/v1/card-transfer/download-sessions/uuid/plan"
  }
}
```

`GET /api/v1/card-transfer/download-sessions/:downloadId/plan`

响应：

```json
{
  "data": {
    "schemaVersion": "1.0.0",
    "cardId": "uuid",
    "versionId": "uuid",
    "suggestedFileName": "Demo.card",
    "networkCard": {
      "bucket": "chips-card-resources",
      "objectKey": "cards/{cardId}/versions/{versionId}/network-card/card.card",
      "publicUrl": "https://file.example/...",
      "downloadUrl": "https://file.example/...",
      "method": "GET",
      "headers": {},
      "sizeBytes": 2048,
      "mimeType": "application/vnd.chips.card+zip"
    },
    "resources": [
      {
        "originalRelativePath": "video.mp4",
        "networkUrl": "https://file.example/...",
        "bucket": "chips-card-resources",
        "objectKey": "cards/{cardId}/versions/{versionId}/resources/video.mp4",
        "downloadUrl": "https://file.example/...",
        "sizeBytes": 1024,
        "mimeType": "video/mp4"
      }
    ],
    "restoreManifest": {},
    "manifest": {}
  }
}
```

客户端获取计划后，下载网络资源卡片和所有资源对象，把配置中的 URL 还原为原始相对路径，写回资源文件，并按 ZIP Store 模式重新打包为完整离线卡片。

### 7.3 卡片渲染状态

`GET /api/v1/cards/:cardId/render-status` 返回：

```json
{
  "data": {
    "cardId": "uuid",
    "status": "ready",
    "viewState": "cache_ready",
    "attemptCount": 0,
    "updatedAt": "2026-08-05T00:00:00.000Z",
    "viewUrl": "/api/v1/cards/uuid/view",
    "error": null
  }
}
```

`status` 来自 ready render cache、最新 render job 或 card status。`viewState` 当前取值包括：

- `cache_ready`
- `rendering`
- `render_error`

### 7.4 卡片查看

`GET /api/v1/cards/:cardId/view` 当前行为：

- 命中 ready view cache 时续期缓存并 `302` 到缓存入口；
- 缺失缓存时入队渲染并返回 `202`，响应中包含 `renderStatusUrl` 和 `retryAfterSeconds`。

`GET /api/v1/cards/:cardId/cover` 当前行为：

- 命中 ready cover cache 时续期缓存并 `302` 到缓存入口；
- 缺失 cover cache 时入队封面渲染并返回 `202 text/html` 的临时准备页，响应头 `retry-after: 3`。

公开卡片的 view/cover 缓存写入公开 bucket：

- `chips-card-render-cache`
- `chips-card-cover-cache`

私有卡片的 view/cover 缓存写入私有 bucket，并通过受控 API 代理：

- `GET /api/v1/cards/:cardId/render-cache/:cacheVersion/*`
- `GET /api/v1/cards/:cardId/cover-cache/:cacheVersion/*`

浏览器只加载社区页面、查看缓存和远程资源 URL。网页不提供上传和下载 `.card` 入口；如需保存完整卡片，网页只提示在薯片客户端中打开并下载。

## 8. 兼容与范围说明

本文只描述当前社区服务器已经真实生效的 HTTP 契约，不扩展未实现能力。

当前不在本契约范围内的内容包括：

- 评论、点赞、关注
- 房间成员与 ACL
- 卡片文件本身的权限字段（公开、私有、身份、授权属于社区身份和内容管理系统，卡片文件不实现权限管理）
- 箱子在线布局运行时
- 实时消息与通知

社区内 `.card` 完整回下载由客户端卡片传输模块承担，不在浏览器页面暴露；契约见本文件 7.2 节。

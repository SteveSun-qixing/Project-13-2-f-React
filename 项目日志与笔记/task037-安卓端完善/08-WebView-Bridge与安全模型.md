# WebView Bridge 与安全模型

## 1. 目标

插件侧继续看到与桌面一致的 `window.chips.*` 和 SDK API。transport 从 Electron IPC 替换为 Android WebView 消息通道，但路由 action、payload、错误、事件和权限语义不变。

## 2. 建议通信链路

```text
Plugin JS
 -> Runtime Client / SDK
 -> window.chips transport facade
 -> WebMessagePort
 -> AndroidBridgeEndpoint
 -> authenticated RouteInvocationContext
 -> Kernel router
 -> Host Service
 -> Android PAL
```

Bridge facade 由 Host 在受信插件文档启动前注入或作为固定 bootstrap 加载。插件不能替换 transport，也不能自行创建特权 channel。

## 3. 身份绑定

每个 surface 创建时生成：

- `surfaceId`；
- `sceneId`；
- `pluginId`；
- `sessionId`；
- 单次 session token/nonce；
- 权限快照；
- 允许的 origin；
- 消息频率和载荷上限。

原生 Bridge endpoint 保存绑定关系。JS 请求只提交 action/payload/requestId，caller 身份从 endpoint 绑定读取，不能从消息正文采信。

## 4. Origin 与 frame 策略

- 每个插件使用独立的受控 origin 或等价隔离键；
- 顶层 app surface 才能获得 app Bridge；
- 基础卡片/布局 iframe 使用更窄的 scoped Bridge；
- 远程 HTTP(S) 页面不获得特权 Bridge；
- 页面导航离开允许 origin 时立即销毁 channel；
- 弹窗、新窗口、下载、权限请求由 Host WebViewClient/WebChromeClient 拦截治理；
- 禁止 file URL 的通用访问和 mixed content。

## 5. 消息协议

建议延续现有 request/response/event 模型：

```json
{
  "kind": "invoke",
  "requestId": "...",
  "action": "card.readMetadata",
  "payload": {},
  "protocolVersion": 1
}
```

响应必须是结构化 success/error。错误沿用 `StandardError`，不能把 Kotlin exception stack 直接暴露给插件。

必须限制：

- JSON 深度；
- 单消息字节数；
- 二进制传输方式；
- 每秒消息数；
- 未决请求数；
- 单 action timeout；
- 事件订阅数量；
- surface 销毁后的请求取消。

## 6. 二进制数据

当前一些链路把 Buffer/number array 穿过 Bridge，Android 上大文件不能用巨大 JSON 数组。

应建立正式 `blob/resource handle`：

1. 插件请求 Host 读取资源；
2. Host 返回短期 handle 与元数据；
3. WebView 通过受控 resource URL 流式读取；
4. 写入使用 upload/session handle；
5. handle 绑定 pluginId/sessionId/权限/有效期并可撤销。

这会显著降低 Bridge 内存峰值和 Binder/消息大小风险。

## 7. CPK 与动态内容安全

Android 安装插件前必须：

- 校验 ZIP 路径穿越、重复条目、大小/解压比、符号链接；
- 校验 manifest、entry、targets、engines、permissions；
- 校验签名、发布者和内容 hash；
- 禁止 dex/JAR/.so 和 Android native payload；
- 静态扫描危险 WebView 配置和外部脚本来源；
- 在 staging 目录完成验证后原子激活；
- 保留上一个可回滚版本；
- 支持撤销/隔离已知恶意插件。

## 8. 与当前实现的收敛关系

可以复用：现有 `BridgeAdapter`、route action、错误模型、scoped context、插件消息配额。

需要替换：Electron `ipcMain/ipcRenderer/contextBridge`、`webUtils.getPathForFile`、BrowserWindow sender 推断。

需要新增：Android endpoint、origin registry、WebMessage transport、resource handle、导航销毁、instrumentation security tests。

## 9. 安全验收

- 远程页面调用 `window.chips` 失败；
- 插件 A 不能复用插件 B token/handle；
- iframe 不能提升为顶层 app 权限；
- 导航、返回、surface 销毁立即撤销 channel；
- 篡改 manifest/entry/CPK 被拒绝；
- Bridge 洪泛被限流且 Host 不 ANR；
- 超大 payload 被拒绝且错误结构稳定；
- WebView 调试在 release 构建关闭；
- release 禁止明文网络和任意证书绕过。

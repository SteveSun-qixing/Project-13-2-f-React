# Android PAL 能力映射设计

## 1. 原则

- `PALAdapter` 的公共语义保持稳定；
- Android 实现按分面拆类，不再形成另一个 3000 行单文件 adapter；
- 支持、受限、降级、unsupported 必须体现在 `PalCapabilitySnapshot`；
- 旧别名 `window/fs/dialog/...` 只为现有桌面链路保留，Android 新实现优先使用 `surface/storage/selection/...`；
- 不能为满足接口而返回伪成功。

## 2. 分面映射

| PAL 分面 | Android 映射 | 首发状态 |
|---|---|---|
| environment | Build/PackageManager/WebView version | 必须 |
| surface | Activity/Navigation/WebView registry | 必须 |
| storage | internal storage + ContentResolver | 必须 |
| selection | Activity Result + SAF | 必须 |
| transfer | share sheet、open external、URI grants | 必须 |
| association | intent-filter、App Links、MIME/扩展名 | 必须 |
| device | display、power、locale、insets | 必须 |
| systemUi | clipboard、notification、有限 shortcut | 必须 |
| background | WorkManager/foreground service policy | 必须 |
| image | Bitmap/ImageDecoder 等 | 按卡片链路 |
| offscreenRender | WebView/PrintDocumentAdapter/PixelCopy 等 | 分阶段 |
| launcher | 主 Host launcher；插件内部入口 | 重新定义 |
| ipc | 进程内消息/受控 Binder；不暴露 named pipe | 分阶段 |

## 3. Storage

`PALStorage` 当前以字符串路径为中心，Android 需要双域模型：

- Host internal path：Host 完全控制，适合插件安装、缓存、内部 workspace；
- External document handle：持久 URI、provider 元数据、读写授权和显示名。

建议新增公共资源定位类型，而不是让业务层到处判断 `content://`：

```ts
type ResourceLocator =
  | { kind: 'host-path'; path: string }
  | { kind: 'document'; uri: string; persisted: boolean }
  | { kind: 'network'; url: string };
```

这属于公共契约变更，必须先更新共享文档、SDK 和 Host 测试，不能只在 Android 私下扩展。

## 4. Selection

- open file -> `ACTION_OPEN_DOCUMENT`；
- create/save -> `ACTION_CREATE_DOCUMENT`；
- directory/workspace -> `ACTION_OPEN_DOCUMENT_TREE`；
- image/video -> 需要时使用 Photo Picker；
- 多选、MIME、扩展名过滤由 Android 能力尽量映射；provider 无法严格按扩展名过滤时，返回后再由 Host 校验。

## 5. Surface 与 window 旧 API

Android 不存在任意桌面窗口、最小化和托盘窗口。新的 app 插件必须走 `surface.*`。旧 `window.*`：

- open/create：可按 manifest fallback 映射为 fullscreen；
- focus/close/state：映射当前 destination；
- minimize/maximize/alwaysOnTop：返回 unsupported；
- width/height：作为逻辑 presentation hint，不承诺物理窗口尺寸。

## 6. Notification、Clipboard、Shortcut

- notification：Android 13+ 运行时通知权限，channel 必须由 Host 管理；
- clipboard：遵守系统隐私提示和后台读取限制；
- global shortcut：桌面语义不成立，使用 app shortcut/deep link/command surface 替代；
- tray：unsupported；持续任务应通过符合政策的前台通知表达，不伪装为 tray。

## 7. Background 与 Power

- 短任务随前台 Activity；
- 可延迟可靠任务使用 WorkManager；
- 用户发起的大文件上传/下载使用 Android 推荐的数据传输机制；
- 必须持续且用户可感知的任务才使用 foreground service；
- `setPreventSleep` 只在可见 surface 或明确前台任务中映射 wake lock，且要自动释放。

## 8. Offscreen Render

当前桌面实现依赖隐藏 BrowserWindow。Android 需逐能力验证：

- HTML -> PDF：PrintDocumentAdapter 或专用受控 WebView；
- HTML -> image：离屏/隐藏 WebView + PixelCopy/draw，验证大尺寸和字体；
- 视频首帧：MediaMetadataRetriever/Media3；
- TIFF 等图片转换：确认 Android codec 覆盖，否则选择经过评估的图像库。

这些能力不应继续在 `register-host-services.ts` 直接创建平台对象，应全部下沉 PAL/正式模块。

## 9. Capability Snapshot 验收

每个 Android API 等级和设备运行时都应生成 capability snapshot，插件启动时同时检查：

1. manifest 的 `mobile.supported`；
2. 插件声明权限；
3. 当前设备 capability；
4. fallback 是否可执行。

只有四项同时满足才允许启动或调用。

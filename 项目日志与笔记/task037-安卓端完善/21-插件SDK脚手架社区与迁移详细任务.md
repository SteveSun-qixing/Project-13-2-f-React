# 插件、SDK、脚手架、社区与迁移详细任务

## 1. W9-01 SDK 跨端升级

**目标**：`chips-sdk` 仍是纯 TypeScript 开发者工具包，在 Electron/Tauri/Web 中消费同一 Bridge 语义，不包含 Host Core 实现。

**实施任务**：

1. 用 W1 生成类型替代手写的 route/error/capability/handle 重复定义；
2. `createClient()` 只依赖抽象 transport，提供 Electron preload、Tauri WebView、browser mock/remote adapters；
3. 新增 `DocumentHandle` / `ResourceHandle` / stream/lease 的类型化 API 和自动回收 helper；
4. 新增 `platform.getCapabilities()` 的分面查询与 `requireCapability` 工具；
5. 新增 surface lifecycle、background/resume、module job progress/cancel/recovery API；
6. 事件订阅默认返回 unsubscribe，client dispose 必须清理订阅、stream 和 lease；
7. 保持公共错误对象和 request/trace ID，不向应用泄漏底层 transport error。

**测试**：生成类型 drift、mock transport contract、Electron/Tauri/browser transport 等价、取消/超时竞态、dispose 泄漏、handle 过期和 unsupported。

**完成判据**：同一 SDK E2E suite 在 Desktop、Android、iOS、Web mock/real transport 上通过。

## 2. W9-02 `chipsdev-r` 多端工具链

**实施任务**：

- `validate`：验证 schema、target profile、入口、权限、payload policy、Node/Electron/Tauri/native import、CSP 和资源上限；
- `build`：产出稳定 ESM/HTML/CSS/assets，禁止环境绝对路径进入 source map/asset manifest；
- `package`：确定性 `.cpk`、hash manifest、签名请求和平台 payload 检查；
- `start/preview`：可选 Desktop/Android/iOS/Web target，但必须调用真实 Host Shell；
- `module invoke`：调用 Rust module runtime，不再默认拉起 Electron BrowserWindow；
- `doctor`：检查 Node/pnpm、Rust toolchain、Android JDK/SDK/NDK/adb、Xcode/codesign、Electron 签名和对应设备；
- `test --target`：运行契约测试和目标设备 E2E，输出机器可读认证报告。

**完成判据**：脚手架生成的新插件能在无手工修改情况下完成 build/validate/test/package/install。

## 3. W9-03 五类脚手架

### App 脚手架

生成 React/Vite、`ui.surface`、capability 检查、resume/dispose、SDK transport mock、Desktop/Mobile/Web 契约测试；禁止 Electron/Tauri 直连。

### Card 脚手架

生成 `basecardDefinition`、DOM mount/cleanup、resource handle、独立文档高度、焦点/手势、媒体能力检查和多 WebView 测试。

### Layout 脚手架

生成 box session、entry render/release、嵌套卡片 origin/source 校验、空/错误/大数据状态和触摸/鼠标双输入测试。

### Module 脚手架

分 `portable-js`、`portable-wasm`、`host-builtin` 内部模板；第三方默认只能生成 portable profile；生成 schema、配额、取消和 deterministic tests。

### Theme 脚手架

根据现行前端技术口径重新确认 theme 类型是否仍作为可安装插件；若保留，则只包含经 schema 约束的 token/CSS/assets，不包含可执行原生代码。

## 4. W9-04 Card/Layout/Theme 认证

### 基础卡片认证顺序

1. `richtext-BCP`：DOM、IME、selection、长文本和导出基线；
2. `image-BCP`：资源 handle、旋转/缩放、大图、TIFF 转换；
3. `score-BCP`：字体、标准尺寸和打印；
4. `hyperlink-BCP`：外部打开、安全 URL 和 deep link；
5. `webpage-BCP`：远程内容无特权 WebView、CSP/frame policy；
6. `music/video-BCP`：编解码、后台、音频焦点、内联播放、媒体权限；
7. `book-BCP`：大文件、归档导入、阅读应用路由。

每个卡片必须验证 view/editor/export、mount/cleanup、资源回收、Desktop Chromium、Android WebView、WKWebView 和 Web 目标；不支持的 target 保持 false。

### 布局插件认证顺序

1. `list-BLP` / `grid-BLP`：基础箱子会话和大列表；
2. `cardStack-BLP` / `coverFlow-BLP`：叠放、动画、手势与媒体回收；
3. `masonry-BLP` / `timeline-BLP`：尺寸回报和虚拟化；
4. `documentLibrary-BLP`：搜索、摘要、封面和内嵌文档；
5. `infiniteCanvas-BLP` / `scattered-BLP` / `map-BLP`：Canvas/WebGL、触摸/鼠标、缩放、移动内存和平台 capability。

### Theme 认证

校验 CSS 不越界、字体资产可移植、系统 WebView 差异、打印/导出和高对比度；不将 Electron 特有 scheme 写入主题。

## 5. W9-05 Module 插件迁移

| 模块 | 目标形态 | 具体任务 |
|---|---|---|
| `Chips-ColorPicker` | portable | 纯算法迁入 JS/Wasm sandbox，固定颜色结果 corpus |
| `Chips-CommunityUploader` | portable + network capability | 使用 ResourceHandle/stream/credential，禁止 Node `fs` |
| `Chips-Cover-Plugin` | portable/builtin 按实际能力 | 只通过 card/box edit session 修改封面 |
| `Chips-CardtoHTML` | portable orchestration | 消费 Host 托管渲染文档，不自建渲染器 |
| `Chips-HtmltoImage` | Host builtin/offscreen | 调用 `platform.renderHtmlToImage`，Desktop/Mobile/Headless 按 capability |
| `Chips-HtmltoPDF` | Host builtin/offscreen | 去除 Electron PDF template 的公共锁定，定义可移植 options |
| `Chips-FileConversion` | orchestration | 解析 provider 和组合 job，不直连转换实现 |

每个 module 必须有 input/output schema、quota、cancel、timeout、progress、大文件流、崩溃恢复和平台 target 认证。

## 6. W9-06 官方 App 插件

### `Chips-CardViewer`

作为首要金链路：改用 DocumentHandle，消费 Host card render/cover/resource，处理 surface resume/back/share，覆盖单卡/复合卡/损坏卡/缺插件。

### `Chips-EditingEngine`

作为最高风险 app：所有 workspace/card/box/history/resource 写入走 Rust Services；基础卡片 descriptor 由 Host registry 交付；单卡 iframe 在多 WebView 引擎认证；移动不优化响应式 UI，但必须正确运行、保存和恢复。

### 媒体/阅读应用

`Chips-MusicPlayer`、`Chips-VideoPlayer`、`Chips-PhotoViewer`、`Chips-BookReader`：使用 ResourceHandle 与平台 media capability；处理解码差异、音频焦点、后台、锁屏、字幕、大图/大书和外部打开。

### 治理/社区应用

`Chips-EcoSettingsPanel`：展示真实 capability、插件签名/权限/认证、日志导出和平台设置；`Chips-CommunityClient`：统一认证、ResourceHandle 上传/下载、deep link 和断点恢复。

### `Chips-RichTextEditor` 与 `Chip-iconMaker`

确认其插件类型和正式入口；富文本重点认证 IME/selection/clipboard/paste/sanitize；图标工具使用正式资源/导出链路。

## 7. W9-07 编辑全链路

**任务步骤**：

1. workspace selection/import 返回 handle；
2. Rust workspace/card/box sessions 建立 checkpoint；
3. EditingEngine 获取安装插件 descriptor 和配置 schema；
4. 单卡 view/editor mount，资源导入通过 Host；
5. 操作进入统一 history，undo/redo 不保留应用私有第二份状态；
6. auto-save 使用事务与冲突检查；
7. process death/reload 从 checkpoint 恢复；
8. pack/export/share 使用同一 Rust codec；
9. Desktop/Android/iOS 对同一编辑脚本产出字节等价文档。

## 8. W9-08 社区与个人服务器

### `Chips-CommunityPlatformServer`

将 Host 整合替换为 Rust HeadlessHostShell/library；server 与 worker 使用独立 workspace/credential/quota；卡片验证、渲染、导出和 module job 与客户端共用 corpus。

### `Chips-PersonalServer`

使用同一 Rust Core 和内容 codec；不复制 card/box 解析；定义 API 与 Host handle/stream 边界；保留项目已在进行的数据库重构，不覆盖用户改动。

### 社区 Web

对公开卡片使用 WebHostShell/受限渲染运行时；不向公网页面暴露本地 Host Bridge；上传的渲染产物与源文档有 hash/version/plugin-set 绑定。

## 9. 插件认证报告模板

每个插件必须产出：

- plugin ID/version/type/entry/build hash；
- 源码直接平台 API 扫描结果；
- permissions 与真实 route 调用差分；
- Desktop/Android/iOS/Web/Headless 目标状态；
- 单元/契约/E2E/visual/performance 结果；
- 资源、订阅、WebView/module instance 泄漏结果；
- 崩溃/恢复/弱网/低内存结果；
- 已批准 manifest `runtime.targets`；
- 认证设备、OS/WebView/Electron 版本与日期。

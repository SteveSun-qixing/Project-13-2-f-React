# HTML转图片模块技术方案

## 1. 当前仓库基线

当前仓库已完成首版正式实现：

- `manifest.yaml` 已切换到 `converter.html.to-image/convert`；
- `src/` 已完成输入校验、清单读取、参数归一、Host 导出调用与错误归一；
- `contracts/convert.*.json` 与 `tests/unit/module-definition.test.ts` 已对齐正式输入输出契约；
- 旧脚手架 `run/runAsync` 示例 schema 已移入 `contracts/归档/`；
- `tests/integration/packaged-plugin.test.ts` 已覆盖真实打包插件安装、`card -> html -> image` 正式链路与 Host Electron mock 联调。

当前代码已经完成正式能力实现，后续迭代重点是继续扩大真实样例覆盖，而不是替换技术路径。

## 2. 职责边界

`Chips-HtmltoImage-Plugin` 是 `html -> image` 原子转换模块，只承担以下职责：

- 校验目录态 HTML 输入；
- 读取 HTML 转换清单并归一默认参数；
- 归一化图片导出参数；
- 调用 Host 正式 HTML 渲染导出能力；
- 整理任务进度、错误和最终输出结果。

本模块明确不承担以下职责：

- 不解析卡片文件；
- 不生成 HTML；
- 不直接依赖基础卡片插件；
- 不直接导入 `electron`；
- 不直接创建 `BrowserWindow`；
- 不直接调用 `webContents.capturePage()`；
- 不直接引入 `puppeteer` 或其他独立浏览器运行时。

## 3. 正式依赖关系

### 3.1 上游依赖

本模块只消费 `card -> html` 输出的目录态 HTML 中间产物，正式输入至少包含：

- `htmlDir`
- `entryFile`，默认 `index.html`
- `conversion-manifest.json`
- 输出文件路径与图片参数

### 3.2 下游依赖

本模块必须通过 Host 侧正式 HTML 渲染导出能力完成页面截图，不允许在模块 worker 内直接完成页面渲染。

当前正式实现入口已经冻结为：

- `ctx.host.invoke("platform.renderHtmlToImage", payload)`

因此 `html -> image` 的正式实现模型是：

```text
HtmltoImage Module
  -> 输入校验 / 参数归一
  -> 调用 Host HTML 渲染导出能力
  -> Host 加载目录态 HTML
  -> Host 截图并写出图片
  -> 模块整理结果并返回
```

## 4. 模块内部结构

当前正式代码结构为：

- `input-validator`
  - 校验 `htmlDir`、`entryFile`、`outputFile`、图片格式和尺寸参数
- `manifest-reader`
  - 读取并校验 `conversion-manifest.json`
  - 补齐页面尺寸、背景策略等默认口径
- `option-normalizer`
  - 归一化 `format / width / height / scaleFactor / background`
- `host-export-client`
  - 调用 Host 正式 HTML 渲染导出能力
  - 映射模块输入与 Host 导出请求
- `result-normalizer`
  - 统一返回 `outputFile / width / height / format / warnings`
- `error-mapper`
  - 将 Host 内部错误归一为 `CONVERTER_IMAGE_*`

## 5. 输入与参数归一

本模块正式输入延续公共契约：

- `htmlDir`
- `entryFile`
- `outputFile`
- `options.format`
- `options.width`
- `options.height`
- `options.scaleFactor`
- `options.background`

参数归一规则：

- `entryFile` 未传时默认 `index.html`
- `format` 首版支持 `png | jpeg | webp`
- `scaleFactor` 未传时优先读取 HTML 中间产物清单记录，否则使用 Host 默认值
- `background = theme` 时，优先采用 HTML 中间产物记录的页面背景色
- `background = transparent` 仅对支持透明通道的格式生效

## 6. 正式技术路径

### 6.1 最佳实现方案

当前最佳正式方案不是模块内使用 Puppeteer，而是复用 Host 已提供的统一 HTML 渲染导出能力，底层复用 Electron 原生能力：

- Host 受控加载目录态 HTML；
- Host 设置页面尺寸、缩放倍率和背景策略；
- Host 等待文档、图片、字体和布局稳定；
- `html -> image` 调用页面截图能力导出图片；
- `html -> pdf` 复用同一渲染容器，改走 PDF 导出能力。

### 6.2 不采用 Puppeteer 的原因

- Host 本身已经是 Electron 运行时，继续引入 Puppeteer 会形成第二套浏览器控制链路；
- Puppeteer 会引入额外 Chromium 安装、版本和运行环境漂移问题；
- 模块内直接使用 Puppeteer 不符合当前生态“Host 统一承载系统能力”的架构边界；
- `html -> pdf` 和 `html -> image` 无法稳定共用一套渲染治理逻辑。

### 6.3 Host 侧最低能力要求

Host 正式 HTML 渲染导出能力至少需要支持：

- 加载 `htmlDir + entryFile`
- 校验入口文件与资源路径可访问性
- 设置页面尺寸与 `deviceScaleFactor`
- 设置背景策略
- 等待文档、字体、图片和布局稳定
- 在根据实际文档高度调整截图视口后，再次等待复合卡片 `ready/resize` 与基础卡片高度回流稳定，并重新测量最终导出高度
- 执行页面截图导出
- 返回输出文件路径、实际宽高和警告信息
- 响应 job 取消并及时释放渲染资源

当前本模块依赖的正式 Host 动作名已经冻结为 `platform.renderHtmlToImage`，不再需要模块自行推断或私下接入 Host 内部实现。

## 7. 处理流程

正式处理流程如下：

1. 校验输入目录存在、入口文件存在、输出路径合法。
2. 读取并校验 `conversion-manifest.json`。
3. 归一化图片格式、宽高、缩放倍率、背景策略。
4. 组装 Host HTML 渲染导出请求。
5. 上报 `prepare` 进度。
6. 调用 `ctx.host.invoke("platform.renderHtmlToImage", ...)` 执行页面加载与截图。
7. 接收 Host 返回的输出路径、尺寸与警告。
8. 归一化模块结果并返回。

## 8. 错误模型

本模块需要区分以下错误类型：

- `CONVERTER_INPUT_INVALID`
- `CONVERTER_INPUT_NOT_FOUND`
- `CONVERTER_HTML_MANIFEST_INVALID`
- `CONVERTER_IMAGE_UNSUPPORTED_FORMAT`
- `CONVERTER_IMAGE_RENDER_FAILED`
- `CONVERTER_IMAGE_CAPTURE_FAILED`
- `CONVERTER_IMAGE_OUTPUT_FAILED`
- `CONVERTER_PIPELINE_CANCELLED`

其中：

- 输入与清单问题由模块本地校验阶段识别；
- 页面加载、资源缺失、字体超时、截图失败由 Host 导出阶段返回，再由模块归一。

## 9. 测试重点

### 9.1 模块单测

- HTML 输入目录与入口文件校验
- `conversion-manifest.json` 缺失或非法场景
- PNG / JPEG / WebP 参数映射
- 背景策略归一测试
- Host 返回错误到模块错误码的映射测试

### 9.2 集成测试

- `tests/integration/packaged-plugin.test.ts` 真实执行以下链路：
- 打包 `Chips-CardtoHTML-Plugin` 与 `Chips-HtmltoImage-Plugin`
- 通过 `chipsdev-r` 安装到临时 Host 工作区
- 安装并启用正式基础卡片插件与默认主题
- 调用 `converter.card.to-html/convert`
- 调用 `converter.html.to-image/convert`
- 通过 Host Electron mock 验证输出文件、尺寸和 provider 注册状态

### 9.3 手工验收重点

- 真实样例卡片联调
- 长页面截图、透明背景、高清倍率场景验证
- job 取消和渲染资源清理验证

## 10. 当前实施前置条件

Host 侧正式 HTML 渲染导出能力已经落地，本仓当前不存在需要继续替换的脚手架实现。剩余工作只应围绕正式样例覆盖、联调验证和质量收口展开。

# 网页基础卡片插件

网页基础卡片用于在复合卡片中显示网页内容，支持两种来源：

- 远程网址
- 网页 ZIP 压缩包（入口文件必须为 `index.html`）

正式能力特点：

- 查看态通过嵌套网页 iframe 显示内容；
- 查看态可通过宿主注入的 `openResource(...)` 将当前远程 URL 或网页包入口打开意图交回正式资源打开链路；
- 显示区域支持两种正式模式：
  - 固定比例：固定为宽:高 `7:16`，在窗口内滚动查看网页；
  - 自由展开：按网页高度展开，最高不超过当前宽度的 `20` 倍；
- 查看态不会额外绘制描边或圆角，并会把当前显示区域通过正式视口协议传递给嵌入页；
- 网页 ZIP 包会由编辑器通过正式宿主能力解压并写入复合卡片根目录；
- 网页 ZIP 包导入通过 `importArchiveBundle({ entryFile: "index.html", include, stripSingleRootDir: true, excludeSystemArtifacts: true })` 表达通用目录导入规则；
- `index.html` 只是网页包入口文件，正式保存范围是压缩包内通过安全校验后的全部网页文件，配置通过 `resource_paths` 记录所有已导入文件；
- 编辑器采用 Ant Design 组件（`Segmented / Input / Button`，`ChipsForm` → 受控 state 面板做法 A）与“比例选择 -> 网页模式 -> 条件输入”的正式流程，网址输入自动刷新，ZIP 支持点击或拖拽上传；
- 编辑引擎编辑态会通过透明选择层屏蔽网页内部交互，点击网页区域直接选中该基础卡片并打开对应编辑面板；
- 若网页禁止被 iframe 嵌入，则显示明确错误提示。

## 界面文案

- 简体中文直写（task030 后全生态统一），文案总表见 `src/lib/messages.ts`（`formatMessage(key, params)` 插值）。

## 技术栈

- React 运行时；UI 组件基于 Ant Design（`antd`），编辑器面板入口统一套用共享层苹果主题 `appleTheme`（`@chips/ui`），视觉与文案规范遵循 `项目日志与笔记/task030-卸担计划/` 03 / 04 / 06 / 07 章。
- 卡片格式契约（`.card` 序列化字段、`basecardDefinition`、Host 资源桥链路）不依赖任何 UI 框架，保持独立。
- 查看态不再消费 Host 注入的 `themeCssText`（宿主契约字段保留），只注入插件自有查看态样式。

## 目录结构

```text
webpage-BCP/
├─ src/
│  ├─ index.ts
│  ├─ lib/
│  │  └─ messages.ts
│  ├─ editor/
│  │  ├─ panel.tsx
│  │  └─ runtime.ts
│  ├─ render/
│  │  ├─ view.tsx
│  │  └─ runtime.ts
│  ├─ schema/
│  │  └─ card-config.ts
│  └─ shared/
│     └─ utils.ts
├─ 归档/
├─ templates/
├─ docs/
└─ tests/
```

## 开发与验证

在插件目录执行：

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run validate
npm run package
npm run verify
```

如果需要本地开发服务：

```bash
npm run dev
```

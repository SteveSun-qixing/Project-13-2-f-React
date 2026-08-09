# 超链接基础卡片插件

> 通过 `chips-scaffold-basecard` 初始化，并按正式基础卡片契约实现的超链接基础卡片插件工程。

## 简介

本插件工程实现了一个基础卡片插件（`type: card`），用于在复合卡片中插入一个可点击的新页面跳转链接。

查看态会把链接渲染为一个全宽链接条目，文本靠左，并展示目标域名、描述、可选图标和安全提示。点击有效链接时，插件只通过基础卡片 `openResource` 链路交给外层容器调用 Host `resource.open`，最终由 Host 统一决定应用路由、系统打开或外链打开。宿主未注入 `openResource` 时，链接降级为静态不可打开状态，不在基础卡片 iframe 内直接调用系统浏览器。编辑态提供：

- `anchor_text`：锚文本；
- `url`：链接，必须是有效的 `http` 或 `https` 地址。
- `description`：可选描述；
- `icon_url`：可选图标 URL，必须是有效的 `http` 或 `https` 地址；
- `open_mode`：打开方式偏好，作为 `resource.open` payload 透传；
- `display_density`：查看态显示密度；
- `show_security_hint`：是否显示安全提示。

## 项目结构

```text
hyperlink-BCP/
├─ .eslintrc.cjs          # 工程级 ESLint 配置（供 chipsdev-r lint 调用）
├─ manifest.yaml          # 插件清单（type: card）
├─ package.json           # NPM 配置
├─ tsconfig.json          # TypeScript 配置
├─ chips.config.mjs       # chips dev 构建配置
├─ src/
│  ├─ index.ts            # 插件入口（注册渲染与编辑模块）
│  │                      # 同时导出 basecardDefinition 正式契约
│  ├─ lib/
│  │  └─ messages.ts      # 简体中文文案总表（formatMessage 插值）
│  ├─ render/
│  │  ├─ view.tsx         # 渲染模块：基础卡片视图
│  │  └─ runtime.ts       # 渲染运行时挂载逻辑
│  ├─ editor/
│  │  ├─ panel.tsx        # 编辑模块：编辑面板视图
│  │  └─ runtime.ts       # 编辑运行时挂载逻辑
│  ├─ schema/
│  │  └─ card-config.ts   # 配置 Schema 与类型定义
│  └─ shared/
│     └─ utils.ts         # 渲染与编辑共享工具函数
├─ config/
│  └─ logging.ts          # 日志封装
├─ 归档/
│  ├─ i18n/               # 已废弃的多语言语言档案
│  └─ src-shared-i18n/    # 已废弃的 createTranslator 翻译器
├─ templates/
│  ├─ default-card-config.yaml  # 默认基础卡片配置模板
│  └─ parameters.md       # 参数表与填写说明
├─ docs/
│  └─ 超链接基础卡片插件说明.md
├─ tests/
│  ├─ setup.ts            # jsdom 测试环境存根（ResizeObserver 等）
│  ├─ unit/
│  │  ├─ render-view.test.tsx
│  │  └─ editor-panel.test.tsx
│  └─ integration/
│     └─ card-flow.test.ts
└─ assets/
   └─ icons/
      ├─ basecard-icon.svg
      └─ SOURCE.md
```

## 快速开始

```bash
cd <生态根工作区>
npm install
cd hyperlink-BCP
npm run dev
```

基础卡片工程中的 `chips-sdk` 与 `chipsdev-r` 统一依赖生态根工作区解析；请通过 `chipsdev-r create` 将工程接入工作区，不再单独在项目目录执行首次依赖安装。

在开发模式下，使用 `chips dev server` 启动本地开发环境，根据 `chips dev` 工具文档在 Host 工作区中加载插件进行调试。

## 配置结构

基础卡片配置类型在 `src/schema/card-config.ts` 中定义，对应 YAML 文件示例位于 `templates/default-card-config.yaml`。

参数表与填写说明见 `templates/parameters.md`。

当前插件默认内置：

- React 渲染与编辑运行时
- `normalizeBasecardConfig()` / `validateBasecardConfig()` 统一归一与校验基线
- `renderBasecardView()` / `renderBasecardEditor()` / `basecardDefinition` 正式入口
- `card_type/theme/locale/anchor_text/url/description/icon_url/open_mode/display_density/show_security_hint` 正式配置模型（`theme`/`locale` 为保留契约字段，不再消费）
- `http/https` 协议白名单、凭据 URL 阻断、HTTP 风险提示和 Host 打开能力缺失降级

## 正式入口契约

本工程在 `src/index.ts` 中导出：

- `renderBasecardView(ctx)`：供 Host 通用查看链路与编辑引擎单卡 iframe 复用；
- `renderBasecardEditor(ctx)`：供 Host 托管编辑器与编辑引擎本地编辑面板复用；
- `basecardDefinition`：供编辑引擎运行时注册表消费插件元信息、归一/校验逻辑与渲染能力。

生成后请至少确认以下字段与清单保持一致：

- `basecardDefinition.pluginId === manifest.id`
- `basecardDefinition.cardType === manifest.capabilities.cardTypes[0]`
- `basecardDefinition.aliases` 显式声明 `HyperlinkCard` 内容类型别名；
- `basecardDefinition.previewPointerEvents === "shielded"`，编辑引擎预览态点击优先选中基础卡片，查看态仍按正常链接打开新页面；
- `basecardDefinition.icon` 是运行时正式图标描述符；
- `assets/icons/basecard-icon.svg` 只作为静态资源保留，来源说明见 `assets/icons/SOURCE.md`。

## 视觉与文案约束

- 视觉固定为生态统一苹果风格：antd token 与共享层 `appleTheme`（`@chips/ui`），查看态样式为插件自有 CSS（固定色值，不再读取主题 CSS 变量）；不引入第二套视觉体系。
- 编辑面板入口统一套用 `ConfigProvider locale={zhCN} theme={appleTheme}`；表单按 antd 受控组件实现（做法 A），`onChange` 语义不变。
- 用户可见文案统一简体中文直写，总表维护在 `src/lib/messages.ts`（`formatMessage` 插值），不再使用多语言系统。
- 查看态不渲染 Host 注入的 `themeCssText`（`BasecardRenderContext.themeCssText` 作为宿主契约字段保留、不消费）。

## 资源打开边界

- 查看态有效链接点击只调用宿主 `openResource(...)`。
- `openResource(...)` payload 使用 `kind: "chips.hyperlink-card"`、`version: "1.0.0"`、`cardType: "base.hyperlink"`，并透传 `openMode`、`displayDensity`、`sourceUrl`、`securityLevel` 和 `securityReason`。
- 插件不调用 `transfer.openExternal`、`platform.openExternal`、`window.open`，不硬编码目标应用，不直接访问 Host 内部服务。

# {{ DISPLAY_NAME }}

> 标准基础卡片插件工程。

## 简介

本插件工程实现了一个基础卡片插件（`type: card`），用于演示如何：

- 在查看器中渲染基础卡片内容，并解析 Host 注入的资源预览地址；
- 在编辑引擎中提供编辑面板，编辑基础卡片配置；
- 通过 `basecardDefinition` 同时对接 Host 通用链路与官方编辑引擎运行时；
- 使用 YAML 配置文件保存基础卡片数据；
- 使用 antd（Ant Design v6）+ `@chips/ui` 共享层与简体中文直写文案。

## 项目结构

```text
{{ PROJECT_NAME }}/
├─ .eslintrc.cjs          # 工程级 ESLint 配置（供 chipsdev-r lint 调用）
├─ manifest.yaml          # 插件清单（type: card）
├─ package.json           # NPM 配置
├─ tsconfig.json          # TypeScript 配置
├─ vitest.config.mts      # 生成工程测试配置
├─ chips.config.mjs       # chipsdev-r 构建配置
├─ src/
│  ├─ index.ts            # 插件入口（注册渲染与编辑模块）
│  │                      # 同时导出 basecardDefinition 正式契约
│  ├─ lib/
│  │  └─ messages.ts      # 简体中文文案总表与 formatMessage
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
├─ templates/
│  ├─ default-card-config.yaml  # 默认基础卡片配置模板
│  └─ parameters.md       # 参数表与填写说明
├─ tests/
│  ├─ unit/
│  │  ├─ schema.test.ts
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
cd {{ PROJECT_NAME }}
npm run dev
```

基础卡片工程中的 `chips-sdk`、`chipsdev-r` 与 `@chips/ui` 统一依赖生态根工作区解析；请通过 `chipsdev-r create` 将工程接入工作区，不再单独在项目目录执行首次依赖安装。

在开发模式下，使用 `chipsdev-r server` 启动本地开发环境，并根据 chipsdev-r 开发者命令行手册在 Host 开发工作区中加载插件进行调试。

## 配置结构

基础卡片配置类型在 `src/schema/card-config.ts` 中定义，对应 YAML 文件示例位于 `templates/default-card-config.yaml`。

参数表与填写说明见 `templates/parameters.md`。

本工程默认内置：

- React 渲染与编辑运行时
- antd（Ant Design v6）控件与 `@chips/ui` 共享层（`appleTheme` 苹果风格主题）
- `normalizeBasecardConfig()` / `validateBasecardConfig()` 统一归一与校验基线
- `collectBasecardResourcePaths()` 卡片根目录资源路径收集
- `renderBasecardView()` / `renderBasecardEditor()` / `basecardDefinition` 正式入口
- `card_type/theme/title/body/locale/resource_path` 正式配置模型

## 验证链路

生成工程默认提供以下正式脚本：

- `npm run lint`：通过 chipsdev-r 调用 ESLint；
- `npm run typecheck`：执行 TypeScript 严格类型检查；
- `npm test`：通过 chipsdev-r 调用 Vitest；
- `npm run build`：通过 chipsdev-r 生成插件构建产物；
- `npm run validate`：校验 Manifest、构建产物和正式资源；
- `npm run package`：按 Manifest 与构建产物生成 `.cpk` 插件包；
- `npm run verify`：串联上述所有默认门禁。

## 正式入口契约

本工程默认在 `src/index.ts` 中导出：

- `renderBasecardView(ctx)`：供 Host 通用查看链路与编辑引擎单卡 iframe 复用；
- `renderBasecardEditor(ctx)`：供 Host 托管编辑器与编辑引擎本地编辑面板复用；
- `basecardDefinition`：供编辑引擎运行时注册表消费插件元信息、归一/校验逻辑与渲染能力。

生成后请至少确认以下字段与清单保持一致：

- `basecardDefinition.pluginId === manifest.id`
- `basecardDefinition.cardType === manifest.capabilities.cardTypes[0]`
- 如需兼容历史卡片类型别名，请在 `aliases` 中显式声明，而不是把别名判断散落到业务组件里。
- `basecardDefinition.icon` 是运行时正式图标描述符；
- `assets/icons/basecard-icon.svg` 只作为静态资源保留，来源说明见 `assets/icons/SOURCE.md`。

## 视觉与文案约束

- 编辑面板通过 `ConfigProvider(locale=zh_CN, theme=appleTheme)` 接入 antd 中文文案与苹果风格 token；
- 查看态与编辑态视觉样式固定为生态统一苹果风格，不使用已废弃的主题系统变量（`--chips-sys-*`）；
- 界面文案简体中文直写，统一维护在 `src/lib/messages.ts`，调用点使用 `formatMessage("key", params)`；
- 查看态不默认添加额外边框、阴影、圆角壳层，基础卡片外观由宿主装配层决定。

## 资源与生命周期

- `resource_path` 只保存卡片根目录相对路径，不保存绝对路径、`file://`、`blob:` 或 `data:` 运行时地址；
- 查看态通过 `resolveResourceUrl()` 获取临时预览 URL，并在 cleanup 中通过 `releaseResourceUrl()` 释放；
- 查看态通过 `openResource()` 表达资源打开意图，业务上下文放入 `payload`，不在基础卡片内部直接启动应用；
- 编辑态通过 `importResource()` 导入文件，只把宿主返回的 `path` 写回配置；
- 编辑态通过 `deleteResource()` 删除当前引用资源，成功后清空 `resource_path`；
- `importArchiveBundle()` 与 `convertTiffToPng()` 是可选宿主能力，适合网页包、图片序列、TIFF 封面转换等资源型卡片扩展；
- 查看态和编辑态都支持重复挂载，新挂载前会清理同一容器上的旧 React root；
- 编辑态 cleanup 会恢复 `html/body/container` 被本次挂载修改过的内联样式。

## 表单与文案

- 编辑面板使用受控状态（做法 A）：原生 `<form>` + antd `Input` / `Input.TextArea` / `Button` 控件，字段变更直接同步配置并触发 `onChange`；
- 校验失败时字段级错误与全局错误以 `formatMessage` 中文文案展示；
- 用户可见文案统一写入 `src/lib/messages.ts`，源码中不硬编码中文界面文案。

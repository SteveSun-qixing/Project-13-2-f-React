# 富文本编辑器（chips.official.rich-text-editor）

> 角色：`app`；插件 ID：`chips.official.rich-text-editor`；版本：`0.1.0`

单文档 Markdown 所见即所得编辑器：不重写富文本编辑运行时，直接调用富文本基础卡片插件（`@chips/plugin-richtext`，G9 复用白名单在册）的正式编辑器能力 `renderEditor`（Milkdown 引擎装配唯一口径在插件内），包装为独立应用；正式产物为「复合卡片容器 + 一张富文本基础卡片」的固定复合卡片（`base.richtext`，01-卡片文件格式 §6.6）。

## 功能面（W5 编辑臂收口，2026-10-01）

- **编辑器主体**：打开卡片（`document:open` 正式面；来源引用 / 命令派发 / `resource:opened` 投递三入口）→ 编辑会话受管装载 → Milkdown 编辑器挂载（复用插件公开导出，禁复制装配逻辑；§2.14 解析归一随行生效）→ 编辑回流唯一时序（`getChange()` → 校验 → `document:write` → 投影重读 → `markCommitted`，修订回执严格递增）→ `document:save` 回执驱动保存态；
- **卡库 / 卡箱浏览面**（08-产品与交互 01.04 口径最小可用）：卡片 / 箱子两标签页、打开来源输入、新建入口（`document:create` 正式契约调用；宿主实现在途——工单072 在册，失败如实回码）；
- **命令族**（13-命令系统契约）：`open-card` / `save-document` / `export-document` / `new-card` / `refresh-view`，与 manifest `cli.commands` 一一对应（测试锁定）；
- **导出入口**：`document:export` 正式契约调用（宿主实现候第十三项，工单072 在册）。

## 目录结构

```text
rich-text-editor/
├── manifest.yaml            # 唯一权威清单（权限面与命令族）
├── package.json             # 工作区包 @chips/plugin-rich-text-editor
├── vite.shared.ts           # 构建红线守卫与平台 vendor 表
├── vite.main.config.ts      # 主进程入口构建 → dist/index.js
├── vite.render.config.ts    # 渲染入口构建（@chips/plugin-richtext 复用锚点）→ render.js
├── vitest.config.ts         # 测试配置（jsdom + 复用锚点 alias）
├── src/index.ts             # IAppPlugin 实现 → dist/index.js
├── src/domain/card/         # 固定复合卡片文档模型（W5 迁移臂交付，79 例基线）
├── src/domain/editor/       # 编辑臂：文档网关（document:* 消费面）+ 编辑会话（唯一时序）+ 视图装配
├── src/commands/            # 命令族元数据与 UI 命令运行时接线
├── src/ui/                  # AppView + 卡库/卡箱浏览面 + 编辑区 + 插件编辑器挂载点
├── tests/                   # 网关契约 / 会话时序 / 往返恰等 / 编辑臂集成（fake 桥）
└── assets/icons/            # 启动器图标
```

## 常用命令

```bash
pnpm install                                   # 在工作区根建立链接
pnpm --filter @chips/plugin-rich-text-editor run typecheck
pnpm --filter @chips/plugin-rich-text-editor run test
pnpm --filter @chips/plugin-rich-text-editor run test:coverage
pnpm --filter @chips/plugin-rich-text-editor run build
pnpm --filter @chips/plugin-rich-text-editor run package       # 打包 .cpk（由 @chips/cli 执行）
```

构建产物为 `dist/index.js`（主进程入口，自包含 ESM）与 `render.js`（渲染入口，外部化 React 与 `@chips/ui`；Milkdown 随 `@chips/plugin-richtext` 复用锚点内联）。`.cpk` 布局、签名与校验规则以《插件包格式》为准。

## 在册缺位（不临时绕过）

- `document:create` / `document:export` 宿主能力处理器缺位（工单072，候第十三项）：新建与导出入口按正式契约真调，能力未注册时如实呈现 `BRIDGE_CAPABILITY_NOT_FOUND`；宿主收口后应用零改动回填；
- `resource:opened` 运行中投递的宿主路由（工单063 族）：订阅面为本臂正式消费位，宿主路由收口前以空态如实呈现。

## 规范入口

《应用插件开发指南》《应用插件接口》《基础卡片插件接口》（§4 编辑契约）；《编辑引擎设计》（§6 回流时序、§13 创建链路）；《官方应用功能总览》§十二；《插件清单规范》《插件包格式》《TypeScript 编码规范》《测试规范》。

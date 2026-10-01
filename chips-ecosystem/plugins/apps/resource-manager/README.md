# 资源管理器

> 角色：`app`；插件 ID：`chips.official.resource-manager`；版本：`0.1.0`

工作区浏览、查找与批量组织：重命名、移动、复制、删除、新建目录、批量标签、收藏与最近；不创建卡片、不编辑内容、不解析文档（全新建，《04-资源管理器产品设计》为唯一母型）。

## 当前交付面（W5 起步臂：资源浏览域只读消费 + 条目呈现）

- **条目呈现数据模型**（`src/domain/browse/entryModel.ts`）：浏览位置清单（按 `documentId` 幂等，
  不自造 ID）、条目呈现投影（启用前置 + zh 词序、名称取 `url` 末段）、分页切片、结构计数、
  标签拍平——全部派生自文档链路类型化切片。
- **只读消费面**（`src/domain/browse/browseGateway.ts`）：`document:open` / `document:read`
  经 `@chips/sdk` 正式面消费（`resources:read` 解锁且宿主真实现，工单036 波 C3）；卡片 → 结构摘要、
  箱子 → 条目清单（range 分页）。
- **三栏壳**（`src/ui/`，§2.2 最小可用面）：导航栏（快速访问「未就绪」如实呈现 + 已打开位置）+
  内容区（来源输入工具栏 + 条目/结构列表）+ 详情面板（属性与标签呈现）；`Tree` 属 @chips/ui
  禁面组件，组织呈现以白名单件（List）承担；文案简体中文直写，样式全 token。
- **命令族**（`src/commands/`）：`resource-manager:open-card` / `resource-manager:refresh-view`，
  与 manifest `cli.commands` 逐字对应（锁测对照），按《13-命令系统契约》注册。

## 已登记缺位（诚实降级，不假接线）

- **目录树数据源缺位**（工单036 后续段，`filesystem:read:${workspace}` 域）：工作区根以「未就绪」
  呈现，不做目录扫描、不伪造树形列表；域处理器落波后接工作区扫描装配臂（§2.3 位置模型随之完整）。
- **写臂缺位**（工单036 后续段，`resource:write` / `resources:write` 注册）：重命名/移动/复制/删除/
  新建目录/批量标签（§五 批量操作）本臂不实现、不声明写权限；manifest 权限面与只读实现一致。
- **打开意图路由缺位**：`resource:open` 未落位，条目「打开」动作为后续臂（§5.1 打开意图）。
- **跨会话浏览状态与收藏/最近缺位**：插件私有数据目录通道未接，位置清单为会话内存态（§2.4 状态分层
  如实降级；选择/展开/滚动本就属内存态）。
- **命令通道缺位**：`command:*` 宿主派发处理器未落位期间，注册失败收敛为「命令通道异常」状态条，
  界面照常工作（骨架既有口径）。

## 目录结构

```text
resource-manager/
├── manifest.yaml                    # 唯一权威清单（权限与只读实现一致；不声明 fileAssociations）
├── package.json                     # 工作区包 @chips/plugin-resource-manager，version 与 manifest 一致
├── tsconfig.json                    # 继承仓库 tsconfig.base.json
├── vite.shared.ts                   # 构建红线守卫与平台 vendor 表
├── vite.main.config.ts              # 主进程入口构建 → dist/index.js
├── vite.render.config.ts            # 渲染入口构建 → render.js
├── vitest.config.ts                 # 测试配置（jsdom 环境）
├── src/index.ts                     # IAppPlugin 实现 → dist/index.js
├── src/domain/browse/               # 条目呈现模型与 document:* 只读消费面
├── src/commands/                    # cli.commands 对应命令元数据与 UI 命令运行时接线
├── src/ui/                          # 三栏壳（导航/内容/详情）→ render.js
├── tests/                           # vitest 单元测试（模型/网关/命令/壳）
├── assets/icons/                    # 启动器图标
```

## 常用命令

```bash
pnpm install                                   # 在工作区根建立链接
pnpm --filter @chips/plugin-resource-manager run typecheck
pnpm --filter @chips/plugin-resource-manager run test
pnpm --filter @chips/plugin-resource-manager run test:coverage
pnpm --filter @chips/plugin-resource-manager run build
pnpm --filter @chips/plugin-resource-manager run package       # 打包 .cpk（由 @chips/cli 执行）
```

构建产物为 `dist/index.js`（主进程入口，自包含 ESM）与 `render.js`（渲染入口，外部化 React 与 `@chips/ui`）。
`.cpk` 布局、签名与校验规则以《插件包格式》为准。

## 后续臂（候波次，不代裁）

1. 工作区扫描装配臂（`filesystem:read:${workspace}` 域处理器落波后，工单036 后续段）——
   目录树/位置模型/视图模式（列表/网格/时间线）逐档启用。
2. 写臂（`resource:write` 注册后，工单036 后续段）——重命名/移动/复制/删除/新建目录/批量标签
   （§五），权限面随实现扩展。
3. 收藏与最近（§六）：插件私有数据目录（`${userData}/plugins/chips.official.resource-manager/`）
   通道落位后落跨会话存储。
4. 标签导航与筛选（§三）：标签系统（06-标签系统设计）索引与筛选表达式随标签域落位接入。
5. 《09-官方插件与应用目录》resource-manager 行状态翻正随端到端臂收口时随批办理。

## 规范入口

《应用插件开发指南》《应用插件接口》；《插件清单规范》《插件包格式》《TypeScript 编码规范》《测试规范》；
产品形态见《04-资源管理器产品设计》与《06-标签系统设计》。

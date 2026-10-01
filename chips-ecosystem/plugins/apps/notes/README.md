# 笔记

> 角色：`app`；插件 ID：`chips.official.notes`；版本：`0.1.0`

笔记本与笔记工作台：以 `.box` 为笔记本、`.card` 为笔记组织与编辑内容（`Chips-Notes` 按矩阵整重写的迁移落点）。

## 当前交付面（W5 起步臂：领域层 + UI 壳）

- **领域层**（`src/domain/notes/`）：笔记数据模型（笔记本/笔记分区、标签与条目呈现）与存储契约消费面——
  `document:open` / `document:read` 经 `@chips/sdk` 正式面消费（宿主真实现，工单036 波 C3）；
  卡片 content 按 `nodeId` 逐节点读取、箱子 `entries` 支持分页，组合语义与宿主校验同源。
- **UI 壳**（`src/ui/`）：左列表（笔记本/笔记分区，`@chips/ui` 替代件呈现，禁面组件 `Tree` 不迁移）
  + 右编辑区骨架（元数据、标签、条目/内容节点只读呈现）；文案简体中文直写，样式全 token。
- **命令族**（`src/commands/`）：`notes:open-card` / `notes:refresh-view`，与 manifest `cli.commands`
  逐字对应，按《13-命令系统契约》注册；处理器路由到领域控制器真实动作。

## 已登记缺位（诚实降级，不假接线）

- **工作区枚举通道缺位**（工单036 后续段，`filesystem:read:${workspace}` 域）：笔记库列表不做目录扫描，
  只经打开臂显式收录文档；域处理器落波后增扫描装配臂。
- **编辑链路缺位**（候 IEditSession 生产装载，工单036 波 C 终闸）：编辑区为只读消费骨架，
  不接线 `document:write` / `document:save`，不伪造可编辑外观。
- **命令通道缺位**：`command:*` 宿主派发处理器未落位期间，注册失败收敛为「命令通道异常」状态行，
  界面照常工作（骨架既有口径）。
- 触禁件（`Tree`/`message` 静态实例/`Popconfirm`）候第十二项裁定：本臂零触达，组织呈现以
  `@chips/ui` 白名单件（List/Tag/Badge）承担。

## 目录结构

```text
notes/
├── manifest.yaml                # 唯一权威清单
├── package.json                 # 工作区包 @chips/plugin-notes，version 与 manifest 一致
├── tsconfig.json                # 继承仓库 tsconfig.base.json
├── vite.shared.ts               # 构建红线守卫与平台 vendor 表
├── vite.main.config.ts          # 主进程入口构建 → dist/index.js
├── vite.render.config.ts        # 渲染入口构建 → render.js
├── vitest.config.ts             # 测试配置（jsdom 环境）
├── src/index.ts                 # IAppPlugin 实现 → dist/index.js
├── src/domain/notes/            # 笔记数据模型与 document:* 存储契约消费面
├── src/commands/                # cli.commands 对应命令元数据与 UI 命令运行时接线
├── src/ui/                      # 应用窗口界面（列表 + 编辑区骨架）→ render.js
├── tests/                       # vitest 单元测试（模型/网关/命令/壳）
├── assets/icons/                # 启动器图标
```

## 常用命令

```bash
pnpm install                                   # 在工作区根建立链接
pnpm --filter @chips/plugin-notes run typecheck
pnpm --filter @chips/plugin-notes run test
pnpm --filter @chips/plugin-notes run test:coverage
pnpm --filter @chips/plugin-notes run build
pnpm --filter @chips/plugin-notes run package       # 打包 .cpk（由 @chips/cli 执行）
```

构建产物为 `dist/index.js`（主进程入口，自包含 ESM）与 `render.js`（渲染入口，外部化 React 与 `@chips/ui`）。
`.cpk` 布局、签名与校验规则以《插件包格式》为准。

## 后续臂（候波次，不代裁）

1. 工作区扫描装配臂（`filesystem:read:${workspace}` 域处理器落波后，工单036 后续段）。
2. 编辑链路臂：IEditSession 生产装载落位后在本编辑区接线 `document:write` / `document:save`。
3. 笔记工作台完整形态（窗口体系/画布/拖放）候渲染链与帧执行通道（#85/工单025）与
   「平台完全承接笔记编辑场景」确认（三应用矩阵缺口 3）。
4. 《09-官方插件与应用目录》notes 行状态翻正随端到端臂收口时随批办理。

## 规范入口

《应用插件开发指南》《应用插件接口》；《插件清单规范》《插件包格式》《TypeScript 编码规范》《测试规范》；
能力语义见《04-能力契约规范》§7.3 与《11-文档服务设计》。

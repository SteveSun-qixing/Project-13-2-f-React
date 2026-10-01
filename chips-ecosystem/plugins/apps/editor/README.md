# 编辑引擎

> 角色：`app`；插件 ID：`chips.official.editor`；版本：`0.1.0`

编辑链路官方消费者与 `.card` / `.box` 官方生产工具：工作区场景、卡片与箱子窗口、编辑面板、封面与导出。

W5 应用迁移三段式推进中：第②段骨架已交付（四闸绿）；**本包当前状态＝第③段搬运臂已落（15 行搬运件 + 2 随迁测试 + 4 启动器图标），主体（场景 / 六模式布局 / 窗口 / 拖放 / 编辑面板 / 命令，旧仓 151 行重写集）候前置件，尚未开工**（缺位登记见下文）。

## 搬运件映射登记（W5 第③段搬运臂，2026-10-01）

裁决底册：《W5开工前置-应用族逐仓勘查-2026-10-01.md》派单行表 #10（「15 行搬运臂可先派」）；逐文件裁决照办《旧功能覆盖矩阵-编辑引擎与UI与设置面板-2026-09-20》§三/§六.2（纯逻辑/工具件逐字迁移 + 类型面适配；旧仓只读冻结，零改动）。

| 旧路径（Chips-EditingEngine） | 新路径（本包） | 裁决 | 迁移适配登记 |
|---|---|---|---|
| `src/utils/a11y.ts`（314 行） | `src/utils/a11y.ts` | 迁移（矩阵 §三「通用工具」行） | 逐字迁移：引号统一工作区单引号口径；`activeId` 索引访问补 `?? null` 收敛（`noUncheckedIndexedAccess`）；一处超宽类型签名按 printWidth 换行。逻辑零语义差。升共享层需走 `@chips/ui` 导出面 RFC（矩阵 §六.2），本包不重复登记 |
| `src/utils/id.ts`（56 行） | `src/utils/id.ts` | 迁移（矩阵 §三「通用工具」行） | 逐字迁移：随机主路径取字符 `ID_CHARS[...]` 改 `.charAt(...)`（`noUncheckedIndexedAccess` 类型面收敛，与同函数回退分支写法一致）。仅界面内部标识用，不涉插件/能力 ID |
| `src/components/CardSettings/panels/cover-crop-layout.ts`（162 行） | `src/card-settings/cover-crop-layout.ts` | 迁移（矩阵 §三「可复用纯函数（布局/导出）」行） | 逐字迁移：`parseCoverRatio` 导入来源改同目录 `cover-ratio.ts`，其余零改动 |
| `src/components/CardSettings/panels/cover-panel-layout.ts`（54 行） | `src/card-settings/cover-panel-layout.ts` | 迁移（同上） | 逐字迁移：导入来源改同目录 `cover-ratio.ts`，其余零改动 |
| `src/components/CardSettings/panels/export-utils.ts`（50 行） | `src/card-settings/export-utils.ts` | 迁移（同上） | 逐字迁移，零语义差、零依赖变更；落盘动作面候 `document:export` 提供方（第十三项），本件不涉能力调用 |
| `src/utils/card-cover.ts`（148 行） | `src/card-settings/cover-ratio.ts`（依赖收编，非全件迁移） | 全文件**废弃**（封面 HTML 生成归 W4 `chips.module.cover`，矩阵 §三「封面服务与封面工具」行） | 仅收编 `parseCoverRatio` 最小依赖闭包（`DEFAULT_COVER_RATIO`/`normalizeCoverRatio`/`parseCoverRatio` 逐字 + 缩进 4→2 空格适配）：两布局件的唯一外部依赖属比例字符串呈现数学，零能力零 Host；全文件废弃裁决不变，封面生成面不迁移 |
| `tests/unit/cover-crop-layout.test.ts` | `tests/cover-crop-layout.test.ts` | 测试随迁（矩阵 §三「测试」行：迁移 2） | 断言逐条随迁（3 例，不放宽、不删例），仅被测件导入路径适配 |
| `tests/unit/cover-panel-layout.test.ts` | `tests/cover-panel-layout.test.ts` | 测试随迁（同上） | 断言逐条随迁（3 例，不放宽、不删例），仅被测件导入路径适配 |
| `assets/icons/app-icon.{svg,png,ico,icns}`（4 件） | `assets/icons/app-icon.{svg,png,ico,icns}` | 迁移（矩阵 §二.6：应用图标判迁移，launcher 图标功能仍需） | 同批次四格式逐字复制，sha256 与旧仓核对一致；来源与使用边界见 `assets/icons/SOURCE.md`；脚手架占位图标 `app.svg` 归档至 `chips-ecosystem/归档/W5编辑器-脚手架占位启动图标-20261001/`；manifest `ui.launcher.icon` 翻转指 `assets/icons/app-icon.svg` |

## 主体缺位登记（如实引用勘查底册，不重复开单）

编辑器主体＝旧仓 151 行重写集（场景/六模式布局/窗口/拖放/编辑面板/命令，矩阵 §六.1），按勘查底册派单行表 #10 登记为**候前置件**，前置件收口进度以《W5开工前置-应用族逐仓勘查-2026-10-01.md》及后续勘查为准：

1. **IEditSession 生产装载**（工单036 波 C 终闸；波 C3 已交付 document 存储适配器）；
2. **渲染帧插件执行通道**（#85 / 工单025）；
3. **命令域宿主处理器**；
4. **`chips.module.cover`**（封面生成模块，未落）；
5. **`document:export` 提供方**（第十三项候裁）。

上述缺位全部在既有工单/候裁通道在册，本臂不新开工单、不设任何临时/占位实现；骨架期命令面（`open-card`/`refresh-view`）与窗口界面保持第②段原样，主体臂开工时按矩阵 §六.1 重写收编。

## 目录结构

```text
editor/
├── manifest.yaml            # 唯一权威清单（launcher.icon 已指 app-icon.svg）
├── package.json             # 工作区包 @chips/plugin-editor，version 与 manifest 一致
├── tsconfig.json            # 继承仓库 tsconfig.base.json
├── vite.shared.ts           # 构建红线守卫与平台 vendor 表
├── vite.main.config.ts      # 主进程入口构建 → dist/index.js
├── vite.render.config.ts    # 渲染入口构建 → render.js
├── vitest.config.ts         # 测试配置（单元测试与包级集成测试）
├── src/index.ts             # IAppPlugin 实现 → dist/index.js（骨架原样，主体臂重写）
├── src/commands/            # cli.commands 对应命令元数据与 UI 命令运行时接线（骨架原样，主体臂重写）
├── src/ui/AppView.tsx       # 应用窗口界面根组件 → render.js（骨架原样，主体臂重写）
├── src/utils/               # 搬运件：a11y（键盘映射/roving tab index）、id（62 进制 ID）
├── src/card-settings/       # 搬运件：cover-crop-layout、cover-panel-layout、export-utils、cover-ratio（依赖收编）
├── tests/                   # vitest 单元测试（骨架 2 文件 + 随迁 2 文件）
└── assets/icons/            # 启动器图标四格式 + SOURCE.md 来源登记
```

## 常用命令

```bash
npx -y pnpm@9 install                                   # 在工作区根建立链接
npx -y pnpm@9 --filter @chips/plugin-editor run typecheck
npx -y pnpm@9 --filter @chips/plugin-editor run test
npx -y pnpm@9 --filter @chips/plugin-editor run test:coverage
npx -y pnpm@9 --filter @chips/plugin-editor run build
npx -y pnpm@9 --filter @chips/plugin-editor run package       # 打包 .cpk（由 @chips/cli 执行）
```

构建产物为 `dist/index.js`（主进程入口，自包含 ESM）与 `render.js`（渲染入口，外部化 React 与 `@chips/ui`）。
`.cpk` 布局、签名与校验规则以《插件包格式》为准。

## 规范入口

《应用插件开发指南》《应用插件接口》；《插件清单规范》《插件包格式》《13-命令系统契约》《TypeScript 编码规范》《测试规范》；
迁移裁决底册见《旧功能覆盖矩阵-编辑引擎与UI与设置面板》§三/§六，W5 派单与前置件口径见《W5开工前置-应用族逐仓勘查》行表 #10。

# 生态设置面板

> 角色：`app`；插件 ID：`chips.official.settings`；版本：`0.1.0`

平台设置、插件治理、权限审查、快捷键、文件打开方式、存储、更新与首启引导（`Chips-EcoSettingsPanel` 按矩阵整重写的迁移落点，随平台内置分发）。

## 当前交付面（W5 起步臂：偏好域 + 注册表壳层）

- **设置模型与分组契约**（`src/domain/settings/catalog.ts`）：九类导航注册表（Scene ID/标题/顺序/依赖域，
  《05-生态设置面板设计》§2.1 逐字对应）与偏好项描述符（配置键/分组/取值约束/默认值，§3.1/§3.2
  逐字对应）；取值归一（枚举白名单、整数界收敛、布尔校验）。
- **偏好存储**（`src/domain/settings/preferenceStore.ts`）：`SettingsPreferenceStore` 接口 +
  窗口会话内存态实现（诚实降级，工单066）；生效层如实标记「会话内存（未持久化）」。
- **壳层**（`src/ui/`）：注册表驱动九类导航（Menu + 在册图标）+ 偏好页（`SettingsLayout`/
  `SettingsGroup`/`SettingsRow` 三件套，外观/行为即时生效、单项与分组级恢复默认）+ 域依赖分类页
  （诚实呈现依赖域与登记去向，不铺替代控件）。
- **命令族**（`src/commands/`）：`settings:refresh-view`（manifest CLI 在册）+ 九类分类跳转命令
  `settings:open-<sceneId>`（《05-生态设置面板设计》§2.3，运行时注册；CLI 消费入口语义不适用）。

## 已登记缺位（诚实降级，不假接线）

- **`config:*` 配置域宿主处理器缺位**（**工单066** 在册）：偏好持久化收敛为窗口会话内存态；
  `SettingsPreferenceStore` 接口收口待换接 `IAppConfig` / `chips.request('config:*')` 实现，消费面零改动。
  平台键 schema（10-配置系统设计 §四）落定后随包补 `config.schema.json`。
- **其余七类治理页依赖域缺位**：工作区（`config:get`/`shell:openExternal`）、关于更新（`system:info`）、
  插件治理/权限/快捷键/文件打开方式/存储缓存（各自查询域）——页面如实呈现依赖域与落波去向，
  不呈现替代数据；随宿主域处理器逐域落位启用。
- **命令通道缺位**：`command:*` 宿主派发处理器未落位期间，注册失败收敛为「命令通道异常」状态行，
  界面照常工作（骨架既有口径）。
- 命令 ID 文法收口：设计文档 §2.3 所记 `<面板插件ID>.scene.<sceneId>` 点号旧记法与
  《13-命令系统契约》§2.1 文法不符，按契约取 `settings:open-<sceneId>`（随开发日志勘误候裁，不代改文档）。

## 目录结构

```text
settings/
├── manifest.yaml                  # 唯一权威清单
├── package.json                   # 工作区包 @chips/plugin-settings，version 与 manifest 一致
├── tsconfig.json                  # 继承仓库 tsconfig.base.json
├── vite.shared.ts                 # 构建红线守卫与平台 vendor 表
├── vite.main.config.ts            # 主进程入口构建 → dist/index.js
├── vite.render.config.ts          # 渲染入口构建 → render.js
├── vitest.config.ts               # 测试配置（jsdom 环境）
├── src/index.ts                   # IAppPlugin 实现 → dist/index.js
├── src/domain/settings/           # 设置模型与分组契约 + 偏好存储（会话内存降级件）
├── src/commands/                  # 命令元数据与 UI 命令运行时接线
├── src/ui/                        # 注册表壳层 + 偏好页/域依赖页 → render.js
├── tests/                         # vitest 单元测试（目录/存储/命令/壳）
├── assets/icons/                  # 启动器图标
```

## 常用命令

```bash
pnpm install                                   # 在工作区根建立链接
pnpm --filter @chips/plugin-settings run typecheck
pnpm --filter @chips/plugin-settings run test
pnpm --filter @chips/plugin-settings run test:coverage
pnpm --filter @chips/plugin-settings run build
pnpm --filter @chips/plugin-settings run package       # 打包 .cpk（由 @chips/cli 执行）
```

构建产物为 `dist/index.js`（主进程入口，自包含 ESM）与 `render.js`（渲染入口，外部化 React 与 `@chips/ui`）。
`.cpk` 布局、签名与校验规则以《插件包格式》为准。

## 后续臂（候波次，不代裁）

1. 配置域处理器落波后偏好持久化翻正（工单066 期望面：`packages/host/src/capabilities/config/`
   按 document 域同构落波）+ 随包补 `config.schema.json`。
2. 其余七类治理页随各自宿主查询域落位逐页启用（插件治理/权限/快捷键/文件打开方式/存储缓存/
   关于更新/工作区）。
3. 快捷键自定义与导入导出、首启引导（《05-生态设置面板设计》§六/§七）候命令与快捷键域。
4. W5 内被 editor 依赖的「关于/文件模式页」归此（派单行表 #9），随编辑器搬运臂对齐。

## 规范入口

《应用插件开发指南》《应用插件接口》；《插件清单规范》《插件包格式》《TypeScript 编码规范》《测试规范》；
产品形态见《05-生态设置面板设计》；配置分层见《10-配置系统设计》。

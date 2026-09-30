# 图标工坊

> 角色：`app`；插件 ID：`chips.official.iconmaker`；版本：`0.1.0`

由图片或图标字体生成 PNG、ICO、ICNS 图标资源包。业务面自 `Chip-iconMaker` 旧仓迁移（W5 派单行表 #6 第③段）：
编码算法 11 模块逐字迁移为纯函数领域层，应用壳/命令/CLI 按 `IAppPlugin` + `command:*` / `file:*` 新口径重写。

## 功能面

- **图片来源**：拖拽或点击上传 PNG / JPEG / WebP / GIF / SVG，实时预览，适应 / 填充两种缩放适配；
- **图标字体来源**：内置 Material Symbols（包内 woff2 ×3 + 码位表完整字形集 + 36 条精选离线兜底）、
  系统 Emoji、自定义字体（FontFace 注册 + 私用区字形）；前景常用色板与背景八种预设色板；
- **生成链路**：Canvas 渲染 → PNG 编码 → ICO（PNG 载荷，≤256px）/ ICNS（大端族容器）/ ZIP Store 资源包；
- **落盘臂**：经 `file:mkdir` / `file:write` 正式能力写入用户目录；filesystem 域宿主处理器未就绪
  （工单061 在册）时如实呈现失败与错误码，不伪造成功（诚实降级）；
- **命令**：`iconmaker:generate`（ui 目标，窗口内经命令通道派发执行；CLI 入口在 manifest 登记，
  `cli:task-*` 进度上报接线候宿主域处理器，登记不实现）。

## 目录结构

```text
icon-maker/
├── manifest.yaml            # 唯一权威清单（权限限定值、CLI 入口）
├── package.json             # 工作区包 @chips/plugin-icon-maker，version 与 manifest 一致
├── tsconfig.json            # 继承仓库 tsconfig.base.json
├── vite.shared.ts           # 构建红线守卫与平台 vendor 表
├── vite.main.config.ts      # 主进程入口构建 → dist/index.js
├── vite.render.config.ts    # 渲染入口构建 → render.js
├── vitest.config.ts         # 测试配置（jsdom 环境，单元测试与包级集成测试）
├── src/index.ts             # IAppPlugin 实现 → dist/index.js
├── src/domain/              # 图标生成领域层（binary/crc32/zip-store/ico/icns/canvas-renderer/generator/image-loader/file-names/types/default-fonts，旧仓逐字迁移）
├── src/export/              # filesystem 臂：iconSave.ts（落盘诚实降级）、source-image.ts（来源图路径装载）
├── src/commands/            # iconmaker:generate 命令元数据与 UI 命令运行时接线
├── src/ui/AppView.tsx       # 应用窗口界面（工作台：来源/字体/格式/尺寸/预览/落盘）
├── tests/                   # vitest 测试（领域真实夹具、命令、落盘诚实降级、UI 渲染冒烟）
├── assets/icons/            # 启动器图标（app-icon 四格式 + SOURCE.md 出处记录）
└── assets/fonts/            # Material Symbols woff2 ×3 + 码位表 + SOURCE.md（母本 design-assets/material-symbols）
```

## 常用命令

```bash
pnpm install                                   # 在工作区根建立链接
pnpm --filter @chips/plugin-icon-maker run typecheck
pnpm --filter @chips/plugin-icon-maker run test
pnpm --filter @chips/plugin-icon-maker run test:coverage
pnpm --filter @chips/plugin-icon-maker run build
pnpm --filter @chips/plugin-icon-maker run package       # 打包 .cpk（由 @chips/cli 执行）
```

构建产物为 `dist/index.js`（主进程入口，自包含 ESM）与 `render.js`（渲染入口，外部化 React 与 `@chips/ui`）。
`.cpk` 布局、签名与校验规则以《插件包格式》为准；当前分发态打包因 `.codepoints` 资产扩展名
未入打包器白名单挂账（工单065），四闸与包内功能不受影响。

## 已登记缺位（候宿主域处理器，零绕过）

- `file:read` / `file:write` / `file:mkdir` 宿主侧处理器未注册（工单061 同源）：落盘臂与 CLI 来源装载
  以错误码如实呈现失败，不伪造成功；
- `command:*` 域处理器未注册：命令注册收敛为「命令通道异常」展示，预览与生成不受影响；
- `cli:task-*` 进度上报接线（旧 CLI 臂 `cliTask.progress/complete/fail`）按派单口径登记不实现；
- 取色 GUI（`ColorPicker`）候《12-antd 转发面禁面》裁定，未落地前仅提供常用色板。

## 规范入口

《应用插件开发指南》《应用插件接口》；《插件清单规范》《插件包格式》《13-命令系统契约》
《TypeScript 编码规范》《测试规范》。

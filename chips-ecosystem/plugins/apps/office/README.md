# 薯片办公

> 角色：`app`；插件 ID：`chips.official.office`；版本：`0.1.0`

Word / 表格 / 演示 / PDF 四件套查看与编辑（.docx / .xlsx / .csv / .pptx / .pdf）。

## 域迁移状态（W5 三域臂，2026-10-01）

| 域 | 状态 | 落位 |
|---|---|---|
| 表格（sheet） | domain 15 模块 + gateway 23 模块纯逻辑已迁移（xlsx-gateway 的 node:fs 编排按「Node 直连重写边界」裁决移除，字节级函数原文保留；xlsx-package-io 归宿主 document 会话链臂重写） | `src/sheet/` |
| PDF（pdf） | 标注/搜索/文本行/线程/盖章/页面几何等 21 个纯逻辑模块已迁移（私有 IPC 契约抽取为 `src/pdf/contracts/`；渲染装配候渲染帧插件执行通道） | `src/pdf/` |
| 演示（slide） | 演示域模型（动画时序/调整柄几何/放映序列等 12 个纯逻辑模块）已迁移（vendor 引擎耦合文件候选型收口） | `src/slide/` |
| Word（word） | **不实现**：挂起于「richtext 编辑引擎选型（tiptap 续留 vs 自研）」在册候裁项，裁定前不引入 @tiptap/* 依赖 | — |

四域 UI（ribbon/画布/开始场景）按矩阵判重写，候端到端前置件（document 会话链、渲染帧插件执行通道、file/resource 域处理器）。迁移裁决依据与逐文件登记见《项目日志与笔记/W5迁移-office-三域臂-开发日志-2026-10-01.md》；第三方依赖选型见《第三方参考资产清单》§2.13。

## 目录结构

```text
office/
├── manifest.yaml            # 唯一权威清单
├── package.json             # 工作区包 @chips/plugin-office，version 与 manifest 一致
├── tsconfig.json            # 继承仓库 tsconfig.base.json
├── vite.shared.ts           # 构建红线守卫与平台 vendor 表
├── vite.main.config.ts      # 主进程入口构建 → dist/index.js
├── vite.render.config.ts  # 渲染入口构建 → render.js
├── vitest.config.ts         # 测试配置（单元测试与包级集成测试）
├── src/index.ts      # IAppPlugin 实现 → dist/index.js
├── src/commands/     # cli.commands 对应命令元数据与 UI 命令运行时接线
├── src/ui/AppView.tsx # 应用窗口界面根组件 → render.js
├── src/sheet/        # 表格域：domain（工作簿模型/公式/pivot）+ gateway（xlsx 字节读写）+ contracts（编辑契约）
├── src/pdf/          # PDF 阅读域：domain（标注/搜索/文本/几何）+ contracts（编辑输入契约）+ shared
├── src/slide/        # 演示域：domain（动画/调整柄/放映等纯逻辑）+ contracts（域动作契约）
├── tests/            # vitest 单元测试（含真实字节夹具 tests/fixtures/minimal.{xlsx,pdf,pptx}）
├── assets/icons/     # 启动器图标
```

## 常用命令

```bash
pnpm install                                   # 在工作区根建立链接
pnpm --filter @chips/plugin-office run typecheck
pnpm --filter @chips/plugin-office run test
pnpm --filter @chips/plugin-office run test:coverage
pnpm --filter @chips/plugin-office run build
pnpm --filter @chips/plugin-office run package       # 打包 .cpk（由 @chips/cli 执行）
```

构建产物为 `dist/index.js`（主进程入口，自包含 ESM）与 `render.js`（渲染入口，外部化 React 与 `@chips/ui`）。
`.cpk` 布局、签名与校验规则以《插件包格式》为准。

## 下一步

执行 `pnpm --filter @chips/plugin-office run build` 后用 `chips dev run` 启动开发宿主联调窗口。

## 规范入口

《应用插件开发指南》《应用插件接口》；《插件清单规范》《插件包格式》《TypeScript 编码规范》《测试规范》。

# chips-ecosystem

> 版本：v1.0.0
> 日期：2026-09-19
> 状态：正式版
> 适用范围：薯片生态新实现工作区的定位、目录职责、环境基线、标准命令与质量门禁入口

---

chips-ecosystem 是薯片生态重构后的唯一实现工作区（Cordis + Rust 核心 + Neon + Electron + React/@chips/ui）。全部新代码在本工作区落地；旧仓库与旧文档库已冻结，只读参考。

- 技术权威：[《薯片生态文档库》](../薯片生态文档库/README.md)：全部接口、文件格式、开发规范与质量门禁以文档库为唯一依据，本仓库文档只做链接与执行，不复制口径。
- 重构执行：[《重构大计划》](../重构大计划/00-总纲与路线图.md)：波次、文件台账与子智能体规范以该目录为准，当前波次见总纲"当前波次"章节。
- 工程流程：[`CONTRIBUTING.md`](./CONTRIBUTING.md)、[`docs/开发流程.md`](./docs/开发流程.md)。

## 一、目录结构

```
chips-ecosystem/
├── docs/                    # 工程流程文档与模板（仓库内工程文档基线；权威技术文档库在其外）
├── packages/
│   ├── core-rust/           # Rust 内核与子系统 crate（Cordis、Bridge 内核、解析、资源）
│   ├── native/              # Neon 绑定（chips-native → chips-native.node）
│   ├── bridge/              # @chips/bridge：Bridge 协议类型与 TS 桥接层
│   ├── host/                # @chips/host：Electron 壳、主进程、preload、渲染层、Host 能力
│   ├── sdk/                 # @chips/sdk：插件类型、客户端封装、测试辅助、脚手架导出
│   ├── ui/                  # @chips/ui：唯一前端导入面（组件、Hooks、Design Tokens）
│   ├── antd/                # @chips/antd：fork antd（仅 @chips/ui 内部使用）
│   └── cli/                 # @chips/cli：用户侧与开发侧命令
├── plugins/
│   ├── basecards/           # 基础卡片插件族（W4）
│   ├── layouts/             # 箱子布局插件族（W4）
│   ├── services/            # 服务/模块插件族（W4）
│   └── apps/                # 官方应用（W5）
├── tools/
│   ├── scaffold/            # 插件脚手架生成器与四角色模板
│   ├── contract-gen/        # 能力/权限/事件 ID 常量生成
│   ├── testing/             # @chips/testing：vitest 工厂、覆盖率口径与聚合门禁
│   └── gates/               # 门禁脚本（边界、契约、覆盖率、文档）
├── examples/plugins/        # 示例插件（hello 等，与官方插件同接口）
├── tests/                   # 契约测试、全链路 E2E、性能基线（contract/e2e/perf）
├── reports/                 # 门禁与覆盖率产物（已 gitignore，不随源码提交）
├── Cargo.toml               # Rust workspace 清单
├── package.json             # 根聚合脚本（命令唯一入口）
├── pnpm-workspace.yaml      # pnpm 工作区成员
└── tsconfig.base.json       # 全仓 TypeScript 共享配置
```

规则：仓库根只放工作区配置与文档；源码只落在上述目录；跨包依赖只允许 `workspace:*`（pnpm）与 `version.workspace = true`（Cargo）。

## 二、环境基线

| 工具                  | 版本要求              | 核验命令                                            |
| --------------------- | --------------------- | --------------------------------------------------- |
| Node.js               | >= 18 LTS             | `node --version`                                    |
| pnpm                  | 主版本 9              | `pnpm --version`                                    |
| Rust（rustc / cargo） | >= 1.75；edition 2021 | `rustc --version`                                   |
| Electron              | >= 27                 | `pnpm --filter @chips/host exec electron --version` |
| TypeScript            | >= 5                  | `pnpm --filter @chips/host exec tsc --version`      |

版本基线、平台前置条件与排障以[《开发环境配置》](../薯片生态文档库/06-开发与运维/01-开发环境配置.md)为唯一依据；三处（workspace 清单、CI 工作流、文档）必须一致。

## 三、标准命令

根脚本只做聚合与排序，集合与语义以根 `package.json` 与[《代码组织规范》§8.1](../薯片生态文档库/02-开发规范/01-代码组织规范.md)为准。

| 命令                                                | 说明                                                                   |
| --------------------------------------------------- | ---------------------------------------------------------------------- |
| `pnpm install`                                      | 还原 Node 工作区依赖（只在仓库根执行；`--frozen-lockfile` 校验锁文件） |
| `pnpm dev`                                          | 启动开发环境（Electron 壳 + 渲染层热更新 + Rust 增量编译）             |
| `pnpm build`                                        | 全量构建（Rust workspace → 平台包与插件）                              |
| `pnpm test`                                         | 全仓测试（Rust workspace + TS 包）                                     |
| `pnpm test:coverage`                                | 覆盖率全流程（cargo-tarpaulin + vitest v8 + 聚合门禁）                 |
| `pnpm test:coverage:rust` / `pnpm test:coverage:ts` | 分侧覆盖率执行（cargo-tarpaulin / vitest v8）                          |
| `pnpm report:coverage`                              | 覆盖率聚合报告与门禁判定（读取既有覆盖率产物）                         |
| `pnpm bench`                                        | Rust 基准测试（criterion，含解析器基准）                               |
| `pnpm test:contract`                                | 契约测试（核心导出面、角色接口、帧协议）                               |
| `pnpm test:e2e`                                     | 全链路 E2E（Playwright，配置见 `tests/e2e/`）                          |
| `pnpm test:e2e:fixtures`                            | 生成 E2E 夹具；`test:e2e:fixtures:check` 校验夹具与提交一致            |
| `pnpm lint`                                         | 静态检查（ESLint + Prettier + rustfmt + clippy）                       |
| `pnpm typecheck`                                    | 类型检查（`tsc -b` 与各包）                                            |
| `pnpm package`                                      | 生成安装包与 `.cpk`                                                    |
| `pnpm clean`                                        | 清理构建产物                                                           |
| `pnpm docs:check`                                   | 文档门禁（坏链、索引、文档头、公开 API 文档覆盖率）                    |
| `pnpm ci`                                           | 流水线聚合入口：检查 → 测试 → 契约 → 构建 → 门禁（见 §四末尾说明）     |

单包与单 crate：

```bash
pnpm --filter @chips/bridge run test      # 单包脚本（build/test/lint/typecheck/test:coverage/test:contract）
cargo test -p <crate>                     # 单 crate 测试
cargo clippy -p <crate> --all-targets -- -D warnings
```

重构台账（只读查询与回写）：

```bash
python3 ../重构大计划/工具/重构台账.py stats            # 仓库与文件状态统计
python3 ../重构大计划/工具/重构台账.py next -n 20      # 取下一批待评估文件
python3 ../重构大计划/工具/重构台账.py dispose --help  # 裁决回写（参数见帮助）
```

## 四、质量门禁

门禁编号、判定与数值以[《CI/CD 与质量门禁》§3.1](../薯片生态文档库/06-开发与运维/05-CICD与质量门禁.md)为唯一权威；本表只给执行命令。

| 编号 | 门禁项              | 执行命令                                                  |
| ---- | ------------------- | --------------------------------------------------------- |
| G1   | Rust 格式           | `cargo fmt --all -- --check`                              |
| G2   | Rust 静态检查       | `cargo clippy --workspace --all-targets -- -D warnings`   |
| G3   | TypeScript 静态检查 | `pnpm lint`                                               |
| G4   | 类型检查            | `pnpm typecheck`                                          |
| G5   | 测试                | `pnpm test`；关键 E2E：`pnpm test:e2e`                    |
| G6   | 覆盖率              | `pnpm test:coverage`                                      |
| G7   | 性能预算            | `pnpm bench`（criterion）与 `tests/perf` 性能基线         |
| G8   | 契约一致性          | `pnpm test:contract`                                      |
| G9   | 架构红线            | 依赖方向与导入拦截（`pnpm lint` 内 R4 规则）              |
| G10  | 依赖安全            | `cargo audit && pnpm audit`                               |
| G11  | 产物校验            | `pnpm exec chips plugin validate <产物>` 与版本一致性检查 |
| G12  | 文档门禁            | `pnpm docs:check`                                         |

任一阶段失败即阻断合并与发布，不存在部分通过；失败处理与豁免的唯一合法形式见[《CI/CD 与质量门禁》§六](../薯片生态文档库/06-开发与运维/05-CICD与质量门禁.md)。本地通过不构成判定，CI 是唯一权威。

本仓库不绑定任何托管 CI 平台（无远端流水线配置；工作流配置须与[《CI/CD 与质量门禁》§2.3](../薯片生态文档库/06-开发与运维/05-CICD与质量门禁.md) 的五阶段定义等价）；一次跑完 G1–G5、G6 判定、G8、G9、G12 的入口是根 `pnpm ci`，用法与阶段拆分见 [`docs/开发流程.md`](./docs/开发流程.md) §五。G6 的覆盖率输入报告由 `pnpm test:coverage` 单独产出（需 `cargo-tarpaulin`）；G7 性能预算（`pnpm bench` 与 `tests/perf`）、G10 依赖审计与 G11 产物校验需要额外工具、网络或已打包产物，由流水线按阶段单独调用。

## 五、工程文档与记录

| 位置                                         | 内容                                                               |
| -------------------------------------------- | ------------------------------------------------------------------ |
| [`CONTRIBUTING.md`](./CONTRIBUTING.md)       | 开发流程：读文档 → 计划 → 日志 → 测试 → 台账回写                   |
| [`docs/开发流程.md`](./docs/开发流程.md)     | 本仓库操作手册（对齐《重构大计划/03》，含制品落点与台账回写）      |
| [`docs/模板/`](./docs/模板/包-README模板.md) | 包 `README.md`、`开发计划.md`、`开发日志.md`、`ADOPS` 波次记录模板 |
| [`docs/ADOPS/`](./docs/ADOPS/README.md)      | 每波次收尾记录（台账统计、阻塞项、下一波准入判定）                 |
| `../项目日志与笔记/`                         | 问题工单、技术债务清单、RFC 等过程材料（不入文档库）               |
| `../薯片生态文档库/`                         | 正式技术契约与规范（唯一权威，只链接不复制）                       |

---

**文档结束**

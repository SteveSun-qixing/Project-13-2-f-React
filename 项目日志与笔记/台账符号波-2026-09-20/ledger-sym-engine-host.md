# 台账符号波回执 — ledger-sym-engine-host（任务 #67，W2 展开类符号波）

> 日期：2026-09-21
> 范围：Chips-EditingEngine 360 / Chips-Host 267 / Chips-SDK 41 / Chips-Scaffold 37 / scripts 23 / ProductFinishedProductTestingSpace 18，共 **746 个展开类符号**（`symbols-claim --class expand` 一次认领 746，零跳过）。
> 工具链：全程仅经 `重构大计划/工具/重构台账.py`（symbols-claim → symbol-dispose 逐符号 746+3 次落库；sqlite3 只读复核）；未手工 SQL、未做任何 git 写操作、`chips-ecosystem/**` 与旧仓只读。
> 判定基线：与三份矩阵（Host/Scaffold、编辑引擎与UI与设置面板、SDK与工具类）逐行对齐，无冲突；符号 target 一律单一语义路径 + `#符号锚点`，波次与依据说明进 notes。

## 一、终责复核（sqlite3 只读）

`files.disposition IN (迁移,重写)` 的未裁决符号按仓：Chips-EditingEngine 0/360、Chips-Host 0/267、Chips-SDK 0/41、Chips-Scaffold 0/37、scripts 0/23、ProductFinishedProductTestingSpace 0/18。**六仓展开类 pending = 0**。`verify` 认领分布行：`ledger-sym-engine-host 认领 746 个，其中未裁决 0 个`。

裁决分布：迁移 95 / 重写 651（无符号级废弃/保留设计/归档——全部符号的所属文件均为矩阵判迁移/重写行，功能均有承接或重建归属）。

## 二、真 target 命中（本路重点指标）

- **target 基路径落盘存在：344/746（46.1%）**；其余 402 为规划镜像（4 个基路径：`plugins/apps/editor`、`packages/host/src/runtime/resource`、`tests/e2e/fixtures/media`、`tools/icons`）。
- **新实现功能已落地并给真实锚点+行证据：81 个**，其中完全收口 48 个：
  - Chips-SDK `src/api/cli-command.ts` 38 个 → 矩阵§2.3-1 缺口**已实际收口**：33 个类型面锚至 `packages/sdk/src/types/cli/command.ts:17-247`（旧单数名按新复数形状映射，如 CliCommandPathRule→CliCommandPathRules:53、SurfaceReusePolicy→CliCommandTargetDeclaration:134-145），`createCliCommandApi` → `packages/sdk/src/client/cli-command-api.ts:36`，5 个客户端自校验 helper 按§11 约束12 归 `packages/cli/src/artifacts/manifest.ts:446-493` 与 `client/service-router.ts:289-304 assertQuery`。
  - Host 资源打开契约面 10 个（2128 六个 Handler 类型 + 2127 三个 ResourceOpen 类型 + 2068 CardOpenResult）→ 真落位 `packages/sdk/src/types/resource-open.ts:11-116`。
  - 载体已落、符号在途 33 个：2135 ModuleLoader 面 7 → `packages/host/src/loader`（zip/semver/limits 已落，生命周期 W2 P0-3）；2160 窗口 chrome 13 → `platform/contracts/window.ts`（G5 字段缺口，随窗口能力派单补齐）；3991 服务模板引擎 13 → `tools/scaffold/src/templates/service.ts`（G2 形态矩阵未补齐，随 W4）。
- Chips-Host 解析/序列化 20 个（2073/2102/2066）锚至 `packages/core-rust/crates/chips-parser/src`（读侧 `lib.rs:56-67` CardParser/BoxParser 已落地为证据，写侧随 W3 chips-resource 收口，打包不变量引保留设计《16-CardPacker》）。

## 三、波次镜像口径（规划中未落地，均点名矩阵行）

- EditingEngine 360 个 → `chips-ecosystem/plugins/apps/editor#<符号>` 按 W5 重建/搬运（矩阵§三/§六.1/§六.2；测试 13 文件随 W5 配套）；`drag-drop-manager.ts`、`use-file-drop.ts`、`use-layout-switch.ts` 镜像文件级裁决锚至《02-拖动与拖放交互规范》《01-编辑引擎产品与交互设计》。
- Host 其余 → `runtime/capability`（W2 派单 59）、`renderer`（W2 P0-4，20）、`runtime/resource`（W3，23）、`plugins/services`（W4，75）、`plugins/apps`（W5 历史/自动保存/工作区，16）、`packages/host/scripts`（W6 安装器，12）、`tests/e2e(+/fixtures)`（金链路 6）、mime/类型表（W4 单一事实源，7，含 O3 提示）。
- Scaffold 生成工程门禁 23 → `tools/scaffold/tests`（G1，W3）；scripts 图标管线 23 → `tools/icons`（暂缓项波次）；PFP 素材 18 → `tests/e2e/fixtures/media`（版权核验前置，矩阵§五）。

## 四、verify 与遗留

`verify` 退出码 3：14 项幻想 target 全部为**其他裁决人的文件级行**（ledger-apps/ledger-engine-ui 名下 README/package.json/app-config 等），本路符号零幻想、零 sweep 异常、零悬空。全局其余未裁决符号 1473 属其他并行路（四媒体查看器/三插件/三应用等展开面），不在本路六仓终责内。本轮无遗留未认领：六仓展开类由本路全部认领并清零；主智能体验收即可。

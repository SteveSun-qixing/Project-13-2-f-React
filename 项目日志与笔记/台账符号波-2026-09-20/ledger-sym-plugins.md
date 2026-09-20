# 台账符号波回执 — ledger-sym-plugins（任务 #65）

> 日期：2026-09-20
> 范围：三插件仓（Chips-BaseCardPlugin / Chips-BoxLayoutPlugin / Chips-ModulePlugin）展开类（迁移/重写文件）符号 1,867 个逐符号判定落库。
> 纪律：全程只读取证 + 唯一写入口 `重构台账.py`（symbols-claim / symbol-dispose）；未触碰 chips-ecosystem/、旧仓、矩阵与文档库；无任何 git 写操作。

## 一、命令与退出码

| 步骤 | 命令 | 退出码 | 结果 |
|---|---|---|---|
| 符号波认领 | `symbols-claim --owner ledger-sym-plugins --repo <R> --class expand`（分仓 ×3） | 0/0/0 | BCP=891、BLP=819、MOD=157，共 1,867，无重复冲突 |
| 判定落库 | `symbol-dispose --owner ledger-sym-plugins --symbol <ids> --disposition … --target … --notes …` ×1,077 批（同 (disposition,target,notes) 键合并 ids） | 0×1077 | 成功 1,077 批 / 失败 0，覆盖 1,867 符号；执行日志 `/tmp/sym_exec.log` |
| 只读终核 | `sqlite3 "file:重构台账.db?mode=ro"` 按 wave_owner 分组计数 | 0 | `PENDING=0`；迁移 1,449（BCP 871 + BLP 578）、重写 418（BCP 20 + BLP 241 + MOD 157），合计 1,867 |
| verify | `verify --allow-issues` | 0（--allow-issues） | 幻想 target 14 行＝既有基线（全为他仓 files 级行：BookReader/Notes/Office/EcoSettingsPanel/EditingEngine，与本路零相关，无新增）；sweep 一致性异常 0；孤儿行 0；本路 target 均为 迁移/重写 → 落入「规划中未落地」提示档（1,391 行全局，不计数） |

## 二、判定口径（禁幻想，逐符号四规则）

取证事实：`chips-ecosystem/plugins/{basecards,layouts,services,apps}` 四目录实测 0 文件（与矩阵「计划路径」口径一致）；但新 SDK 契约面已落地——`packages/sdk/src/types/roles/boxlayout.ts`（09 §3/§6.1/§7.1 帧运行时）与 `packages/sdk/src/types/views.ts`（§6.6 视图），行号证据逐条写入 notes。

1. **规则 a（已落地真 target+证据）**：BLP 重写骨架中旧契约类型/挂载面对应到新 SDK 已落地符号，target 直指 `packages/sdk/src/types/roles/boxlayout.ts#IBoxLayoutPlugin/:ILayoutEditor/:IBoxLayoutFrameRuntime/:EntryTicket/:EntryRequest` 与 `views.ts#BoxRenderView/:BoxCoverView/:CardRenderView`（证据行号 boxlayout.ts:26/36/56/58/116/143/145/148，views.ts:54/80/95，均已复核）。覆盖 10 布局 × {index.ts 装配/context、shared/types.ts 8 型、view|editor/runtime.ts 挂载函数与 options}。
2. **规则 b（迁移未落地=镜像+#锚点）**：三仓 115+60 个 迁移文件共 1,449 符号 → 镜像文件 target + `#符号名`，notes 固定句式「规划中未落地（W4 按矩阵行「…」），镜像文件迁移裁决逐符号展开」，矩阵行按路径模式映射（BCP：卡片定义装配/查看渲染与挂载/编辑面板/配置模型与校验/书籍解析/音乐元数据/文件封面体系/富文本/单测；BLP：配置模型与 JSON Schema/渲染主体/编辑面板/散点分列/中文文案表/单测）。
3. **规则 c（重写未落地=矩阵分流）**：BCP webpage resource-loader 20 符号、BLP `layoutDefinition` const 与 `ResolvedRuntimeResource`、10×layout-definition.test.tsx 契约测试（matrix 行「布局注册契约测试」→新包重建）、MOD 26 文件 157 符号（content-processing W4 / community-client W5 分流，notes 携带 G2/G3 缺口标注）。未发现应作符号级废弃的矩阵行——module 装配作废面在文件级已判废弃、不入展开类。
4. **规则 d（拿不准保守镜像）**：BLP `captureStyle/restoreStyle`（挂载协议私有 DOM 辅助，帧运行时下是否保留未见矩阵单列）→ 保守镜像重写 + notes 标注「未定→保守镜像」。

与《旧功能覆盖矩阵-三插件仓库-2026-09-20》判定零冲突。

## 三、计数汇总（机读口径，sqlite3 只读复核）

| 仓 | 认领 | 落库 | 其中镜像 | 其中已落地真 target | 剩余 pending |
|---|---|---|---|---|---|
| Chips-BaseCardPlugin | 891 | 891 | 871 迁移 + 20 重写镜像 | 0 | 0 |
| Chips-BoxLayoutPlugin | 819 | 819 | 578 迁移 + 37 重写镜像 | 204（10 布局 × 契约类型/挂载/装配 20.4→共 types8+index4+runtime6 组） | 0 |
| Chips-ModulePlugin | 157 | 157 | 157 重写镜像（W4/W5 分流） | 0 | 0 |
| **合计** | **1,867** | **1,867** | — | **204** | **0** |

自洽校验：1,867 = 1,663 镜像 + 204 已落地真 target，成立；本路 wave_owner 名下未裁决 = 0，无烂尾，未触 150 轮上限（实际有效工具调用约 50 轮，1,077 批由单一驱动脚本 `python3 /tmp/ledger_sym_plugins_drive.py apply` 顺序执行）。

## 四、遗留

- 全局「待评估符号 4,733」为其他并行展开路（office-b/c、ufv、apps、engine-host、media-community）存量，非本路范围。
- BLP 10 布局的 `ResolvedRuntimeResource` / `captureStyle` / `restoreStyle` 共 100 符号按保守镜像落库（重写待建），W4 落地帧内资源协议与 renderEditor 实装时需按 09 §6.1/§7.1 复核取舍；notes 已带「未定→保守镜像」标注。
- 镜像 target 均指向角色目录 `chips-ecosystem/plugins/{basecards,layouts,services,apps}#符号`，包目录由 W4/W5 以 scaffold 模板建档后，文件级与符号级 target 的 `<slug>` 细化由收口波次统一执行（与文件级既有镜像口径一致）。
- 驱动脚本与执行日志在本机 /tmp（过程材料，不入库）；台账留痕见 `重构大计划/台账操作.log` 1,077 行 symbol-dispose。

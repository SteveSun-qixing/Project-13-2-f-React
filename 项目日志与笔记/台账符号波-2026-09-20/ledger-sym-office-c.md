# 台账符号波回执 — ledger-sym-office-c（任务 #63，Office 全仓终责路）

> 日期：2026-09-20（深夜→次日凌晨批次）
> 范围：Chips-Office 仓展开类（所属文件 disposition ∈ {迁移, 重写}）符号逐符号真判定，终责＝Office 展开类 pending 清零。
> 纪律：源码面全程只读；唯一写入口 `python3 重构大计划/工具/重构台账.py`；未改矩阵/工单/文档/chips-ecosystem；无任何 git 写操作。

## 一、认领（symbols-claim，机器互斥实报）

| 命令 | 退出码 | 结果 |
|---|---|---|
| `… symbols-claim --owner ledger-sym-office-c --repo Chips-Office --class expand`（不带 --limit） | 0 | 认领 2,554 个；条件命中未裁决 3,854 个，重复认领跳过（wave_owner 已有值）1,300 个（＝ledger-sym-office-b 面） |
| `ledger-sym-office-a` 面 | — | 由 office-a 回执自证：其下发时 Office 展开面已被 b/c 吃满，合法 0 认领；本路未触碰他人认领面 |

认领面覆盖 281 个代码文件（迁移文件 122 个 / 重写文件 159 个）。

## 二、判定口径与取证方法（对齐 01 文档 §4.3.1 四规则）

取证基线：先读 `重构大计划/01-文件台账与消灭流程.md` §四（§4.3/§4.3.1 target 口径）与 `项目日志与笔记/重构计划/旧功能覆盖矩阵-三应用仓库-2026-09-20.md` §二（Chips-Office 538 行）与 §五（架构缺口 G1/G2/G4 与 Office 相关）。

规则 a（已落地真 target）：`chips-ecosystem/plugins/apps/` 实测为空目录（`ls` 取证），Office 应用侧无任何已落地实现 → 全量走 b/c/d 镜像路。为避免臆断，另对新工作区 610 个 `.ts/.tsx` 源文件（packages/plugins/tools/tests/examples，排除 node_modules/dist/target/coverage）做标识符全集交叉：本路 2,259 个唯一符号名（≥8 字符）仅 8 个同名命中（`IPC_CHANNELS`/`createClient`/`createDocument`/`openDocument`/`saveDocument`/`escapeHtml`/`bootstrap`/`summarize`），逐一读码复核后确认除 `IPC_CHANNELS`（Bridge 统一通道表，`chips-ecosystem/packages/bridge/src/protocol/ipc.ts:22`）与 SDK 客户端工厂（`chips-ecosystem/packages/sdk/src/client/chips-bridge.ts:143` `createClient`）是「正式契约面已落地」外，其余均为跨域同名巧合（脚手架 basecard 模板 HTML 转义、e2e Playwright 助手、diff 摘要），不构成实现落点。上述两条真实落地链路以 file:行 证据写入 16 个符号的 notes（`src/apps/sheet/shared/ipc-channels.ts` 5 个 + `src/bridge/document-session.ts` 8 个 + `src/runtime/chips-client.ts` 1 个 + `tests/unit/document-session.test.ts` 2 个；复核口径：`notes LIKE '%落地链路证据%'` = 11、`notes LIKE '%已落地%'` = 15，两条批次措辞不同但都带 file:行 取证）。与 office-b 回执「口径 a 命中数 = 0」一致。

规则 b（迁移未落地 → 镜像 + 锚点）：1,021 个符号判**迁移**，target＝`chips-ecosystem/plugins/apps/office/<旧相对路径>#<符号名>`（旧相对路径镜像落点 + 符号锚点，纯路径、说明入 notes，符合 §4.4「target 书写口径」）；notes 逐符号记：矩阵 §二 基线④依据（实测 chips-sdk 0 处、antd/@chips/ui 0 处）＋「规划中未落地（W5：plugins/apps/office 尚未创建）」＋该文件实测的私有桥调用面处数（G2）/@genoffice 引擎类型引用（G1）/DOM 与 @univerjs、@tiptap 依赖/Hook 与类型契约说明。

规则 c（重写未落地 → 矩阵分流）：1,501 个符号判**重写**（矩阵 §二 对应功能行「覆盖」，notes 记实测违例信号与 R2/R4/R5 依据）；32 个符号判**废弃**（矩阵分流·废弃：`src/apps/{word,slide,sheet}/renderer/i18n/locale.tsx` 的 `LocaleProvider`/`useI18n`/`t`/`getLang`/`setModuleLang`/`aiLangDirective`/`I18n`/`StringKey`/`TFunc`/`DATE_LOCALES` 共 30 个 + `src/lib/messages.ts` 的 `MessageKey`/`formatMessage` 2 个）——R5 主题与多语言系统已随 task030 废弃，语言包机制与 key 间接层功能不再保留，zh 文案作素材由 W5 直写复用（矩阵 §二「UI 多语言文案」「文案」行与缺口 G4）；废弃符号 target 一律留空（与 symbol-sweep 废弃口径一致）。i18n 文案聚合常量（`strings`/`appStrings`/`ribbonStrings`/`editorStrings`/`tableStrings`/`dialogStrings`/`paneStrings`）按矩阵文件级判**重写**，不新造悬空的保留设计 target。

规则 d（禁幻想 → 保守镜像 + G 标注）：30 个符号带「G-保守镜像」标注（旧仓 src/tests/vendor 全域标识符索引下除声明处零引用，如未接线的 ribbon 图标工厂、`opVocabulary`/`opUsage` 文档件、`constrainSelectedTableWidth` 等）——不臆断废弃，交由 W5 实施时随模块收敛。矩阵缺口在 notes 中逐条点名，机读计数（`notes LIKE '%G1%'` 等）：G1（vendor `@genoffice/*` 未入台账）1,026 个符号、G2（私有 IPC 桥面）493 个符号、G4（i18n 双语包残留）44 个符号。

零判定冲突自查：本路符号 disposition 与所属文件裁决一致率——迁移文件符号 100% 迁移；重写文件符号 97.9% 重写 + 2.1% 符号级废弃（i18n 机制面，矩阵 §五.4 明文要求废弃语言包机制）；未出现任何与矩阵分流方向相反的判定（无「迁移文件符号判重写」或「重写文件符号判迁移」）。

## 三、落库与批处理

- 写入：`symbol-dispose --owner ledger-sym-office-c --symbol <id> --disposition <五值> --target <路径#锚点> --notes <逐符号理由>`，逐符号单次落库（保留 `#符号名` 锚点粒度）。
- 批次：主判定 2,554 次（`ok=2554 fail=0`，日志 `/tmp/apply_all.log`）；符号级措辞按实测证据修正 34 次（`.tsx` JSX 组件未命中 React 正则 22、`toast-bus`/`table-shading-colors` 无外部信号的 components 支撑件 7、`ribbon-format-state.ts` antd 措辞修正 5；`ok=34 fail=0`）；落地链路证据补注 16 次（`ok=16` 全部退出码 0）。合计落库调用 2,604 次，全部经台账工具单事务与 `台账操作.log` 留痕，无手工 SQL 写。

## 四、终验（Office 全仓清零复核）

终责复核 SQL（只读 URI）：

```bash
sqlite3 "file:/Users/sevenstars/Documents/ChipsCard/Develop/Project-13-2-f-React/重构大计划/重构台账.db?mode=ro" \
"SELECT COUNT(*) FROM symbols s JOIN files f ON s.file_id=f.id JOIN repos r ON f.repo_id=r.id WHERE r.name='Chips-Office' AND s.disposition IS NULL AND f.disposition IN ('迁移','重写');"
```

输出：`0` —— Chips-Office 展开类 pending 清零（本路收口，无烂尾）。

补充复核（同库只读）：

| 复核项 | SQL 条件 | 输出 |
|---|---|---|
| Office 全仓符号未裁决 | `r.name='Chips-Office' AND s.status<>'已裁决'` | 0 |
| 本路未裁决存量 | `wave_owner='ledger-sym-office-c' AND disposition IS NULL` | 0（自洽：认领 2,554 = 落库 2,554 + 剩余 0） |
| 本路裁决分布 | 按 `disposition` 分组 | 迁移 1,021 / 重写 1,501 / 废弃 32 |
| 本路 target 去重 | `COUNT(DISTINCT target)` | 2,522 个非空镜像 target + 32 个空（废弃） |
| Office 全仓裁决分布（含继承类） | 按 `disposition` 分组 | 迁移 1,815 / 重写 2,002 / 废弃 329 |

`python3 重构大计划/工具/重构台账.py verify --allow-issues`（退出码 0）关键行：

- `符号裁决 == 符号总数 28047，已裁决 28047，未裁决 0`；`有符号文件 4194 个：符号全裁决 4194，部分裁决 0`
- `终验机读口径：status<>'已裁决'（待评估）的符号 0 个（收口目标 0）`
- 符号波认领分布：`ledger-sym-office-c 认领 2554 个，其中未裁决 0 个`（office-b 1,300 亦 0；九路全部未裁决 0）
- `sweep 一致性：(无)`；`孤儿行：(无)`；`符号裁决悬空：0 个`
- `target 落盘校验：幻想 target 14 行`（＝既有文件级基线 14 行，无符号波新增；本路零贡献）
- `stats`：`wave_owner 认领: 27496 个符号（其中未裁决 0 个，未认领未裁决 0 个）`；文件级 已裁决 12,372 无变化（符号波不触碰 files 表）。
- 不带 `--allow-issues` 的 `verify` 退出码 3，仅由上述 14 行文件级基线触发（工单面既有遗留，非本路引入）。

## 五、遗留与提示（仅报告，本路未改动任何矩阵/工单/文档）

1. W5 实施时需把本路 2,522 个「规划中未落地（W5）」镜像 target 回写为真路径；锚点名即旧符号名，可直接作为旧功能覆盖清单逐条打勾依据。
2. 30 个「G-保守镜像」零引用符号待 W5 收敛判定（确认无新调用面后可改判废弃，需重跑 `symbol-dispose`）。
3. 矩阵缺口 G1（`Chips-Office/vendor/@genoffice/*` 在台账 0 行登记）仍未收口：本路 1,026 个符号的 notes 点名了该引擎耦合面（另 G2 私有桥面 493 个、G4 语言包残留 44 个），vendor 补扫/裁决仍需工具侧或主代理处置。
4. 文件级 target 书写口径漂移依旧存在于基线（如 `chips-ecosystem/plugins/apps/office（计划归属，W5，目录尚未落地）` 含中文说明），本路符号 target 已按 §4.4「纯路径 + #锚点、说明进 notes」执行，未代改他人 files 行。
5. 引用矩阵：`项目日志与笔记/重构计划/旧功能覆盖矩阵-三应用仓库-2026-09-20.md`（本轮未产生任何与矩阵冲突的判定）。

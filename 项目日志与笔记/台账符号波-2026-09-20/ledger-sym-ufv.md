# 台账符号波回执 — ledger-sym-ufv（任务 #64）

> 日期：2026-09-20
> 范围：Chips-UniversalFileViewer 展开类（迁移/重写文件）符号 1,433 个（56 文件，平均 25.6 符号/文件）逐符号分组判定落库。
> 纪律：全程只读取证 + 唯一写入口 `重构台账.py`（symbols-claim / symbol-dispose）；未触碰 chips-ecosystem/、旧仓、矩阵与文档库；无任何 git 写操作。

## 一、命令与退出码

| 步骤 | 命令 | 退出码 | 结果 |
|---|---|---|---|
| 符号波认领 | `symbols-claim --owner ledger-sym-ufv --repo Chips-UniversalFileViewer --class expand` | 0 | 认领 1,433，命中未裁决 1,433，重复跳过 0 |
| 符号级废弃摘除 | `symbol-dispose --owner ledger-sym-ufv --symbol <单id> --disposition 废弃 --target ""` ×5 | 0×5 | 12452/12453/12491/12770/12447（详见§二-3） |
| 批量判定落库 | `symbol-dispose --owner ledger-sym-ufv --file <id> --only-pending --disposition 迁移/重写 --target "chips-ecosystem/plugins/apps/universal-file-viewer#<旧rel_path>" --notes …` ×56 文件分 9 桶 | 0×56 | 落库 5+1,368+60 = 1,433，失败 0；执行日志 `/tmp/b1..b8.log`、`/tmp/d1..d5.log` |
| 只读终核 | `sqlite3 "file:重构台账.db?mode=ro"`（SQL 见§三） | 0 | 本路 pending=0；迁移 1,368 / 重写 60 / 废弃 5 |
| verify | `python3 重构台账.py verify` | 3 | 幻想 target 14 行＝既有基线（全为 BookReader/EcoSettingsPanel/EditingEngine/Notes/Office 他仓 files 级行，本路 0 新增）；sweep 一致性异常 0；孤儿行 0；本路 target 全落「规划中未落地」提示档（1,391 行全局，不计数） |

## 二、判定口径（禁幻想，逐符号四规则）

取证事实：`chips-ecosystem/plugins/apps/` 实测空目录（0 文件，与矩阵「计划路径」口径一致）→ 本仓规则 a（已落地真 target）命中 0；全部走 b/c。

1. **规则 b（迁移未落地=镜像 target+锚点）**：36 个迁移文件 1,368 符号 → 镜像文件 target `chips-ecosystem/plugins/apps/universal-file-viewer` + `#旧rel_path` 锚点，notes 固定含「规划中未落地（W5 按矩阵行承接）」并逐桶引矩阵§三迁移行：
   - 格式插件族 20 文件（lrc/gis/image/ofd/video/fallback/epub/cad/audio/archive/text/email/plugins-utils/xmind/encrypted/drawing/xps/asset/model3d/oasis-binary）709 符号 → 「24 格式插件 + 5 Prism 语法包」行（§8.3 兜底矩阵逐项对应；依赖许可证 G-3 复核标注）。
   - Office/PDF 族 4 文件（office 365、msdoc 121、msppt 42、pdf 33）561 符号 → 同上 + G-1 分层口径复核标注（10-设计§4.3 边界，W5 实现前复核）。
   - 引擎核心 4 文件（dom/types/viewer/support）117 符号 → 「预览引擎核心」行（零 Host 触达 grep 实测；theme/locale 已摘除后随迁）。
   - shims d.ts 4 文件 11 符号 → 「shims 类型声明」行（heic 许可见 G-3）。
   - detect.ts 7 符号 → 核心行 + G-4 单一 MIME 事实源标注。
   - utils 装载与归类 3 文件（engine-plugins/open-targets/file-kind）11 符号 → 「装载与归类」行。
2. **规则 c（重写未落地=矩阵分流·覆盖）**：19 个重写文件 58 符号 + messages.ts 残余 2 符号 = 60 → 矩阵§三「应用壳/工具栏/场景」「引擎 UI 层」「资源读取投递」「测试 重写 5」行均有覆盖承接 → disposition=重写 + 镜像 target + `#旧rel_path` 锚点（notes 注明锚点=旧实现定位符非 1:1 路径）；测试/工装 5 文件 notes 携带 G-5 素材路径缺口标注；viewer-engine/messages.ts 按「zh 文案抽取直写」判 defaultMessages/formatPreviewMessage=重写。
3. **符号级废弃 5 个**（target 空 + 引矩阵行，与文件级裁决零冲突——均为矩阵明文废弃的机制面，文件整体仍迁移/重写）：
   - 12452 `PreviewTheme`（types.ts）、12491 `applyTheme`（viewer.ts）：主题机制随 task030 废弃（矩阵§三「引擎 UI 层」行依据列）。
   - 12453 `PreviewLocale`（types.ts）、12447 `resolveMessages`（messages.ts）：双语/locale 间接层随 task030 废弃，zh 文案直写不搬运 locale 层（同一矩阵行）。
   - 12770 `wrapCadPreviewInstance`（cad.ts）：DWG 入口适配器，随文件级废弃 cad-dwg/cad-webgl 与矩阵「DWG 解码废弃」行、「24 格式插件」行「搬运时移除 DWG 入口」摘除（03-设计§8.3 许可证不允许不声明）。
4. **规则 d（拿不准保守镜像）**：0 个——全部符号可由矩阵行直接归位；DWG/主题/locale 三处曾考虑保守镜像，因矩阵与 task030 有明文废弃口径而判符号级废弃，notes 已写明证据链。

与《旧功能覆盖矩阵-四媒体查看器仓-2026-09-20》§三裁决统计（迁移 46 行/重写 27 行文件）零冲突；cad-dwg/cad-webgl/sandbox-compat 等文件级废弃行不在展开类内，未重复判定。

## 三、机读复核 SQL 与结果（sqlite3 只读 URI）

```sql
-- 本路 pending（结果 0）
SELECT COUNT(*) FROM symbols s JOIN files f ON f.id=s.file_id
 WHERE f.repo_id='Chips-UniversalFileViewer' AND s.wave_owner='ledger-sym-ufv' AND s.status<>'已裁决';
-- 分布（结果 迁移1368/重写60/废弃5 = 1433）
SELECT s.disposition, COUNT(*) FROM symbols s JOIN files f ON f.id=s.file_id
 WHERE f.repo_id='Chips-UniversalFileViewer' AND s.wave_owner='ledger-sym-ufv' GROUP BY s.disposition;
```

自洽校验：56 文件、5+709+561+117+11+7+11+60 = 1,433 全落库，owner 名下未裁决 = 0，无烂尾；有效工具调用约 12 轮，远低于 150 上限。

## 四、遗留

- 无本路遗留。全局「待评估符号 3,300」为其他并行展开路存量（apps/engine-host 等），非本路范围。
- G-1（office/pdf 561 符号的分层口径）、G-3（插件依赖许可证）、G-4（MIME 表事实源收口）、G-5（测试素材路径）均以 notes 标注随迁至 W4/W5 实施波，与本路判定不冲突。

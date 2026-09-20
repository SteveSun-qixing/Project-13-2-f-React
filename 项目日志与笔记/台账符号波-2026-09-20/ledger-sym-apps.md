# 台账符号波回执 — ledger-sym-apps（任务 #66，三应用仓展开类）

> 日期：2026-09-20
> Owner：`ledger-sym-apps`（W2 符号波，class=expand）
> 范围：Chips-BookReader 504 / Chips-Notes 467 / Chips-MusicPlayer 254，合计 **1,225**。

## 一、结果

- `symbols-claim --owner ledger-sym-apps --repo <R> --class expand` 三仓全部认领成功（claim 输出 504/467/254，重复认领跳过 0）。
- 逐文件成批判定经 `symbol-dispose` 全部落库：**1,225/1,225，剩余 0**。分布：迁移 529 / 重写 696 / 符号级废弃 0。
- 判定后按 §4.3.1 target 口径统一补 `#符号名` 锚点（root#name，1,225 条经 symbol-dispose 回写，ok=1225 fail=0）。
- sqlite3 只读复核（`file:重构大计划/重构台账.db?mode=ro`）：三仓展开类 `status<>'已裁决'` = **0**；本 owner 面 wave_owner 未裁决 = **0**；target 空值 = **0**；无锚点 = **0**；符号 disposition 与所属文件裁决偏离 = **0**。
- 案例 a（新实现已落地→真 target+file:行 证据）**无**：`chips-ecosystem/plugins/apps/` 实测空目录（ls 取证，apps/basecards/services 均无落位包），全部按 b/c 口径处理。

## 二、判定口径（与矩阵零冲突）

1. **迁移文件符号（BR 42 文件/Notes 4/MP 13，共 529 符号）**：镜像所属文件计划 target + `#符号名`，notes 引《旧功能覆盖矩阵-三应用仓库》§三/§四与《旧功能覆盖矩阵-音乐富文本社区客户端》§二对应行（零 Host/零 UI import 扫描基线、引擎/领域/交互/测试随主体迁移），标注「规划中未落地（W4/W5 按矩阵行实施后回写 file:行 落点）」。BR 文件行 target 的「的 tests/的 utils」目录位以 `#符号名` 锚点口径统一，目录提示保留在文件级行 notes，不造第二锚点。
2. **重写文件符号（BR 43/Notes 129/MP 19，共 696 符号）**：矩阵功能行全部有承接（旧 SDK Client 链违 R2、antd 直装+硬编码 css 违 R4、messages key 层与 AppChrome/appleTheme 违 R5/task030），一律新计划 target + `#符号名` + notes 引矩阵行；无整文件「矩阵判废弃」残留（Notes 私建卡片运行时、MP 氛围层、字体资产等均为文件级废弃行，不属展开面）。
3. **G 缺口照录（保守镜像+标注，不另造）**：
   - `src/utils/audio-metadata.ts`（MP，迁移）→ notes 照录矩阵§六 **G-3**：应用内置手写标签解析 vs `chips.module.media.tagparse`/`media.lyrics` 服务归属张力，挂 W4 裁决，同型归属照录先例。
   - `src/utils/music-player.ts`（MP，迁移）→ notes 照录 **G-4**：SUPPORTED_AUDIO_EXTENSIONS 多源并存待 W4 收敛；唯一 `import type MusicCardOpenPayload` 换 @chips/sdk 类型面随迁。
   - `src/utils/embedded-artwork-cache.ts`（MP，重写）→ notes 照录 **G-2**：tiff→png 归一能力名在 04-能力契约音频域无逐项登记（现口径仅 04.23§8.4），W4 建档前落点悬空，保守镜像。
   - `src/hooks/*`（BR，重写）→ notes 点名 useReaderSystemTheme 属阅读偏好非平台主题系统（task030 废弃口径）。
4. **无符号级废弃/无幻想**：三仓矩阵未在迁移/重写文件内部判任何功能废弃（对照 Office `window.slidesApi`/`ipc.ts` 整文件废弃形态），故本面 0 条符号级废弃，未新造落点。

## 三、verify 关键行

- 终验机读口径：全库待评估符号 3,300（**均在他路 wave/未认领存量面**——本波三仓 0）。
- 符号波认领分布：`ledger-sym-apps 认领 1225 个，其中未裁决 0 个`。
- sweep 一致性 (无) / 孤儿行 (无) / 符号裁决悬空 0。
- target 落盘校验：幻想 14 行全部为**存量文件级基线**（BookReader/Notes README·技术文档·SOURCE、EcoSettingsPanel、EditingEngine 等他 owner 行，矩阵§七已声明不归符号面）；符号级 target 不参与落盘校验，本波 0 新增异常。verify 退出码 3 由该存量决定。

## 四、过程留痕与纪律

- 取证/复核全程 sqlite3 只读 URI（加引号）；唯一写入口 `重构大计划/工具/重构台账.py`，无手工 SQL。
- claim 日志 `/tmp/claim_<repo>.log`；成批判定驱动 `/tmp/ledger_sym_apps_dispose.sh`（250 文件桶）+ 锚点回写驱动 `/tmp/ledger_sym_apps_anchor.py`；运行日志 `/tmp/sym_apps_run.log`、`/tmp/anchor_{br,nt,mp}.log`；verify 全文 `/tmp/verify_final2.log`。
- `重构大计划/台账操作.log`：本 owner 3 条 `symbols-claim` + 250 条 `symbol-dispose`（成批）+ 1,225 条 `symbol-dispose`（锚点回写）记录。
- chips-ecosystem/** 与旧三仓全程只读；未改矩阵/工单/其他文档（本回执除外）；未做任何 git 写操作。

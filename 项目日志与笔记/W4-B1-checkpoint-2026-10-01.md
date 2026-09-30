# W4 阶段 Checkpoint · 修复批 + B1 迁移批 · 2026-10-01

## Checkpoint W4-B1 · 工作区修复与插件迁移第一二批 · 2026-09-30 ~ 10-01

- 本阶段目标：恢复工作区全绿基线（task044 审计移交的 4 红），随后按 W4 计划 §四/§九 放量迁移官方插件（用户指令：布局族只交付 grid 与 documentLibrary）。

- 完成项（证据：命令 EXIT 码亲跑 + 文件路径）：
  1. **修复批（7 路）**：cardtohtml 55 用例 / htmltoimage 53 / hyperlink 23（含 id 收口 `chips.basecard.hyperlink`）/ markdown 57（根因=实现消费不存在的 `li_open` 记号型 + XSS 消毒按契约重写）/ htmltopdf 123（补齐 service/engine 层）/ grid 配置收口 / 全仓 lint 21 包 0 错 0 警。
  2. **G9 收口**：`gates.config.json` allowedDevInternal += `@chips/cli`（RFC-G9插件devDep放行chips-cli裁定）+ 两处 vitest.config 弃 node:url → BOUNDARY 违规 6 条清零。
  3. **B1 第一批（5 包）**：basecards webpage(66 用例)/file(215)/image(57)/book(67) + layouts documentLibrary(46)——四闸+cpk 五阶段 validate 全过，缺位按 music 判例登记工单060~064，文档库《09》目录逐行翻正。
  4. **B1 第二批（2 路）**：services file-conversion（74 用例，planner 纯函数逐字迁移，executor 经 ctx.inject 正式面零兄弟 import）+ G2 服务模板（scaffold 123/123，G1 门禁 EXIT=0）。
  5. **最终集成链（含全部 11 个新包，2026-10-01 01:24~01:32 亲跑）**：typecheck=0 / test=0（30 个测试面共 ≈8,990 用例）/ build=0 / lint=0 / gates:all=0，五闸全绿。
  6. **插件面现状**：basecards 7/9 族（缺 score/video 候第十二项）、layouts 4 包（grid+document-library 为本波交付，timeline/map 为指令前已交付保留）、services 6 包全交付。

- 未完成项与原因：
  1. basecards score/video 两族：触 `InputNumber` 禁面（7 个 panel 文件），候用户待裁第十二项（W4 §五），**不派**。
  2. layouts cardStack/coverFlow/masonry/scattered/list/infiniteCanvas：用户指令「只迁移网格与文档库」——timeline/map 为指令前已交付成果保留，其余不再迁移。
  3. file-conversion 编排能力 ID：§8.4 明文「converter.file.convert 不登记，转换编排归 file-processing」——服务名 `content-file-conversion` 为文法自洽推导值，**候 RFC 收口**（不冒用 ID、不发 descriptor.json）。
  4. markdown/job 进度取消契约、宿主帧执行通道（#85）、document:export 提供方（第十三项）：在册缺位，不假接线。

- 下一步：集成链五闸复跑（含 11 个新包）出最终数字 → 台账回写与 W4 计划注记 → 向用户呈报候裁项（第十二项/第十三项/file-conversion 命名 RFC/richtext 编辑臂选型）→ 裁后开 W5 应用迁移波。

- 目标状态：进行中（W4 主体接近收口；阻塞项全部为用户级裁决，非工程阻塞）。

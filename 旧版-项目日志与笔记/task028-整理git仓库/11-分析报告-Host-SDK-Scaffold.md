# 分析报告：Chips-Host / Chips-SDK / Chips-Scaffold（2026-06-30 ~ 08-05）

## 任务簇 A：ZIP Store 条目顺序与修改时间恢复（entryPlan）+ 黄金回环（08-05 13:08-13:49）
- zip-service/types.ts：新增 ZipEntryPlan {path, modifiedTime?}。
- zip-service/zip-store.ts：applyEntryPlan（按 plan 顺序输出、覆盖 modifiedTime、未在 plan 中按字典序追加）；compress 支持 options.entryPlan。
- zip-service/index.ts：导出 ZipEntryPlan。
- card-packer.ts：pack 支持 options.entryPlan（packUntilSizeStabilizes 透传）。
- card-service.ts：pack 透传 entryPlan。
- register-host-services.ts：card.pack 与 zip.compress 路由入参新增 entryPlan 并透传。
- zip-store.test.ts：entryPlan 顺序/时间保留用例。
- card-transfer-gold-loop.test.ts（新增 175 行）：完整离线卡片 → 网络资源卡片 → 完整离线卡片黄金回环，断言路径/顺序/字节/URL/封面/时间/Store 模式一致。

## 任务簇 B：SDK communityCardTransfer 封装（08-05 01:48/11:37/17:07）
- src/api/community-card-transfer.ts（新增 98 行）：类型 + upload/download/openRemote（module.invoke）+ getStatus/cancel（module.job.*）。
- core/client.ts：注入 communityCardTransfer；index.ts/types/client.ts 导出类型；package.json test 脚本加入。
- tests/community-card-transfer.test.ts（新增）：module.invoke 载荷断言。

## 任务簇 C：basecard 导出文档资源基址归一化（06-30 测试 / 08-05 实现收口）
- card-service.ts createBasecardFrameDocument：resolveRuntimeResourceBaseUrl（相对 base 按 window.location.href 解析）；resolveResourceUrl 重构；resolveOpenResourceId；openResource 事件 resourceId 用归一化后的完整 URL。
- card-service-rendering.test.ts：新增用例（JSDOM URL 模拟社区缓存域，断言 src 绝对 URL 与 resource-open 事件完整 resourceId）+ TS 类型修复。
- 说明：测试 06-30 编写，实现 08-05 收口，提交时归入 C30 批次并注明。

## 任务簇 D：脚手架排除模板元数据（工单124，08-05 16:06）
- template-engine.ts：SCAFFOLD_METADATA_FILE_NAMES（template.json）+ copyTemplateDir 文件级排除。
- template-engine.test.ts：断言生成工程无 template.json。
- run-generated-e2e.mjs：E2E 校验新增 template.json 存在即抛错。

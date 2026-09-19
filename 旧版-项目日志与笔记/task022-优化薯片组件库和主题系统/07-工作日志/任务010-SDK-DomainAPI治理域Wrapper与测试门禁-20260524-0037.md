# 任务010：SDK Domain API 治理域 Wrapper 与测试门禁

时间：2026-05-24 00:37 CST

## 本次范围

- 继续执行 `任务010-SDK-DomainAPI补齐与类型同步`。
- 本阶段补齐 Host 已注册且适合作为 SDK 公共 Domain API 的治理域：
  - `log`
  - `credential`
  - `serializer`
  - `control-plane`
- 同步处理任务中发现的 SDK 正式测试脚本遗漏 Vitest Domain API 测试问题。

## 完成内容

1. 新增 SDK Domain API：
   - `Chips-SDK/src/api/log.ts`
   - `Chips-SDK/src/api/credential.ts`
   - `Chips-SDK/src/api/serializer.ts`
   - `Chips-SDK/src/api/control-plane.ts`

2. 更新 SDK 客户端入口：
   - `createClient()` 挂载：
     - `client.log`
     - `client.credential`
     - `client.serializer`
     - `client.controlPlane`
   - `Client` 类型同步增加上述属性。
   - `src/index.ts` 导出新增公共类型。

3. 补充测试：
   - `tests/client.test.ts` 覆盖：
     - `log.write/query/export`
     - `credential.get/set/delete/rotate`
     - `serializer.encode/decode/validate`
     - `controlPlane.health/check/metrics/diagnose`
     - 关键入参校验与 Host envelope 解包。

4. 修复测试门禁：
   - 登记并修复 `工单100-SDK正式测试脚本遗漏DomainAPI单元测试导致契约漂移不可见`。
   - `Chips-SDK/package.json` 的 `npm test` 现在先运行 Vitest Domain API / route manifest 契约测试，再运行原 CLI 与脚手架集成脚本。

5. 文档同步：
   - `生态共用技术文档/协议与接口标准/05-系统接口标准.md`
     - 修正 `log.*` 真实入参。
     - 修正 `control-plane.*` 当前无入参口径。
     - 补充 `card.releaseRenderSession` 与 `card.resolveDocumentPath`。
     - 修正剪贴板正式 route 口径。
   - `生态共用技术文档/插件开发/08-SDK使用指南.md`
     - 增加系统治理能力使用说明。
   - `Chips-SDK/需求文档/02-薯片 SDK 功能需求规格.md`
     - 增加 `FR-SDK-SYSTEM`。
   - `Chips-SDK/技术文档/07-错误模型与可观测性设计.md`
   - `Chips-SDK/技术文档/08-类型系统与契约集成设计.md`
   - `Chips-SDK/技术文档/09-测试策略与质量门禁设计.md`

## 明确不暴露项

- `plugin.init`
- `plugin.handshake.complete`

上述动作仍按 Host 插件运行时内部握手链路处理，不作为普通 SDK 公共 Domain API 暴露。

## 当前验证

已通过：

```bash
cd Chips-SDK
npx vitest run tests/client.test.ts tests/card.test.ts tests/resource.test.ts tests/tooling/contract-drift.test.ts
```

结果：4 个测试文件通过，63 个测试通过。

## 后续

- 运行更新后的 `cd Chips-SDK && npm test`，确认新正式测试脚本能完整串行通过。
- 运行 `cd Chips-Host && npm run test:contract`，确认 Host/SDK route manifest 继续一致。

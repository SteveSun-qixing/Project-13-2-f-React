/**
 * 【归档件 · 工单036 波 C3 / 任务：宿主 IDocumentStoragePort 正式适配器接线与
 * `document:save` 终闸】native-parser serialize 诚实拒绝臂退役快照。
 *
 * 退役原因（载体落位，非行为放宽）：
 * - 本臂为「金链路集成七刀定案」刀6 裁决的诚实失败形态——落盘序列化权威当时归
 *   W3 chips-resource 波，解析域导出面无序列化项，臂内以在册码
 *   `BRIDGE_CAPABILITY_NOT_FOUND` 拒绝、`details` 携带端口臂与裁决出处，
 *   服务侧按既有链路包装为 `DOCUMENT_SAVE_FAILED`（`details.cause`）。
 * - 波 C1 已交付序列化算法权威（`chips-parser::serialize::serialize_document` 纯函数）、
 *   波 C3 补登 Neon 导出 `documentSerialize`（第 35 项导出）后，本臂由真实现替换：
 *   `packages/host/src/capabilities/document/adapters/native-parser.ts` 的 `serialize`
 *   臂真经 `documentSerialize(request, savedAtUnixMs)`（保存时刻 `Date.now()` 单源交付），
 *   端到端脏保存自此「真实落盘 + `document:changed/saved` 事件发布」（工单036 §三
 *   关联缺位的同波验收判据）。不留第二套活写路径。
 *
 * 本文件自 2026-10 起**不参与任何构建与测试**（不参与 tsc/eslint：置于 packages 之外），
 * 仅作退役可追溯快照保留。动作臂（`open` / `readPart` / `fingerprint` / `release` /
 * `view`）未退役，仍现役于 `native-parser.ts`。
 *
 * ———— 以下为退役当日（切换前最后一版）原文逐字快照 ————
 */

serialize(): Promise<readonly IDocumentSerializedMember[]> {
  // 刀6 裁决：落盘序列化权威归 W3 chips-resource 波，13 项解析导出面无序列化项。
  // 诚实失败以 rejection 交付（端口异步失败语义一致），不产生任何原生调用。
  return Promise.reject(
    createBridgeError(BRIDGE_ERROR_CODES.capabilityNotFound, {
      message: '落盘序列化能力未装配于解析端口',
      details: {
        port: 'IDocumentParserPort.serialize',
        adjudication: '金链路集成七刀定案·刀6：落盘序列化权威归 W3 chips-resource 波',
      },
    }),
  );
},

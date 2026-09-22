/**
 * Bridge 线封套三方逐字锁检查（工单046 段一残账，#189 波；母型 = #181 audit-entry）。
 *
 * 判定链：《02.07》§7.2/§7.1 文档侧 ↔ `@chips/bridge` 协议权威面 ↔ host IPC 适配层。
 * - §7.2 ↔ bridge：`IBridgeRequest`（ipc.ts）与 `IEventEnvelope`（events.ts）逐字一致
 *   （`readonly` 为实现侧纪律，比对前统一剥离）；
 * - §7.2 ↔ host：`wire.ts` 同构守卫形状与 §7.2 逐字一致（双源两份的交叉锁，张3 兑现）；
 * - §7.1 ↔ bridge ↔ host：`IPC_CHANNELS` 四通道值与 `EVENT_CHANNEL_PREFIX` 必须逐字
 *   出现在通道总表首列，host `channels.ts` 常量值与 bridge 逐字一致（通道名漂移必红）；
 * - 判据存在性：bridge `decodeBridgeRequest` 对 `traceId` 的拒绝与透传判据、host
 *   `isBridgeRequest` / `isEventEnvelope` 对横切键的「出现即非空串」判据，均以空白
 *   折叠子句锚核验（#168 判例：不造含空格整行脆锚）。
 */

import type { BridgeWireEnvelopeModel, HostWireEnvelopeModel } from '../code/wire-envelope.js';
import { CHANNEL_NAME_PAIRS } from '../code/wire-envelope.js';
import type { DocWireEnvelopeModel } from '../docs/wire-envelope.js';
import { WIRE_ENVELOPE_DECLARATION_NAMES } from '../docs/wire-envelope.js';
import { docRefLabel } from '../docs/reader.js';
import type { NormalizedDeclaration } from '../docs/ts-declarations.js';
import { sortViolations, violation, type ContractViolation } from '../violations.js';

export interface WireEnvelopeCheckInput {
  readonly docs: DocWireEnvelopeModel;
  readonly bridge: BridgeWireEnvelopeModel;
  readonly host: HostWireEnvelopeModel;
}

/** `decodeBridgeRequest` 对 traceId 的在册判据子句（空白折叠形态，逐字锚）。 */
export const BRIDGE_DECODE_TRACE_JUDGMENTS: readonly string[] = [
  "raw.traceId !== undefined && (typeof raw.traceId !== 'string' || raw.traceId.length === 0)",
  'raw.traceId === undefined ? base : { ...base, traceId: raw.traceId }',
];

/** host `wire.ts` 守卫对横切键的在册判据子句（空白折叠形态，逐字锚）。 */
export const HOST_GUARD_JUDGMENTS: readonly {
  readonly guard: 'isBridgeRequest' | 'isEventEnvelope';
  readonly clause: string;
}[] = [
  {
    guard: 'isBridgeRequest',
    clause: 'value.traceId === undefined || isNonEmptyString(value.traceId)',
  },
  {
    guard: 'isEventEnvelope',
    clause: 'value.traceId === undefined || isNonEmptyString(value.traceId)',
  },
  {
    guard: 'isEventEnvelope',
    clause: 'value.requestId === undefined || isNonEmptyString(value.requestId)',
  },
];

/** 归一声明 → 可比对指纹（与 audit-entry 母型同形：`readonly` 剥离后逐成员比对）。 */
function declarationFingerprint(declaration: NormalizedDeclaration): string {
  if (declaration.kind === 'type') {
    return `type ${declaration.name} = ${declaration.text}`;
  }
  const members = declaration.members.map((member) => {
    const withoutReadonly = member.signature.replace(/^readonly\s+/, '');
    return `  ${withoutReadonly}`;
  });
  return [`interface ${declaration.name} {`, ...members, '}'].join('\n');
}

export function checkWireEnvelope(input: WireEnvelopeCheckInput): ContractViolation[] {
  const { docs, bridge, host } = input;
  const violations: ContractViolation[] = [];
  const envelopeRef = docRefLabel(docs.envelopeRef);
  const channelRef = docRefLabel(docs.channelRef);

  // 一、形状三方锁：§7.2 ↔ bridge 权威 ↔ host 同构视图，逐字一致。
  for (const name of WIRE_ENVELOPE_DECLARATION_NAMES) {
    const docDeclaration = docs.declarations.get(name);
    if (docDeclaration === undefined) {
      violations.push(
        violation(
          'CONTRACT_WIRE_ENVELOPE_DOC_MISSING',
          `${envelopeRef}:${name}`,
          '§7.2 代码块缺少线封套锁定面声明',
          { expected: name, actual: '缺失' }
        )
      );
      continue;
    }
    const docFingerprint = declarationFingerprint(docDeclaration);
    const bridgeDeclaration = bridge.declarations.get(name);
    if (bridgeDeclaration === undefined) {
      violations.push(
        violation(
          'CONTRACT_WIRE_ENVELOPE_BRIDGE_MISSING',
          name,
          'bridge 协议层缺少 §7.2 权威声明（单一事实源未落地）',
          { expected: envelopeRef, actual: '缺失' }
        )
      );
    } else if (declarationFingerprint(bridgeDeclaration) !== docFingerprint) {
      violations.push(
        violation(
          'CONTRACT_WIRE_ENVELOPE_BRIDGE_DRIFT',
          name,
          'bridge 协议层声明与 §7.2 权威形状不一致（逐字段漂移）',
          { expected: docFingerprint, actual: declarationFingerprint(bridgeDeclaration) }
        )
      );
    }
    const hostDeclaration = host.declarations.get(name);
    if (hostDeclaration === undefined) {
      violations.push(
        violation(
          'CONTRACT_WIRE_ENVELOPE_HOST_MISSING',
          name,
          'host IPC 适配层缺少 §7.2 同构声明（双源交叉锁破坏）',
          { expected: envelopeRef, actual: '缺失' }
        )
      );
    } else if (declarationFingerprint(hostDeclaration) !== docFingerprint) {
      violations.push(
        violation(
          'CONTRACT_WIRE_ENVELOPE_HOST_DRIFT',
          name,
          'host 同构守卫声明与 §7.2 权威形状不一致（逐字段漂移）',
          { expected: docFingerprint, actual: declarationFingerprint(hostDeclaration) }
        )
      );
    }
  }

  // 二、通道名三方锁：bridge IPC_CHANNELS ↔ 文档 §7.1 首列 ↔ host channels.ts。
  const docChannelTokens = new Set(docs.channelTokens);
  for (const [key, value] of bridge.channels) {
    if (!docChannelTokens.has(value)) {
      violations.push(
        violation(
          'CONTRACT_WIRE_ENVELOPE_CHANNEL_DOC_MISSING',
          `${channelRef}:${key}`,
          'bridge IPC_CHANNELS 通道值未逐字出现在 §7.1 通道总表首列',
          { expected: value, actual: '文档缺失' }
        )
      );
    }
  }
  const bridgeChannelValues = new Set(bridge.channels.values());
  for (const token of docs.channelTokens) {
    const isEventDownlink = token.startsWith(bridge.eventChannelPrefix);
    if (!bridgeChannelValues.has(token) && !isEventDownlink) {
      violations.push(
        violation(
          'CONTRACT_WIRE_ENVELOPE_CHANNEL_DOC_EXTRA',
          `${channelRef}:${token}`,
          '§7.1 通道总表登记了 bridge 权威面不存在的通道名',
          { expected: 'bridge IPC_CHANNELS 在册', actual: token }
        )
      );
    }
  }
  for (const { bridgeKey, hostConst } of CHANNEL_NAME_PAIRS) {
    const bridgeValue = bridge.channels.get(bridgeKey);
    const hostValue = host.channels.get(hostConst);
    if (bridgeValue === undefined) {
      violations.push(
        violation(
          'CONTRACT_WIRE_ENVELOPE_BRIDGE_MISSING',
          `IPC_CHANNELS.${bridgeKey}`,
          'bridge IPC_CHANNELS 缺少在册通道属性',
          { expected: bridgeKey, actual: '缺失' }
        )
      );
      continue;
    }
    if (hostValue === undefined) {
      violations.push(
        violation(
          'CONTRACT_WIRE_ENVELOPE_HOST_MISSING',
          hostConst,
          'host channels.ts 缺少在册通道常量（复刻面残缺）',
          { expected: hostConst, actual: '缺失' }
        )
      );
      continue;
    }
    if (hostValue !== bridgeValue) {
      violations.push(
        violation(
          'CONTRACT_WIRE_ENVELOPE_CHANNEL_HOST_DRIFT',
          `${bridgeKey}↔${hostConst}`,
          'host 通道常量字面量与 bridge IPC_CHANNELS 漂移（双源第二份失守）',
          { expected: bridgeValue, actual: hostValue }
        )
      );
    }
  }
  if (host.channels.get('EVENT_CHANNEL_PREFIX') !== bridge.eventChannelPrefix) {
    violations.push(
      violation(
        'CONTRACT_WIRE_ENVELOPE_CHANNEL_HOST_DRIFT',
        'EVENT_CHANNEL_PREFIX',
        'host 事件下行通道前缀与 bridge 权威漂移',
        {
          expected: bridge.eventChannelPrefix,
          actual: host.channels.get('EVENT_CHANNEL_PREFIX') ?? '缺失',
        }
      )
    );
  }
  const docEventDownlinkToken = `${bridge.eventChannelPrefix}<eventId>`;
  if (!docChannelTokens.has(docEventDownlinkToken)) {
    violations.push(
      violation(
        'CONTRACT_WIRE_ENVELOPE_CHANNEL_DOC_MISSING',
        `${channelRef}:event:<eventId>`,
        '§7.1 通道总表未逐字登记事件下行前缀通道形态',
        { expected: docEventDownlinkToken, actual: '文档缺失' }
      )
    );
  }

  // 三、横切键判据存在性：bridge decode 与 host 守卫的在册子句逐锚核验。
  if (bridge.decodeBridgeRequestText.length === 0) {
    violations.push(
      violation(
        'CONTRACT_WIRE_ENVELOPE_BRIDGE_MISSING',
        'decodeBridgeRequest',
        'bridge 侧未找到 decodeBridgeRequest 函数（判据无法核验）',
        { expected: 'decodeBridgeRequest', actual: '缺失' }
      )
    );
  }
  for (const clause of BRIDGE_DECODE_TRACE_JUDGMENTS) {
    if (!bridge.decodeBridgeRequestText.includes(clause)) {
      violations.push(
        violation(
          'CONTRACT_WIRE_ENVELOPE_BRIDGE_JUDGMENT_MISSING',
          'decodeBridgeRequest.traceId',
          'bridge decodeBridgeRequest 缺少 traceId 在册判据子句（拒绝/透传判据漂移）',
          { expected: clause, actual: '未命中' }
        )
      );
    }
  }
  const guardTexts: Record<'isBridgeRequest' | 'isEventEnvelope', string> = {
    isBridgeRequest: host.isBridgeRequestText,
    isEventEnvelope: host.isEventEnvelopeText,
  };
  for (const { guard, clause } of HOST_GUARD_JUDGMENTS) {
    const text = guardTexts[guard];
    if (text.length === 0 || !text.includes(clause)) {
      violations.push(
        violation(
          'CONTRACT_WIRE_ENVELOPE_HOST_JUDGMENT_MISSING',
          `${guard}.横切键`,
          `host ${guard} 缺少横切键在册判据子句（「出现即非空串」守卫漂移）`,
          { expected: clause, actual: text.length === 0 ? '守卫缺失' : '未命中' }
        )
      );
    }
  }

  return sortViolations(violations);
}

/**
 * 帧协议消息快照检查（G8「帧协议」行的机械可判定部分）。
 *
 * - 消息代码块与 §9.3 消息清单表逐项闭合：表中有、代码块必须有；代码块有、表必须收录；
 * - 方向一致：`子 → 父` / `父 → 子`，`父 ⇄ 子` 表示双向成对消息（销毁握手）；
 * - `FrameOutboundMessage` / `HostOutboundMessage` 联合类型与两个方向的消息集合一致；
 * - 封套必须包含 `protocol` / `sessionId` / `frameId` / `message` 四字段；
 * - `protocol` 常量遵守 `chips-frame/<版本>` 文法。
 *
 * 载荷签名的具体形状由 `snapshots/frame-protocol.json` 快照锁定。
 */

import type { FrameProtocolModel } from '../docs/frame.js';
import { sortViolations, violation, type ContractViolation } from '../violations.js';

export interface FrameCheckInput {
  readonly frame: FrameProtocolModel;
}

const PROTOCOL_PATTERN = /^chips-frame\/\d+$/;

function expectedDirections(directionCell: string): readonly string[] {
  if (directionCell.includes('⇄')) {
    return ['child-to-parent', 'parent-to-child'];
  }
  if (directionCell.includes('子 → 父')) {
    return ['child-to-parent'];
  }
  if (directionCell.includes('父 → 子')) {
    return ['parent-to-child'];
  }
  return [];
}

export function checkFrameProtocol(input: FrameCheckInput): ContractViolation[] {
  const { frame } = input;
  const violations: ContractViolation[] = [];

  if (!PROTOCOL_PATTERN.test(frame.protocol)) {
    violations.push(
      violation('CONTRACT_FRAME_PROTOCOL_GRAMMAR', frame.protocol, '帧协议版本常量文法非法', {
        expected: 'chips-frame/<版本号>',
      }),
    );
  }

  for (const member of ['protocol', 'sessionId', 'frameId', 'message']) {
    if (!frame.envelope.members.some((entry) => entry.name === member)) {
      violations.push(
        violation('CONTRACT_FRAME_ENVELOPE', `FrameEnvelope.${member}`, '帧消息封套缺少必需字段', {
          expected: '字段存在',
          actual: '缺失',
        }),
      );
    }
  }

  const declaredByType = new Map<string, readonly string[]>();
  for (const message of frame.messages) {
    if (declaredByType.has(message.type)) {
      violations.push(
        violation('CONTRACT_FRAME_MESSAGE_DUPLICATE', message.type, '帧消息类型在代码块中重复声明'),
      );
    }
    declaredByType.set(message.type, [message.direction]);
  }

  const tableTypes = new Set<string>();
  for (const row of frame.table) {
    const expected = expectedDirections(row.direction);
    if (expected.length === 0) {
      violations.push(
        violation('CONTRACT_FRAME_DIRECTION_UNKNOWN', row.direction, '消息清单表方向列无法归一', {
          actual: row.direction,
        }),
      );
    }
    for (const messageType of row.messageTypes) {
      if (tableTypes.has(messageType)) {
        violations.push(
          violation('CONTRACT_FRAME_MESSAGE_DUPLICATE', messageType, '消息清单表重复收录同一消息类型'),
        );
      }
      tableTypes.add(messageType);
      const declared = declaredByType.get(messageType);
      if (declared === undefined) {
        violations.push(
          violation('CONTRACT_FRAME_MESSAGE_UNDECLARED', messageType, '消息清单表收录了代码块未声明的消息', {
            expected: '代码块声明该消息',
            actual: '缺失',
          }),
        );
        continue;
      }
      const direction = declared[0];
      if (direction !== undefined && !expected.includes(direction)) {
        violations.push(
          violation('CONTRACT_FRAME_DIRECTION', messageType, '消息方向与清单表不一致', {
            expected: expected.join(' / '),
            actual: direction,
          }),
        );
      }
    }
  }
  for (const [messageType] of declaredByType) {
    if (!tableTypes.has(messageType)) {
      violations.push(
        violation('CONTRACT_FRAME_MESSAGE_TABLE_MISSING', messageType, '代码块声明的消息未收录进清单表', {
          expected: '清单表包含该消息',
          actual: '缺失',
        }),
      );
    }
  }

  const childNames = frame.messages
    .filter((message) => message.direction === 'child-to-parent')
    .map((message) => message.name)
    .sort();
  const parentNames = frame.messages
    .filter((message) => message.direction === 'parent-to-child')
    .map((message) => message.name)
    .sort();
  const unionByName = new Map(frame.outboundUnions.map((union) => [union.name, [...union.members].sort()]));
  const expectedUnions: readonly (readonly [string, readonly string[]])[] = [
    ['FrameOutboundMessage', childNames],
    ['HostOutboundMessage', parentNames],
  ];
  for (const [unionName, expected] of expectedUnions) {
    const actual = unionByName.get(unionName);
    if (actual === undefined) {
      violations.push(
        violation('CONTRACT_FRAME_UNION_MISSING', unionName, '帧协议缺少出站消息联合类型声明'),
      );
      continue;
    }
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      violations.push(
        violation('CONTRACT_FRAME_UNION_MISMATCH', unionName, '出站消息联合类型与消息声明集合不一致', {
          expected: expected.join(', '),
          actual: actual.join(', '),
        }),
      );
    }
  }

  return sortViolations(violations);
}

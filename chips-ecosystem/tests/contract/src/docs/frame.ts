/**
 * 帧协议解析：渲染引擎设计 §9（05-接口与契约之外，权威在 01-架构设计/01-子系统设计/05.09）。
 *
 * 解析消息封套、方向分组（子帧→父帧 / 父帧→子帧）、消息声明与 §9.3 消息清单表；
 * 快照锁定消息类型、方向与载荷签名，检查模块核对代码块与清单表逐项一致。
 */

import {
  collapse,
  findSection,
  findTable,
  fencedCodeBlocks,
  inlineCodeTokens,
} from '../markdown.js';
import type { DocReader, DocRef } from './reader.js';
import {
  FRAME_DIRECTION_MARKERS,
  FRAME_ENVELOPE_SECTION,
  FRAME_MESSAGE_TABLE_SECTION,
  FRAME_PROTOCOL_SOURCE,
} from './sources.js';
import {
  normalizeCodeBlock,
  stringLiteralMember,
  unionMembers,
  type NormalizedInterface,
  type NormalizedTypeAlias,
} from './ts-declarations.js';

export type FrameDirection = 'child-to-parent' | 'parent-to-child';

export interface FrameMessageDeclaration {
  readonly name: string;
  /** 消息判别字段的字符串字面量，如 `frame:ready`。 */
  readonly type: string;
  readonly direction: FrameDirection;
  /** `payload` 成员的归一签名。 */
  readonly payload: string;
  readonly ref: DocRef;
}

export interface FrameTableRow {
  /** 表格行声明的消息判别值（一行可含多个，如销毁对）。 */
  readonly messageTypes: readonly string[];
  readonly direction: string;
  readonly trigger: string;
  readonly constraint: string;
}

export interface FrameProtocolModel {
  readonly protocol: string;
  readonly envelope: NormalizedInterface;
  readonly messages: readonly FrameMessageDeclaration[];
  readonly outboundUnions: readonly {
    readonly name: string;
    readonly members: readonly string[];
  }[];
  readonly payloadTypes: readonly NormalizedTypeAlias[];
  readonly table: readonly FrameTableRow[];
  readonly ref: DocRef;
}

interface DirectionSegments {
  readonly head: string;
  readonly child: string;
  readonly parent: string;
}

function splitDirectionSegments(body: string): DirectionSegments {
  const childMarker = FRAME_DIRECTION_MARKERS.childToParent;
  const parentMarker = FRAME_DIRECTION_MARKERS.parentToChild;
  const childIndex = body.indexOf(childMarker);
  const parentIndex = body.indexOf(parentMarker);
  if (childIndex < 0 || parentIndex < 0 || parentIndex < childIndex) {
    throw new Error(
      `帧协议章节缺少方向标记：${FRAME_PROTOCOL_SOURCE.file} §${FRAME_PROTOCOL_SOURCE.section}`
    );
  }
  return {
    head: body.slice(0, childIndex),
    child: body.slice(childIndex + childMarker.length, parentIndex),
    parent: body.slice(parentIndex + parentMarker.length),
  };
}

function messageTypeOf(declaration: NormalizedInterface): string | undefined {
  return stringLiteralMember(declaration, 'type');
}

function payloadSignature(declaration: NormalizedInterface): string {
  return declaration.members.find((member) => member.name === 'payload')?.signature ?? '';
}

interface DirectionParse {
  readonly messages: readonly FrameMessageDeclaration[];
  readonly unions: readonly { readonly name: string; readonly members: readonly string[] }[];
  readonly typeAliases: readonly NormalizedTypeAlias[];
}

function parseDirectionSegment(
  segment: string,
  direction: FrameDirection,
  ref: DocRef
): DirectionParse {
  const messages: FrameMessageDeclaration[] = [];
  const unions: { name: string; members: readonly string[] }[] = [];
  const typeAliases: NormalizedTypeAlias[] = [];
  for (const block of fencedCodeBlocks(segment, ['typescript', 'ts'])) {
    for (const declaration of normalizeCodeBlock(block.content).declarations) {
      if (declaration.kind === 'interface') {
        const type = messageTypeOf(declaration);
        if (type !== undefined) {
          messages.push({
            name: declaration.name,
            type,
            direction,
            payload: payloadSignature(declaration),
            ref,
          });
        }
        continue;
      }
      const members = unionMembers(declaration);
      if (members.length > 0) {
        unions.push({ name: declaration.name, members });
      } else {
        typeAliases.push(declaration);
      }
    }
  }
  return { messages, unions, typeAliases };
}

export function parseFrameProtocolModel(reader: DocReader): FrameProtocolModel {
  const text = reader.read(FRAME_PROTOCOL_SOURCE.file);
  const body = findSection(text, FRAME_PROTOCOL_SOURCE.level, FRAME_PROTOCOL_SOURCE.heading);
  if (body === null) {
    throw new Error(
      `未找到帧协议章节：${FRAME_PROTOCOL_SOURCE.file} §${FRAME_PROTOCOL_SOURCE.section}`
    );
  }
  const envelopeBody = findSection(body, 3, FRAME_ENVELOPE_SECTION);
  if (envelopeBody === null) {
    throw new Error(
      `未找到帧消息封套章节：${FRAME_PROTOCOL_SOURCE.file} §${FRAME_ENVELOPE_SECTION}`
    );
  }
  const segments = splitDirectionSegments(envelopeBody);
  const headBlocks = fencedCodeBlocks(segments.head, ['typescript', 'ts']);
  if (headBlocks.length !== 1) {
    throw new Error(
      `帧消息封套章节应恰有一个代码块，实际 ${headBlocks.length} 个：${FRAME_PROTOCOL_SOURCE.file} §${FRAME_ENVELOPE_SECTION}`
    );
  }
  const head = normalizeCodeBlock(headBlocks[0]?.content ?? '');
  const protocol = head.stringConstants.find(
    (constant) => constant.name === 'FRAME_PROTOCOL'
  )?.value;
  if (protocol === undefined) {
    throw new Error(
      `帧消息封套缺少 FRAME_PROTOCOL 常量：${FRAME_PROTOCOL_SOURCE.file} §${FRAME_ENVELOPE_SECTION}`
    );
  }
  const envelope = head.declarations.find(
    (declaration): declaration is NormalizedInterface =>
      declaration.kind === 'interface' && declaration.name === 'FrameEnvelope'
  );
  if (envelope === undefined) {
    throw new Error(
      `帧消息封套缺少 FrameEnvelope 接口：${FRAME_PROTOCOL_SOURCE.file} §${FRAME_ENVELOPE_SECTION}`
    );
  }
  const ref: DocRef = { file: FRAME_PROTOCOL_SOURCE.file, section: FRAME_PROTOCOL_SOURCE.section };
  const child = parseDirectionSegment(segments.child, 'child-to-parent', ref);
  const parent = parseDirectionSegment(segments.parent, 'parent-to-child', ref);
  const messages = [...child.messages, ...parent.messages];
  const outboundUnions = [...child.unions, ...parent.unions];
  const payloadTypes = [...child.typeAliases];

  const tableBody = findSection(body, 3, FRAME_MESSAGE_TABLE_SECTION);
  if (tableBody === null) {
    throw new Error(
      `未找到帧消息清单表：${FRAME_PROTOCOL_SOURCE.file} §${FRAME_MESSAGE_TABLE_SECTION}`
    );
  }
  const table = findTable(tableBody, '消息');
  if (table === null) {
    throw new Error(
      `帧消息清单表缺少「消息」表：${FRAME_PROTOCOL_SOURCE.file} §${FRAME_MESSAGE_TABLE_SECTION}`
    );
  }
  const rows: FrameTableRow[] = table.rows.map((row) => ({
    messageTypes: inlineCodeTokens(row[0] ?? '').filter((token) => token.includes(':')),
    direction: collapse(row[1] ?? ''),
    trigger: collapse(row[2] ?? ''),
    constraint: collapse(row[3] ?? ''),
  }));

  return { protocol, envelope, messages, outboundUnions, payloadTypes, table: rows, ref };
}

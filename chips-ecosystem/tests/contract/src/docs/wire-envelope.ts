/**
 * Bridge 线封套文档侧解析：《02.07》§7.2 消息类型定义代码块 + §7.1 通道总表首列。
 *
 * 工单046 段一残账收口（#189 波）：§7.2 线封套代码块自此进机械闸。
 * - §7.2：抽全部 TypeScript 代码块的顶层声明（`IBridgeRequest` / `IEventEnvelope`
 *   为三方逐字锁定面），走与审计条目同一套语法树归一（`ts-declarations`），
 *   注释不参与归一、成员名/可选性/类型/顺序必进差异；
 * - §7.1：抽「通道总表」（表头含「方向」的唯一主表，排除宿主内部通道指向小表）
 *   首列行内码 token，作为通道名的文档侧权威呈现。
 */

import { findSection, findTable, fencedCodeBlocks, inlineCodeTokens } from '../markdown.js';
import type { DocReader, DocRef } from './reader.js';
import type { SectionSelector } from './sources.js';
import { WIRE_CHANNEL_SOURCE, WIRE_ENVELOPE_SOURCE } from './sources.js';
import { normalizeCodeBlock, type NormalizedDeclaration } from './ts-declarations.js';

/** 三方逐字锁定的线封套声明名（文档 ↔ bridge ↔ host 同名同形）。 */
export const WIRE_ENVELOPE_DECLARATION_NAMES: readonly string[] = [
  'IBridgeRequest',
  'IEventEnvelope',
];

export interface DocWireEnvelopeModel {
  /** 声明名 → 归一声明（§7.2 代码块侧）。 */
  readonly declarations: ReadonlyMap<string, NormalizedDeclaration>;
  /** §7.1 通道总表首列行内码 token（按行序；含 `event:<eventId>` 前缀形态）。 */
  readonly channelTokens: readonly string[];
  readonly envelopeRef: DocRef;
  readonly channelRef: DocRef;
}

function sectionBody(reader: DocReader, selector: SectionSelector): string {
  const text = reader.read(selector.file);
  const body = findSection(text, selector.level, selector.heading);
  if (body === null) {
    throw new Error(`未找到线封套权威章节：${selector.file} §${selector.heading}`);
  }
  return body;
}

export function parseWireEnvelopeDocModel(reader: DocReader): DocWireEnvelopeModel {
  const envelopeBody = sectionBody(reader, WIRE_ENVELOPE_SOURCE);
  const blocks = fencedCodeBlocks(envelopeBody, ['typescript', 'ts']);
  if (blocks.length === 0) {
    throw new Error(
      `线封套章节缺少 TypeScript 代码块：${WIRE_ENVELOPE_SOURCE.file} §${WIRE_ENVELOPE_SOURCE.heading}`
    );
  }
  const declarations = new Map<string, NormalizedDeclaration>();
  for (const block of blocks) {
    for (const declaration of normalizeCodeBlock(block.content).declarations) {
      const previous = declarations.get(declaration.name);
      if (previous !== undefined && JSON.stringify(previous) !== JSON.stringify(declaration)) {
        throw new Error(
          `§7.2 出现同名不同形的声明（单一事实源破坏）：${declaration.name}（${WIRE_ENVELOPE_SOURCE.file}）`
        );
      }
      if (previous === undefined) {
        declarations.set(declaration.name, declaration);
      }
    }
  }
  for (const name of WIRE_ENVELOPE_DECLARATION_NAMES) {
    if (!declarations.has(name)) {
      throw new Error(`§7.2 代码块缺少锁定面声明：${name}（${WIRE_ENVELOPE_SOURCE.file}）`);
    }
  }

  const channelBody = sectionBody(reader, WIRE_CHANNEL_SOURCE);
  const channelTable = parseTablesForDirectionColumn(channelBody);
  const channelTokens = channelTable.rows.flatMap((row) => inlineCodeTokens(row[0] ?? ''));
  if (channelTokens.length === 0) {
    throw new Error(
      `通道总表首列未解析出任何通道名：${WIRE_CHANNEL_SOURCE.file} §${WIRE_CHANNEL_SOURCE.heading}`
    );
  }

  return {
    declarations,
    channelTokens,
    envelopeRef: {
      file: WIRE_ENVELOPE_SOURCE.file,
      section: WIRE_ENVELOPE_SOURCE.section ?? WIRE_ENVELOPE_SOURCE.heading,
    },
    channelRef: {
      file: WIRE_CHANNEL_SOURCE.file,
      section: WIRE_CHANNEL_SOURCE.section ?? WIRE_CHANNEL_SOURCE.heading,
    },
  };
}

/** 取「通道总表」主表：表头含「方向」列、首列为「通道」；同名章节内另有宿主内部通道指向小表，按表头甄别排除。 */
function parseTablesForDirectionColumn(body: string): {
  readonly rows: readonly (readonly string[])[];
} {
  const table = findTable(body, '方向');
  if (table === null) {
    throw new Error(
      `通道总表缺少含「方向」列的主表：${WIRE_CHANNEL_SOURCE.file} §${WIRE_CHANNEL_SOURCE.heading}`
    );
  }
  return table;
}

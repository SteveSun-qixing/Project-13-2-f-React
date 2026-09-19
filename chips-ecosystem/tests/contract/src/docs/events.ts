/**
 * 标准事件表解析：保留域计数（05-接口与契约/05.02 §2.2）与逐事件契约（第五节各分册）。
 *
 * 逐事件契约包含 ID、payload 字段、触发时机与可见性；
 * 与 Bridge 的 `STANDARD_EVENTS` 比对 ID 与可见性，payload/触发时机进入快照评审。
 */

import { collapse, findLabelledLine, findSection, findTable, inlineCodeTokens, splitHeadingSections } from '../markdown.js';
import type { DocReader, DocRef } from './reader.js';
import { EVENT_DECLARATION_FILES, EVENT_RESERVED_DOMAIN_SOURCE } from './sources.js';

export const EVENT_ID_PATTERN = /^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$/;

/** 文档可见性表述归一后的判定键（与 Bridge `EventVisibility.kind` 对齐）。 */
export type DocVisibilityKind =
  | 'public'
  | 'platform'
  | 'plugin-field:pluginId'
  | 'config-namespace'
  | 'owner-lookup:command'
  | 'owner-lookup:tray'
  | 'owner-lookup:shortcut'
  | 'owner-lookup:transfer'
  | 'unknown';

export interface DocEventPayloadField {
  readonly name: string;
  readonly type: string;
  readonly required: boolean;
}

export interface DocEvent {
  readonly id: string;
  readonly domain: string;
  readonly payload: readonly DocEventPayloadField[];
  readonly trigger: string;
  readonly visibilityText: string;
  readonly visibilityKind: DocVisibilityKind;
  readonly ref: DocRef;
}

export interface DocReservedDomain {
  readonly domain: string;
  /** 文档声明的事件数；null 表示不公开、不计数。 */
  readonly declaredCount: number | null;
}

export interface DocEventModel {
  readonly reservedDomains: readonly DocReservedDomain[];
  readonly events: readonly DocEvent[];
}

export function classifyVisibility(text: string): DocVisibilityKind {
  if (text.includes('仅平台与官方审计界面')) {
    return 'platform';
  }
  if (text.startsWith('公开')) {
    return 'public';
  }
  if (text.includes('定向投递给该插件实例') || text.includes('payload.pluginId')) {
    return 'plugin-field:pluginId';
  }
  if (text.includes('命名空间')) {
    return 'config-namespace';
  }
  if (text.includes('命令 owner')) {
    return 'owner-lookup:command';
  }
  if (text.includes('创建该托盘')) {
    return 'owner-lookup:tray';
  }
  if (text.includes('注册该快捷键')) {
    return 'owner-lookup:shortcut';
  }
  if (text.includes('发起传输')) {
    return 'owner-lookup:transfer';
  }
  return 'unknown';
}

function parseReservedDomains(reader: DocReader): readonly DocReservedDomain[] {
  const text = reader.read(EVENT_RESERVED_DOMAIN_SOURCE.file);
  const body = findSection(text, EVENT_RESERVED_DOMAIN_SOURCE.level, EVENT_RESERVED_DOMAIN_SOURCE.heading);
  if (body === null) {
    throw new Error(
      `未找到事件保留域章节：${EVENT_RESERVED_DOMAIN_SOURCE.file} §${EVENT_RESERVED_DOMAIN_SOURCE.heading}`,
    );
  }
  const table = findTable(body, '域');
  if (table === null) {
    throw new Error(
      `事件保留域章节缺少「域」表：${EVENT_RESERVED_DOMAIN_SOURCE.file} §${EVENT_RESERVED_DOMAIN_SOURCE.heading}`,
    );
  }
  const domains: DocReservedDomain[] = [];
  for (const row of table.rows) {
    const token = inlineCodeTokens(row[0] ?? '').find((value) => /^[a-z][a-z0-9-]*$/.test(value));
    if (token === undefined) {
      throw new Error(
        `保留域行未解析出域名：${row[0] ?? ''}（${EVENT_RESERVED_DOMAIN_SOURCE.file} §${EVENT_RESERVED_DOMAIN_SOURCE.heading}）`,
      );
    }
    const countMatch = /(\d+)\s*个/.exec(collapse(row[row.length - 1] ?? ''));
    domains.push({
      domain: token,
      declaredCount: countMatch === null || countMatch[1] === undefined ? null : Number.parseInt(countMatch[1], 10),
    });
  }
  return domains;
}

function parsePayload(body: string, ref: DocRef): readonly DocEventPayloadField[] {
  const table = findTable(body, '字段');
  if (table === null) {
    throw new Error(`事件缺少 payload 字段表：${ref.file} §${ref.section}`);
  }
  const header = table.header.map((cell) => collapse(cell));
  const requiredIndex = header.findIndex((cell) => cell === '必填');
  if (requiredIndex < 0) {
    throw new Error(`事件 payload 表头缺少「必填」列：${ref.file} §${ref.section}`);
  }
  const fields: DocEventPayloadField[] = [];
  for (const row of table.rows) {
    const name = inlineCodeTokens(row[0] ?? '')[0];
    if (name === undefined) {
      throw new Error(`payload 行未解析出字段名：${row[0] ?? ''}（${ref.file} §${ref.section}）`);
    }
    fields.push({
      name,
      type: collapse(row[1] ?? ''),
      required: collapse(row[requiredIndex] ?? '').startsWith('是'),
    });
  }
  return fields;
}

function parseEventDeclarations(reader: DocReader): readonly DocEvent[] {
  const events: DocEvent[] = [];
  const seen = new Set<string>();
  for (const file of EVENT_DECLARATION_FILES) {
    const text = reader.read(file);
    for (const section of splitHeadingSections(text, 4)) {
      const id = section.heading;
      if (!EVENT_ID_PATTERN.test(id)) {
        continue;
      }
      if (seen.has(id)) {
        throw new Error(`事件 ID 重复：${id}（${file}）`);
      }
      seen.add(id);
      const ref: DocRef = { file, section: id };
      const trigger = findLabelledLine(section.body, '触发时机');
      if (trigger === undefined) {
        throw new Error(`事件缺少「触发时机」：${id}（${file}）`);
      }
      const visibilityText = findLabelledLine(section.body, '可见性');
      if (visibilityText === undefined) {
        throw new Error(`事件缺少「可见性」：${id}（${file}）`);
      }
      events.push({
        id,
        domain: id.slice(0, id.indexOf(':')),
        payload: parsePayload(section.body, ref),
        trigger,
        visibilityText,
        visibilityKind: classifyVisibility(visibilityText),
        ref,
      });
    }
  }
  return events;
}

export function parseEventModel(reader: DocReader): DocEventModel {
  return {
    reservedDomains: parseReservedDomains(reader),
    events: parseEventDeclarations(reader),
  };
}

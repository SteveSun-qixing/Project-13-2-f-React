/**
 * Bridge 线封套实现侧装载（工单046 段一残账三方锁，#189 波）。
 *
 * 三面文本、两条读取通道，全部只读源码文本、零 import 编译依赖：
 * - bridge 权威面：`packages/bridge/src/protocol/ipc.ts`（`IBridgeRequest` 形状、
 *   `IPC_CHANNELS` 通道字面量、`decodeBridgeRequest` 对 `traceId` 的拒绝/透传判据）
 *   与 `protocol/events.ts`（`IEventEnvelope` 形状）；
 * - host 适配层：`packages/host/src/protocol/wire.ts`（`IBridgeRequest` /
 *   `IEventEnvelope` 同构守卫形状与 `isBridgeRequest` / `isEventEnvelope` 横切键判据）
 *   与 `packages/host/src/protocol/channels.ts`（通道名字面量）。
 *
 * host 两文件系 #183 在途独占面：本模块只 `readFileSync` 取文本比对，
 * 禁止 import、禁止任何写（方案 (b) 主裁形）。
 * 装载函数一律接受「文本」注入，偏差注入与锁测共用同一判定管线。
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

import { normalizeCodeBlock, type NormalizedDeclaration } from '../docs/ts-declarations.js';
import { WORKSPACE_ROOT } from '../paths.js';

/** 实现侧被锁定的源码文件（展示路径，进入偏差定位）。 */
export const BRIDGE_IPC_FILE = 'packages/bridge/src/protocol/ipc.ts';
export const BRIDGE_EVENTS_FILE = 'packages/bridge/src/protocol/events.ts';
export const HOST_WIRE_FILE = 'packages/host/src/protocol/wire.ts';
export const HOST_CHANNELS_FILE = 'packages/host/src/protocol/channels.ts';

/** `IPC_CHANNELS` 属性名 ↔ host `channels.ts` 常量的通道级对照（同名通道钉同值）。 */
export const CHANNEL_NAME_PAIRS: readonly { bridgeKey: string; hostConst: string }[] = [
  { bridgeKey: 'bridgeRequest', hostConst: 'BRIDGE_REQUEST_CHANNEL' },
  { bridgeKey: 'bridgeResource', hostConst: 'BRIDGE_RESOURCE_CHANNEL' },
  { bridgeKey: 'eventControl', hostConst: 'EVENT_CONTROL_CHANNEL' },
  { bridgeKey: 'sessionPermissions', hostConst: 'SESSION_PERMISSIONS_CHANNEL' },
];

export interface BridgeWireEnvelopeModel {
  /** 锁定面声明名 → 归一声明（`IBridgeRequest` 取 ipc.ts、`IEventEnvelope` 取 events.ts）。 */
  readonly declarations: ReadonlyMap<string, NormalizedDeclaration>;
  /** `IPC_CHANNELS` 对象字面量的属性名 → 字符串值。 */
  readonly channels: ReadonlyMap<string, string>;
  /** `EVENT_CHANNEL_PREFIX` 常量值。 */
  readonly eventChannelPrefix: string;
  /** `decodeBridgeRequest` 函数体（空白折叠后的文本，供判据存在性核验）。 */
  readonly decodeBridgeRequestText: string;
}

export interface HostWireEnvelopeModel {
  /** 锁定面声明名 → 归一声明（`IBridgeRequest` / `IEventEnvelope`，host 同构视图）。 */
  readonly declarations: ReadonlyMap<string, NormalizedDeclaration>;
  /** `channels.ts` 顶层字符串常量名 → 值。 */
  readonly channels: ReadonlyMap<string, string>;
  /** `isBridgeRequest` 守卫函数体（空白折叠文本）。 */
  readonly isBridgeRequestText: string;
  /** `isEventEnvelope` 守卫函数体（空白折叠文本）。 */
  readonly isEventEnvelopeText: string;
}

/** 空白折叠（#168 判例：判据锚一律在折叠文本上匹配，不造含空格整行脆锚）。 */
export function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ');
}

function declarationsFromText(sourceText: string): Map<string, NormalizedDeclaration> {
  const declarations = new Map<string, NormalizedDeclaration>();
  for (const declaration of normalizeCodeBlock(sourceText).declarations) {
    if (!declarations.has(declaration.name)) {
      declarations.set(declaration.name, declaration);
    }
  }
  return declarations;
}

function parseSource(sourceText: string): ts.SourceFile {
  return ts.createSourceFile(
    'contract-wire-envelope.ts',
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
}

/** 抽取 `export const NAME = { key: 'literal', … } as const` 的字符串属性表。 */
function objectLiteralStrings(sourceText: string, constName: string): Map<string, string> {
  const found = new Map<string, string>();
  const source = parseSource(sourceText);
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) {
      continue;
    }
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || declaration.name.text !== constName) {
        continue;
      }
      const initializer = declaration.initializer;
      if (initializer === undefined) {
        continue;
      }
      // `as const` 后缀断言包裹的解包后再取对象字面量。
      const objectLiteral = ts.isAsExpression(initializer) ? initializer.expression : initializer;
      if (!ts.isObjectLiteralExpression(objectLiteral)) {
        continue;
      }
      for (const property of objectLiteral.properties) {
        if (!ts.isPropertyAssignment(property) || !ts.isStringLiteral(property.initializer)) {
          continue;
        }
        found.set(
          property.name.getText(source).replace(/^['"]|['"]$/g, ''),
          property.initializer.text
        );
      }
    }
  }
  return found;
}

/** 抽取顶层函数的源码文本并折叠空白；未找到返回空串（检查侧按缺失报偏差）。 */
function functionText(sourceText: string, functionName: string): string {
  const source = parseSource(sourceText);
  for (const statement of source.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name?.text === functionName) {
      return collapseWhitespace(statement.getText(source));
    }
  }
  return '';
}

/** 顶层字符串常量表（名 → 值），取 `normalizeCodeBlock` 的 stringConstants 事实。 */
function stringConstants(sourceText: string): Map<string, string> {
  const found = new Map<string, string>();
  for (const constant of normalizeCodeBlock(sourceText).stringConstants) {
    if (!found.has(constant.name)) {
      found.set(constant.name, constant.value);
    }
  }
  return found;
}

/** 解析 bridge `ipc.ts` 文本：`IBridgeRequest` 形状、`IPC_CHANNELS` 通道表与解码判据。 */
export function parseBridgeIpcText(ipcText: string): BridgeWireEnvelopeModel {
  const prefix = stringConstants(ipcText).get('EVENT_CHANNEL_PREFIX');
  return {
    declarations: declarationsFromText(ipcText),
    channels: objectLiteralStrings(ipcText, 'IPC_CHANNELS'),
    eventChannelPrefix: prefix ?? '',
    decodeBridgeRequestText: functionText(ipcText, 'decodeBridgeRequest'),
  };
}

/** 组装 bridge 权威面模型：`IEventEnvelope` 自 `events.ts` 并入单一声明表。 */
export function parseBridgeWireEnvelopeModel(
  ipcText: string,
  eventsText: string
): BridgeWireEnvelopeModel {
  const base = parseBridgeIpcText(ipcText);
  const declarations = new Map(base.declarations);
  const envelope = declarationsFromText(eventsText).get('IEventEnvelope');
  if (envelope !== undefined) {
    declarations.set('IEventEnvelope', envelope);
  }
  return { ...base, declarations };
}

export function parseHostWireEnvelopeModel(
  wireText: string,
  channelsText: string
): HostWireEnvelopeModel {
  return {
    declarations: declarationsFromText(wireText),
    channels: stringConstants(channelsText),
    isBridgeRequestText: functionText(wireText, 'isBridgeRequest'),
    isEventEnvelopeText: functionText(wireText, 'isEventEnvelope'),
  };
}

/** 读取真实实现侧四件源码文本（相对工作区路径 → 文本）；只读，零写入。 */
export function loadWireEnvelopeCodeTexts(): ReadonlyMap<string, string> {
  return new Map([
    [BRIDGE_IPC_FILE, readFileSync(path.join(WORKSPACE_ROOT, BRIDGE_IPC_FILE), 'utf8')],
    [BRIDGE_EVENTS_FILE, readFileSync(path.join(WORKSPACE_ROOT, BRIDGE_EVENTS_FILE), 'utf8')],
    [HOST_WIRE_FILE, readFileSync(path.join(WORKSPACE_ROOT, HOST_WIRE_FILE), 'utf8')],
    [HOST_CHANNELS_FILE, readFileSync(path.join(WORKSPACE_ROOT, HOST_CHANNELS_FILE), 'utf8')],
  ]);
}

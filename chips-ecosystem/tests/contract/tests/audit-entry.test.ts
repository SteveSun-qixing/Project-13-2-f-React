/**
 * 权限审计条目三方锁测（工单046 段一：条目面单一事实源）。
 *
 * 正向臂：《08.08》§8.2 ↔ `@chips/bridge` 协议层 ↔ SDK 转发锚点逐字一致，
 * 异型 `IPermissionAuditRecord` 三面源码零命中；v1.0.3 现文 16 字段全量在册。
 * 偏差臂：任何一侧的改名、缺字段、可选性漂移、手抄回潮、异型回潮都必须红。
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import path from 'node:path';
import { checkAuditEntry } from '../src/check/audit-entry.js';
import {
  BRIDGE_PERMISSION_FILE,
  SDK_PERMISSION_FILE,
  findForbiddenShapeHits,
  loadAuditEntryCodeTexts,
  parseBridgePermissionText,
  parseSdkPermissionAnchorText,
} from '../src/code/audit-entry.js';
import { parseAuditEntryModel } from '../src/docs/audit-entry.js';
import { PERMISSION_AUDIT_ENTRY_SOURCE } from '../src/docs/sources.js';
import { createMemoryReader } from '../src/docs/reader.js';
import { WORKSPACE_ROOT } from '../src/paths.js';
import { assertNoViolations } from '../src/violations.js';

const DOC_AUDIT_FILE = path.join(
  WORKSPACE_ROOT,
  '..',
  '薯片生态文档库',
  PERMISSION_AUDIT_ENTRY_SOURCE.file
);

/** v1.0.3 现文《08.08》§8.2 全 16 字段（词表逐字锚，改名/增删必须显式评审）。 */
const AUDIT_ENTRY_FIELD_ANCHOR: readonly string[] = [
  'id',
  'timestamp',
  'action',
  'source',
  'actor',
  'pluginId',
  'pluginVersion',
  'sessionId',
  'permission',
  'qualifier',
  'capabilityId',
  'target',
  'resourceUri',
  'reason',
  'traceId',
  'requestId',
];

function loadModels(): {
  docs: ReturnType<typeof parseAuditEntryModel>;
  bridge: ReturnType<typeof parseBridgePermissionText>;
  sdk: ReturnType<typeof parseSdkPermissionAnchorText>;
  codeTexts: ReadonlyMap<string, string>;
} {
  const docs = parseAuditEntryModel({
    read: (relativePath: string) => {
      if (relativePath !== PERMISSION_AUDIT_ENTRY_SOURCE.file) {
        throw new Error(`非预期文档读取：${relativePath}`);
      }
      return readFileSync(DOC_AUDIT_FILE, 'utf8');
    },
  });
  const codeTexts = loadAuditEntryCodeTexts();
  const bridge = parseBridgePermissionText(codeTexts.get(BRIDGE_PERMISSION_FILE) as string);
  const sdk = parseSdkPermissionAnchorText(codeTexts.get(SDK_PERMISSION_FILE) as string);
  return { docs, bridge, sdk, codeTexts };
}

describe('权限审计条目三方一致（§8.2 ↔ bridge ↔ sdk）', () => {
  it('真实文档与实现侧零偏差', () => {
    const { docs, bridge, sdk, codeTexts } = loadModels();
    assertNoViolations(
      checkAuditEntry({ docs, bridge, sdk, forbiddenShapeHits: findForbiddenShapeHits(codeTexts) })
    );
  });

  it('§8.2 权威形状为 v1.0.3 全 16 字段（词表逐字锚）', () => {
    const { docs } = loadModels();
    const entry = docs.declarations.get('IPermissionAuditEntry');
    expect(entry?.kind).toBe('interface');
    expect(entry?.kind === 'interface' ? entry.members.map((member) => member.name) : []).toEqual(
      AUDIT_ENTRY_FIELD_ANCHOR
    );
    expect(entry?.kind === 'interface' ? entry.members.length : 0).toBe(16);
  });

  it('SDK 治理类型面四权威声明全部锚定 @chips/bridge 转发', () => {
    const { sdk } = loadModels();
    for (const name of [
      'IPermissionAuditEntry',
      'PermissionAuditAction',
      'PermissionAuditSource',
      'PermissionDenyReason',
    ]) {
      expect(sdk.importedFromBridge.has(name), `未自 @chips/bridge 引入：${name}`).toBe(true);
      expect(sdk.reexported.has(name), `未对外转发：${name}`).toBe(true);
      expect(sdk.locallyDeclared.has(name), `本地再声明：${name}`).toBe(false);
    }
  });

  it('异型 IPermissionAuditRecord 在 bridge/sdk/host 源码零命中', () => {
    const { codeTexts } = loadModels();
    expect(findForbiddenShapeHits(codeTexts)).toEqual([]);
  });
});

describe('权限审计条目偏差注入（每一侧漂移必须红）', () => {
  const base = loadModels();

  it('文档 §8.2 删除一个字段：条目漂移 + 词表不闭合双检出', () => {
    const mutatedDoc = readFileSync(DOC_AUDIT_FILE, 'utf8').replace(
      '  resourceUri?: string;\n',
      ''
    );
    const docs = parseAuditEntryModel(
      createMemoryReader(new Map([[PERMISSION_AUDIT_ENTRY_SOURCE.file, mutatedDoc]]))
    );
    const violations = checkAuditEntry({
      docs,
      bridge: base.bridge,
      sdk: base.sdk,
      forbiddenShapeHits: [],
    });
    const codes = new Set(violations.map((item) => item.code));
    expect(codes.has('CONTRACT_AUDIT_ENTRY_TABLE_EXTRA')).toBe(true);
    expect(codes.has('CONTRACT_AUDIT_ENTRY_BRIDGE_DRIFT')).toBe(true);
  });

  it('bridge 侧把 requestId 可选改必填：逐字段漂移检出', () => {
    const mutatedBridge = (base.codeTexts.get(BRIDGE_PERMISSION_FILE) as string).replace(
      'readonly requestId?: string;',
      'readonly requestId: string;'
    );
    const violations = checkAuditEntry({
      docs: base.docs,
      bridge: parseBridgePermissionText(mutatedBridge),
      sdk: base.sdk,
      forbiddenShapeHits: [],
    });
    expect(violations.map((item) => item.code)).toContain('CONTRACT_AUDIT_ENTRY_BRIDGE_DRIFT');
  });

  it('SDK 手抄面回潮（本地再声明权威形状）：检出', () => {
    const mutatedSdk = `${base.codeTexts.get(SDK_PERMISSION_FILE) as string}\nexport interface IPermissionAuditEntry {\n  readonly id: string;\n}\n`;
    const violations = checkAuditEntry({
      docs: base.docs,
      bridge: base.bridge,
      sdk: parseSdkPermissionAnchorText(mutatedSdk),
      forbiddenShapeHits: [],
    });
    expect(violations.map((item) => item.code)).toContain('CONTRACT_AUDIT_ENTRY_SDK_RESHAPED');
  });

  it('异型 IPermissionAuditRecord 回潮：机械闸检出', () => {
    const texts = new Map<string, string>([
      [
        'packages/bridge/src/core/permission-evaluator.ts',
        'export interface IPermissionAuditRecord {\n  sessionId: string;\n}\n',
      ],
    ]);
    const violations = checkAuditEntry({
      docs: base.docs,
      bridge: base.bridge,
      sdk: base.sdk,
      forbiddenShapeHits: findForbiddenShapeHits(texts),
    });
    expect(violations.map((item) => item.code)).toContain('CONTRACT_AUDIT_ENTRY_FORBIDDEN_SHAPE');
  });
});

/**
 * `resource:open` / `resource:list-handlers` 契约镜像锁单测（14-资源打开与默认处理器契约
 * §2.2/§4.5/§5.1/§5.5/§6.1/§6.2、04-能力契约规范 §6.2 R19、05-事件契约规范 §4.4）。
 *
 * @remarks
 * - 与 `document-capability-contract.test.ts` 同纪律：`@chips/host` 不在 `@chips/sdk` /
 *   `@chips/bridge` 依赖边内，读取生成源与登记表原文做结构解析比对，任一侧漂移即红。
 * - 锁定面：能力 ID、权限映射、限定值目标、事件 ID 文法、输入 Schema 逐字段、
 *   上下文/结果类型形状与 SDK 源的逐字一致性、槽位键文法常量。
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  RESOURCE_OPEN_CAPABILITY_IDS,
  RESOURCE_OPEN_CAPABILITY_PERMISSIONS,
  RESOURCE_OPEN_CAPABILITY_TARGETS,
  RESOURCE_OPEN_EVENT_IDS,
  RESOURCE_OPEN_INPUT_SCHEMAS,
  RESOURCE_OPEN_MIME_PATTERN,
  RESOURCE_OPEN_OCTET_STREAM,
  RESOURCE_OPEN_SLOT_EXT_PREFIX,
  RESOURCE_OPEN_SLOT_MIME_PREFIX,
  extensionSlotKey,
  inferMimeTypeFromExtension,
  mimeSlotKey,
  normalizeExtension,
} from '../src/capabilities/resource-open/contract.js';
import { createResourceOpenCapabilityDescriptors } from '../src/capabilities/resource-open/descriptors.js';

/** 读取工作区内生成源/登记表原文（不建立包依赖边）。 */
function readWorkspaceSource(relativeFromTests: string): string {
  return readFileSync(fileURLToPath(new URL(relativeFromTests, import.meta.url)), 'utf8');
}

const SDK_CAPABILITY_PERMISSIONS_SOURCE = readWorkspaceSource(
  '../../../packages/sdk/src/generated/capability-permissions.ts',
);
const SDK_EVENT_IDS_SOURCE = readWorkspaceSource('../../../packages/sdk/src/generated/event-ids.ts');
const BRIDGE_CONTRACTS_SOURCE = readWorkspaceSource('../../../packages/bridge/src/protocol/capability-contracts.ts');
const SDK_RESOURCE_OPEN_TYPES_SOURCE = readWorkspaceSource('../../../packages/sdk/src/types/resource-open.ts');

describe('resource-open 契约镜像锁（R19 / 14 §2.2 / 05 §4.4）', () => {
  it('能力 ID 与 `@chips/sdk` 生成表、`@chips/bridge` 登记表逐字一致', () => {
    expect(Object.values(RESOURCE_OPEN_CAPABILITY_IDS)).toEqual(['resource:open', 'resource:list-handlers']);
    expect(SDK_CAPABILITY_PERMISSIONS_SOURCE).toContain("'resource:open': ['resources:read']");
    expect(SDK_CAPABILITY_PERMISSIONS_SOURCE).toContain("'resource:list-handlers': []");
    // Bridge 登记表行：`resource:open` 带 `resource.uri` 限定值目标、`resource:list-handlers` 免权限。
    expect(BRIDGE_CONTRACTS_SOURCE).toContain(
      "contract('resource:open', ['resources:read'], [target('resources:read', 'resource.uri')])",
    );
    expect(BRIDGE_CONTRACTS_SOURCE).toContain("contract('resource:list-handlers', [])");
  });

  it('权限映射镜像与 R19 canonical 行双向锁定', () => {
    expect(RESOURCE_OPEN_CAPABILITY_PERMISSIONS['resource:open']).toEqual(['resources:read']);
    expect(RESOURCE_OPEN_CAPABILITY_PERMISSIONS['resource:list-handlers']).toEqual([]);
  });

  it('限定值目标镜像与 Bridge 登记表逐项一致（`resource.uri` 点分路径）', () => {
    expect(RESOURCE_OPEN_CAPABILITY_TARGETS['resource:open']).toEqual([
      { permission: 'resources:read', targetFields: ['resource.uri'] },
    ]);
    expect(RESOURCE_OPEN_CAPABILITY_TARGETS['resource:list-handlers']).toEqual([]);
  });

  it('事件 ID 文法合规且与 `@chips/sdk` 生成表一致（05 §2 `<domain>:<action>`）', () => {
    expect(RESOURCE_OPEN_EVENT_IDS.opened).toBe('resource:opened');
    expect(RESOURCE_OPEN_EVENT_IDS.opened).toMatch(/^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$/);
    expect(SDK_EVENT_IDS_SOURCE).toContain("RESOURCE_OPENED: 'resource:opened'");
    expect(SDK_EVENT_IDS_SOURCE).toContain("'resource:opened',");
  });

  it('输入 Schema 逐字段镜像 14 §2.2 / §6.2（含 chips-resource-uri format 与 payload 上限）', () => {
    expect(RESOURCE_OPEN_INPUT_SCHEMAS['resource:open']).toEqual({
      type: 'object',
      additionalProperties: false,
      properties: {
        intent: { type: 'string', enum: ['view', 'edit'] },
        resource: {
          type: 'object',
          additionalProperties: false,
          required: ['uri'],
          properties: {
            uri: { type: 'string', format: 'chips-resource-uri', maxLength: 2048 },
            mimeType: { type: 'string', pattern: RESOURCE_OPEN_MIME_PATTERN, maxLength: 128 },
            fileName: { type: 'string', minLength: 1, maxLength: 255 },
            title: { type: 'string', minLength: 1, maxLength: 128 },
            payload: { type: 'object', maxProperties: 32 },
          },
        },
      },
      required: ['resource'],
    });
    expect(RESOURCE_OPEN_INPUT_SCHEMAS['resource:list-handlers']).toEqual({
      type: 'object',
      additionalProperties: false,
      properties: {},
    });
  });

  it('上下文/结果类型形状与 SDK 源逐字段一致（结构视图零漂移）', () => {
    // IResourceOpenContext 关键成员（14 §5.1）在 SDK 源中逐字在册。
    for (const member of ['intent', 'origin', 'uri', 'mimeType', 'extension', 'fileName', 'title', 'slot', 'payload']) {
      expect(SDK_RESOURCE_OPEN_TYPES_SOURCE).toMatch(new RegExp(`readonly ${member}\\??:`));
    }
    // 打开意图/来源/层级/投递模式枚举值。
    expect(SDK_RESOURCE_OPEN_TYPES_SOURCE).toContain("'os-association' | 'drop' | 'in-app' | 'frame'");
    expect(SDK_RESOURCE_OPEN_TYPES_SOURCE).toContain("'primary' | 'fallback'");
    expect(SDK_RESOURCE_OPEN_TYPES_SOURCE).toContain("'app' | 'service' | 'shell' | 'external'");
    // `resource:opened` payload（{ pluginId, context }，14 §5.5 / 05 §4.4）由本包
    // `context.ts` 镜像承载（SDK 未登记该 payload 类型），形状锁在服务套件断言。
  });

  it('注册单元与契约常量逐项一致（02 §4.1 注册项形状）', () => {
    const service = {
      executeOpen: (): Promise<unknown> => Promise.resolve({}),
      executeListHandlers: (): Promise<unknown> => Promise.resolve({ slots: [] }),
    };
    const descriptors = createResourceOpenCapabilityDescriptors(
      service as Parameters<typeof createResourceOpenCapabilityDescriptors>[0],
    );
    expect(descriptors.map((descriptor) => descriptor.id)).toEqual(['resource:open', 'resource:list-handlers']);
    expect(descriptors.map((descriptor) => descriptor.permissions)).toEqual([['resources:read'], []]);
    expect(descriptors[0]?.targets).toEqual(RESOURCE_OPEN_CAPABILITY_TARGETS['resource:open']);
    expect(descriptors[0]?.schema).toBe(RESOURCE_OPEN_INPUT_SCHEMAS['resource:open']);
    expect(descriptors[1]?.schema).toBe(RESOURCE_OPEN_INPUT_SCHEMAS['resource:list-handlers']);
    expect(descriptors.every((descriptor) => descriptor.concurrency === 'parallel')).toBe(true);
  });

  it('槽位键文法常量与推断表守 §6.1 / §2.3 / §3.5（候勘行不入表）', () => {
    expect(RESOURCE_OPEN_SLOT_MIME_PREFIX).toBe('mime:');
    expect(RESOURCE_OPEN_SLOT_EXT_PREFIX).toBe('ext:');
    expect(mimeSlotKey('image/png')).toBe('mime:image/png');
    expect(extensionSlotKey('.png')).toBe('ext:.png');
    expect(RESOURCE_OPEN_OCTET_STREAM).toBe('application/octet-stream');
    // canonical 在册行可推断；候勘行（Office 族 / .7z / .json 精确细分 / .box）不硬造。
    expect(inferMimeTypeFromExtension('.png')).toBe('image/png');
    expect(inferMimeTypeFromExtension('.mp3')).toBe('audio/mpeg');
    expect(inferMimeTypeFromExtension('.webm')).toBe('audio/webm');
    expect(inferMimeTypeFromExtension('.card')).toBe('application/x-card');
    expect(inferMimeTypeFromExtension('.docx')).toBeNull();
    expect(inferMimeTypeFromExtension('.7z')).toBeNull();
    expect(inferMimeTypeFromExtension('.json')).toBeNull();
    expect(inferMimeTypeFromExtension('.box')).toBeNull();
    expect(inferMimeTypeFromExtension(undefined)).toBeNull();
  });

  it('扩展名归一守 §2.3 规则 3（小写加点；无点/首字符点/尾点即缺席）', () => {
    expect(normalizeExtension('photo.PNG')).toBe('.png');
    expect(normalizeExtension('archive.tar.gz')).toBe('.gz');
    expect(normalizeExtension('no-extension')).toBeUndefined();
    expect(normalizeExtension('.hidden')).toBeUndefined();
    expect(normalizeExtension('trailing.')).toBeUndefined();
  });
});

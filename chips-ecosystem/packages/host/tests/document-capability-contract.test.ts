/**
 * `document:*` 契约镜像锁单测（`04-能力契约规范` §6.2/§7.3、`05-事件契约规范` §4.2、
 * `02-Bridge三层设计` §4.1、`03-核心接口规范` §5.1/§5.3；命名唯一依据《本轮架构收口裁决》§一）。
 *
 * 覆盖：壳侧镜像（`contract.ts`）与 `@chips/sdk` 生成常量、`@chips/bridge` 内置能力登记表
 * 的逐项一致性（读取生成源与登记表原文比对，任一漂移即红）、注册单元（`descriptors.ts`）
 * 与镜像常量及 `runtime/capabilities/reserved.ts` 预留槽位的逐项一致性、上下文如实传递。
 *
 * @remarks
 * - `@chips/host` 当前不在 `@chips/sdk` / `@chips/bridge` 的工作区依赖边内（集成缺口已按
 *   工单口径登记），故本套件不 import 两侧包，而是读取其生成源文件原文做结构解析比对——
 *   这正是"双源不漂移"的锁：任何一侧改 ID、权限、事件、限定值目标或提供方标识而另一侧未跟进，
 *   都会在这里确定性翻红（前路 `IDocumentKind` / `DocumentKind` 命名漂移的防复发面）。
 * - 本模块交付面为四项（`open` / `read` / `write` / `save`）；`document:create` 与
 *   `document:export` 属后续交付，此处锁定"SDK 全集 − 本模块镜像 = 恰为 create/export"，
 *   新增第五项文档能力而未在本模块落地时同样翻红，防止静默缩水。
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  DOCUMENT_CAPABILITY_IDS,
  DOCUMENT_CAPABILITY_PERMISSIONS,
  DOCUMENT_CAPABILITY_TARGETS,
  DOCUMENT_EVENT_IDS,
  DOCUMENT_INPUT_SCHEMAS,
  DOCUMENT_PLATFORM_CAPABILITY_OWNER,
} from '../src/capabilities/document/contract.js';
import type { DocumentCapabilityId } from '../src/capabilities/document/contract.js';
import { createDocumentCapabilityDescriptors } from '../src/capabilities/document/descriptors.js';
import type { IDocumentCapabilityContext } from '../src/capabilities/document/contract.js';
import type { DocumentCapabilityExecutor } from '../src/capabilities/document/ports.js';
import type { IDocumentService } from '../src/capabilities/document/service.js';
import type { DocumentViewSessionResolution } from '../src/capabilities/document/service.js';
import { RESERVED_DOCUMENT_CAPABILITIES } from '../src/runtime/capabilities/reserved.js';
import type { IHostCapabilityContext } from '../src/runtime/capability/contracts.js';

/** 读取工作区内生成源/登记表原文（不建立包依赖边）。 */
function readWorkspaceSource(relativeFromTests: string): string {
  return readFileSync(fileURLToPath(new URL(relativeFromTests, import.meta.url)), 'utf8');
}

const SDK_CAPABILITY_IDS_SOURCE = readWorkspaceSource('../../../packages/sdk/src/generated/capability-ids.ts');
const SDK_CAPABILITY_PERMISSIONS_SOURCE = readWorkspaceSource('../../../packages/sdk/src/generated/capability-permissions.ts');
const SDK_EVENT_IDS_SOURCE = readWorkspaceSource('../../../packages/sdk/src/generated/event-ids.ts');
const BRIDGE_CONTRACTS_SOURCE = readWorkspaceSource('../../../packages/bridge/src/protocol/capability-contracts.ts');

/** 镜像模块交付的四能力 ID 值集合。 */
const MIRRORED_IDS: readonly DocumentCapabilityId[] = Object.values(DOCUMENT_CAPABILITY_IDS);

/** 提取 `KEY: 'value',` 形态常量对象中指定前缀的键值对。 */
function extractConstantEntries(source: string, keyPrefix: string): Map<string, string> {
  const entries = new Map<string, string>();
  const pattern = new RegExp(String.raw`^\s{2}${keyPrefix}[A-Z_]+:\s*'([^']+)',`, 'gm');
  for (const match of source.matchAll(pattern)) {
    const key = match[0].slice(2).split(':')[0]?.trim() ?? '';
    entries.set(key, match[1] ?? '');
  }
  return entries;
}

/** 提取 `CAPABILITY_PERMISSIONS` 形态映射中 `document:` 前缀行的权限数组。 */
function extractPermissionMap(source: string): Map<string, readonly string[]> {
  const entries = new Map<string, readonly string[]>();
  for (const match of source.matchAll(/^\s*'(document:[^']+)':\s*\[([^\]]*)\],$/gm)) {
    const id = match[1] ?? '';
    const items = [...(match[2] ?? '').matchAll(/'([^']+)'/g)].map((item) => item[1] ?? '');
    entries.set(id, items);
  }
  return entries;
}

/** 一条 `contract(...)` 调用的解析结果。 */
interface IBridgeContractEntry {
  readonly id: string;
  readonly permissions: readonly string[];
  readonly targets: readonly { permission: string; targetFields: readonly string[] }[];
}

/** 从 `capability-contracts.ts` 原文提取指定能力前缀的 contract 登记项（括号配平，兼容跨行书写）。 */
function extractBridgeContracts(source: string, idPrefix: string): Map<string, IBridgeContractEntry> {
  const entries = new Map<string, IBridgeContractEntry>();
  const marker = 'contract(';
  let index = source.indexOf(marker);
  while (index !== -1) {
    let depth = 0;
    let end = -1;
    for (let i = index + marker.length - 1; i < source.length; i += 1) {
      if (source[i] === '(') {
        depth += 1;
      } else if (source[i] === ')') {
        depth -= 1;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end === -1) {
      break;
    }
    const call = source.slice(index, end + 1);
    const idMatch = /contract\(\s*'([^']+)'/.exec(call);
    const id = idMatch?.[1];
    if (id !== undefined && id.startsWith(idPrefix)) {
      const permissionsMatch = /\[\s*([^\]]*)\]/.exec(call.slice('contract('.length));
      const permissions = [...(permissionsMatch?.[1] ?? '').matchAll(/'([^']+)'/g)].map((item) => item[1] ?? '');
      const targets = [
        ...call.matchAll(/target\('([^']+)'((?:\s*,\s*'[^']*')*)\)/g),
      ].map((match) => ({
        permission: match[1] ?? '',
        targetFields: [...(match[2] ?? '').matchAll(/'([^']+)'/g)].map((field) => field[1] ?? ''),
      }));
      entries.set(id, { id, permissions, targets });
    }
    index = source.indexOf(marker, end + 1);
  }
  return entries;
}

describe('壳侧镜像 ↔ @chips/sdk 生成常量', () => {
  it('能力 ID 逐项一致，且 SDK 全集与本模块交付面的差集恰为 create / export', () => {
    const sdkDocumentIds = new Set(extractConstantEntries(SDK_CAPABILITY_IDS_SOURCE, 'DOCUMENT_').values());
    for (const id of MIRRORED_IDS) {
      expect(sdkDocumentIds.has(id), `SDK 生成源缺少 ${id}`).toBe(true);
    }
    const sdkOnly = [...sdkDocumentIds].filter((id) => !MIRRORED_IDS.includes(id as DocumentCapabilityId)).sort();
    expect(sdkOnly).toEqual(['document:create', 'document:export']);
    expect(MIRRORED_IDS).toHaveLength(4);
  });

  it('R19 权限映射逐能力一致（open/read → resources:read，write/save → resources:write）', () => {
    const sdkPermissions = extractPermissionMap(SDK_CAPABILITY_PERMISSIONS_SOURCE);
    for (const id of MIRRORED_IDS) {
      expect(sdkPermissions.get(id), `SDK 权限映射缺少 ${id}`).toEqual([...(DOCUMENT_CAPABILITY_PERMISSIONS[id] ?? [])]);
    }
  });

  it('事件 ID 与 SDK event-ids 的 document 全集逐项一致', () => {
    const sdkEventIds = new Set(extractConstantEntries(SDK_EVENT_IDS_SOURCE, 'DOCUMENT_').values());
    const mirroredEventIds = new Set(Object.values(DOCUMENT_EVENT_IDS));
    expect([...mirroredEventIds].sort()).toEqual([...sdkEventIds].sort());
  });
});

describe('壳侧镜像 ↔ @chips/bridge 内置能力登记表', () => {
  const bridgeEntries = extractBridgeContracts(BRIDGE_CONTRACTS_SOURCE, 'document:');

  it('登记表含本模块四能力，权限并集逐项一致', () => {
    for (const id of MIRRORED_IDS) {
      const entry = bridgeEntries.get(id);
      expect(entry, `Bridge 登记表缺少 ${id}`).toBeDefined();
      expect(entry?.permissions).toEqual([...(DOCUMENT_CAPABILITY_PERMISSIONS[id] ?? [])]);
    }
  });

  it('限定值目标逐项一致（仅 document:open 的 resources:read 指向 source）', () => {
    for (const id of MIRRORED_IDS) {
      const entry = bridgeEntries.get(id);
      const mirrored = DOCUMENT_CAPABILITY_TARGETS[id].map((rule) => ({
        permission: rule.permission,
        targetFields: [...rule.targetFields],
      }));
      expect(entry?.targets, `${id} 目标缺失`).toEqual(mirrored);
    }
    expect(DOCUMENT_CAPABILITY_TARGETS['document:open']).toEqual([
      { permission: 'resources:read', targetFields: ['source'] },
    ]);
  });

  it('平台内置提供方标识同值（PLATFORM_CAPABILITY_OWNER）', () => {
    const match = /export const PLATFORM_CAPABILITY_OWNER = '([^']+)'/.exec(BRIDGE_CONTRACTS_SOURCE);
    expect(match?.[1]).toBe(DOCUMENT_PLATFORM_CAPABILITY_OWNER);
  });
});

describe('输入 Schema（04 §7.3 结构不变量）', () => {
  it('四能力 Schema 一律 additionalProperties: false，required 字段均在 properties 内', () => {
    for (const id of MIRRORED_IDS) {
      const schema = DOCUMENT_INPUT_SCHEMAS[id];
      expect(schema.additionalProperties, `${id} 必须关闭未声明字段`).toBe(false);
      expect(typeof schema.properties, `${id} 必须声明 properties`).toBe('object');
      const properties = schema.properties as Record<string, unknown>;
      for (const field of (schema.required ?? []) as string[]) {
        expect(Object.keys(properties)).toContain(field);
      }
    }
  });

  it('document:open / document:read / document:write / document:save 的必填集与契约一致', () => {
    expect(DOCUMENT_INPUT_SCHEMAS['document:open'].required).toEqual(['source']);
    expect(DOCUMENT_INPUT_SCHEMAS['document:read'].required).toEqual(['documentId', 'part']);
    expect(DOCUMENT_INPUT_SCHEMAS['document:write'].required).toEqual(['documentId', 'part', 'value']);
    expect(DOCUMENT_INPUT_SCHEMAS['document:save'].required).toEqual(['documentId']);
  });
});

describe('注册单元 ↔ 镜像常量与预留槽位（descriptors.ts）', () => {
  /** 一条执行调用记录。 */
  interface ICall {
    readonly name: string;
    readonly input: unknown;
    readonly ctx: IDocumentCapabilityContext;
  }

  /** 记录调用的执行器替身。 */
  function recorder<TOutput>(name: string, calls: ICall[]): DocumentCapabilityExecutor<unknown, TOutput> {
    return (input, ctx) => {
      calls.push({ name, input, ctx });
      return Promise.resolve({ handled: name } as unknown as TOutput);
    };
  }

  /** 构造记录型服务与描述符。 */
  function createDescriptors(): {
    descriptors: ReturnType<typeof createDocumentCapabilityDescriptors>;
    calls: ICall[];
  } {
    const calls: ICall[] = [];
    const service: IDocumentService = {
      executeOpen: recorder('open', calls),
      executeRead: recorder('read', calls),
      executeWrite: recorder('write', calls),
      executeSave: recorder('save', calls),
      resolveViewSession: (): DocumentViewSessionResolution => ({ status: 'not-found' }),
      releaseSessions: (): Promise<void> => Promise.resolve(),
      activeRecordCount: (): number => 0,
    };
    return { descriptors: createDocumentCapabilityDescriptors(service), calls };
  }

  it('四条注册单元按 open → read → write → save 顺序，契约要素逐项取自镜像', () => {
    const { descriptors } = createDescriptors();
    expect(descriptors.map((descriptor) => descriptor.id)).toEqual([
      'document:open',
      'document:read',
      'document:write',
      'document:save',
    ]);
    for (const descriptor of descriptors) {
      const id = descriptor.id as DocumentCapabilityId;
      expect(descriptor.permissions).toEqual(DOCUMENT_CAPABILITY_PERMISSIONS[id]);
      expect(descriptor.schema).toEqual(DOCUMENT_INPUT_SCHEMAS[id]);
      expect(descriptor.targets).toEqual(DOCUMENT_CAPABILITY_TARGETS[id]);
      expect(descriptor.concurrency).toBe('parallel');
      expect(descriptor.owner, '提供方不自报，owner 由组合根单点决定').toBeUndefined();
    }
  });

  it('处理器将壳侧上下文四字段如实传递给执行器并透传结果', async () => {
    const { descriptors, calls } = createDescriptors();
    const open = descriptors[0];
    const controller = new AbortController();
    let emitted = 0;
    const hostCtx: IHostCapabilityContext = {
      signal: controller.signal,
      deadline: 1234567,
      sessionId: 'session-x',
      callerId: 'test.plugin',
      emit: () => {
        emitted += 1;
      },
    };
    const result = await open?.handler({ source: 'chips-resource://default/card/Ab3dEf6Gh8.card' }, hostCtx);
    expect(result).toEqual({ handled: 'open' });
    expect(calls).toHaveLength(1);
    const ctx = calls[0]?.ctx;
    expect(ctx).toEqual({
      signal: controller.signal,
      deadline: 1234567,
      sessionId: 'session-x',
      callerId: 'test.plugin',
    });
    expect(emitted, '事件走注入的发布端口，不走 ctx.emit 按会话通道').toBe(0);
  });

  it('与 runtime/capabilities/reserved.ts 预留槽位逐项一致（ID、权限、数量）', () => {
    const { descriptors } = createDescriptors();
    expect(RESERVED_DOCUMENT_CAPABILITIES.map((entry) => entry.id)).toEqual(
      descriptors.map((descriptor) => descriptor.id)
    );
    for (const reserved of RESERVED_DOCUMENT_CAPABILITIES) {
      const id = reserved.id as DocumentCapabilityId;
      expect(reserved.permissions).toEqual([...DOCUMENT_CAPABILITY_PERMISSIONS[id]]);
    }
  });
});

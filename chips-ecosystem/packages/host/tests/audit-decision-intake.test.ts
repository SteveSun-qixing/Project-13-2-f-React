/**
 * native 判定素材宿主单消费点锁测（工单046 段四接线波，任务 #206）。
 *
 * 权威：
 * - 《08-权限系统设计》§8.2（十六字段条目形状，逐名对账表见本文件 A/B 组）；
 * - RFC-权限审计跨层采集sink裁定 v1.0.1 §5.3（素材×条目对齐表：crate 产出腿直传、
 *   宿主侧 `id`/`timestamp`/`actor`/`pluginVersion`/`traceId` 补挂、`source` 运行时
 *   缺省不造值）、§八条 3（camelCase 键表）、§六条 2（dropped 告警载荷）、
 *   §九 9.2-2（单条目单落点：直连 `auditWriter.enqueue` 唯一入口）；
 * - 三方文本锁母型（刀2 A 组）：`decision-intake.ts` 镜像接口 ↔
 *   `packages/native/types/chips-native.d.ts` ↔ `abi/export-surface.json` 签名，
 *   纯文本比对零 import 编译依赖。
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { isUlid, type IPermissionAuditEntry } from '@chips/bridge';

import {
  bindNativeDecisionSink,
  createPermissionDecisionIntake,
  validateAuditEntry,
  type INativeAuditDecisionFrame,
  type INativePermissionDecision,
  type IPermissionAuditWriter,
  type PermissionDecisionIntakeOptions,
} from '../src/audit/index.js';
import { createCollectingDiagnostics, type CapturedDiagnostic } from './helpers/audit-fixture.js';

/** 读取邻包源文件原文（不建立依赖边，比照 §11.3 三方表文本锁母型）。 */
function readWorkspaceSource(relativeFromTests: string): string {
  return readFileSync(fileURLToPath(new URL(relativeFromTests, import.meta.url)), 'utf8');
}

/** 提取 `export interface X { … }` 块内的成员名序列（`name` 或 `name(` 起头行）。 */
function interfaceMemberNames(source: string, name: string): string[] {
  const start = source.indexOf(`export interface ${name} {`);
  if (start < 0) {
    throw new Error(`接口块缺位：${name}`);
  }
  const block = source.slice(start, source.indexOf('\n}', start));
  return [...block.matchAll(/^ {2}(?:readonly )?([A-Za-z]+)[(:]/gm)].map((m) => m[1] as string);
}

/** §8.2 十六字段逐名清单（声明序 = d.ts/镜像接口序基线）。 */
const AUDIT_ENTRY_FIELDS = [
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
] as const;

/** 素材夹具（bridge 域 allow：单侧键齐、可缺省腿恒 null）。 */
function capabilityAllowFrame(overrides: Partial<INativePermissionDecision> = {}): INativeAuditDecisionFrame {
  return {
    decision: {
      domain: 'capability',
      action: 'allow',
      pluginId: 'chips.official.editor',
      sessionId: 7,
      permission: 'filesystem:read',
      required: ['filesystem:read', 'filesystem:write'],
      missing: [],
      reason: null,
      capabilityId: 'file:read',
      resourceUri: null,
      target: null,
      requestId: 'req-9',
      traceId: 't-crate-1',
      qualifier: null,
      ...overrides,
    },
    dropped: 0,
  };
}

/** 素材夹具（resource 域 deny：宿主补挂腿全空、crate 腿全带）。 */
function resourceDenyFrame(overrides: Partial<INativePermissionDecision> = {}): INativeAuditDecisionFrame {
  return {
    decision: {
      domain: 'resource',
      action: 'deny',
      pluginId: 'chips.official.viewer',
      sessionId: 12,
      permission: 'filesystem:write',
      required: ['filesystem:write'],
      missing: ['filesystem:write'],
      reason: 'out_of_scope',
      capabilityId: null,
      resourceUri: 'chips-resource://workspace/a.md',
      target: 'chips-resource://workspace/',
      requestId: null,
      traceId: null,
      qualifier: 'path:/workspace/a.md',
      ...overrides,
    },
    dropped: 0,
  };
}

/** 条目收集假写入器（`IPermissionAuditWriter` 消费面：仅 `enqueue` 被本波触达）。 */
function makeRecordingWriter(): { writer: IPermissionAuditWriter; entries: IPermissionAuditEntry[] } {
  const entries: IPermissionAuditEntry[] = [];
  return {
    entries,
    writer: {
      enqueue: (entry) => {
        entries.push(entry);
      },
      flush: () => Promise.resolve(),
      close: () => Promise.resolve(),
      report: () => ({ directory: '', written: 0, dropped: 0, queued: 0, closed: false }),
    },
  };
}

const FIXED_NOW_MS = Date.UTC(2026, 8, 20, 10, 20, 31, 482);
const FIXED_ID = '01ARZ3NDEKTSV4RRFFQ69G5FAV';

/** 生产缺省注入面基线（写入器/诊断/版本端口齐备；traceId 端口按臂覆盖）。 */
function makeIntake(overrides: Partial<PermissionDecisionIntakeOptions> = {}): {
  intake: ReturnType<typeof createPermissionDecisionIntake>;
  entries: IPermissionAuditEntry[];
  records: CapturedDiagnostic[];
} {
  const { writer, entries } = makeRecordingWriter();
  const { sink, records } = createCollectingDiagnostics();
  const intake = createPermissionDecisionIntake({
    auditWriter: writer,
    diagnostics: sink,
    resolvePluginVersion: (pluginId) => (pluginId === 'chips.official.editor' ? '2.3.1' : '1.0.0'),
    newId: () => FIXED_ID,
    now: () => FIXED_NOW_MS,
    ...overrides,
  });
  return { intake, entries, records };
}

/* ------------------------------------------------------------------ *
 * A 组：三方文本锁（镜像接口 ↔ d.ts ↔ export-surface.json 签名）
 * ------------------------------------------------------------------ */

describe('三方文本锁：decision-intake 镜像 ↔ chips-native.d.ts ↔ 导出表签名', () => {
  const intakeSource = readWorkspaceSource('../src/audit/decision-intake.ts');
  const declaration = readWorkspaceSource('../../native/types/chips-native.d.ts');
  const manifest = JSON.parse(readWorkspaceSource('../../native/abi/export-surface.json')) as {
    exports: { name: string; kind: string; signature: string }[];
  };

  it('素材镜像接口成员名序列与 d.ts INativePermissionDecision 逐名逐序一致', () => {
    expect(interfaceMemberNames(intakeSource, 'INativePermissionDecision')).toEqual(
      interfaceMemberNames(declaration, 'INativePermissionDecision'),
    );
  });

  it('帧镜像接口成员名序列与 d.ts INativeAuditDecisionFrame 逐名逐序一致', () => {
    expect(interfaceMemberNames(intakeSource, 'INativeAuditDecisionFrame')).toEqual(
      interfaceMemberNames(declaration, 'INativeAuditDecisionFrame'),
    );
  });

  it('导出表第 53 项 auditBindDecisionSink：sync + 签名逐字，d.ts 声明同形在册', () => {
    const entry = manifest.exports.find((item) => item.name === 'auditBindDecisionSink');
    expect(entry).toBeDefined();
    // 位次锁：波 A1 三资源名补登（50→53）后 audit 域仍居末位（第 53 项）。
    expect(manifest.exports[52]?.name).toBe('auditBindDecisionSink');
    expect(entry?.kind).toBe('sync');
    expect(entry?.signature).toBe('(sink: (frame: INativeAuditDecisionFrame) => void) => void');
    // 空白全剥净形锁：d.ts 声明逐 token 与在册签名同形（版式由包内 prettier 定形，锁判不含空白）。
    const normalized = declaration.replace(/\s+/g, '');
    expect(normalized).toContain('functionauditBindDecisionSink(sink:(frame:INativeAuditDecisionFrame)=>void):void;');
    expect(manifest.exports.length).toBe(53);
  });
});

/* ------------------------------------------------------------------ *
 * B 组：§8.2 十六字段组装逐名对账（RFC §5.3 对齐表）
 * ------------------------------------------------------------------ */

describe('§8.2 十六字段组装逐名对账（唯一组装点）', () => {
  it('capability allow 帧：crate 腿直传 + 宿主腿注入，键集恰为素材可得腿（source/缺省腿不造值）', () => {
    const { intake, entries } = makeIntake();
    intake.consume(capabilityAllowFrame());
    expect(entries).toHaveLength(1);
    const entry = entries[0] as IPermissionAuditEntry;
    expect(entry).toEqual({
      id: FIXED_ID,
      timestamp: '2026-09-20T10:20:31.482Z',
      action: 'allow',
      actor: 'system',
      pluginId: 'chips.official.editor',
      pluginVersion: '2.3.1',
      sessionId: '7',
      permission: 'filesystem:read',
      capabilityId: 'file:read',
      requestId: 'req-9',
      traceId: 't-crate-1',
    });
    // §5.3：`source` 运行时缺省不造值；allow 臂 `reason`/`qualifier`/`target`/`resourceUri` 恒缺省。
    for (const field of ['source', 'reason', 'qualifier', 'target', 'resourceUri'] as const) {
      expect(entry).not.toHaveProperty(field);
    }
  });

  it('resource deny 帧：traceId 走补挂端口、deny 腿全入条目（十四可落字段逐名）', () => {
    const { intake, entries } = makeIntake({ resolveTraceId: () => 'native-audit:resource-domain' });
    intake.consume(resourceDenyFrame());
    expect(entries).toHaveLength(1);
    const entry = entries[0] as IPermissionAuditEntry;
    expect(entry).toEqual({
      id: FIXED_ID,
      timestamp: '2026-09-20T10:20:31.482Z',
      action: 'deny',
      actor: 'system',
      pluginId: 'chips.official.viewer',
      pluginVersion: '1.0.0',
      sessionId: '12',
      permission: 'filesystem:write',
      qualifier: 'path:/workspace/a.md',
      target: 'chips-resource://workspace/',
      resourceUri: 'chips-resource://workspace/a.md',
      reason: 'out_of_scope',
      traceId: 'native-audit:resource-domain',
    });
    // capabilityId/requestId 素材恒 null → 键不出现；source 恒缺省。
    expect(entry).not.toHaveProperty('capabilityId');
    expect(entry).not.toHaveProperty('requestId');
    expect(entry).not.toHaveProperty('source');
  });

  it('生产缺省面：id 走段一 ULID 供给、timestamp 为 ISO 8601 UTC（注入面缺省臂）', () => {
    const { writer, entries } = makeRecordingWriter();
    const { sink } = createCollectingDiagnostics();
    const intake = createPermissionDecisionIntake({
      auditWriter: writer,
      diagnostics: sink,
      resolvePluginVersion: () => '0.1.0',
      resolveTraceId: () => 'sentinel',
    });
    intake.consume(resourceDenyFrame());
    intake.consume(capabilityAllowFrame());
    expect(entries).toHaveLength(2);
    for (const entry of entries) {
      expect(isUlid(entry.id)).toBe(true);
      expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      // 连续帧 id 单调（段一 ULID 母型口径）。
    }
    const first = entries[0];
    const second = entries[1];
    if (first === undefined || second === undefined) {
      throw new Error('连续帧缺失，单调性无从判定');
    }
    expect(first.id < second.id).toBe(true);
  });

  it('组装产物逐字段过 validateAuditEntry 形状闸（与写入器同一必填口径）', () => {
    const { intake, entries } = makeIntake({ resolveTraceId: () => 'sentinel' });
    intake.consume(capabilityAllowFrame());
    intake.consume(resourceDenyFrame());
    for (const entry of entries) {
      expect(validateAuditEntry(entry)).toBeNull();
    }
  });

  it('十六字段名集在册自证：素材 14 名 = §8.2 词表 11 名 + 附加三材、宿主腿 id/timestamp 不入素材面', () => {
    const declaration = readWorkspaceSource('../../native/types/chips-native.d.ts');
    const materialNames = interfaceMemberNames(declaration, 'INativePermissionDecision');
    expect(materialNames).toHaveLength(14);
    // 附加素材（RFC §5.3 尾注 + §八条 3 域判别）恰 {domain, required, missing} 三材，
    // 不落 §8.2 条目（组装面零造字段）；余 11 名逐一落 §8.2 词表。
    const extraMaterials = ['domain', 'required', 'missing'];
    for (const name of materialNames) {
      expect([...AUDIT_ENTRY_FIELDS, ...extraMaterials]).toContain(name);
    }
    expect(materialNames.filter((name) => !extraMaterials.includes(name))).toHaveLength(11);
    expect(materialNames).not.toContain('id');
    expect(materialNames).not.toContain('timestamp');
    expect(materialNames).not.toContain('pluginVersion');
    // §5.3 宿主腿之外素材必含 traceId（crate 产出腿可空、键恒在）。
    expect(materialNames).toContain('traceId');
  });
});

/* ------------------------------------------------------------------ *
 * C 组：拒组装与丢弃可见性（G2 永不抛出、§六条 2 dropped 告警）
 * ------------------------------------------------------------------ */

describe('拒组装臂与丢弃可见性', () => {
  it('traceId 双腿均无源：拒组装留痕、不投递、report 计数如实', () => {
    const { intake, entries, records } = makeIntake();
    intake.consume(resourceDenyFrame());
    expect(entries).toHaveLength(0);
    expect(intake.report()).toEqual({ received: 1, assembled: 0, rejected: 1, nativeDropped: 0 });
    expect(records.some((r) => r.message.includes('traceId 双腿均无源') && r.message.includes('禁另造关联键'))).toBe(
      true,
    );
  });

  it('素材自带 traceId 优先于补挂端口（双腿序，§5.3 双侧行）', () => {
    const { intake, entries } = makeIntake({ resolveTraceId: () => 'must-not-win' });
    intake.consume(capabilityAllowFrame());
    expect(entries[0]?.traceId).toBe('t-crate-1');
  });

  it('pluginVersion 无权威源：拒组装不伪造版本串', () => {
    const { intake, entries } = makeIntake({ resolvePluginVersion: () => null });
    intake.consume(capabilityAllowFrame());
    expect(entries).toHaveLength(0);
    expect(intake.report().rejected).toBe(1);
  });

  it('帧结构越键表六臂：一律拒组装留痕、consume 永不抛出（G2）', () => {
    const cases: INativeAuditDecisionFrame[] = [
      capabilityAllowFrame({ domain: 'kernel' as INativePermissionDecision['domain'] }),
      capabilityAllowFrame({ action: 'grant' as INativePermissionDecision['action'] }),
      capabilityAllowFrame({ reason: 'because' as NonNullable<INativePermissionDecision['reason']> }),
      capabilityAllowFrame({ sessionId: 1.5 }),
      capabilityAllowFrame({ required: 'filesystem:read' as unknown as string[] }),
      capabilityAllowFrame({ resourceUri: 7 as unknown as string | null }),
    ];
    const { intake, entries } = makeIntake();
    for (const frame of cases) {
      expect(() => intake.consume(frame)).not.toThrow();
    }
    expect(entries).toHaveLength(0);
    expect(intake.report()).toEqual({ received: 6, assembled: 0, rejected: 6, nativeDropped: 0 });
  });

  it('非对象帧与 dropped 非数值：同样拒组装留痕', () => {
    const { intake, entries } = makeIntake();
    expect(() => intake.consume(null as unknown as INativeAuditDecisionFrame)).not.toThrow();
    expect(() => intake.consume({ decision: capabilityAllowFrame().decision, dropped: Number.NaN })).not.toThrow();
    expect(entries).toHaveLength(0);
    expect(intake.report().rejected).toBe(2);
  });

  it('native dropped 增量：首个正增量告警一次、平值静默、再增再告（背压可见性）', () => {
    const { intake, records } = makeIntake();
    intake.consume({ ...capabilityAllowFrame(), dropped: 3 });
    intake.consume({ ...capabilityAllowFrame(), dropped: 3 });
    intake.consume({ ...capabilityAllowFrame(), dropped: 5 });
    const backpressure = records.filter((r) => r.message.includes('素材丢弃'));
    expect(backpressure).toHaveLength(2);
    expect(backpressure[0]?.details).toEqual({ delta: 3, total: 3 });
    expect(backpressure[1]?.details).toEqual({ delta: 2, total: 5 });
    expect(intake.report().nativeDropped).toBe(5);
  });
});

/* ------------------------------------------------------------------ *
 * D 组：bindNativeDecisionSink 装载/绑定闸三态
 * ------------------------------------------------------------------ */

describe('bindNativeDecisionSink 三态（诚实呈现、永不抛出）', () => {
  it('bound：导出在位 → 消费函数原样传入且恰调用一次', () => {
    const calls: unknown[] = [];
    const binding = bindNativeDecisionSink(
      { auditBindDecisionSink: (sink: unknown) => calls.push(sink) },
      () => undefined,
    );
    expect(binding).toEqual({ status: 'bound' });
    expect(calls).toHaveLength(1);
  });

  it('export-missing：导出缺位/非函数 → 点名 detail，零调用', () => {
    const missing = bindNativeDecisionSink({}, () => undefined);
    expect(missing.status).toBe('export-missing');
    const shadowed = bindNativeDecisionSink({ auditBindDecisionSink: 'nope' }, () => undefined);
    expect(shadowed.status).toBe('export-missing');
    if (missing.status === 'export-missing') {
      expect(missing.detail).toContain('auditBindDecisionSink');
    }
  });

  it('bind-failed：绑定抛错（重复绑定 NATIVE_INTERNAL 形态）→ detail 携带原错误信息', () => {
    const binding = bindNativeDecisionSink(
      {
        auditBindDecisionSink: () => {
          throw new Error('NATIVE_INTERNAL: 审计观察面已绑定宿主消费函数，终身不可换');
        },
      },
      () => undefined,
    );
    expect(binding.status).toBe('bind-failed');
    if (binding.status === 'bind-failed') {
      expect(binding.detail).toContain('终身不可换');
    }
  });
});

/* ------------------------------------------------------------------ *
 * E 组：组合根接线臂文本锁（生产唯一绑定点在册）
 * ------------------------------------------------------------------ */

describe('production-assembly 接线臂文本锁（工单046 段四接线位）', () => {
  const assemblySource = readWorkspaceSource('../src/main/production-assembly.ts');

  it('接线判据在册：available ∧ auditWriter 非 null → 绑定，三态留痕 fail-closed', () => {
    expect(assemblySource).toContain("nativeBridge.status === 'available' && runtime.auditWriter !== null");
    expect(assemblySource).toContain('createPermissionDecisionIntake({');
    expect(assemblySource).toContain('bindNativeDecisionSink(moduleValue, intake.consume)');
    expect(assemblySource).toContain("bridgeDiagnostics.warn('native-audit'");
    // resource 域 traceId 腿 = 固定来源哨兵（自裁依据见常量头注与交回报告）。
    expect(assemblySource).toContain('resolveTraceId: () => AUDIT_RESOURCE_DOMAIN_TRACE_SOURCE');
    expect(assemblySource).toContain(
      "export const AUDIT_RESOURCE_DOMAIN_TRACE_SOURCE = 'native-audit:resource-domain'",
    );
    // pluginVersion 腿 = 插件持久化注册表在册供给（无值即 null → 拒组装）。
    expect(assemblySource).toContain('pluginRegistry.get(pluginId)?.version ?? null');
  });

  it('绑定单点：组合根文件内 bindNativeDecisionSink 生产调用恰一处（禁第二绑定点）', () => {
    expect([...assemblySource.matchAll(/bindNativeDecisionSink\(/g)].length).toBe(1);
  });
});

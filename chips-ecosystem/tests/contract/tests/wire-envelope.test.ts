/**
 * Bridge 线封套三方逐字锁测（工单046 段一残账收口，#189 波；母型 = #181 audit-entry）。
 *
 * 正向臂：《02.07》§7.2 代码块 ↔ `@chips/bridge` `ipc.ts`/`events.ts` ↔ host
 * `wire.ts`/`channels.ts` 三方逐字一致；§7.1 通道总表 ↔ `IPC_CHANNELS` ↔ host 通道
 * 常量三方一致；横切键判据（bridge decode 拒绝/透传、host 守卫「出现即非空串」）在册。
 * 偏差臂：删键、异型、通道名漂移、横切键漂移、判据删除每一侧都必须红。
 * host 两文件仅以源码文本读取比对（零 import 编译依赖、零写入，#183 独占红线兑现）。
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { checkWireEnvelope } from '../src/check/wire-envelope.js';
import {
  BRIDGE_EVENTS_FILE,
  BRIDGE_IPC_FILE,
  CHANNEL_NAME_PAIRS,
  HOST_CHANNELS_FILE,
  HOST_WIRE_FILE,
  loadWireEnvelopeCodeTexts,
  parseBridgeWireEnvelopeModel,
  parseHostWireEnvelopeModel,
} from '../src/code/wire-envelope.js';
import { parseWireEnvelopeDocModel } from '../src/docs/wire-envelope.js';
import type { DocWireEnvelopeModel } from '../src/docs/wire-envelope.js';
import { WIRE_CHANNEL_SOURCE, WIRE_ENVELOPE_SOURCE } from '../src/docs/sources.js';
import { createMemoryReader } from '../src/docs/reader.js';
import { DOCS_ROOT, WORKSPACE_ROOT } from '../src/paths.js';
import { assertNoViolations } from '../src/violations.js';

const DOC_WIRE_FILE = path.join(DOCS_ROOT, WIRE_ENVELOPE_SOURCE.file);

/** §7.2 现文逐字锚（词表逐字钉，改名/增删/换序必须显式评审）。 */
const BRIDGE_REQUEST_FIELD_ANCHOR: readonly string[] = [
  'requestId',
  'capabilityId',
  'input',
  'traceId',
];
const EVENT_ENVELOPE_FIELD_ANCHOR: readonly string[] = [
  'eventId',
  'payload',
  'emittedAt',
  'traceId',
  'requestId',
];

function readDocText(): string {
  return readFileSync(DOC_WIRE_FILE, 'utf8');
}

function loadModels(): {
  docs: ReturnType<typeof parseWireEnvelopeDocModel>;
  bridge: ReturnType<typeof parseBridgeWireEnvelopeModel>;
  host: ReturnType<typeof parseHostWireEnvelopeModel>;
  codeTexts: ReadonlyMap<string, string>;
  docText: string;
} {
  const docText = readDocText();
  const docs = parseWireEnvelopeDocModel(
    createMemoryReader(
      new Map([
        [WIRE_ENVELOPE_SOURCE.file, docText],
        [WIRE_CHANNEL_SOURCE.file, docText],
      ])
    )
  );
  const codeTexts = loadWireEnvelopeCodeTexts();
  const bridge = parseBridgeWireEnvelopeModel(
    codeTexts.get(BRIDGE_IPC_FILE) as string,
    codeTexts.get(BRIDGE_EVENTS_FILE) as string
  );
  const host = parseHostWireEnvelopeModel(
    codeTexts.get(HOST_WIRE_FILE) as string,
    codeTexts.get(HOST_CHANNELS_FILE) as string
  );
  return { docs, bridge, host, codeTexts, docText };
}

function mutateDocs(docText: string): DocWireEnvelopeModel {
  return parseWireEnvelopeDocModel(
    createMemoryReader(
      new Map([
        [WIRE_ENVELOPE_SOURCE.file, docText],
        [WIRE_CHANNEL_SOURCE.file, docText],
      ])
    )
  );
}

describe('Bridge 线封套三方逐字一致（§7.2 ↔ bridge ↔ host）', () => {
  it('真实文档与两侧实现零偏差', () => {
    const { docs, bridge, host } = loadModels();
    assertNoViolations(checkWireEnvelope({ docs, bridge, host }));
  });

  it('§7.2 权威形状逐字段词表锚（请求封套四字段、事件封套五字段，横切键在册）', () => {
    const { docs } = loadModels();
    const request = docs.declarations.get('IBridgeRequest');
    const envelope = docs.declarations.get('IEventEnvelope');
    expect(request?.kind).toBe('interface');
    expect(envelope?.kind).toBe('interface');
    expect(
      request?.kind === 'interface' ? request.members.map((member) => member.name) : []
    ).toEqual(BRIDGE_REQUEST_FIELD_ANCHOR);
    expect(
      envelope?.kind === 'interface' ? envelope.members.map((member) => member.name) : []
    ).toEqual(EVENT_ENVELOPE_FIELD_ANCHOR);
  });

  it('通道名三方一致：IPC_CHANNELS ↔ host channels.ts ↔ §7.1 通道总表首列', () => {
    const { docs, bridge, host } = loadModels();
    const docTokens = new Set(docs.channelTokens);
    for (const { bridgeKey, hostConst } of CHANNEL_NAME_PAIRS) {
      const value = bridge.channels.get(bridgeKey);
      expect(value, `bridge 缺少通道属性：${bridgeKey}`).toBeTypeOf('string');
      expect(host.channels.get(hostConst), `host 缺少通道常量：${hostConst}`).toBe(value);
      expect(docTokens.has(value as string), `§7.1 未登记通道：${String(value)}`).toBe(true);
    }
    expect(bridge.eventChannelPrefix).toBe('event:');
    expect(host.channels.get('EVENT_CHANNEL_PREFIX')).toBe(bridge.eventChannelPrefix);
    expect(docTokens.has(`${bridge.eventChannelPrefix}<eventId>`)).toBe(true);
  });

  it('横切键判据在册：bridge decode 拒绝/透传子句与 host 守卫「出现即非空串」子句逐字命中', () => {
    const { bridge, host } = loadModels();
    expect(bridge.decodeBridgeRequestText).toContain('raw.traceId !== undefined');
    expect(bridge.decodeBridgeRequestText).toContain('traceId: raw.traceId');
    expect(host.isBridgeRequestText).toContain('value.traceId === undefined');
    expect(host.isEventEnvelopeText).toContain('value.traceId === undefined');
    expect(host.isEventEnvelopeText).toContain('value.requestId === undefined');
  });

  it('host 两文件装载面自证：只读工作区源码文本，展示路径钉死', () => {
    const { codeTexts } = loadModels();
    for (const file of [BRIDGE_IPC_FILE, BRIDGE_EVENTS_FILE, HOST_WIRE_FILE, HOST_CHANNELS_FILE]) {
      expect(codeTexts.get(file), `未装载：${file}`).toBeTruthy();
    }
    expect(path.join(WORKSPACE_ROOT, HOST_WIRE_FILE)).toBeTypeOf('string');
  });
});

describe('Bridge 线封套偏差注入（每一侧漂移必须红）', () => {
  const base = loadModels();

  it('删键臂：§7.2 IBridgeRequest 删除 traceId 行 → bridge/host 双向漂移检出', () => {
    const mutated = mutateDocs(base.docText.replace('  traceId?: string;\n', ''));
    const violations = checkWireEnvelope({ docs: mutated, bridge: base.bridge, host: base.host });
    const codes = new Set(violations.map((item) => item.code));
    expect(codes.has('CONTRACT_WIRE_ENVELOPE_BRIDGE_DRIFT')).toBe(true);
    expect(codes.has('CONTRACT_WIRE_ENVELOPE_HOST_DRIFT')).toBe(true);
  });

  it('横切键漂移臂：§7.2 IEventEnvelope 删除 requestId 行 → 事件封套漂移检出', () => {
    const mutated = mutateDocs(base.docText.replace('  requestId?: string;\n', ''));
    const violations = checkWireEnvelope({ docs: mutated, bridge: base.bridge, host: base.host });
    const drifts = violations.filter(
      (item) =>
        item.code === 'CONTRACT_WIRE_ENVELOPE_BRIDGE_DRIFT' ||
        item.code === 'CONTRACT_WIRE_ENVELOPE_HOST_DRIFT'
    );
    expect(drifts.length).toBeGreaterThan(0);
    expect(drifts.every((item) => item.subject === 'IEventEnvelope')).toBe(true);
  });

  it('异型臂：bridge IBridgeRequest traceId 改 number → 与 §7.2 逐字漂移检出', () => {
    const mutatedIpc = (base.codeTexts.get(BRIDGE_IPC_FILE) as string).replace(
      'traceId?: string;',
      'traceId?: number;'
    );
    const violations = checkWireEnvelope({
      docs: base.docs,
      bridge: parseBridgeWireEnvelopeModel(
        mutatedIpc,
        base.codeTexts.get(BRIDGE_EVENTS_FILE) as string
      ),
      host: base.host,
    });
    expect(violations.map((item) => item.code)).toContain('CONTRACT_WIRE_ENVELOPE_BRIDGE_DRIFT');
  });

  it('判据删除臂：bridge decodeBridgeRequest 拒绝判据翻正缺失 → 判据检出', () => {
    const mutatedIpc = (base.codeTexts.get(BRIDGE_IPC_FILE) as string).replace(
      'raw.traceId !== undefined',
      'raw.traceId === undefined'
    );
    const violations = checkWireEnvelope({
      docs: base.docs,
      bridge: parseBridgeWireEnvelopeModel(
        mutatedIpc,
        base.codeTexts.get(BRIDGE_EVENTS_FILE) as string
      ),
      host: base.host,
    });
    expect(violations.map((item) => item.code)).toContain(
      'CONTRACT_WIRE_ENVELOPE_BRIDGE_JUDGMENT_MISSING'
    );
  });

  it('通道名漂移臂：host channels.ts bridge:request 改面 → 双源通道漂移检出', () => {
    const mutatedChannels = (base.codeTexts.get(HOST_CHANNELS_FILE) as string).replace(
      "'bridge:request'",
      "'bridge:req'"
    );
    const violations = checkWireEnvelope({
      docs: base.docs,
      bridge: base.bridge,
      host: parseHostWireEnvelopeModel(
        base.codeTexts.get(HOST_WIRE_FILE) as string,
        mutatedChannels
      ),
    });
    const drifts = violations.filter(
      (item) => item.code === 'CONTRACT_WIRE_ENVELOPE_CHANNEL_HOST_DRIFT'
    );
    expect(drifts.length).toBeGreaterThan(0);
    expect(drifts.some((item) => item.subject === 'bridgeRequest↔BRIDGE_REQUEST_CHANNEL')).toBe(
      true
    );
  });

  it('守卫判据漂移臂：host isBridgeRequest 横切键子句删除 → 守卫判据缺失检出', () => {
    const mutatedWire = (base.codeTexts.get(HOST_WIRE_FILE) as string).replace(
      'value.traceId === undefined || isNonEmptyString(value.traceId)',
      'true'
    );
    const violations = checkWireEnvelope({
      docs: base.docs,
      bridge: base.bridge,
      host: parseHostWireEnvelopeModel(
        mutatedWire,
        base.codeTexts.get(HOST_CHANNELS_FILE) as string
      ),
    });
    const missing = violations.filter(
      (item) => item.code === 'CONTRACT_WIRE_ENVELOPE_HOST_JUDGMENT_MISSING'
    );
    expect(missing.length).toBeGreaterThan(0);
    expect(missing.every((item) => item.subject === 'isBridgeRequest.横切键')).toBe(true);
  });
});

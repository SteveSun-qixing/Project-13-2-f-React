/**
 * 发现文件消费：严格形状 + 陈旧双判据（《17-CLI承载链路契约》§2.4、§2.5；工单039 波 2）。
 *
 * 覆盖必测臂：
 * - 严格形状：缺失/JSON 非法/未知顶层字段/字段缺失/类型不符一律视同无效；
 * - 陈旧双判据：`pid_dead` 与 `pid_recycled` 同时实现，创建时间不可得保守判不陈旧；
 * - 消费侧无删除权：读出陈旧后登记文件仍在（§2.5-4）。
 */

import { describe, expect, it } from 'vitest';

import { CARRIER_PROTOCOL, type ICarrierDiscoveryRecord } from '@chips/bridge';

import {
  createSystemPidProbe,
  judgeStaleness,
  parseDiscoveryRecord,
  readCarrierDiscovery,
  type IPidProbe,
} from '../src/client/carrier/discovery.js';
import { MemoryFileSystem } from './support/memory-file-system.js';

const DISCOVERY_FILE = '/userdata/chips-carrier.json';

function record(overrides: Partial<ICarrierDiscoveryRecord> = {}): ICarrierDiscoveryRecord {
  return {
    protocol: CARRIER_PROTOCOL,
    instanceId: 'inst-42',
    socketPath: '/userdata/chips-carrier.sock',
    pid: 4242,
    startedAt: 1_000_000,
    bearerToken: 'a'.repeat(64),
    ...overrides,
  };
}

function probe(over: Partial<IPidProbe> = {}): IPidProbe {
  return {
    pidAlive: () => true,
    processCreatedAt: () => null,
    ...over,
  };
}

function fsWith(text: string | null): MemoryFileSystem {
  const fileSystem = new MemoryFileSystem();
  fileSystem.writeDirectory('/userdata');
  if (text !== null) {
    fileSystem.writeText(DISCOVERY_FILE, text);
  }
  return fileSystem;
}

describe('parseDiscoveryRecord：严格形状（§2.4）', () => {
  it('合法记录逐字段还原', () => {
    const parsed = parseDiscoveryRecord(JSON.stringify(record()));
    expect(parsed).toEqual(record());
  });

  it('文件缺失（null）→ null', () => {
    expect(parseDiscoveryRecord(null)).toBeNull();
  });

  it('JSON 非法 → null', () => {
    expect(parseDiscoveryRecord('{ not json')).toBeNull();
  });

  it('非对象/数组 → null', () => {
    expect(parseDiscoveryRecord('[1,2,3]')).toBeNull();
    expect(parseDiscoveryRecord('"str"')).toBeNull();
    expect(parseDiscoveryRecord('null')).toBeNull();
  });

  it('未知顶层字段 → 视同无效（null）', () => {
    const withExtra = { ...record(), unexpected: 'x' };
    expect(parseDiscoveryRecord(JSON.stringify(withExtra))).toBeNull();
  });

  it('字段缺失 → null', () => {
    const partial = { ...record() } as Record<string, unknown>;
    delete partial.bearerToken;
    expect(parseDiscoveryRecord(JSON.stringify(partial))).toBeNull();
  });

  it('类型不符（pid 非整数）→ null', () => {
    expect(parseDiscoveryRecord(JSON.stringify(record({ pid: 1.5 })))).toBeNull();
    expect(parseDiscoveryRecord(JSON.stringify({ ...record(), startedAt: 'x' }))).toBeNull();
  });
});

describe('judgeStaleness：陈旧双判据（§2.5-3）', () => {
  it('判据一：PID 不存在 → pid_dead', () => {
    expect(judgeStaleness(record(), probe({ pidAlive: () => false }))).toEqual({
      stale: true,
      reason: 'pid_dead',
    });
  });

  it('判据二：PID 假活、进程创建时间晚于 startedAt → pid_recycled', () => {
    expect(
      judgeStaleness(record(), probe({ processCreatedAt: () => record().startedAt + 1 }))
    ).toEqual({ stale: true, reason: 'pid_recycled' });
  });

  it('PID 存活、创建时间早于 startedAt → 不陈旧', () => {
    expect(judgeStaleness(record(), probe({ processCreatedAt: () => 500 }))).toEqual({
      stale: false,
    });
  });

  it('创建时间不可得 → 保守判不陈旧', () => {
    expect(judgeStaleness(record(), probe({ processCreatedAt: () => null }))).toEqual({
      stale: false,
    });
  });

  it('pid_dead 优先于创建时间（存活判据先落）', () => {
    expect(
      judgeStaleness(
        record(),
        probe({ pidAlive: () => false, processCreatedAt: () => record().startedAt + 9 })
      )
    ).toEqual({ stale: true, reason: 'pid_dead' });
  });
});

describe('readCarrierDiscovery：一站式定性（§2.4/§2.5/§5.3）', () => {
  it('缺失文件 → unavailable(missing)', () => {
    expect(readCarrierDiscovery(fsWith(null), DISCOVERY_FILE, probe())).toEqual({
      status: 'unavailable',
      reason: 'missing',
    });
  });

  it('存在但形状非法 → unavailable(invalid_shape)', () => {
    expect(readCarrierDiscovery(fsWith('垃圾'), DISCOVERY_FILE, probe())).toEqual({
      status: 'unavailable',
      reason: 'invalid_shape',
    });
  });

  it('protocol 不匹配 → protocol_mismatch（携记录）', () => {
    const result = readCarrierDiscovery(
      fsWith(JSON.stringify(record({ protocol: 'chips-cli-carrier/999' }))),
      DISCOVERY_FILE,
      probe()
    );
    expect(result.status).toBe('protocol_mismatch');
  });

  it('合法但 pid_dead → stale(pid_dead)', () => {
    const result = readCarrierDiscovery(
      fsWith(JSON.stringify(record())),
      DISCOVERY_FILE,
      probe({ pidAlive: () => false })
    );
    expect(result).toMatchObject({ status: 'stale', reason: 'pid_dead' });
  });

  it('合法但 pid_recycled → stale(pid_recycled)', () => {
    const result = readCarrierDiscovery(
      fsWith(JSON.stringify(record())),
      DISCOVERY_FILE,
      probe({ processCreatedAt: () => record().startedAt + 5 })
    );
    expect(result).toMatchObject({ status: 'stale', reason: 'pid_recycled' });
  });

  it('新鲜合法 → ready（携记录）', () => {
    const result = readCarrierDiscovery(fsWith(JSON.stringify(record())), DISCOVERY_FILE, probe());
    expect(result).toEqual({ status: 'ready', record: record() });
  });

  it('消费侧无删除权：读出陈旧后登记文件仍在（§2.5-4）', () => {
    const fileSystem = fsWith(JSON.stringify(record()));
    readCarrierDiscovery(fileSystem, DISCOVERY_FILE, probe({ pidAlive: () => false }));
    expect(fileSystem.exists(DISCOVERY_FILE)).toBe(true);
    expect(fileSystem.kind(DISCOVERY_FILE)).toBe('file');
  });
});

describe('createSystemPidProbe：探针形状（§2.5-3）', () => {
  it('非正整数 pid：pidAlive false、createdAt null', () => {
    const probeInstance = createSystemPidProbe(() => Date.now());
    expect(probeInstance.pidAlive(0)).toBe(false);
    expect(probeInstance.pidAlive(-1)).toBe(false);
    expect(probeInstance.pidAlive(1.5)).toBe(false);
    expect(probeInstance.processCreatedAt(0)).toBeNull();
  });

  it('存活自身 pid → pidAlive true（探针只读，不抛）', () => {
    const probeInstance = createSystemPidProbe(() => Date.now());
    expect(probeInstance.pidAlive(process.pid)).toBe(true);
  });
});

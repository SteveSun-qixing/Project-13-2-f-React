/**
 * 权限审计写入器生命周期接线锁测（工单046 段二；carrierService 母型比照）。
 *
 * @remarks 锁定面：
 * - 装配形状：`audit` 选项注入即常开（不受 `CHIPS_TRACE` 门控），`auditWriter` 单点可
 *   观察，`report().audit` 快照随宿主报告呈现（终态可观察一致性）；
 * - **本波边界**：host 路由判定点零审计钩（裁定三硬绑段三 025③，禁双挂点）——运行能力
 *   调用（含 allow/deny）后 `written` 恒 0，消费只经 `auditWriter.enqueue` 唯一入口；
 * - shutdown 收尾关闭：停机清理链之后 writer 最后关（宿主注记裁量），入队条目在
 *   `close()` 同一 flush 收尾中全量落盘；关闭后条目拒收 + 计数 + 告警；
 * - 未装配 `audit` 选项：`auditWriter` 缺位、报告不含 `audit` 键（不伪造观察面）。
 */

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import type { IPermissionAuditEntry } from '@chips/bridge';

import { createHostRuntime } from '../src/runtime/host-runtime.js';
import type { IHostCapabilityDescriptor } from '../src/runtime/capability/contracts.js';
import type { IPalHost, SystemInfo } from '../src/platform/contracts/index.js';
import type { IPlatformHostChannel } from '../src/runtime/contracts.js';
import { auditFileName } from '../src/audit/types.js';
import {
  auditDirectory,
  cleanupTempUserData,
  createCollectingDiagnostics,
  makeAuditEntry,
  makeTempUserData,
  shiftUtcDay,
} from './helpers/audit-fixture.js';

const SYSTEM_SNAPSHOT: SystemInfo = {
  platform: 'darwin',
  osVersion: '15.0',
  arch: 'arm64',
  appVersion: '0.1.0',
  locale: 'zh-CN',
  paths: {
    userHome: '/Users/tester',
    userDocuments: '/Users/tester/Documents',
    userDownloads: '/Users/tester/Downloads',
    userDesktop: '/Users/tester/Desktop',
    userPictures: '/Users/tester/Pictures',
    userMusic: '/Users/tester/Music',
    userVideos: '/Users/tester/Videos',
    userData: '/Users/tester/Library/Application Support/Chips',
    temp: '/tmp',
  },
};

function palHost(): IPalHost {
  return {
    info: {
      shell: 'desktop',
      platform: 'macos',
      osVersion: '15.0',
      arch: 'arm64',
      appVersion: '0.1.0',
      locale: 'zh-CN',
      paths: {},
    },
    matrix: {
      window: false,
      dialog: false,
      notification: false,
      clipboard: false,
      menu: false,
      tray: false,
      shortcut: false,
      power: false,
      systemInfo: true,
      transfer: false,
      shellOpen: false,
      http: false,
      config: false,
    },
    ports: {
      storage: {},
      system: { getInfo: (): Promise<SystemInfo> => Promise.resolve(SYSTEM_SNAPSHOT) },
    } as IPalHost['ports'],
  };
}

function channel(): IPlatformHostChannel {
  return { pushSessionPermissions: () => undefined };
}

/** 真实当日 ISO（运行期时钟——生命周期臂不注入时刻，锁的就是「装配即活」）。 */
function todayDay(): string {
  return new Date().toISOString().slice(0, 10);
}

/** 当日锚定条目（留存清理按真实时钟判档，落盘断言不受跨日竞态影响：目录全量行计数）。 */
function recentEntry(overrides: Partial<IPermissionAuditEntry> = {}): IPermissionAuditEntry {
  return makeAuditEntry({ timestamp: `${todayDay()}T08:00:00.000Z`, ...overrides });
}

/** 目录内全部审计 JSONL 行集（跨日/序号竞态免疫的行计数）。 */
async function readAllAuditLines(userDataPath: string): Promise<unknown[]> {
  const dir = auditDirectory(userDataPath);
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return [];
  }
  const lines: unknown[] = [];
  for (const name of names.filter((candidate) => candidate.startsWith('audit-'))) {
    const text = await readFile(join(dir, name), 'utf8');
    for (const line of text.split('\n')) {
      if (line.length > 0) {
        lines.push(JSON.parse(line) as unknown);
      }
    }
  }
  return lines;
}

afterEach(async () => {
  await cleanupTempUserData();
});

describe('生命周期：装配形状与判定点零钩（本波边界锁定）', () => {
  it('注入 audit 选项：auditWriter 常开、report().audit 快照在册；未注入即缺位且不伪造', async () => {
    const userDataPath = await makeTempUserData('chips-audit-lc-wire-');
    const runtime = createHostRuntime({ capabilities: [], audit: { userDataPath } });
    expect(runtime.auditWriter).not.toBeNull();
    expect(runtime.report().audit).toEqual({
      directory: join(userDataPath, 'logs', 'audit'),
      written: 0,
      dropped: 0,
      queued: 0,
      closed: false,
    });
    await runtime.start(palHost(), channel());
    await runtime.shutdown();

    const bare = createHostRuntime({ capabilities: [] });
    expect(bare.auditWriter).toBeNull();
    expect(Object.prototype.hasOwnProperty.call(bare.report(), 'audit')).toBe(false);
    await bare.start(palHost(), channel());
    await bare.shutdown();
    expect(bare.report().state).toBe('stopped');
  });

  it('CHIPS_TRACE 恒空仍落盘（常开不受诊断门控，工单041 隔离口径的运行时层臂）', async () => {
    const previous = process.env['CHIPS_TRACE'];
    process.env['CHIPS_TRACE'] = '';
    try {
      const userDataPath = await makeTempUserData('chips-audit-lc-gate-');
      const runtime = createHostRuntime({ capabilities: [], audit: { userDataPath } });
      await runtime.start(palHost(), channel());
      runtime.auditWriter?.enqueue(recentEntry());
      await runtime.auditWriter?.flush();
      expect(await readAllAuditLines(userDataPath)).toHaveLength(1);
      await runtime.shutdown();
    } finally {
      if (previous === undefined) {
        delete process.env['CHIPS_TRACE'];
      } else {
        process.env['CHIPS_TRACE'] = previous;
      }
    }
  });

  it('路由判定点零审计钩：allow/deny 能力调用后 written 恒 0（挂钩发射位归段三，禁双挂点）', async () => {
    const userDataPath = await makeTempUserData('chips-audit-lc-hook-');
    const allowed: IHostCapabilityDescriptor = {
      id: 'demo:ok',
      permissions: [],
      handler: () => Promise.resolve('ok'),
    };
    const guarded: IHostCapabilityDescriptor = {
      id: 'doc:write',
      permissions: ['resources:write'],
      handler: () => Promise.resolve('should-not-run'),
    };
    const runtime = createHostRuntime({
      capabilities: [allowed, guarded],
      audit: { userDataPath },
      sessionProvisioner: { provision: () => ({ pluginId: 'demo', grantedPermissions: [] }) },
    });
    await runtime.start(palHost(), channel());
    const ok = await runtime.ipc.handleRequest(
      { windowId: 1, frameId: null },
      { requestId: 'r-allow', capabilityId: 'demo:ok' },
    );
    expect(ok.ok).toBe(true);
    const denied = await runtime.ipc.handleRequest(
      { windowId: 1, frameId: null },
      { requestId: 'r-deny', capabilityId: 'doc:write' },
    );
    expect(denied.ok).toBe(false);
    // 判定面挂钩属段三（025③ 硬绑，禁双挂点）：本波任何判定点不得产生审计落帧。
    expect(runtime.auditWriter?.report().written).toBe(0);
    expect(await readAllAuditLines(userDataPath)).toEqual([]);
    await runtime.shutdown();
  });
});

describe('生命周期：shutdown 终态可观察一致性（writer 最后关）', () => {
  it('停机前入队条目经 shutdown 同一收尾全量落盘；关闭态拒收后续条目并计数告警', async () => {
    const userDataPath = await makeTempUserData('chips-audit-lc-close-');
    const { sink, records } = createCollectingDiagnostics();
    const runtime = createHostRuntime({ capabilities: [], audit: { userDataPath }, diagnostics: sink });
    await runtime.start(palHost(), channel());
    const writer = runtime.auditWriter;
    if (writer === null) {
      throw new Error('unreachable：audit 已装配');
    }
    writer.enqueue(recentEntry());
    writer.enqueue(recentEntry({ action: 'grant' }));
    writer.enqueue(recentEntry({ permission: 'clipboard:access' }));
    // 不显式 flush：shutdown 的 writer 收尾必须兜住停机前入队面。
    await runtime.shutdown();
    expect(writer.report()).toEqual({
      directory: join(userDataPath, 'logs', 'audit'),
      written: 3,
      dropped: 0,
      queued: 0,
      closed: true,
    });
    expect(await readAllAuditLines(userDataPath)).toHaveLength(3);
    // 终态可观察：停机后宿主报告仍呈报 writer 快照。
    expect(runtime.report().audit?.closed).toBe(true);
    expect(runtime.report().audit?.written).toBe(3);

    writer.enqueue(recentEntry());
    expect(writer.report().dropped).toBe(1);
    const alarm = records.find((record) => record.message === '审计写入器已关闭，条目拒收');
    expect(alarm?.details).toEqual({ droppedCount: 1, reason: 'writer-closed' });
    // 双关幂等：重复 shutdown 与直接 close 均不抛出、不重复记账。
    await runtime.shutdown();
    await writer.close();
    expect(writer.report().written).toBe(3);
  });

  it('装配即挂启动期留存清理（真实时钟）：超 365 天旧档删、百日内档案留', async () => {
    const userDataPath = await makeTempUserData('chips-audit-lc-sweep-');
    const dir = auditDirectory(userDataPath);
    await mkdir(dir, { recursive: true });
    const expired = auditFileName(shiftUtcDay(todayDay(), -400), 0);
    const fresh = auditFileName(shiftUtcDay(todayDay(), -100), 0);
    await writeFile(join(dir, expired), 'stale-audit\n');
    await writeFile(join(dir, fresh), '{"permission":"config:read"}\n');
    const runtime = createHostRuntime({ capabilities: [], audit: { userDataPath } });
    await runtime.start(palHost(), channel());
    await runtime.auditWriter?.flush(); // 启动期清理步在同序链首位。
    expect(await readdir(dir)).toEqual([fresh]);
    await runtime.shutdown();
  });
});

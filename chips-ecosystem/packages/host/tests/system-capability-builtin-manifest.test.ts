/**
 * 组合根内置能力清单装配锁单测（G6 系统服务族第一批：dialog/clipboard/notification/shell）。
 *
 * 权威：`04-能力契约规范` §6.2 R19 全表、§7.5～§7.8；`17-跨端Shell与平台抽象设计`
 * §5.1（矩阵只供内置能力注册层消费：分面为 `false` 的能力域整体不注册）。
 *
 * @remarks 覆盖 `createBuiltinCapabilities` 的域拼接顺序、分面闸全链形为、
 * 以及全部内置 ID ∈ SDK 生成全集（R19 对齐；防静默自造 ID）。
 */

import { describe, expect, it } from 'vitest';

import type { IPalHost } from '../src/platform/contracts/index.js';
import { createBuiltinCapabilities } from '../src/runtime/capabilities/system-info.js';
import {
  createDialogFakePort,
  createClipboardFakePort,
  createNotificationFakePort,
  createShellOpenFakePort,
} from './helpers/system-service-fakes.js';
import { createFakePalHost, createFakePorts } from './helpers/fake-pal-host.js';
import { extractConstantEntries, readContractSource } from './helpers/contract-source.js';

const SDK_CAPABILITY_IDS_SOURCE = readContractSource('../../../packages/sdk/src/generated/capability-ids.ts');

/** 四分面全就绪的 PAL 宿主替身。 */
function fullFacetHost(): IPalHost {
  const base = createFakePalHost();
  return createFakePalHost({
    matrix: { ...base.matrix, dialog: true, clipboard: true, notification: true, shellOpen: true },
    ports: createFakePorts({
      dialog: createDialogFakePort(),
      clipboard: createClipboardFakePort(),
      notification: createNotificationFakePort(),
      shellOpen: createShellOpenFakePort(),
    }),
  });
}

describe('组合根内置能力清单（G6 系统服务族第一批）', () => {
  it('四分面就绪：system:info + dialog ×2 + clipboard ×2 + notification ×1 + shell ×1 + event（无分面恒在册）按域序拼接', () => {
    const manifest = createBuiltinCapabilities(fullFacetHost());
    expect(manifest.map((descriptor) => descriptor.id)).toEqual([
      'system:info',
      'dialog:open',
      'dialog:save',
      'clipboard:read',
      'clipboard:write',
      'notification:send',
      'shell:openExternal',
      'event:publish',
    ]);
  });

  it('分面缺位：仅 system:info 与 event 域在册（17 §5.1/§5.2：分面 false 整体不注册；event 无 PAL 端口恒在册）', () => {
    expect(createBuiltinCapabilities(createFakePalHost()).map((descriptor) => descriptor.id)).toEqual([
      'system:info',
      'event:publish',
    ]);
  });

  it('单分面逐域闸：任一分面缺失时其域整体缺位、其余域不受牵连', () => {
    const base = createFakePalHost();
    const onlyClipboard = createFakePalHost({
      matrix: { ...base.matrix, clipboard: true },
      ports: createFakePorts({ clipboard: createClipboardFakePort() }),
    });
    expect(createBuiltinCapabilities(onlyClipboard).map((descriptor) => descriptor.id)).toEqual([
      'system:info',
      'clipboard:read',
      'clipboard:write',
      'event:publish',
    ]);
  });

  it('全部内置 ID 都是 R19 登记项（SDK 生成全集成员；禁自造 ID）', () => {
    const sdkIds = new Set(extractConstantEntries(SDK_CAPABILITY_IDS_SOURCE, '').values());
    for (const descriptor of createBuiltinCapabilities(fullFacetHost())) {
      expect(sdkIds.has(descriptor.id), `${descriptor.id} 应在 SDK 生成全集内`).toBe(true);
    }
  });
});

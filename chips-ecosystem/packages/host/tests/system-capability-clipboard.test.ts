/**
 * `clipboard:*` 能力域契约锁单测（`04-能力契约规范` §6.2 R19、§7.6、§11.4；
 * `17-跨端Shell与平台抽象设计` §5.2；`02-Bridge三层设计` §4.1/§5.2）。
 *
 * 覆盖：壳侧镜像与 `@chips/sdk` 生成常量、`@chips/bridge` 登记表逐项一致性；
 * 分面闸；输入 schema 拒绝面；处理器行为（读取 `null` 归一、写入透传、错误面逐字、
 * 剪贴板内容不落日志）；路由级权限拒绝路径（`clipboard:access`）。
 */

import { describe, expect, it } from 'vitest';

import { PalPortError, PAL_ERROR_CODES } from '../src/platform/errors.js';
import { createClipboardCapabilities } from '../src/runtime/capabilities/clipboard.js';
import type { IHostCapabilityContext } from '../src/runtime/capability/contracts.js';
import type { IPalHost } from '../src/platform/contracts/index.js';
import { createFakePalHost, createFakePorts } from './helpers/fake-pal-host.js';
import { createClipboardFakePort } from './helpers/system-service-fakes.js';
import { routeSystemServiceRequest } from './helpers/system-service-route.js';
import {
  extractBridgeContracts,
  extractConstantEntries,
  extractGeneratedPermissionMap,
  readContractSource,
} from './helpers/contract-source.js';

const SDK_CAPABILITY_IDS_SOURCE = readContractSource('../../../packages/sdk/src/generated/capability-ids.ts');
const SDK_CAPABILITY_PERMISSIONS_SOURCE = readContractSource(
  '../../../packages/sdk/src/generated/capability-permissions.ts',
);
const BRIDGE_CONTRACTS_SOURCE = readContractSource('../../../packages/bridge/src/protocol/capability-contracts.ts');

/** 能力执行上下文替身。 */
function capabilityContext(): IHostCapabilityContext {
  return {
    signal: new AbortController().signal,
    deadline: Date.now() + 30_000,
    sessionId: 'session-test',
    callerId: 'test.plugin',
    emit: () => undefined,
  };
}

/** 构造剪贴板分面就绪的 PAL 宿主替身。 */
function clipboardHost(port: ReturnType<typeof createClipboardFakePort>): IPalHost {
  return createFakePalHost({
    matrix: { ...createFakePalHost().matrix, clipboard: true },
    ports: createFakePorts({ clipboard: port }),
  });
}

describe('clipboard:* 契约镜像锁（04 §7.6 / §6.2 R19）', () => {
  it('能力 ID 与 @chips/sdk 生成常量逐项一致', () => {
    const sdkIds = new Set(extractConstantEntries(SDK_CAPABILITY_IDS_SOURCE, 'CLIPBOARD_').values());
    expect([...sdkIds].sort()).toEqual(['clipboard:read', 'clipboard:write']);
  });

  it('权限映射与 SDK 生成表、Bridge 登记表逐项一致（clipboard:access）', () => {
    const sdkPermissions = extractGeneratedPermissionMap(SDK_CAPABILITY_PERMISSIONS_SOURCE, 'clipboard:');
    expect(sdkPermissions.get('clipboard:read')).toEqual(['clipboard:access']);
    expect(sdkPermissions.get('clipboard:write')).toEqual(['clipboard:access']);
    const bridgeEntries = extractBridgeContracts(BRIDGE_CONTRACTS_SOURCE, 'clipboard:');
    expect(bridgeEntries.get('clipboard:read')?.permissions).toEqual(['clipboard:access']);
    expect(bridgeEntries.get('clipboard:write')?.permissions).toEqual(['clipboard:access']);
    expect(bridgeEntries.get('clipboard:read')?.targets).toEqual([]);
    expect(bridgeEntries.get('clipboard:write')?.targets).toEqual([]);
  });
});

describe('clipboard:* 注册形制（分面闸与描述符）', () => {
  it('分面缺位：整体不注册（17 §5.2）', () => {
    expect(createClipboardCapabilities(createFakePalHost())).toEqual([]);
    const portless = createFakePalHost({
      matrix: { ...createFakePalHost().matrix, clipboard: true },
      ports: createFakePorts(),
    });
    expect(createClipboardCapabilities(portless)).toEqual([]);
  });

  it('分面就绪：read → write 两条注册单元，权限与 schema 取自镜像常量', () => {
    const descriptors = createClipboardCapabilities(clipboardHost(createClipboardFakePort()));
    expect(descriptors.map((descriptor) => descriptor.id)).toEqual(['clipboard:read', 'clipboard:write']);
    for (const descriptor of descriptors) {
      expect(descriptor.permissions).toEqual(['clipboard:access']);
      expect(descriptor.targets).toEqual([]);
      expect(descriptor.owner).toBeUndefined();
      expect(descriptor.concurrency).toBe('parallel');
    }
  });
});

describe('clipboard:* 输入 schema（04 §7.6 逐字）', () => {
  it('read schema 无字段、write schema 仅 text；与契约逐字一致', () => {
    const descriptors = createClipboardCapabilities(clipboardHost(createClipboardFakePort()));
    expect(descriptors[0]?.schema).toEqual({
      type: 'object',
      additionalProperties: false,
      properties: {},
    });
    expect(descriptors[1]?.schema).toEqual({
      type: 'object',
      additionalProperties: false,
      required: ['text'],
      properties: {
        text: { type: 'string' },
      },
    });
  });

  it('read 拒绝面：任何输入字段、非对象输入即 BRIDGE_INVALID_INPUT', async () => {
    const [read] = createClipboardCapabilities(clipboardHost(createClipboardFakePort()));
    for (const input of [undefined, null, 'text', { extra: 1 }]) {
      await expect(read!.handler(input, capabilityContext())).rejects.toMatchObject({
        code: 'BRIDGE_INVALID_INPUT',
        retryable: false,
        details: { capabilityId: 'clipboard:read' },
      });
    }
  });

  it('write 拒绝面：缺 text、text 非字符串即 BRIDGE_INVALID_INPUT', async () => {
    const [, write] = createClipboardCapabilities(clipboardHost(createClipboardFakePort()));
    for (const input of [{}, { text: 1 }, { text: null }, { text: undefined, extra: 0 }]) {
      await expect(write!.handler(input, capabilityContext())).rejects.toMatchObject({
        code: 'BRIDGE_INVALID_INPUT',
        retryable: false,
        details: { capabilityId: 'clipboard:write' },
      });
    }
  });

  it('write 接受面：空串与长文本均合法（契约未设长度界）', async () => {
    const port = createClipboardFakePort();
    const [, write] = createClipboardCapabilities(clipboardHost(port));
    await expect(write!.handler({ text: '' }, capabilityContext())).resolves.toBeUndefined();
    await expect(write!.handler({ text: '薯片'.repeat(1000) }, capabilityContext())).resolves.toBeUndefined();
    expect(port.writes).toHaveLength(2);
  });
});

describe('clipboard:* 处理器行为（端口注入）', () => {
  it('read：输出 { text }；无文本时 text 为 null（剪贴板端口不阻塞，无调用上下文参数）', async () => {
    const port = createClipboardFakePort();
    port.readResult = '剪贴板内容';
    const [read] = createClipboardCapabilities(clipboardHost(port));
    await expect(read!.handler({}, capabilityContext())).resolves.toEqual({ text: '剪贴板内容' });
    expect(port.readCount).toBe(1);

    port.readResult = null;
    await expect(read!.handler({}, capabilityContext())).resolves.toEqual({ text: null });
  });

  it('write：文本如实透传端口，无输出', async () => {
    const port = createClipboardFakePort();
    const [, write] = createClipboardCapabilities(clipboardHost(port));
    await expect(write!.handler({ text: '目标文本' }, capabilityContext())).resolves.toBeUndefined();
    expect(port.writes[0]).toEqual({ text: '目标文本' });
  });

  it('错误面逐字：端口域错误原样透传（CLIPBOARD_UNAVAILABLE 可重试）', async () => {
    const port = createClipboardFakePort();
    port.error = new PalPortError(PAL_ERROR_CODES.CLIPBOARD_UNAVAILABLE);
    const descriptors = createClipboardCapabilities(clipboardHost(port));
    await expect(descriptors[0]!.handler({}, capabilityContext())).rejects.toMatchObject({
      code: 'CLIPBOARD_UNAVAILABLE',
      retryable: true,
      name: 'PalPortError',
    });
    await expect(descriptors[1]!.handler({ text: 'x' }, capabilityContext())).rejects.toMatchObject({
      code: 'CLIPBOARD_UNAVAILABLE',
      retryable: true,
    });
  });
});

describe('clipboard:* 权限判定（路由级，R19 clipboard:access）', () => {
  it('未授予 clipboard:access：BRIDGE_PERMISSION_DENIED，details 指认缺失权限', async () => {
    const descriptors = createClipboardCapabilities(clipboardHost(createClipboardFakePort()));
    const response = await routeSystemServiceRequest({
      capabilities: descriptors,
      grantedPermissions: ['dialogs:use'],
      capabilityId: 'clipboard:read',
      input: {},
    });
    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.error.code).toBe('BRIDGE_PERMISSION_DENIED');
      expect(response.error.details).toMatchObject({
        capabilityId: 'clipboard:read',
        permission: 'clipboard:access',
      });
    }
  });

  it('授予 clipboard:access：读写皆达端口', async () => {
    const port = createClipboardFakePort();
    port.readResult = 'x';
    const descriptors = createClipboardCapabilities(clipboardHost(port));
    const read = await routeSystemServiceRequest({
      capabilities: descriptors,
      grantedPermissions: ['clipboard:access'],
      capabilityId: 'clipboard:read',
      input: {},
    });
    expect(read).toEqual({ requestId: 'route-1', ok: true, result: { text: 'x' } });
    const write = await routeSystemServiceRequest({
      capabilities: descriptors,
      grantedPermissions: ['clipboard:access'],
      capabilityId: 'clipboard:write',
      input: { text: 'y' },
    });
    expect(write).toEqual({ requestId: 'route-1', ok: true, result: undefined });
  });
});

/**
 * `notification:send` 能力域契约锁单测（`04-能力契约规范` §6.2 R19、§7.5、§11.4；
 * `17-跨端Shell与平台抽象设计` §5.2；`02-Bridge三层设计` §4.1/§5.2）。
 *
 * 覆盖：壳侧镜像与 `@chips/sdk` 生成常量、`@chips/bridge` 登记表逐项一致性；
 * 分面闸；输入 schema 拒绝面（title/body/silent/iconUri 逐字段）；
 * 处理器行为（图标引用 fail-closed、错误面逐字）；路由级权限拒绝路径（`notifications:send`）。
 */

import { describe, expect, it } from 'vitest';

import { PalPortError, PAL_ERROR_CODES } from '../src/platform/errors.js';
import { createNotificationCapabilities } from '../src/runtime/capabilities/notification.js';
import type { IHostCapabilityContext } from '../src/runtime/capability/contracts.js';
import type { IPalHost } from '../src/platform/contracts/index.js';
import { createFakePalHost, createFakePorts } from './helpers/fake-pal-host.js';
import { createNotificationFakePort } from './helpers/system-service-fakes.js';
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

/** 构造通知分面就绪的 PAL 宿主替身。 */
function notificationHost(port: ReturnType<typeof createNotificationFakePort>): IPalHost {
  return createFakePalHost({
    matrix: { ...createFakePalHost().matrix, notification: true },
    ports: createFakePorts({ notification: port }),
  });
}

describe('notification:send 契约镜像锁（04 §7.5 / §6.2 R19）', () => {
  it('能力 ID 与 @chips/sdk 生成常量逐项一致', () => {
    const sdkIds = new Set(extractConstantEntries(SDK_CAPABILITY_IDS_SOURCE, 'NOTIFICATION_').values());
    expect([...sdkIds]).toEqual(['notification:send']);
  });

  it('权限映射与 SDK 生成表、Bridge 登记表逐项一致（notifications:send）', () => {
    const sdkPermissions = extractGeneratedPermissionMap(SDK_CAPABILITY_PERMISSIONS_SOURCE, 'notification:');
    expect(sdkPermissions.get('notification:send')).toEqual(['notifications:send']);
    const bridgeEntries = extractBridgeContracts(BRIDGE_CONTRACTS_SOURCE, 'notification:');
    expect(bridgeEntries.get('notification:send')?.permissions).toEqual(['notifications:send']);
    expect(bridgeEntries.get('notification:send')?.targets).toEqual([]);
  });
});

describe('notification:send 注册形制（分面闸与描述符）', () => {
  it('分面缺位：整体不注册（17 §5.2）', () => {
    expect(createNotificationCapabilities(createFakePalHost())).toEqual([]);
    const portless = createFakePalHost({
      matrix: { ...createFakePalHost().matrix, notification: true },
      ports: createFakePorts(),
    });
    expect(createNotificationCapabilities(portless)).toEqual([]);
  });

  it('分面就绪：单条注册单元，权限与 schema 取自镜像常量', () => {
    const descriptors = createNotificationCapabilities(notificationHost(createNotificationFakePort()));
    expect(descriptors.map((descriptor) => descriptor.id)).toEqual(['notification:send']);
    const descriptor = descriptors[0]!;
    expect(descriptor.permissions).toEqual(['notifications:send']);
    expect(descriptor.targets).toEqual([]);
    expect(descriptor.owner).toBeUndefined();
    expect(descriptor.concurrency).toBe('parallel');
  });
});

describe('notification:send 输入 schema（04 §7.5 逐字）', () => {
  it('schema 与契约逐字一致', () => {
    const descriptors = createNotificationCapabilities(notificationHost(createNotificationFakePort()));
    expect(descriptors[0]?.schema).toEqual({
      type: 'object',
      additionalProperties: false,
      required: ['title'],
      properties: {
        title: { type: 'string', minLength: 1, maxLength: 128 },
        body: { type: 'string', maxLength: 1024 },
        iconUri: { type: 'string', format: 'chips-resource-uri' },
        silent: { type: 'boolean', default: false },
      },
    });
  });

  it('schema 拒绝面：缺 title、字段类型与长度越界、未声明字段逐项 BRIDGE_INVALID_INPUT', async () => {
    const [send] = createNotificationCapabilities(notificationHost(createNotificationFakePort()));
    const cases: readonly unknown[] = [
      undefined,
      null,
      '导出完成',
      {},
      { title: '' },
      { title: 7 },
      { title: 'x'.repeat(129) },
      { title: 't', body: 9 },
      { title: 't', body: 'x'.repeat(1025) },
      { title: 't', silent: 'yes' },
      { title: 't', iconUri: 3 },
      { title: 't', iconUri: 'https://example.com/icon.png' },
      { title: 't', iconUri: 'file:///etc/passwd' },
      { title: 't', iconUri: 'chips-resource:///' },
      { title: 't', extra: true },
    ];
    for (const input of cases) {
      await expect(
        send!.handler(input, capabilityContext()),
        `输入 ${JSON.stringify(input)} 应被拒绝`,
      ).rejects.toMatchObject({
        code: 'BRIDGE_INVALID_INPUT',
        retryable: false,
        details: { capabilityId: 'notification:send' },
      });
    }
  });

  it('schema 接受面：title、body、silent 与合法受管图标引用通过', async () => {
    const port = createNotificationFakePort();
    const [send] = createNotificationCapabilities(notificationHost(port));
    await expect(
      send!.handler(
        {
          title: '导出完成',
          body: '卡片已导出到目标目录',
          iconUri: 'chips-resource://plugin-abc/assets/icon.png',
          silent: false,
        },
        capabilityContext(),
      ),
    ).rejects.toMatchObject({ code: 'NOTIFICATION_FAILED' });
    await expect(send!.handler({ title: 't', silent: true }, capabilityContext())).resolves.toBeUndefined();
    expect(port.sends, '图标 fail-closed 臂不触达端口，仅合法无图标调用达端口').toHaveLength(1);
  });
});

describe('notification:send 处理器行为（端口注入）', () => {
  it('title/body/silent 如实透传端口；iconUri 缺省时不传 iconPath', async () => {
    const port = createNotificationFakePort();
    const [send] = createNotificationCapabilities(notificationHost(port));
    const first = capabilityContext();
    await send!.handler({ title: '标题', body: '正文', silent: true }, first);
    expect(port.sends[0]?.options).toEqual({
      signal: first.signal,
      deadline: first.deadline,
      title: '标题',
      body: '正文',
      silent: true,
    });
    const second = capabilityContext();
    await send!.handler({ title: '仅标题' }, second);
    expect(port.sends[1]?.options).toEqual({ signal: second.signal, deadline: second.deadline, title: '仅标题' });
  });

  it('图标引用 fail-closed：iconUri 合法但解析通道缺位 → NOTIFICATION_FAILED（可重试，不伪造无图标成功）', async () => {
    const port = createNotificationFakePort();
    const [send] = createNotificationCapabilities(notificationHost(port));
    await expect(
      send!.handler({ title: 't', iconUri: 'chips-resource://plugin-abc/assets/icon.png' }, capabilityContext()),
    ).rejects.toMatchObject({ code: 'NOTIFICATION_FAILED', retryable: true });
    expect(port.sends, '未物化的图标不得静默降级为无图标发送').toHaveLength(0);
  });

  it('错误面逐字：端口域错误原样透传（NOTIFICATION_UNAVAILABLE / NOTIFICATION_FAILED 均可重试）', async () => {
    const port = createNotificationFakePort();
    const [send] = createNotificationCapabilities(notificationHost(port));
    port.error = new PalPortError(PAL_ERROR_CODES.NOTIFICATION_UNAVAILABLE);
    await expect(send!.handler({ title: 't' }, capabilityContext())).rejects.toMatchObject({
      code: 'NOTIFICATION_UNAVAILABLE',
      retryable: true,
      name: 'PalPortError',
    });
    port.error = new PalPortError(PAL_ERROR_CODES.NOTIFICATION_FAILED);
    await expect(send!.handler({ title: 't' }, capabilityContext())).rejects.toMatchObject({
      code: 'NOTIFICATION_FAILED',
      retryable: true,
    });
  });
});

describe('notification:send 权限判定（路由级，R19 notifications:send）', () => {
  it('未授予 notifications:send：BRIDGE_PERMISSION_DENIED，details 指认缺失权限', async () => {
    const descriptors = createNotificationCapabilities(notificationHost(createNotificationFakePort()));
    const response = await routeSystemServiceRequest({
      capabilities: descriptors,
      grantedPermissions: [],
      capabilityId: 'notification:send',
      input: { title: 't' },
    });
    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.error.code).toBe('BRIDGE_PERMISSION_DENIED');
      expect(response.error.details).toMatchObject({
        capabilityId: 'notification:send',
        permission: 'notifications:send',
      });
    }
  });

  it('授予 notifications:send：判定放行并达端口', async () => {
    const port = createNotificationFakePort();
    const descriptors = createNotificationCapabilities(notificationHost(port));
    const response = await routeSystemServiceRequest({
      capabilities: descriptors,
      grantedPermissions: ['notifications:send'],
      capabilityId: 'notification:send',
      input: { title: '导出完成' },
    });
    expect(response).toEqual({ requestId: 'route-1', ok: true, result: undefined });
    expect(port.sends).toHaveLength(1);
  });
});

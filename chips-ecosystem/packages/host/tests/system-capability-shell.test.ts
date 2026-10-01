/**
 * `shell:openExternal` 能力域契约锁单测（`04-能力契约规范` §6.2 R19、§7.8、§11.4；
 * `17-跨端Shell与平台抽象设计` §5.2/§5.2 能力过滤；`02-Bridge三层设计` §4.1/§5.2）。
 *
 * 覆盖：壳侧镜像与 `@chips/sdk` 生成常量、`@chips/bridge` 登记表逐项一致性（含 `url`
 * 限定值目标）；分面闸；输入 schema 拒绝面（协议白名单 `^(https?://|mailto:)`）；
 * 处理器行为（错误面逐字、目标字段透传）；路由级权限拒绝路径（`shell:external`）。
 */

import { describe, expect, it } from 'vitest';

import { PalPortError, PAL_ERROR_CODES } from '../src/platform/errors.js';
import { createShellCapabilities } from '../src/runtime/capabilities/shell.js';
import type { IHostCapabilityContext } from '../src/runtime/capability/contracts.js';
import type { IPalHost } from '../src/platform/contracts/index.js';
import { createFakePalHost, createFakePorts } from './helpers/fake-pal-host.js';
import { createShellOpenFakePort } from './helpers/system-service-fakes.js';
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

/** 构造外部打开分面就绪的 PAL 宿主替身。 */
function shellHost(port: ReturnType<typeof createShellOpenFakePort>): IPalHost {
  return createFakePalHost({
    matrix: { ...createFakePalHost().matrix, shellOpen: true },
    ports: createFakePorts({ shellOpen: port }),
  });
}

describe('shell:openExternal 契约镜像锁（04 §7.8 / §6.2 R19）', () => {
  it('能力 ID 与 @chips/sdk 生成常量逐项一致', () => {
    const sdkIds = new Set(extractConstantEntries(SDK_CAPABILITY_IDS_SOURCE, 'SHELL_').values());
    expect([...sdkIds]).toEqual(['shell:openExternal']);
  });

  it('权限映射与 SDK 生成表、Bridge 登记表逐项一致（shell:external）', () => {
    const sdkPermissions = extractGeneratedPermissionMap(SDK_CAPABILITY_PERMISSIONS_SOURCE, 'shell:');
    expect(sdkPermissions.get('shell:openExternal')).toEqual(['shell:external']);
    const bridgeEntries = extractBridgeContracts(BRIDGE_CONTRACTS_SOURCE, 'shell:');
    expect(bridgeEntries.get('shell:openExternal')?.permissions).toEqual(['shell:external']);
  });

  it('限定值目标：url 字段与 Bridge 登记表一致', () => {
    const bridgeEntries = extractBridgeContracts(BRIDGE_CONTRACTS_SOURCE, 'shell:');
    expect(bridgeEntries.get('shell:openExternal')?.targets).toEqual([
      { permission: 'shell:external', targetFields: ['url'] },
    ]);
  });
});

describe('shell:openExternal 注册形制（分面闸与描述符）', () => {
  it('分面缺位：整体不注册（17 §5.2；仅具备分面的壳注册外部打开能力）', () => {
    expect(createShellCapabilities(createFakePalHost())).toEqual([]);
    const portless = createFakePalHost({
      matrix: { ...createFakePalHost().matrix, shellOpen: true },
      ports: createFakePorts(),
    });
    expect(createShellCapabilities(portless)).toEqual([]);
  });

  it('分面就绪：单条注册单元，权限、目标与 schema 取自镜像常量', () => {
    const descriptors = createShellCapabilities(shellHost(createShellOpenFakePort()));
    expect(descriptors.map((descriptor) => descriptor.id)).toEqual(['shell:openExternal']);
    const descriptor = descriptors[0]!;
    expect(descriptor.permissions).toEqual(['shell:external']);
    expect(descriptor.targets).toEqual([{ permission: 'shell:external', targetFields: ['url'] }]);
    expect(descriptor.owner).toBeUndefined();
    expect(descriptor.concurrency).toBe('parallel');
  });
});

describe('shell:openExternal 输入 schema（04 §7.8 逐字）', () => {
  it('schema 与契约逐字一致', () => {
    const descriptors = createShellCapabilities(shellHost(createShellOpenFakePort()));
    expect(descriptors[0]?.schema).toEqual({
      type: 'object',
      additionalProperties: false,
      required: ['url'],
      properties: {
        url: { type: 'string', format: 'uri', pattern: '^(https?://|mailto:)' },
      },
    });
  });

  it('协议白名单拒绝面：file、脚本与自定义 scheme 即 BRIDGE_INVALID_INPUT（能力层闸）', async () => {
    const [openExternal] = createShellCapabilities(shellHost(createShellOpenFakePort()));
    const cases: readonly unknown[] = [
      undefined,
      null,
      {},
      { url: 42 },
      { url: 'file:///etc/passwd' },
      { url: 'javascript:alert(1)' },
      { url: 'data:text/html,hi' },
      { url: 'chips-resource://platform/shell.html' },
      { url: 'ftp://example.com/a' },
      { url: '//example.com/x' },
      { url: 'HTTPS://EXAMPLE.COM/A' },
      { url: 'https:example.com' },
      { url: 'https//example.com' },
      { url: 'mailto:a@example.com', extra: 1 },
    ];
    for (const input of cases) {
      await expect(
        openExternal!.handler(input, capabilityContext()),
        `输入 ${JSON.stringify(input)} 应被拒绝`,
      ).rejects.toMatchObject({
        code: 'BRIDGE_INVALID_INPUT',
        retryable: false,
        details: { capabilityId: 'shell:openExternal' },
      });
    }
  });

  it('白名单接受面：http、https 与 mailto 通过（逐字对齐 §7.8 允许集合）', async () => {
    const port = createShellOpenFakePort();
    const [openExternal] = createShellCapabilities(shellHost(port));
    for (const url of ['https://example.com/help', 'http://example.com/a', 'mailto:someone@example.com']) {
      await expect(openExternal!.handler({ url }, capabilityContext())).resolves.toBeUndefined();
    }
    expect(port.opens.map((entry) => entry.url)).toEqual([
      'https://example.com/help',
      'http://example.com/a',
      'mailto:someone@example.com',
    ]);
  });
});

describe('shell:openExternal 处理器行为（端口注入）', () => {
  it('url 与端口调用上下文如实透传，无输出', async () => {
    const port = createShellOpenFakePort();
    const [openExternal] = createShellCapabilities(shellHost(port));
    const ctx = capabilityContext();
    await openExternal!.handler({ url: 'https://example.com/help' }, ctx);
    expect(port.opens[0]).toEqual({
      url: 'https://example.com/help',
      call: { signal: ctx.signal, deadline: ctx.deadline },
    });
  });

  it('错误面逐字：端口域错误原样透传（SHELL_SCHEME_DENIED 不可重试、SHELL_OPEN_FAILED 可重试）', async () => {
    const port = createShellOpenFakePort();
    const [openExternal] = createShellCapabilities(shellHost(port));
    port.error = new PalPortError(PAL_ERROR_CODES.SHELL_SCHEME_DENIED, undefined, {
      details: { scheme: 'file:' },
    });
    await expect(openExternal!.handler({ url: 'https://example.com' }, capabilityContext())).rejects.toMatchObject({
      code: 'SHELL_SCHEME_DENIED',
      retryable: false,
      name: 'PalPortError',
    });
    port.error = new PalPortError(PAL_ERROR_CODES.SHELL_OPEN_FAILED);
    await expect(openExternal!.handler({ url: 'https://example.com' }, capabilityContext())).rejects.toMatchObject({
      code: 'SHELL_OPEN_FAILED',
      retryable: true,
    });
  });
});

describe('shell:openExternal 权限判定（路由级，R19 shell:external）', () => {
  it('未授予 shell:external：BRIDGE_PERMISSION_DENIED，details 指认缺失权限', async () => {
    const descriptors = createShellCapabilities(shellHost(createShellOpenFakePort()));
    const response = await routeSystemServiceRequest({
      capabilities: descriptors,
      grantedPermissions: [],
      capabilityId: 'shell:openExternal',
      input: { url: 'https://example.com' },
    });
    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.error.code).toBe('BRIDGE_PERMISSION_DENIED');
      expect(response.error.details).toMatchObject({
        capabilityId: 'shell:openExternal',
        permission: 'shell:external',
      });
    }
  });

  it('授予 shell:external：判定放行并达端口', async () => {
    const port = createShellOpenFakePort();
    const descriptors = createShellCapabilities(shellHost(port));
    const response = await routeSystemServiceRequest({
      capabilities: descriptors,
      grantedPermissions: ['shell:external'],
      capabilityId: 'shell:openExternal',
      input: { url: 'https://example.com/help' },
    });
    expect(response).toEqual({ requestId: 'route-1', ok: true, result: undefined });
    expect(port.opens).toHaveLength(1);
  });

  it('双层防线：能力层白名单之后的端口系统级兜底错误经路由逐字归一（SHELL_SCHEME_DENIED 不可重试）', async () => {
    const port = createShellOpenFakePort();
    port.error = new PalPortError(PAL_ERROR_CODES.SHELL_SCHEME_DENIED, undefined, { details: { scheme: 'file:' } });
    const descriptors = createShellCapabilities(shellHost(port));
    const response = await routeSystemServiceRequest({
      capabilities: descriptors,
      grantedPermissions: ['shell:external'],
      capabilityId: 'shell:openExternal',
      input: { url: 'https://allowed.example' },
    });
    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.error.code).toBe('SHELL_SCHEME_DENIED');
      expect(response.error.retryable).toBe(false);
    }
  });
});

/**
 * `dialog:*` 能力域契约锁单测（`04-能力契约规范` §6.2 R19、§7.7、§11.4；
 * `17-跨端Shell与平台抽象设计` §5.2 分面不可用语义；`02-Bridge三层设计` §4.1/§5.2）。
 *
 * 覆盖：壳侧镜像与 `@chips/sdk` 生成常量、`@chips/bridge` 登记表逐项一致性；
 * 分面闸（缺位整体不注册）；输入 schema 拒绝面（`BRIDGE_INVALID_INPUT`）；
 * 处理器行为（端口注入：选项映射、上下文透传、输出形状、错误面逐字、
 * 返回路径绝对性纪律）；路由级权限拒绝路径（`dialogs:use`）。
 */

import { describe, expect, it } from 'vitest';

import { PalPortError, PAL_ERROR_CODES } from '../src/platform/errors.js';
import { createDialogCapabilities } from '../src/runtime/capabilities/dialog.js';
import type { IHostCapabilityContext } from '../src/runtime/capability/contracts.js';
import type { IPalHost } from '../src/platform/contracts/index.js';
import { createFakePalHost, createFakePorts } from './helpers/fake-pal-host.js';
import { createDialogFakePort } from './helpers/system-service-fakes.js';
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

/** 能力执行上下文替身（字段与运行时组装一致）。 */
function capabilityContext(): IHostCapabilityContext {
  return {
    signal: new AbortController().signal,
    deadline: Date.now() + 60_000,
    sessionId: 'session-test',
    callerId: 'test.plugin',
    emit: () => undefined,
  };
}

/** 构造对话框分面就绪的 PAL 宿主替身。 */
function dialogHost(port: ReturnType<typeof createDialogFakePort>): IPalHost {
  return createFakePalHost({
    matrix: { ...createFakePalHost().matrix, dialog: true },
    ports: createFakePorts({ dialog: port }),
  });
}

describe('dialog:* 契约镜像锁（04 §7.7 / §6.2 R19）', () => {
  it('能力 ID 与 @chips/sdk 生成常量逐项一致', () => {
    const sdkIds = new Set(extractConstantEntries(SDK_CAPABILITY_IDS_SOURCE, 'DIALOG_').values());
    expect([...sdkIds].sort()).toEqual(['dialog:open', 'dialog:save']);
  });

  it('权限映射与 SDK 生成表、Bridge 登记表逐项一致（dialogs:use）', () => {
    const sdkPermissions = extractGeneratedPermissionMap(SDK_CAPABILITY_PERMISSIONS_SOURCE, 'dialog:');
    expect(sdkPermissions.get('dialog:open')).toEqual(['dialogs:use']);
    expect(sdkPermissions.get('dialog:save')).toEqual(['dialogs:use']);
    const bridgeEntries = extractBridgeContracts(BRIDGE_CONTRACTS_SOURCE, 'dialog:');
    expect(bridgeEntries.get('dialog:open')?.permissions).toEqual(['dialogs:use']);
    expect(bridgeEntries.get('dialog:save')?.permissions).toEqual(['dialogs:use']);
  });

  it('对话框能力无限定值目标（Bridge 登记表同口径）', () => {
    const bridgeEntries = extractBridgeContracts(BRIDGE_CONTRACTS_SOURCE, 'dialog:');
    expect(bridgeEntries.get('dialog:open')?.targets).toEqual([]);
    expect(bridgeEntries.get('dialog:save')?.targets).toEqual([]);
  });
});

describe('dialog:* 注册形制（分面闸与描述符）', () => {
  it('分面缺位：整体不注册（17 §5.2；调用维持注册表未命中语义）', () => {
    expect(createDialogCapabilities(createFakePalHost())).toEqual([]);
    const portless = createFakePalHost({
      matrix: { ...createFakePalHost().matrix, dialog: true },
      ports: createFakePorts(),
    });
    expect(createDialogCapabilities(portless)).toEqual([]);
  });

  it('分面就绪：open → save 两条注册单元，ID、权限、schema、目标取自镜像常量', () => {
    const descriptors = createDialogCapabilities(dialogHost(createDialogFakePort()));
    expect(descriptors.map((descriptor) => descriptor.id)).toEqual(['dialog:open', 'dialog:save']);
    for (const descriptor of descriptors) {
      expect(descriptor.permissions).toEqual(['dialogs:use']);
      expect(descriptor.targets).toEqual([]);
      expect(descriptor.owner, '提供方不自报，owner 由组合根单点决定').toBeUndefined();
      expect(descriptor.concurrency).toBe('parallel');
    }
  });

  it('对话框为用户交互模态：超时显式放宽（30s 注册默认会拦下正常选取）', () => {
    const descriptors = createDialogCapabilities(dialogHost(createDialogFakePort()));
    for (const descriptor of descriptors) {
      expect(descriptor.timeoutMs).toBe(600_000);
    }
  });
});

describe('dialog:open 输入 schema（04 §7.7 逐字）', () => {
  it('schema 与契约逐字一致', () => {
    const descriptors = createDialogCapabilities(dialogHost(createDialogFakePort()));
    expect(descriptors[0]?.schema).toEqual({
      type: 'object',
      additionalProperties: false,
      properties: {
        title: { type: 'string', maxLength: 128 },
        multiple: { type: 'boolean', default: false },
        directory: { type: 'boolean', default: false },
        filters: {
          type: 'array',
          maxItems: 16,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['name', 'extensions'],
            properties: {
              name: { type: 'string', minLength: 1, maxLength: 64 },
              extensions: {
                type: 'array',
                minItems: 1,
                maxItems: 32,
                items: { type: 'string', pattern: '^\\.[A-Za-z0-9]+$' },
              },
            },
          },
        },
      },
    });
  });

  it('schema 拒绝面：未声明字段、类型越界、过滤器约束逐项 BRIDGE_INVALID_INPUT', async () => {
    const [open] = createDialogCapabilities(dialogHost(createDialogFakePort()));
    const handler = open!.handler;
    const cases: readonly { readonly input: unknown; readonly reason: string }[] = [
      { input: null, reason: '非对象' },
      { input: 'dialog', reason: '字符串输入' },
      { input: { extra: true }, reason: '未声明字段' },
      { input: { title: 7 }, reason: 'title 非字符串' },
      { input: { title: 'x'.repeat(129) }, reason: 'title 超长' },
      { input: { multiple: 'yes' }, reason: 'multiple 非布尔' },
      { input: { directory: 1 }, reason: 'directory 非布尔' },
      { input: { filters: '图片' }, reason: 'filters 非数组' },
      {
        input: { filters: Array.from({ length: 17 }, () => ({ name: '图', extensions: ['.png'] })) },
        reason: '过滤器超 16',
      },
      { input: { filters: [{ name: '', extensions: ['.png'] }] }, reason: '过滤器名空' },
      { input: { filters: [{ name: 'x'.repeat(65), extensions: ['.png'] }] }, reason: '过滤器名超长' },
      { input: { filters: [{ name: '图片' }] }, reason: '缺 extensions' },
      { input: { filters: [{ name: '图片', extensions: [] }] }, reason: 'extensions 空' },
      {
        input: { filters: [{ name: '图片', extensions: Array.from({ length: 33 }, () => '.png') }] },
        reason: 'extensions 超 32',
      },
      { input: { filters: [{ name: '图片', extensions: ['png'] }] }, reason: '扩展名缺点号' },
      { input: { filters: [{ name: '图片', extensions: ['.png!'] }] }, reason: '扩展名含非法字符' },
      { input: { filters: [{ name: '图片', extensions: ['.png'], extra: 1 }] }, reason: '过滤器未声明字段' },
    ];
    for (const { input } of cases) {
      const error = await handler(input, capabilityContext()).then(
        () => null,
        (caught: unknown) => caught,
      );
      expect(error, `输入 ${JSON.stringify(input)} 应被拒绝`).toMatchObject({
        code: 'BRIDGE_INVALID_INPUT',
        retryable: false,
      });
      expect((error as { details?: { capabilityId?: string } }).details?.capabilityId).toBe('dialog:open');
    }
  });

  it('schema 边界接受面：合法输入通过（空 filters 数组、title 空、全部缺省）', async () => {
    const port = createDialogFakePort();
    port.openResult = { canceled: true, paths: [] };
    const [open] = createDialogCapabilities(dialogHost(port));
    await expect(open!.handler({}, capabilityContext())).resolves.toEqual({ canceled: true, paths: [] });
    await expect(open!.handler({ title: '', filters: [] }, capabilityContext())).resolves.toEqual({
      canceled: true,
      paths: [],
    });
  });
});

describe('dialog:save 输入 schema（04 §7.7 逐字）', () => {
  it('schema 与契约逐字一致', () => {
    const descriptors = createDialogCapabilities(dialogHost(createDialogFakePort()));
    expect(descriptors[1]?.schema).toEqual({
      type: 'object',
      additionalProperties: false,
      properties: {
        title: { type: 'string', maxLength: 128 },
        defaultPath: { type: 'string', minLength: 1 },
        filters: {
          type: 'array',
          maxItems: 16,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['name', 'extensions'],
            properties: {
              name: { type: 'string', minLength: 1, maxLength: 64 },
              extensions: {
                type: 'array',
                minItems: 1,
                maxItems: 32,
                items: { type: 'string', pattern: '^\\.[A-Za-z0-9]+$' },
              },
            },
          },
        },
      },
    });
  });

  it('schema 拒绝面：defaultPath 空串、非字符串即 BRIDGE_INVALID_INPUT', async () => {
    const [, save] = createDialogCapabilities(dialogHost(createDialogFakePort()));
    for (const input of [{ defaultPath: '' }, { defaultPath: 3 }, { defaultPath: {} }]) {
      await expect(save!.handler(input, capabilityContext())).rejects.toMatchObject({
        code: 'BRIDGE_INVALID_INPUT',
        retryable: false,
      });
    }
  });
});

describe('dialog:* 处理器行为（端口注入）', () => {
  it('open：选项与端口调用上下文如实透传，输出 { canceled, paths }', async () => {
    const port = createDialogFakePort();
    port.openResult = { canceled: false, paths: ['/Users/tester/Pictures/a.png'] };
    const [open] = createDialogCapabilities(dialogHost(port));
    const controller = new AbortController();
    const deadline = Date.now() + 60_000;
    const result = await open!.handler(
      { title: '选择图片', multiple: false, filters: [{ name: '图片', extensions: ['.png'] }] },
      { signal: controller.signal, deadline, sessionId: 's1', callerId: 'p', emit: () => undefined },
    );
    expect(result).toEqual({ canceled: false, paths: ['/Users/tester/Pictures/a.png'] });
    expect(port.opens).toHaveLength(1);
    expect(port.opens[0]?.options).toEqual({
      signal: controller.signal,
      deadline,
      title: '选择图片',
      multiple: false,
      filters: [{ name: '图片', extensions: ['.png'] }],
    });
  });

  it('save：选项与上下文透传，输出 { canceled, path }；取消时 path 为 null', async () => {
    const port = createDialogFakePort();
    port.saveResult = { canceled: false, path: '/Users/tester/Desktop/b.png' };
    const [, save] = createDialogCapabilities(dialogHost(port));
    await expect(save!.handler({ title: '保存' }, capabilityContext())).resolves.toEqual({
      canceled: false,
      path: '/Users/tester/Desktop/b.png',
    });
    port.saveResult = { canceled: true, path: null };
    await expect(save!.handler({}, capabilityContext())).resolves.toEqual({ canceled: true, path: null });
  });

  it('错误面逐字：端口域错误原样透传（DIALOG_FAILED 可重试、BRIDGE_CANCELLED 不可重试）', async () => {
    const port = createDialogFakePort();
    port.error = new PalPortError(PAL_ERROR_CODES.DIALOG_FAILED);
    const [open] = createDialogCapabilities(dialogHost(port));
    await expect(open!.handler({}, capabilityContext())).rejects.toMatchObject({
      code: 'DIALOG_FAILED',
      retryable: true,
      name: 'PalPortError',
    });
    port.error = new PalPortError(PAL_ERROR_CODES.BRIDGE_CANCELLED);
    await expect(open!.handler({}, capabilityContext())).rejects.toMatchObject({
      code: 'BRIDGE_CANCELLED',
      retryable: false,
    });
  });
});

describe('dialog:* 权限判定（路由级，R19 dialogs:use）', () => {
  it('未授予 dialogs:use：BRIDGE_PERMISSION_DENIED，details 指认缺失权限', async () => {
    const descriptors = createDialogCapabilities(dialogHost(createDialogFakePort()));
    const response = await routeSystemServiceRequest({
      capabilities: descriptors,
      grantedPermissions: [],
      capabilityId: 'dialog:open',
      input: {},
    });
    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.error.code).toBe('BRIDGE_PERMISSION_DENIED');
      expect(response.error.details).toMatchObject({ capabilityId: 'dialog:open', permission: 'dialogs:use' });
    }
  });

  it('授予 dialogs:use：判定放行（进入 schema 准入与端口执行）', async () => {
    const port = createDialogFakePort();
    port.openResult = { canceled: true, paths: [] };
    const descriptors = createDialogCapabilities(dialogHost(port));
    const response = await routeSystemServiceRequest({
      capabilities: descriptors,
      grantedPermissions: ['dialogs:use'],
      capabilityId: 'dialog:open',
      input: { title: '选择' },
    });
    expect(response.ok).toBe(true);
    expect(port.opens).toHaveLength(1);
  });

  it('未注册分面：调用得真实 BRIDGE_CAPABILITY_NOT_FOUND（17 §5.2 分面缺失语义）', async () => {
    const response = await routeSystemServiceRequest({
      capabilities: createDialogCapabilities(createFakePalHost()),
      grantedPermissions: ['*'],
      capabilityId: 'dialog:open',
      input: {},
    });
    expect(response.ok).toBe(false);
    if (!response.ok) {
      expect(response.error.code).toBe('BRIDGE_CAPABILITY_NOT_FOUND');
    }
  });
});

/**
 * 平台内置能力域：`transfer:download` / `transfer:cancel`（04-能力契约规范 §7.15、§6.2 R19）。
 *
 * 权威：`04-能力契约规范` §7.15（下载返回 `transferId`、进度与结果经标准事件投递、
 * `completed` 前目标路径不可见（临时文件 + 原子替换）、传输随调用方会话结束取消；cancel 幂等）、
 * §6.2（`transfer:manage` + 目标路径 `filesystem:write` + URL 逐跳 `network:http`；限定值目标
 * `target` / `url`，Bridge 登记表同口径；对全部角色开放）、§11.4（`TRANSFER_*`）、
 * `05-事件契约规范` §4.10（`transfer:progress` / `transfer:completed` / `transfer:failed`
 * 载荷，端口事件形状与其逐字一致）、`17-跨端Shell与平台抽象设计` §5.1/§5.2（分面闸）、
 * §4.2 规则 2（端口调用上下文）。
 *
 * @remarks
 * - 处理器直连 PAL `transfer` 端口（异步任务、临时文件 + 原子替换、进度限流均在端口承载），
 *   能力模块不感知 Electron。
 * - 会话绑定：下载任务信号取 `ctx.sessionSignal`（测试替身缺省回退 `ctx.signal`），
 *   会话销毁即取消传输（§7.15 约束）；进度与结果事件经 `ctx.emit` 投递到调用方会话所在窗口
 *   （跨会话/跨进程投递归内核事件总线正式面；事件只作通知、至多一次，不保证必达）。
 * - URL 与重定向目标的协议白名单（`^https?://`）由本域逐跳判定（与 `http` 域同形）；
 *   域名限定值匹配归核心权限链（08 §7.4），本层不复制第二套判定。
 */

import type { IPalHost } from '../../platform/contracts/index.js';
import type { IHostCapabilityDescriptor } from '../capability/contracts.js';
import {
  isFacetReady,
  optionalBooleanField,
  optionalPatternStringField,
  patternStringField,
  readInputRecord,
  requireStringField,
} from './system-service-common.js';

/** 内置 `transfer:*` 能力 ID（单一事实源常量，与 `@chips/sdk` 生成表同值）。 */
export const TRANSFER_CAPABILITY_IDS = {
  download: 'transfer:download',
  cancel: 'transfer:cancel',
} as const;

/** 传输域权限并集（R19 §6.2：`transfer:manage` + `filesystem:write` + `network:http`）。 */
export const TRANSFER_PERMISSION_IDS = {
  manage: 'transfer:manage',
  filesystemWrite: 'filesystem:write',
  networkHttp: 'network:http',
} as const;

/** 输入 JSON Schema（逐字镜像 §7.15 `transferInputSchemas`）。 */
export const TRANSFER_INPUT_SCHEMAS: Readonly<
  Record<'transfer:download' | 'transfer:cancel', Readonly<Record<string, unknown>>>
> = {
  'transfer:download': {
    type: 'object',
    additionalProperties: false,
    required: ['url', 'target'],
    properties: {
      url: { type: 'string', format: 'uri', pattern: '^https?://' },
      target: { type: 'string', minLength: 1 },
      expectedDigest: { type: 'string', pattern: '^sha256:[0-9a-f]{64}$' },
      overwrite: { type: 'boolean', default: false },
    },
  },
  'transfer:cancel': {
    type: 'object',
    additionalProperties: false,
    required: ['transferId'],
    properties: {
      transferId: { type: 'string', minLength: 1 },
    },
  },
};

/** §7.15 协议白名单（`pattern: '^https?://'`，逐字对齐）。 */
const URL_PATTERN = /^https?:\/\//;

/** 摘要文法（§7.15 `expectedDigest.pattern`）。 */
const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/;

/**
 * 构造内置 `transfer:download` / `transfer:cancel` 能力注册条目（分面缺位时返回空数组，整体不注册）。
 *
 * @param host 已通过壳自检的 PAL 宿主。
 */
export function createTransferCapabilities(host: IPalHost): readonly IHostCapabilityDescriptor[] {
  if (!isFacetReady(host.matrix, host.ports, 'transfer')) {
    return [];
  }
  const transfer = host.ports.transfer!;
  const download: IHostCapabilityDescriptor = {
    id: TRANSFER_CAPABILITY_IDS.download,
    permissions: [
      TRANSFER_PERMISSION_IDS.manage,
      TRANSFER_PERMISSION_IDS.filesystemWrite,
      TRANSFER_PERMISSION_IDS.networkHttp,
    ],
    schema: TRANSFER_INPUT_SCHEMAS['transfer:download'],
    targets: [
      { permission: TRANSFER_PERMISSION_IDS.filesystemWrite, targetFields: ['target'] },
      { permission: TRANSFER_PERMISSION_IDS.networkHttp, targetFields: ['url'] },
    ],
    concurrency: 'parallel',
    async handler(input, ctx): Promise<unknown> {
      const record = readInputRecord(TRANSFER_CAPABILITY_IDS.download, input, [
        'url',
        'target',
        'expectedDigest',
        'overwrite',
      ]);
      const url = patternStringField(
        TRANSFER_CAPABILITY_IDS.download,
        record,
        'url',
        URL_PATTERN,
        'url 必须是 http(s) 绝对 URL',
      );
      const target = requireStringField(TRANSFER_CAPABILITY_IDS.download, record, 'target', { minLength: 1 });
      const expectedDigest = optionalPatternStringField(
        TRANSFER_CAPABILITY_IDS.download,
        record,
        'expectedDigest',
        DIGEST_PATTERN,
        'expectedDigest 必须匹配 ^sha256:[0-9a-f]{64}$',
      );
      const overwrite = optionalBooleanField(TRANSFER_CAPABILITY_IDS.download, record, 'overwrite');
      const { transferId } = await transfer.download(
        {
          // 传输随调用方会话结束取消（§7.15）：任务信号绑定会话级信号。
          signal: ctx.sessionSignal ?? ctx.signal,
          deadline: ctx.deadline,
          url,
          target,
          ...(expectedDigest !== null ? { expectedDigest } : {}),
          ...(overwrite !== null ? { overwrite } : {}),
          // 逐跳重定向授权：协议判定本域交付；地址与域名限定值判定归核心权限链。
          authorizeRedirect: (redirectTarget: string): Promise<boolean> =>
            Promise.resolve(URL_PATTERN.test(redirectTarget)),
        },
        {
          // 标准事件经调用方会话所在窗口投递；载荷与端口事件形状一致（§4.10）。
          onProgress: (event): void => {
            ctx.emit('transfer:progress', event);
          },
          onCompleted: (event): void => {
            ctx.emit('transfer:completed', event);
          },
          onFailed: (event): void => {
            ctx.emit('transfer:failed', {
              transferId: event.transferId,
              error: {
                code: event.code,
                message: event.message,
                retryable: event.retryable,
                ...(event.details !== undefined ? { details: event.details } : {}),
              },
              cancelled: event.cancelled,
            });
          },
        },
      );
      return { transferId };
    },
  };
  const cancel: IHostCapabilityDescriptor = {
    id: TRANSFER_CAPABILITY_IDS.cancel,
    permissions: [
      TRANSFER_PERMISSION_IDS.manage,
      TRANSFER_PERMISSION_IDS.filesystemWrite,
      TRANSFER_PERMISSION_IDS.networkHttp,
    ],
    schema: TRANSFER_INPUT_SCHEMAS['transfer:cancel'],
    targets: [],
    concurrency: 'parallel',
    async handler(input): Promise<unknown> {
      const record = readInputRecord(TRANSFER_CAPABILITY_IDS.cancel, input, ['transferId']);
      const transferId = requireStringField(TRANSFER_CAPABILITY_IDS.cancel, record, 'transferId', { minLength: 1 });
      // cancel 幂等即返、不阻塞（端口契约无调用上下文参数，17 §4.2 规则 2 的阻塞口径不适用）。
      await transfer.cancel(transferId);
      return undefined;
    },
  };
  return [download, cancel];
}

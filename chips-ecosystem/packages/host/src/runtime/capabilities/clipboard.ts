/**
 * 平台内置能力域：`clipboard:read` / `clipboard:write`（04-能力契约规范 §7.6、§6.2 R19）。
 *
 * 权威：`04-能力契约规范` §7.6（读取输出 `{ text }`，无文本为 `null`；剪贴板内容不得写入
 * 日志或审计原文）、§6.2（`clipboard:access`）、§11.4（`CLIPBOARD_UNAVAILABLE`），
 * `17-跨端Shell与平台抽象设计` §5.1/§5.2（分面闸）、§4.3（能力层职责）。
 *
 * @remarks
 * - 处理器直连 PAL `clipboard` 端口，能力模块不感知 Electron；读取属高风险操作，
 *   首次调用确认与判定审计由权限链路承载（08-权限系统设计），本域不复制第二套判定。
 * - 剪贴板读写不阻塞（端口契约无调用上下文参数，17 §4.2 规则 2 的阻塞口径不适用）；
 *   读取输出按契约收敛为 `{ text }`；写入无输出（`undefined`）。
 */

import type { IPalHost } from '../../platform/contracts/index.js';
import type { IHostCapabilityDescriptor } from '../capability/contracts.js';
import { isFacetReady, readInputRecord, requireStringField } from './system-service-common.js';

/** 内置 `clipboard:*` 能力 ID（单一事实源常量，与 `@chips/sdk` 生成表同值）。 */
export const CLIPBOARD_CAPABILITY_IDS = {
  read: 'clipboard:read',
  write: 'clipboard:write',
} as const;

/** 剪贴板域权限 ID（R19 §6.2：`clipboard:access`）。 */
export const CLIPBOARD_PERMISSION_IDS = {
  access: 'clipboard:access',
} as const;

/** 输入 JSON Schema（逐字镜像 §7.6 `clipboardInputSchemas`）。 */
export const CLIPBOARD_INPUT_SCHEMAS: Readonly<
  Record<'clipboard:read' | 'clipboard:write', Readonly<Record<string, unknown>>>
> = {
  'clipboard:read': {
    type: 'object',
    additionalProperties: false,
    properties: {},
  },
  'clipboard:write': {
    type: 'object',
    additionalProperties: false,
    required: ['text'],
    properties: {
      text: { type: 'string' },
    },
  },
};

/** 构造内置 `clipboard:read` / `clipboard:write` 能力注册条目（分面缺位时返回空数组，整体不注册）。 */
export function createClipboardCapabilities(host: IPalHost): readonly IHostCapabilityDescriptor[] {
  if (!isFacetReady(host.matrix, host.ports, 'clipboard')) {
    return [];
  }
  const clipboard = host.ports.clipboard!;
  const read: IHostCapabilityDescriptor = {
    id: CLIPBOARD_CAPABILITY_IDS.read,
    permissions: [CLIPBOARD_PERMISSION_IDS.access],
    schema: CLIPBOARD_INPUT_SCHEMAS['clipboard:read'],
    targets: [],
    concurrency: 'parallel',
    async handler(input): Promise<unknown> {
      readInputRecord(CLIPBOARD_CAPABILITY_IDS.read, input, []);
      return { text: await clipboard.readText() };
    },
  };
  const write: IHostCapabilityDescriptor = {
    id: CLIPBOARD_CAPABILITY_IDS.write,
    permissions: [CLIPBOARD_PERMISSION_IDS.access],
    schema: CLIPBOARD_INPUT_SCHEMAS['clipboard:write'],
    targets: [],
    concurrency: 'parallel',
    async handler(input): Promise<unknown> {
      const record = readInputRecord(CLIPBOARD_CAPABILITY_IDS.write, input, ['text']);
      const text = requireStringField(CLIPBOARD_CAPABILITY_IDS.write, record, 'text');
      await clipboard.writeText(text);
      return undefined;
    },
  };
  return [read, write];
}

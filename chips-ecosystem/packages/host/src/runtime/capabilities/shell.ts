/**
 * 平台内置能力域：`shell:openExternal`（04-能力契约规范 §7.8、§6.2 R19）。
 *
 * 权威：`04-能力契约规范` §7.8（输入 `url` 仅允许 `http` / `https` / `mailto` scheme；
 * `file:`、脚本等 scheme 一律拒绝）、§6.2（`shell:external`；限定值目标 `url`）、
 * §11.4（`SHELL_SCHEME_DENIED` / `SHELL_OPEN_FAILED`），`17-跨端Shell与平台抽象设计`
 * §5.1/§5.2（分面闸；仅具备分面的壳注册）、§4.3（能力层安全判定）。
 *
 * @remarks
 * - 协议白名单双层防线：能力层按 §7.8 schema `pattern` 闸（`^(https?://|mailto:)`），
 *   PAL `shellOpen` 端口做系统级 scheme 白名单兜底；域名限定值匹配归核心（08 §7.4）。
 * - 处理器直连 PAL 端口，能力模块不感知 Electron。
 */

import type { IPalHost } from '../../platform/contracts/index.js';
import type { IHostCapabilityDescriptor } from '../capability/contracts.js';
import {
  isFacetReady,
  readInputRecord,
  requireStringField,
  systemServiceInputError,
  toPortCall,
} from './system-service-common.js';

/** 内置 `shell:openExternal` 能力 ID（单一事实源常量，与 `@chips/sdk` 生成表同值）。 */
export const SHELL_CAPABILITY_IDS = {
  openExternal: 'shell:openExternal',
} as const;

/** 外部打开域权限 ID（R19 §6.2：`shell:external`，仅 `app` 角色可持有）。 */
export const SHELL_PERMISSION_IDS = {
  external: 'shell:external',
} as const;

/** 输入 JSON Schema（逐字镜像 §7.8 `shellInputSchemas`）。 */
export const SHELL_INPUT_SCHEMAS: Readonly<Record<'shell:openExternal', Readonly<Record<string, unknown>>>> = {
  'shell:openExternal': {
    type: 'object',
    additionalProperties: false,
    required: ['url'],
    properties: {
      url: { type: 'string', format: 'uri', pattern: '^(https?://|mailto:)' },
    },
  },
};

/** §7.8 协议白名单（`pattern: '^(https?://|mailto:)'`，区分大小写逐字对齐）。 */
const URL_PATTERN = /^(https?:\/\/|mailto:)/;

/** 构造内置 `shell:openExternal` 能力注册条目（分面缺位时返回空数组，整体不注册）。 */
export function createShellCapabilities(host: IPalHost): readonly IHostCapabilityDescriptor[] {
  if (!isFacetReady(host.matrix, host.ports, 'shellOpen')) {
    return [];
  }
  const shellOpen = host.ports.shellOpen!;
  const openExternal: IHostCapabilityDescriptor = {
    id: SHELL_CAPABILITY_IDS.openExternal,
    permissions: [SHELL_PERMISSION_IDS.external],
    schema: SHELL_INPUT_SCHEMAS['shell:openExternal'],
    targets: [{ permission: SHELL_PERMISSION_IDS.external, targetFields: ['url'] }],
    concurrency: 'parallel',
    async handler(input, ctx): Promise<unknown> {
      const record = readInputRecord(SHELL_CAPABILITY_IDS.openExternal, input, ['url']);
      const url = requireStringField(SHELL_CAPABILITY_IDS.openExternal, record, 'url');
      if (!URL_PATTERN.test(url)) {
        throw systemServiceInputError(
          SHELL_CAPABILITY_IDS.openExternal,
          'url scheme 不在允许集合（http/https/mailto）',
        );
      }
      await shellOpen.openExternal(url, toPortCall(ctx));
      return undefined;
    },
  };
  return [openExternal];
}

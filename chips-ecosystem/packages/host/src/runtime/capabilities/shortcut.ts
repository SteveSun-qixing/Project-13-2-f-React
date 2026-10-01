/**
 * 平台内置能力域：`shortcut:register` / `shortcut:unregister`（04-能力契约规范 §7.9、§6.2 R19）。
 *
 * 权威：`04-能力契约规范` §7.9（重复注册同 ID 覆盖旧绑定；注销幂等，不存在视为成功；
 * 快捷键绑定随调用方会话结束释放）、§6.2（`shortcut:manage`；仅 `app` 角色可持有，08 §6.3）、
 * §11.4（`SHORTCUT_ACCELERATOR_INVALID` / `SHORTCUT_CONFLICT` / `SHORTCUT_REGISTER_FAILED`），
 * `05-事件契约规范` §4.10（`shortcut:triggered`），`17-跨端Shell与平台抽象设计` §5.1/§5.2
 * （分面闸）、§4.2 规则 2（端口调用上下文）。
 *
 * @remarks
 * - 处理器直连 PAL `shortcut` 端口，能力模块不感知 Electron；`shortcutId` 由调用方命名空间
 *   管理（§7.9），重复注册同 ID 覆盖旧绑定由端口承载。
 * - 会话绑定：注册成功后把会话信号（`ctx.sessionSignal`；测试替身缺省回退 `ctx.signal`）
 *   与注销绑定，会话销毁即注销该会话登记的全部快捷键（§7.9 约束）。
 * - 触发信号经 `register` 回调交给本域，向注册会话所在窗口发布 `shortcut:triggered`
 *   （载荷 `shortcutId`，§4.10）；同时按应用命令通道投递对应 `command` 的转发由壳在命令系统
 *   波次接线（本域不感知命令通道）。
 */

import type { IPalHost } from '../../platform/contracts/index.js';
import type { IHostCapabilityDescriptor } from '../capability/contracts.js';
import {
  isFacetReady,
  patternStringField,
  readInputRecord,
  requireStringField,
  toPortCall,
} from './system-service-common.js';

/** 内置 `shortcut:*` 能力 ID（单一事实源常量，与 `@chips/sdk` 生成表同值）。 */
export const SHORTCUT_CAPABILITY_IDS = {
  register: 'shortcut:register',
  unregister: 'shortcut:unregister',
} as const;

/** 快捷键域权限 ID（R19 §6.2：`shortcut:manage`）。 */
export const SHORTCUT_PERMISSION_IDS = {
  manage: 'shortcut:manage',
} as const;

/** 输入 JSON Schema（逐字镜像 §7.9 `integrationInputSchemas` 的 shortcut 项）。 */
export const SHORTCUT_INPUT_SCHEMAS: Readonly<
  Record<'shortcut:register' | 'shortcut:unregister', Readonly<Record<string, unknown>>>
> = {
  'shortcut:register': {
    type: 'object',
    additionalProperties: false,
    required: ['shortcutId', 'accelerator'],
    properties: {
      shortcutId: { type: 'string', pattern: '^[a-z0-9][a-z0-9-]*$', maxLength: 64 },
      accelerator: { type: 'string', minLength: 1, maxLength: 64 },
    },
  },
  'shortcut:unregister': {
    type: 'object',
    additionalProperties: false,
    required: ['shortcutId'],
    properties: {
      shortcutId: { type: 'string', pattern: '^[a-z0-9][a-z0-9-]*$', maxLength: 64 },
    },
  },
};

/** 快捷键 ID 文法（§7.9 `shortcutId.pattern`）。 */
const SHORTCUT_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

/**
 * 构造内置 `shortcut:register` / `shortcut:unregister` 能力注册条目（分面缺位时返回空数组，整体不注册）。
 *
 * @param host 已通过壳自检的 PAL 宿主。
 */
export function createShortcutCapabilities(host: IPalHost): readonly IHostCapabilityDescriptor[] {
  if (!isFacetReady(host.matrix, host.ports, 'shortcut')) {
    return [];
  }
  const shortcut = host.ports.shortcut!;

  /** 会话已登记的快捷键（会话销毁时逐项注销；模块生命周期内存续）。 */
  const sessionBindings = new Map<string, Set<string>>();

  /** 登记会话绑定；返回会话结束时的自动注销臂。 */
  const bindSession = (sessionId: string, shortcutId: string, sessionSignal: AbortSignal): void => {
    let bindings = sessionBindings.get(sessionId);
    if (bindings === undefined) {
      const bound = new Set<string>([shortcutId]);
      bindings = bound;
      sessionBindings.set(sessionId, bound);
      sessionSignal.addEventListener(
        'abort',
        () => {
          sessionBindings.delete(sessionId);
          for (const id of bound) {
            // 会话结束自动注销（§7.9）：会话信号已中止，注销幂等即返、不带调用上下文。
            void shortcut.unregister(id).catch(() => undefined);
          }
        },
        { once: true },
      );
      return;
    }
    bindings.add(shortcutId);
  };

  /** 摘除会话绑定记账（注销调用）；会话级自动注销臂不再重复注销该键。 */
  const unbindSession = (sessionId: string, shortcutId: string): void => {
    sessionBindings.get(sessionId)?.delete(shortcutId);
  };

  const register: IHostCapabilityDescriptor = {
    id: SHORTCUT_CAPABILITY_IDS.register,
    permissions: [SHORTCUT_PERMISSION_IDS.manage],
    schema: SHORTCUT_INPUT_SCHEMAS['shortcut:register'],
    targets: [],
    concurrency: 'parallel',
    async handler(input, ctx): Promise<unknown> {
      const record = readInputRecord(SHORTCUT_CAPABILITY_IDS.register, input, ['shortcutId', 'accelerator']);
      const shortcutId = patternStringField(
        SHORTCUT_CAPABILITY_IDS.register,
        record,
        'shortcutId',
        SHORTCUT_ID_PATTERN,
        'shortcutId 必须匹配 ^[a-z0-9][a-z0-9-]*$',
        { maxLength: 64 },
      );
      const accelerator = requireStringField(SHORTCUT_CAPABILITY_IDS.register, record, 'accelerator', {
        minLength: 1,
        maxLength: 64,
      });
      await shortcut.register(
        shortcutId,
        accelerator,
        () => {
          ctx.emit('shortcut:triggered', { shortcutId });
        },
        toPortCall(ctx),
      );
      bindSession(ctx.sessionId, shortcutId, ctx.sessionSignal ?? ctx.signal);
      return undefined;
    },
  };
  const unregister: IHostCapabilityDescriptor = {
    id: SHORTCUT_CAPABILITY_IDS.unregister,
    permissions: [SHORTCUT_PERMISSION_IDS.manage],
    schema: SHORTCUT_INPUT_SCHEMAS['shortcut:unregister'],
    targets: [],
    concurrency: 'parallel',
    async handler(input, ctx): Promise<unknown> {
      const record = readInputRecord(SHORTCUT_CAPABILITY_IDS.unregister, input, ['shortcutId']);
      const shortcutId = patternStringField(
        SHORTCUT_CAPABILITY_IDS.unregister,
        record,
        'shortcutId',
        SHORTCUT_ID_PATTERN,
        'shortcutId 必须匹配 ^[a-z0-9][a-z0-9-]*$',
        { maxLength: 64 },
      );
      await shortcut.unregister(shortcutId, toPortCall(ctx));
      unbindSession(ctx.sessionId, shortcutId);
      return undefined;
    },
  };
  return [register, unregister];
}

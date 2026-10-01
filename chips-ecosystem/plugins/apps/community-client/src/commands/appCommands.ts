import type { ICommandDefinition } from '@chips/sdk';
import type { ICommandLocalRegistration } from '@chips/ui';

/** 插件 ID（与 manifest.id 一致）。 */
export const APP_PLUGIN_ID = 'chips.official.community-client';

/** 命令命名空间：取插件 ID 末段（《13-命令系统契约》§2.1）。 */
export const APP_COMMAND_DOMAIN = 'community-client';

/** 运行时命令 ID；与 manifest `cli.commands` 声明逐字对应。 */
export const APP_COMMAND_IDS = {
  openCard: 'community-client:open-card',
  refreshView: 'community-client:refresh-view',
} as const;

/** ui 目标命令的本地处理器标识（《13-命令系统契约》§2.2，与注册记录配对）。 */
export const APP_COMMAND_HANDLER_IDS = {
  openCard: 'open-card',
  refreshView: 'refresh-view',
} as const;

/**
 * 可序列化命令元数据：注册进平台命令注册表的纯数据对象。
 *
 * 全部字段为 JSON 可往返的普通数据（无函数、无类实例）；界面文案简体中文直写，
 * 快捷键文法见《13-命令系统契约》§2.6。
 */
export const appCommandDefinitions: readonly ICommandDefinition[] = [
  {
    id: APP_COMMAND_IDS.openCard,
    title: '打开卡片',
    description: '在「薯片社区」中登记指定卡片文件的本地查看请求',
    shortcut: 'CommandOrControl+O',
    scope: { kind: 'app', appId: APP_PLUGIN_ID },
    handlerId: APP_COMMAND_HANDLER_IDS.openCard,
    keywords: ['open', 'card', '打开', '卡片'],
    group: '文件',
  },
  {
    id: APP_COMMAND_IDS.refreshView,
    title: '刷新当前视图',
    description: '重新读取会话运行时状态并刷新当前展示数据',
    shortcut: 'F5',
    scope: { kind: 'app', appId: APP_PLUGIN_ID },
    handlerId: APP_COMMAND_HANDLER_IDS.refreshView,
    keywords: ['refresh', '刷新'],
    group: '视图',
  },
];

export type AppCommandId = (typeof APP_COMMAND_IDS)[keyof typeof APP_COMMAND_IDS];
export type AppCommandHandlerId =
  (typeof APP_COMMAND_HANDLER_IDS)[keyof typeof APP_COMMAND_HANDLER_IDS];

const APP_COMMAND_ID_SET: ReadonlySet<string> = new Set<string>(Object.values(APP_COMMAND_IDS));

/** 判定命令 ID 是否属于本应用的命令记录（可见性由平台保证，此守卫为防御性复核）。 */
export function isAppCommandId(commandId: string): boolean {
  return APP_COMMAND_ID_SET.has(commandId);
}

/**
 * 命令业务动作：本地处理器解析载荷后调用的界面入口（由界面层装配）。
 *
 * - `openCard`：登记本地查看请求（本地查看经 14-契约由默认处理器路由本地卡片查看器；
 *   `transfer:*` 链路落波前如实呈现候前置件登记，不伪造查看能力）；
 * - `refreshView`：重读会话运行时状态刷新当前视图。
 */
export interface CommunityCommandActions {
  /** 登记本地查看请求（载荷路径非法时入口侧已拒绝，不会以空值触达）。 */
  openCard(path: string): void;
  /** 刷新当前视图。 */
  refreshView(): void;
}

/** 派发执行记录：本地处理器执行后上报给界面层消费（非法载荷如实记录失败）。 */
export interface AppCommandStatus {
  readonly commandId: string;
  readonly handlerId: AppCommandHandlerId;
  readonly ok: boolean;
}

/** 打开卡片命令载荷收窄：`{ path }` 必须为非空字符串（manifest `mapsTo: path`），其余形状非法。 */
export function readOpenCardPayloadPath(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }
  const candidate = (payload as Record<string, unknown>)['path'];
  return typeof candidate === 'string' && candidate.trim().length > 0 ? candidate.trim() : null;
}

/**
 * 构造与 `command:invoked` 派发配对的本地处理器集合（《13-命令系统契约》§5.6）。
 *
 * 每条注册以 `(commandId, handlerId)` 与平台登记记录配对；打开卡片命令载荷非法时
 * 如实上报失败（`ok: false`），不静默成功。
 */
export function createAppCommandHandlers(
  actions: CommunityCommandActions,
  notify: (status: AppCommandStatus) => void,
): readonly ICommandLocalRegistration[] {
  const byHandlerId = new Map<string, (payload: unknown) => void>();

  byHandlerId.set(APP_COMMAND_HANDLER_IDS.openCard, (payload: unknown): void => {
    const path = readOpenCardPayloadPath(payload);
    if (path === null) {
      notify({ commandId: APP_COMMAND_IDS.openCard, handlerId: 'open-card', ok: false });
      return;
    }
    actions.openCard(path);
    notify({ commandId: APP_COMMAND_IDS.openCard, handlerId: 'open-card', ok: true });
  });

  byHandlerId.set(APP_COMMAND_HANDLER_IDS.refreshView, (): void => {
    actions.refreshView();
    notify({ commandId: APP_COMMAND_IDS.refreshView, handlerId: 'refresh-view', ok: true });
  });

  return appCommandDefinitions.map((definition) => {
    const handlerId = (definition.handlerId ?? '') as AppCommandHandlerId;
    const handler = byHandlerId.get(handlerId);
    return {
      commandId: definition.id,
      handlerId,
      handler: (payload: unknown): void => {
        handler?.(payload);
      },
    };
  });
}

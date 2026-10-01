import type { ICommandDefinition } from '@chips/sdk';
import type { ICommandLocalRegistration } from '@chips/ui';

/** 插件 ID（与 manifest.id 一致）。 */
export const APP_PLUGIN_ID = 'chips.official.resource-manager';

/** 命令命名空间：取插件 ID 末段（《13-命令系统契约》§2.1）。 */
export const APP_COMMAND_DOMAIN = 'resource-manager';

/** 运行时命令 ID；与 manifest `cli.commands` 声明逐字对应。 */
export const APP_COMMAND_IDS = {
  openCard: 'resource-manager:open-card',
  refreshView: 'resource-manager:refresh-view',
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
 * 快捷键文法见《13-命令系统契约》§2.6。资源管理器不声明文件关联（§1.4 规则 5），
 * `open-card` 为显式打开臂入口；批量组织（重命名/移动/删除/批量标签）属写臂，
 * 候 `resource:write` 注册（工单036 后续段）后按 §五 增补命令。
 */
export const appCommandDefinitions: readonly ICommandDefinition[] = [
  {
    id: APP_COMMAND_IDS.openCard,
    title: '打开文档浏览',
    description: '按来源引用打开指定卡片或箱子并进入只读浏览',
    shortcut: 'CommandOrControl+O',
    scope: { kind: 'app', appId: APP_PLUGIN_ID },
    handlerId: APP_COMMAND_HANDLER_IDS.openCard,
    keywords: ['open', 'card', 'box', '打开', '浏览', '资源'],
    group: '文件',
  },
  {
    id: APP_COMMAND_IDS.refreshView,
    title: '刷新当前视图',
    description: '重新读取当前浏览文档的元数据与条目',
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

/** 命令业务动作：本地处理器解析载荷后调用的领域入口（由界面层装配）。 */
export interface BrowseCommandActions {
  /** 打开来源引用指向的卡片/箱子并进入浏览。 */
  openCard(path: string): void;
  /** 刷新当前浏览视图。 */
  refreshView(): void;
}

/** 派发执行记录：本地处理器执行后上报给界面层消费。 */
export interface AppCommandStatus {
  readonly commandId: string;
  readonly handlerId: AppCommandHandlerId;
  readonly ok: boolean;
}

/**
 * 构造与 `command:invoked` 派发配对的本地处理器集合（《13-命令系统契约》§5.6）。
 *
 * 每条注册以 `(commandId, handlerId)` 与平台登记记录配对；载荷按命令语义防御性收窄，
 * 非法载荷如实上报失败，不静默忽略。
 */
export function createAppCommandHandlers(
  actions: BrowseCommandActions,
  notify: (status: AppCommandStatus) => void,
): readonly ICommandLocalRegistration[] {
  const handlers: Readonly<Record<AppCommandHandlerId, (payload: unknown) => void>> = {
    'open-card': (payload: unknown): void => {
      const path = readPayloadPath(payload);
      if (path === null) {
        notify({ commandId: APP_COMMAND_IDS.openCard, handlerId: 'open-card', ok: false });
        return;
      }
      actions.openCard(path);
      notify({ commandId: APP_COMMAND_IDS.openCard, handlerId: 'open-card', ok: true });
    },
    'refresh-view': (): void => {
      actions.refreshView();
      notify({ commandId: APP_COMMAND_IDS.refreshView, handlerId: 'refresh-view', ok: true });
    },
  };

  return appCommandDefinitions.map((definition) => {
    const handlerId = (definition.handlerId ?? '') as AppCommandHandlerId;
    return {
      commandId: definition.id,
      handlerId,
      handler: (payload: unknown): void => {
        handlers[handlerId](payload);
      },
    };
  });
}

/** 打开命令载荷收窄：`{ path: 非空字符串 }`，其余形状一律拒绝。 */
function readPayloadPath(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }
  const candidate = (payload as { path?: unknown }).path;
  if (typeof candidate !== 'string' || candidate.trim().length === 0) {
    return null;
  }
  return candidate.trim();
}

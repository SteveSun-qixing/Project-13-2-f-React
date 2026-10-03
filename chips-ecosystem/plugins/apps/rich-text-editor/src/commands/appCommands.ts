import type { ICommandDefinition } from '@chips/sdk';
import type { ICommandLocalRegistration } from '@chips/ui';

/** 插件 ID（与 manifest.id 一致）。 */
export const APP_PLUGIN_ID = 'chips.official.rich-text-editor';

/** 命令命名空间：取插件 ID 末段（《13-命令系统契约》§2.1）。 */
export const APP_COMMAND_DOMAIN = 'rich-text-editor';

/** 运行时命令 ID；与 manifest `cli.commands` 声明逐字对应（顺序一致）。 */
export const APP_COMMAND_IDS = {
  openCard: 'rich-text-editor:open-card',
  saveDocument: 'rich-text-editor:save-document',
  exportDocument: 'rich-text-editor:export-document',
  newCard: 'rich-text-editor:new-card',
  refreshView: 'rich-text-editor:refresh-view',
} as const;

/** ui 目标命令的本地处理器标识（《13-命令系统契约》§2.2，与注册记录配对；顺序与命令族一致）。 */
export const APP_COMMAND_HANDLER_IDS = {
  openCard: 'open-card',
  saveDocument: 'save-document',
  exportDocument: 'export-document',
  newCard: 'new-card',
  refreshView: 'refresh-view',
} as const;

/**
 * 可序列化命令元数据：注册进平台命令注册表的纯数据对象。
 *
 * 全部字段为 JSON 可往返的普通数据（无函数、无类实例）；界面文案简体中文直写，
 * 快捷键文法见《13-命令系统契约》§2.6。命令族与 manifest `cli.commands` 一一对应，
 * 派发消费经 `command:invoked` 按 `(commandId, handlerId)` 配对（§5.6）。
 */
export const appCommandDefinitions: readonly ICommandDefinition[] = [
  {
    id: APP_COMMAND_IDS.openCard,
    title: '打开卡片',
    description: '打开指定的卡片文件并在主窗口中编辑',
    shortcut: 'CommandOrControl+O',
    scope: { kind: 'app', appId: APP_PLUGIN_ID },
    handlerId: APP_COMMAND_HANDLER_IDS.openCard,
    keywords: ['open', 'card', '打开', '卡片'],
    group: '文件',
  },
  {
    id: APP_COMMAND_IDS.saveDocument,
    title: '保存当前文档',
    description: '完成待提交回流并把当前文档落盘（document:save）',
    shortcut: 'CommandOrControl+S',
    scope: { kind: 'app', appId: APP_PLUGIN_ID },
    handlerId: APP_COMMAND_HANDLER_IDS.saveDocument,
    keywords: ['save', '保存', '落盘'],
    group: '文件',
  },
  {
    id: APP_COMMAND_IDS.exportDocument,
    title: '导出当前文档',
    description: '把当前文档导出为归档或目录形态（document:export；宿主实现在途）',
    scope: { kind: 'app', appId: APP_PLUGIN_ID },
    handlerId: APP_COMMAND_HANDLER_IDS.exportDocument,
    keywords: ['export', '导出', '另存'],
    group: '文件',
  },
  {
    id: APP_COMMAND_IDS.newCard,
    title: '新建富文本卡片',
    description: '在指定落点新建富文本卡片（document:create；宿主实现在途）',
    scope: { kind: 'app', appId: APP_PLUGIN_ID },
    handlerId: APP_COMMAND_HANDLER_IDS.newCard,
    keywords: ['new', 'create', '新建', '卡片'],
    group: '文件',
  },
  {
    id: APP_COMMAND_IDS.refreshView,
    title: '刷新当前视图',
    description: '重新拉取当前展示数据',
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
export interface RichTextCommandActions {
  /** 打开来源引用指向的卡片/箱子并定位。 */
  openCard(path: string): void;
  /** 保存当前文档（flush + document:save）。 */
  saveDocument(): void;
  /** 导出当前文档（document:export；宿主实现在途时如实呈现错误）。 */
  exportDocument(): void;
  /** 新建富文本卡片（document:create；宿主实现在途时如实呈现错误）。 */
  newCard(): void;
  /** 刷新当前视图。 */
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
  actions: RichTextCommandActions,
  notify: (status: AppCommandStatus) => void
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
    'save-document': (): void => {
      actions.saveDocument();
      notify({ commandId: APP_COMMAND_IDS.saveDocument, handlerId: 'save-document', ok: true });
    },
    'export-document': (): void => {
      actions.exportDocument();
      notify({ commandId: APP_COMMAND_IDS.exportDocument, handlerId: 'export-document', ok: true });
    },
    'new-card': (): void => {
      actions.newCard();
      notify({ commandId: APP_COMMAND_IDS.newCard, handlerId: 'new-card', ok: true });
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

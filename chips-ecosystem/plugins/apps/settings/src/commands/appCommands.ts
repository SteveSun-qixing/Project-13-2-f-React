import type { ICommandDefinition } from '@chips/sdk';
import type { ICommandLocalRegistration } from '@chips/ui';
import { SETTINGS_SCENES } from '../domain/settings/catalog';

/** 插件 ID（与 manifest.id 一致）。 */
export const APP_PLUGIN_ID = 'chips.official.settings';

/** 命令命名空间：取插件 ID 末段（《13-命令系统契约》§2.1）。 */
export const APP_COMMAND_DOMAIN = 'settings';

/**
 * 运行时命令 ID。
 *
 * - `settings:refresh-view`：与 manifest `cli.commands` 声明逐字对应（CLI 刷新入口）；
 * - `settings:open-<sceneId>`：九类分类跳转命令（《05-生态设置面板设计》§2.3——每个 Scene
 *   对应一个稳定命令 ID，经命令系统注册与调用）；文法按《13-命令系统契约》§2.1
 *   `<domain>:<action>`（设计文档 §2.3 点号旧记法以契约文法收口，随开发日志勘误候裁）。
 *   分类命令不进 manifest `cli.commands`（CLI 消费入口语义不适用，判例同 video-player 播放控制族）。
 */
export const APP_COMMAND_IDS = {
  refreshView: 'settings:refresh-view',
  appearance: 'settings:open-appearance',
  behavior: 'settings:open-behavior',
  workspace: 'settings:open-workspace',
  plugins: 'settings:open-plugins',
  permissions: 'settings:open-permissions',
  shortcuts: 'settings:open-shortcuts',
  'file-open': 'settings:open-file-open',
  storage: 'settings:open-storage',
  about: 'settings:open-about',
} as const;

/** ui 目标命令的本地处理器标识（《13-命令系统契约》§2.2，与注册记录配对）。 */
export const APP_COMMAND_HANDLER_IDS = {
  refreshView: 'refresh-view',
  appearance: 'open-appearance',
  behavior: 'open-behavior',
  workspace: 'open-workspace',
  plugins: 'open-plugins',
  permissions: 'open-permissions',
  shortcuts: 'open-shortcuts',
  'file-open': 'open-file-open',
  storage: 'open-storage',
  about: 'open-about',
} as const;

/** 分类跳转命令的界面分组。 */
const SCENE_COMMAND_GROUP = '分类导航';

/**
 * 可序列化命令元数据：注册进平台命令注册表的纯数据对象。
 *
 * 全部字段为 JSON 可往返的普通数据（无函数、无类实例）；界面文案简体中文直写，
 * 快捷键文法见《13-命令系统契约》§2.6。
 */
export const appCommandDefinitions: readonly ICommandDefinition[] = [
  {
    id: APP_COMMAND_IDS.refreshView,
    title: '刷新当前视图',
    description: '重新读取偏好快照并刷新设置面板展示',
    shortcut: 'F5',
    scope: { kind: 'app', appId: APP_PLUGIN_ID },
    handlerId: APP_COMMAND_HANDLER_IDS.refreshView,
    keywords: ['refresh', '刷新'],
    group: '视图',
  },
  ...SETTINGS_SCENES.map(
    (scene): ICommandDefinition => ({
      id: scene.commandId,
      title: `打开${scene.title}设置`,
      description: `跳转到设置面板的「${scene.title}」分类`,
      scope: { kind: 'app', appId: APP_PLUGIN_ID },
      handlerId: APP_COMMAND_HANDLER_IDS[scene.id as keyof typeof APP_COMMAND_HANDLER_IDS],
      keywords: [scene.id, scene.title],
      group: SCENE_COMMAND_GROUP,
    }),
  ),
];

export type AppCommandId = (typeof APP_COMMAND_IDS)[keyof typeof APP_COMMAND_IDS];
export type AppCommandHandlerId =
  (typeof APP_COMMAND_HANDLER_IDS)[keyof typeof APP_COMMAND_HANDLER_IDS];

const APP_COMMAND_ID_SET: ReadonlySet<string> = new Set<string>(Object.values(APP_COMMAND_IDS));

/** 判定命令 ID 是否属于本应用的命令记录（可见性由平台保证，此守卫为防御性复核）。 */
export function isAppCommandId(commandId: string): boolean {
  return APP_COMMAND_ID_SET.has(commandId);
}

/** 命令业务动作：本地处理器解析后调用的界面入口（由界面层装配）。 */
export interface SettingsCommandActions {
  /** 跳转到指定分类（未知分类如实拒绝）。 */
  openScene(sceneId: string): void;
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
 * 每条注册以 `(commandId, handlerId)` 与平台登记记录配对；分类命令载荷可省略或
 * 携带 `{ sceneId }` 复核字段（不一致如实上报失败）。
 */
export function createAppCommandHandlers(
  actions: SettingsCommandActions,
  notify: (status: AppCommandStatus) => void,
): readonly ICommandLocalRegistration[] {
  const byHandlerId = new Map<string, (payload: unknown) => void>();

  byHandlerId.set(APP_COMMAND_HANDLER_IDS.refreshView, (): void => {
    actions.refreshView();
    notify({ commandId: APP_COMMAND_IDS.refreshView, handlerId: 'refresh-view', ok: true });
  });

  for (const scene of SETTINGS_SCENES) {
    const handlerId = APP_COMMAND_HANDLER_IDS[scene.id as keyof typeof APP_COMMAND_HANDLER_IDS];
    byHandlerId.set(handlerId, (payload: unknown): void => {
      const payloadShape = readPayloadScene(payload);
      if (payloadShape.kind === 'invalid' || (payloadShape.kind === 'ok' && payloadShape.sceneId !== scene.id)) {
        notify({ commandId: scene.commandId, handlerId, ok: false });
        return;
      }
      actions.openScene(scene.id);
      notify({ commandId: scene.commandId, handlerId, ok: true });
    });
  }

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

/** 分类命令载荷收窄：可省略（缺 `sceneId` 字段）；给出时必须为非空字符串，其余形状非法。 */
function readPayloadScene(
  payload: unknown,
): { kind: 'absent' } | { kind: 'ok'; sceneId: string } | { kind: 'invalid' } {
  if (payload === undefined) {
    return { kind: 'absent' };
  }
  if (typeof payload !== 'object' || payload === null) {
    return { kind: 'invalid' };
  }
  const record = payload as Record<string, unknown>;
  if (!('sceneId' in record)) {
    return { kind: 'absent' };
  }
  const candidate = record['sceneId'];
  return typeof candidate === 'string' && candidate.length > 0
    ? { kind: 'ok', sceneId: candidate }
    : { kind: 'invalid' };
}

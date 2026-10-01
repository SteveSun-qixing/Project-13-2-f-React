import type { ICommandDefinition } from '@chips/sdk';
import type { ICommandLocalRegistration } from '@chips/ui';

/** 插件 ID（与 manifest.id 一致）。 */
export const APP_PLUGIN_ID = 'chips.official.universal-file-viewer';

/** 命令命名空间：取插件 ID 末段（《13-命令系统契约》§2.1）。 */
export const APP_COMMAND_DOMAIN = 'universal-file-viewer';

/**
 * 运行时命令 ID；与 manifest `cli.commands` 声明逐字对应。
 *
 * 文法 `<domain>:<action>`（13-契约 §2.1：全小写、字母数字连字符、单冒号）。
 * 查看命令族与《03-查看器设计》§8.3 万能查看器形态对齐：
 * 打开 / 刷新 / 队列导航 / 缩放 / 旋转 / 格式信息 / 全屏 / 打印；
 * 内容级缩放旋转由引擎视图命令承担（zoom/rotate 直接驱动引擎 command 通道）。
 */
export const APP_COMMAND_IDS = {
  openCard: 'universal-file-viewer:open-card',
  refreshView: 'universal-file-viewer:refresh-view',
  previousFile: 'universal-file-viewer:previous-file',
  nextFile: 'universal-file-viewer:next-file',
  zoomIn: 'universal-file-viewer:zoom-in',
  zoomOut: 'universal-file-viewer:zoom-out',
  zoomReset: 'universal-file-viewer:zoom-reset',
  rotateLeft: 'universal-file-viewer:rotate-left',
  rotateRight: 'universal-file-viewer:rotate-right',
  toggleInfo: 'universal-file-viewer:toggle-info',
  fullscreen: 'universal-file-viewer:fullscreen',
  print: 'universal-file-viewer:print',
} as const;

/** ui 目标命令的本地处理器标识（《13-命令系统契约》§2.2，与注册记录配对）。 */
export const APP_COMMAND_HANDLER_IDS = {
  openCard: 'open-card',
  refreshView: 'refresh-view',
  previousFile: 'previous-file',
  nextFile: 'next-file',
  zoomIn: 'zoom-in',
  zoomOut: 'zoom-out',
  zoomReset: 'zoom-reset',
  rotateLeft: 'rotate-left',
  rotateRight: 'rotate-right',
  toggleInfo: 'toggle-info',
  fullscreen: 'fullscreen',
  print: 'print',
} as const;

function viewerCommand(
  id: string,
  handlerId: string,
  title: string,
  description: string,
  group: string,
  keywords: readonly string[],
  shortcut?: string
): ICommandDefinition {
  return {
    id,
    title,
    description,
    ...(shortcut === undefined ? {} : { shortcut }),
    scope: { kind: 'app', appId: APP_PLUGIN_ID },
    handlerId,
    keywords: [...keywords],
    group,
  };
}

/**
 * 可序列化命令元数据：注册进平台命令注册表的纯数据对象。
 *
 * 全部字段为 JSON 可往返的普通数据（无函数、无类实例）；界面文案简体中文直写，
 * 快捷键文法见《13-命令系统契约》§2.6（内容键位由查看交互层经命令派发消费，
 * 此处只登记跨上下文有意义的全局键位）。
 */
export const appCommandDefinitions: readonly ICommandDefinition[] = [
  {
    id: APP_COMMAND_IDS.openCard,
    title: '打开卡片',
    description: '打开指定的卡片文件并在主窗口中展示',
    shortcut: 'CommandOrControl+O',
    scope: { kind: 'app', appId: APP_PLUGIN_ID },
    handlerId: APP_COMMAND_HANDLER_IDS.openCard,
    keywords: ['open', 'card', '打开', '卡片'],
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
  viewerCommand(
    APP_COMMAND_IDS.previousFile,
    APP_COMMAND_HANDLER_IDS.previousFile,
    '上一个文件',
    '切换到队列中的上一个文件',
    '视图',
    ['previous', 'file', '上一个', '切换'],
    'CommandOrControl+Left'
  ),
  viewerCommand(
    APP_COMMAND_IDS.nextFile,
    APP_COMMAND_HANDLER_IDS.nextFile,
    '下一个文件',
    '切换到队列中的下一个文件',
    '视图',
    ['next', 'file', '下一个', '切换'],
    'CommandOrControl+Right'
  ),
  viewerCommand(
    APP_COMMAND_IDS.zoomIn,
    APP_COMMAND_HANDLER_IDS.zoomIn,
    '放大',
    '放大当前预览视图',
    '视图',
    ['zoom', 'in', '放大'],
    'CommandOrControl+='
  ),
  viewerCommand(
    APP_COMMAND_IDS.zoomOut,
    APP_COMMAND_HANDLER_IDS.zoomOut,
    '缩小',
    '缩小当前预览视图',
    '视图',
    ['zoom', 'out', '缩小'],
    'CommandOrControl+-'
  ),
  viewerCommand(
    APP_COMMAND_IDS.zoomReset,
    APP_COMMAND_HANDLER_IDS.zoomReset,
    '重置缩放',
    '恢复预览视图的默认缩放',
    '视图',
    ['zoom', 'reset', '缩放', '重置'],
    'CommandOrControl+0'
  ),
  viewerCommand(
    APP_COMMAND_IDS.rotateLeft,
    APP_COMMAND_HANDLER_IDS.rotateLeft,
    '向左旋转',
    '当前预览视图向左旋转 90°',
    '视图',
    ['rotate', 'left', '左转', '旋转']
  ),
  viewerCommand(
    APP_COMMAND_IDS.rotateRight,
    APP_COMMAND_HANDLER_IDS.rotateRight,
    '向右旋转',
    '当前预览视图向右旋转 90°',
    '视图',
    ['rotate', 'right', '右转', '旋转']
  ),
  viewerCommand(
    APP_COMMAND_IDS.toggleInfo,
    APP_COMMAND_HANDLER_IDS.toggleInfo,
    '格式信息',
    '显示或隐藏当前文件的格式信息面板',
    '视图',
    ['info', 'format', '格式', '信息'],
    'CommandOrControl+I'
  ),
  viewerCommand(
    APP_COMMAND_IDS.fullscreen,
    APP_COMMAND_HANDLER_IDS.fullscreen,
    '全屏',
    '切换预览视图的全屏显示',
    '视图',
    ['fullscreen', '全屏'],
    'F11'
  ),
  viewerCommand(
    APP_COMMAND_IDS.print,
    APP_COMMAND_HANDLER_IDS.print,
    '打印',
    '打印当前预览内容',
    '文件',
    ['print', '打印'],
    'CommandOrControl+P'
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

/** 派发执行记录：本地处理器执行后上报给界面层消费。 */
export interface AppCommandStatus {
  readonly commandId: string;
  readonly handlerId: AppCommandHandlerId;
  readonly payload: unknown;
}

/** 本地命令执行器：由查看场景注入，按命令 ID 施加查看控制效应。 */
export type AppCommandExecutor = (status: AppCommandStatus) => void;

/**
 * 构造与 `command:invoked` 派发配对的本地处理器集合（《13-命令系统契约》§5.6）。
 *
 * 每条注册以 `(commandId, handlerId)` 与平台登记记录配对；处理器体把执行记录
 * 交给注入的执行器（查看场景据此切换视图、驱动引擎缩放旋转与开关面板），
 * 执行器不可自选注册通道。
 */
export function createAppCommandHandlers(
  execute: AppCommandExecutor
): readonly ICommandLocalRegistration[] {
  return appCommandDefinitions.map((definition) => {
    const handlerId = (definition.handlerId ?? '') as AppCommandHandlerId;
    return {
      commandId: definition.id,
      handlerId,
      handler: (payload: unknown): void => {
        execute({ commandId: definition.id, handlerId, payload });
      },
    };
  });
}

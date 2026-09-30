import type { ICommandDefinition } from '@chips/sdk';
import type { ICommandLocalRegistration } from '@chips/ui';

/**
 * 命令元数据与本地处理器集合（《13-命令系统契约》）。
 *
 * - `open-card` / `refresh-view` 与 manifest `cli.commands` 逐字对应（ID、title、description）；
 *   两者由 manifest 声明 CLI 消费入口，本表承载运行时命令记录的同 ID 元数据。
 * - 播放控制命令族（toggle-playback 等）为 ui 目标命令：由渲染会话经 `command:register`
 *   登记（§2.3），经命令面板等入口消费；窗口内键位交互由播放器键盘 hook 承载
 *   （《03-查看器设计》§10.1 媒体键位），本表不重复声明 `shortcut`，避免平台窗口级
 *   快捷键派发通道交付后出现双重绑定。
 * - 全部字段为 JSON 可往返的普通数据；界面文案简体中文直写（R5）。
 */

/** 插件 ID（与 manifest.id 一致）。 */
export const APP_PLUGIN_ID = 'chips.official.video-player';

/** 命令命名空间：取插件 ID 末段（《13-命令系统契约》§2.1）。 */
export const APP_COMMAND_DOMAIN = 'video-player';

/** 运行时命令 ID；`open-card` / `refresh-view` 与 manifest `cli.commands[].commandId` 逐字一致。 */
export const APP_COMMAND_IDS = {
  openCard: 'video-player:open-card',
  refreshView: 'video-player:refresh-view',
  togglePlayback: 'video-player:toggle-playback',
  seekForward: 'video-player:seek-forward',
  seekBackward: 'video-player:seek-backward',
  toggleMute: 'video-player:toggle-mute',
  cyclePlaybackRate: 'video-player:cycle-playback-rate',
  toggleLoop: 'video-player:toggle-loop',
  toggleFullscreen: 'video-player:toggle-fullscreen',
  togglePictureInPicture: 'video-player:toggle-picture-in-picture',
} as const;

/** ui 目标命令的本地处理器标识（《13-命令系统契约》§2.2，与注册记录配对）。 */
export const APP_COMMAND_HANDLER_IDS = {
  openCard: 'open-card',
  refreshView: 'refresh-view',
  togglePlayback: 'toggle-playback',
  seekForward: 'seek-forward',
  seekBackward: 'seek-backward',
  toggleMute: 'toggle-mute',
  cyclePlaybackRate: 'cycle-playback-rate',
  toggleLoop: 'toggle-loop',
  toggleFullscreen: 'toggle-fullscreen',
  togglePictureInPicture: 'toggle-picture-in-picture',
} as const;

/** 本地处理器动作签名：payload 为命令派发载荷（结构化克隆兼容）。 */
export type AppCommandAction = (payload: unknown) => void;

/** 播放控制命令的本地动作映射；界面层以控制器方法装配。 */
export interface AppCommandActionMap {
  openCard?: AppCommandAction;
  refreshView?: AppCommandAction;
  togglePlayback?: AppCommandAction;
  seekForward?: AppCommandAction;
  seekBackward?: AppCommandAction;
  toggleMute?: AppCommandAction;
  cyclePlaybackRate?: AppCommandAction;
  toggleLoop?: AppCommandAction;
  toggleFullscreen?: AppCommandAction;
  togglePictureInPicture?: AppCommandAction;
}

/**
 * 可序列化命令元数据：注册进平台命令注册表的纯数据对象。
 *
 * 播放控制命令的 `description` 携带键位提示（括注窗口内键位），便于命令面板检索。
 */
export const appCommandDefinitions: readonly ICommandDefinition[] = [
  {
    id: APP_COMMAND_IDS.openCard,
    title: '打开卡片',
    description: '通过「视频播放器」打开指定卡片文件',
    shortcut: 'CommandOrControl+O',
    scope: { kind: 'app', appId: APP_PLUGIN_ID },
    handlerId: APP_COMMAND_HANDLER_IDS.openCard,
    keywords: ['open', 'card', '打开', '卡片', '视频'],
    group: '文件',
  },
  {
    id: APP_COMMAND_IDS.refreshView,
    title: '刷新当前视图',
    description: '请求「视频播放器」重新拉取当前展示数据',
    shortcut: 'F5',
    scope: { kind: 'app', appId: APP_PLUGIN_ID },
    handlerId: APP_COMMAND_HANDLER_IDS.refreshView,
    keywords: ['refresh', '刷新'],
    group: '视图',
  },
  {
    id: APP_COMMAND_IDS.togglePlayback,
    title: '播放或暂停',
    description: '切换当前视频的播放状态（空格 / K）',
    scope: { kind: 'app', appId: APP_PLUGIN_ID },
    handlerId: APP_COMMAND_HANDLER_IDS.togglePlayback,
    keywords: ['play', 'pause', '播放', '暂停'],
    group: '播放控制',
  },
  {
    id: APP_COMMAND_IDS.seekForward,
    title: '前进 5 秒',
    description: '当前视频快进 5 秒（→，Shift+→ 快进 30 秒）',
    scope: { kind: 'app', appId: APP_PLUGIN_ID },
    handlerId: APP_COMMAND_HANDLER_IDS.seekForward,
    keywords: ['seek', 'forward', '快进', '前进'],
    group: '播放控制',
  },
  {
    id: APP_COMMAND_IDS.seekBackward,
    title: '后退 5 秒',
    description: '当前视频快退 5 秒（←，Shift+← 快退 30 秒）',
    scope: { kind: 'app', appId: APP_PLUGIN_ID },
    handlerId: APP_COMMAND_HANDLER_IDS.seekBackward,
    keywords: ['seek', 'backward', '快退', '后退'],
    group: '播放控制',
  },
  {
    id: APP_COMMAND_IDS.toggleMute,
    title: '静音或取消静音',
    description: '切换当前视频的静音状态（M）',
    scope: { kind: 'app', appId: APP_PLUGIN_ID },
    handlerId: APP_COMMAND_HANDLER_IDS.toggleMute,
    keywords: ['mute', '静音', '音量'],
    group: '播放控制',
  },
  {
    id: APP_COMMAND_IDS.cyclePlaybackRate,
    title: '切换倍速',
    description: '在 0.5x 至 2x 的倍速序列中循环切换',
    scope: { kind: 'app', appId: APP_PLUGIN_ID },
    handlerId: APP_COMMAND_HANDLER_IDS.cyclePlaybackRate,
    keywords: ['rate', 'speed', '倍速', '速度'],
    group: '播放控制',
  },
  {
    id: APP_COMMAND_IDS.toggleLoop,
    title: '循环播放',
    description: '开启或关闭当前视频的循环播放',
    scope: { kind: 'app', appId: APP_PLUGIN_ID },
    handlerId: APP_COMMAND_HANDLER_IDS.toggleLoop,
    keywords: ['loop', '循环', '重复'],
    group: '播放控制',
  },
  {
    id: APP_COMMAND_IDS.toggleFullscreen,
    title: '切换全屏',
    description: '进入或退出视频全屏模式（F）',
    scope: { kind: 'app', appId: APP_PLUGIN_ID },
    handlerId: APP_COMMAND_HANDLER_IDS.toggleFullscreen,
    keywords: ['fullscreen', '全屏'],
    group: '画面',
  },
  {
    id: APP_COMMAND_IDS.togglePictureInPicture,
    title: '切换画中画',
    description: '进入或退出视频画中画模式（P）',
    scope: { kind: 'app', appId: APP_PLUGIN_ID },
    handlerId: APP_COMMAND_HANDLER_IDS.togglePictureInPicture,
    keywords: ['picture', 'pip', '画中画'],
    group: '画面',
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

/** 派发执行记录：本地处理器执行后上报给界面层消费。 */
export interface AppCommandStatus {
  readonly commandId: string;
  readonly handlerId: AppCommandHandlerId;
  readonly payload: unknown;
}

/**
 * 构造与 `command:invoked` 派发配对的本地处理器集合（《13-命令系统契约》§5.6）。
 *
 * 每条注册以 `(commandId, handlerId)` 与平台登记记录配对；处理器体在派发时经
 * `resolveActions()` 现取动作表（界面层控制器对象按渲染换代，动作表取最新引用），
 * 执行缺位动作静默跳过（空态/能力未就绪时命令派发不产生效应），再把执行记录上报界面层。
 */
export function createAppCommandHandlers(
  resolveActions: () => AppCommandActionMap,
  notify: (status: AppCommandStatus) => void,
): readonly ICommandLocalRegistration[] {
  return appCommandDefinitions.map((definition) => {
    const handlerId = (definition.handlerId ?? '') as AppCommandHandlerId;
    return {
      commandId: definition.id,
      handlerId,
      handler: (payload: unknown): void => {
        resolveActions()[handlerIdToActionKey(handlerId)]?.(payload);
        notify({ commandId: definition.id, handlerId, payload });
      },
    };
  });
}

/** handlerId 与动作键同形，此处做显式映射以免索引签名漂移。 */
function handlerIdToActionKey(handlerId: string): keyof AppCommandActionMap {
  switch (handlerId) {
    case APP_COMMAND_HANDLER_IDS.openCard:
      return 'openCard';
    case APP_COMMAND_HANDLER_IDS.refreshView:
      return 'refreshView';
    case APP_COMMAND_HANDLER_IDS.togglePlayback:
      return 'togglePlayback';
    case APP_COMMAND_HANDLER_IDS.seekForward:
      return 'seekForward';
    case APP_COMMAND_HANDLER_IDS.seekBackward:
      return 'seekBackward';
    case APP_COMMAND_HANDLER_IDS.toggleMute:
      return 'toggleMute';
    case APP_COMMAND_HANDLER_IDS.cyclePlaybackRate:
      return 'cyclePlaybackRate';
    case APP_COMMAND_HANDLER_IDS.toggleLoop:
      return 'toggleLoop';
    case APP_COMMAND_HANDLER_IDS.toggleFullscreen:
      return 'toggleFullscreen';
    case APP_COMMAND_HANDLER_IDS.togglePictureInPicture:
      return 'togglePictureInPicture';
    default:
      return 'togglePlayback';
  }
}

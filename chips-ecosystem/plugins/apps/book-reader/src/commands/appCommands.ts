import type { ICommandDefinition } from '@chips/sdk';
import type { ICommandLocalRegistration } from '@chips/ui';

/** 插件 ID（与 manifest.id 一致）。 */
export const APP_PLUGIN_ID = 'chips.official.book-reader';

/** 命令命名空间：取插件 ID 末段（《13-命令系统契约》§2.1）。 */
export const APP_COMMAND_DOMAIN = 'book-reader';

/**
 * 运行时命令 ID；与 manifest `cli.commands` 声明逐字对应。
 *
 * 文法 `<domain>:<action>`（13-契约 §2.1：全小写、字母数字连字符、单冒号）。
 * 阅读控制命令族与《03-查看器设计》§8.2 书籍阅读器能力（翻页/目录/书签/搜索/偏好）对齐。
 */
export const APP_COMMAND_IDS = {
  openCard: 'book-reader:open-card',
  refreshView: 'book-reader:refresh-view',
  previousPage: 'book-reader:previous-page',
  nextPage: 'book-reader:next-page',
  previousSection: 'book-reader:previous-section',
  nextSection: 'book-reader:next-section',
  goSectionStart: 'book-reader:go-section-start',
  goSectionEnd: 'book-reader:go-section-end',
  toggleContents: 'book-reader:toggle-contents',
  toggleBookmarks: 'book-reader:toggle-bookmarks',
  togglePreferences: 'book-reader:toggle-preferences',
  toggleSearch: 'book-reader:toggle-search',
  closePanel: 'book-reader:close-panel',
  increaseFont: 'book-reader:increase-font',
  decreaseFont: 'book-reader:decrease-font',
  widenContent: 'book-reader:widen-content',
  narrowContent: 'book-reader:narrow-content',
  toggleBookmark: 'book-reader:toggle-bookmark',
} as const;

/** ui 目标命令的本地处理器标识（《13-命令系统契约》§2.2，与注册记录配对）。 */
export const APP_COMMAND_HANDLER_IDS = {
  openCard: 'open-card',
  refreshView: 'refresh-view',
  previousPage: 'previous-page',
  nextPage: 'next-page',
  previousSection: 'previous-section',
  nextSection: 'next-section',
  goSectionStart: 'go-section-start',
  goSectionEnd: 'go-section-end',
  toggleContents: 'toggle-contents',
  toggleBookmarks: 'toggle-bookmarks',
  togglePreferences: 'toggle-preferences',
  toggleSearch: 'toggle-search',
  closePanel: 'close-panel',
  increaseFont: 'increase-font',
  decreaseFont: 'decrease-font',
  widenContent: 'widen-content',
  narrowContent: 'narrow-content',
  toggleBookmark: 'toggle-bookmark',
} as const;

function readingCommand(
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
 * 快捷键文法见《13-命令系统契约》§2.6（内容键位由阅读交互层经命令派发消费，
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
  readingCommand(
    APP_COMMAND_IDS.previousPage,
    APP_COMMAND_HANDLER_IDS.previousPage,
    '上一页',
    '向前翻动一页（滚动模式下向上滚动一屏）',
    '阅读',
    ['previous', 'page', '上一页', '翻页']
  ),
  readingCommand(
    APP_COMMAND_IDS.nextPage,
    APP_COMMAND_HANDLER_IDS.nextPage,
    '下一页',
    '向后翻动一页（滚动模式下向下滚动一屏）',
    '阅读',
    ['next', 'page', '下一页', '翻页']
  ),
  readingCommand(
    APP_COMMAND_IDS.previousSection,
    APP_COMMAND_HANDLER_IDS.previousSection,
    '上一章',
    '跳转到上一个章节（快捷键 P）',
    '阅读',
    ['section', 'chapter', '上一章', '章节'],
    'P'
  ),
  readingCommand(
    APP_COMMAND_IDS.nextSection,
    APP_COMMAND_HANDLER_IDS.nextSection,
    '下一章',
    '跳转到下一个章节（快捷键 N）',
    '阅读',
    ['section', 'chapter', '下一章', '章节'],
    'N'
  ),
  readingCommand(
    APP_COMMAND_IDS.goSectionStart,
    APP_COMMAND_HANDLER_IDS.goSectionStart,
    '跳到本章开头',
    '跳转到当前章节起始位置（Home）',
    '阅读',
    ['home', 'start', '本章开头', '章节起点']
  ),
  readingCommand(
    APP_COMMAND_IDS.goSectionEnd,
    APP_COMMAND_HANDLER_IDS.goSectionEnd,
    '跳到本章末尾',
    '跳转到当前章节结束位置（End）',
    '阅读',
    ['end', '本章末尾', '章节末尾']
  ),
  readingCommand(
    APP_COMMAND_IDS.toggleContents,
    APP_COMMAND_HANDLER_IDS.toggleContents,
    '目录',
    '显示或隐藏章节目录面板',
    '视图',
    ['toc', 'contents', '目录', '章节']
  ),
  readingCommand(
    APP_COMMAND_IDS.toggleBookmarks,
    APP_COMMAND_HANDLER_IDS.toggleBookmarks,
    '书签列表',
    '显示或隐藏书签列表面板',
    '视图',
    ['bookmark', '书签', '列表']
  ),
  readingCommand(
    APP_COMMAND_IDS.togglePreferences,
    APP_COMMAND_HANDLER_IDS.togglePreferences,
    '阅读偏好',
    '显示或隐藏阅读偏好面板（字号、行距、亮度与配色）',
    '视图',
    ['preference', '偏好', '字号', '配色']
  ),
  readingCommand(
    APP_COMMAND_IDS.toggleSearch,
    APP_COMMAND_HANDLER_IDS.toggleSearch,
    '搜索',
    '显示或隐藏全书搜索面板（快捷键 Ctrl/Cmd+F）',
    '视图',
    ['search', 'find', '搜索', '查找'],
    'CommandOrControl+F'
  ),
  readingCommand(
    APP_COMMAND_IDS.closePanel,
    APP_COMMAND_HANDLER_IDS.closePanel,
    '关闭面板',
    '关闭当前打开的面板（快捷键 Esc）',
    '视图',
    ['close', 'panel', '关闭', '面板'],
    'Escape'
  ),
  readingCommand(
    APP_COMMAND_IDS.increaseFont,
    APP_COMMAND_HANDLER_IDS.increaseFont,
    '增大字号',
    '按档位增大正文字号',
    '排版',
    ['font', 'size', '字号', '增大']
  ),
  readingCommand(
    APP_COMMAND_IDS.decreaseFont,
    APP_COMMAND_HANDLER_IDS.decreaseFont,
    '减小字号',
    '按档位减小正文字号',
    '排版',
    ['font', 'size', '字号', '减小']
  ),
  readingCommand(
    APP_COMMAND_IDS.widenContent,
    APP_COMMAND_HANDLER_IDS.widenContent,
    '加宽版心',
    '加大正文内容区宽度',
    '排版',
    ['width', '版心', '加宽', '宽度']
  ),
  readingCommand(
    APP_COMMAND_IDS.narrowContent,
    APP_COMMAND_HANDLER_IDS.narrowContent,
    '收窄版心',
    '收窄正文内容区宽度',
    '排版',
    ['width', '版心', '收窄', '宽度']
  ),
  readingCommand(
    APP_COMMAND_IDS.toggleBookmark,
    APP_COMMAND_HANDLER_IDS.toggleBookmark,
    '添加或移除书签',
    '在当前阅读位置添加书签；已存在书签时移除',
    '阅读',
    ['bookmark', '书签', '标记']
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

/** 本地命令执行器：由阅读场景注入，按命令 ID 施加阅读控制效应。 */
export type AppCommandExecutor = (status: AppCommandStatus) => void;

/**
 * 构造与 `command:invoked` 派发配对的本地处理器集合（《13-命令系统契约》§5.6）。
 *
 * 每条注册以 `(commandId, handlerId)` 与平台登记记录配对；处理器体把执行记录
 * 交给注入的执行器（阅读场景据此翻页、开关面板与调整排版），执行器不可自选注册通道。
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

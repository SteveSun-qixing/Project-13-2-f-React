/**
 * 界面文案层（重写件）：简体中文直写（R5），去 key 层、去 i18n 装配。
 *
 * 仅保留「媒体错误键 → 文案」一个映射：键由迁移件 `resolveMediaErrorKey` 产出，
 * 是播放引擎的稳定内部标识（非 i18n key）。其余文案以字面量写在组件内。
 */

import type { ViewerFeedback } from './player/videoPlayer';

/** 媒体错误键 → 简体中文文案（《10-官方内容处理与阅读服务设计》§3.4 语义归置）。 */
export const MEDIA_ERROR_TEXTS: Readonly<Record<string, string>> = {
  mediaAborted: '视频加载已取消。',
  mediaNetwork: '加载视频时发生网络错误。',
  mediaDecode: '当前运行时无法解码该视频（VIDEO_PLAYER_DECODE_UNSUPPORTED）。',
  mediaSource: '视频资源不可用（VIDEO_PLAYER_SOURCE_UNAVAILABLE）。',
  loadFailed: '视频加载失败，或当前运行时无法解码该视频。',
};

/** 由媒体错误键构造界面反馈。 */
export function mediaErrorFeedback(errorKey: string | null): ViewerFeedback | null {
  if (errorKey === null) {
    return null;
  }
  const message = MEDIA_ERROR_TEXTS[errorKey];
  return {
    tone: 'error',
    message: message ?? '视频加载失败，或当前运行时无法解码该视频。',
  };
}

/** 键位帮助分组（《03-查看器设计》§10.1 媒体键位行）。 */
export interface KeyHelpGroup {
  readonly title: string;
  readonly items: readonly KeyHelpItem[];
}

export interface KeyHelpItem {
  readonly keys: string;
  readonly label: string;
}

export const KEY_HELP_GROUPS: readonly KeyHelpGroup[] = [
  {
    title: '播放',
    items: [
      { keys: '空格 / K', label: '播放或暂停' },
      { keys: '← →', label: '后退 / 前进 5 秒' },
      { keys: 'Shift + ← →', label: '后退 / 前进 30 秒' },
      { keys: 'J / L', label: '后退 / 前进 10 秒' },
      { keys: 'Home / End', label: '回到开头 / 跳到末尾' },
      { keys: '0-9', label: '跳转到 0%-90%' },
      { keys: '[ ]', label: '上一帧 / 下一帧' },
    ],
  },
  {
    title: '声音',
    items: [
      { keys: '↑ ↓', label: '音量增减' },
      { keys: 'M', label: '静音' },
    ],
  },
  {
    title: '画面',
    items: [
      { keys: 'F', label: '全屏' },
      { keys: 'P', label: '画中画' },
      { keys: '双击', label: '全屏' },
    ],
  },
  {
    title: '其他',
    items: [
      { keys: '?', label: '打开快捷键帮助' },
      { keys: 'Esc', label: '关闭面板 / 退出全屏' },
    ],
  },
];

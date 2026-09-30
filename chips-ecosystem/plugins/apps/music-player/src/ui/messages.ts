/**
 * 界面文案层（重写件）：简体中文直写（R5），去 key 层、去 i18n 装配。
 *
 * 仅保留「媒体错误键 → 文案」一个映射：键由迁移件 `resolveMediaErrorKey` 产出，
 * 是播放引擎的稳定内部标识（非 i18n key）。其余文案以字面量写在组件内。
 */

import type { ViewerFeedback } from '../player/musicPlayer';

/** 媒体错误键 → 简体中文文案。 */
export const MEDIA_ERROR_TEXTS: Readonly<Record<string, string>> = {
  mediaAborted: '音频加载已取消。',
  mediaNetwork: '加载音频时发生网络错误。',
  mediaDecode: '当前运行时无法解码该音频（MUSIC_PLAYER_DECODE_UNSUPPORTED）。',
  mediaSource: '音频资源不可用（MUSIC_PLAYER_SOURCE_UNAVAILABLE）。',
  loadFailed: '音频加载失败，或当前运行时无法解码该音频。',
};

/** 由媒体错误键构造界面反馈。 */
export function mediaErrorFeedback(errorKey: string | null): ViewerFeedback | null {
  if (errorKey === null) {
    return null;
  }
  const message = MEDIA_ERROR_TEXTS[errorKey];
  return {
    tone: 'error',
    message: message ?? '音频加载失败，或当前运行时无法解码该音频。',
  };
}

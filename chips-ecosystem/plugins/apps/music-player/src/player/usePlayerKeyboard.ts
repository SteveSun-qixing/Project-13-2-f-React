/**
 * 播放器键位 hook（重写件）。
 *
 * 旧实现 `MusicPlayerStage.tsx:126` 挂接的 `controller.handleKeyDown` 为空实现（矩阵
 * 「播控/歌词/舞台 UI」行判重写的一部分）。本件承载真实窗口键位语义（《03-查看器设计》
 * 媒体键位同源口径）：空格播放暂停、←→ 快退/快进 5 秒、↑↓ 音量步进、M 静音、
 * L 循环、N/P 下一首/上一首；输入控件聚焦时不抢占（表单输入优先）。
 * 音量步进的方向语义由界面层装配（控制器持有最新音量，本件不缓存跨实例状态）。
 */

import { useCallback, useRef, type KeyboardEvent } from 'react';

const SEEK_STEP_SECONDS = 5;

/** 键位动作表：界面层以控制器方法装配（音量步进携带方向）。 */
export interface PlayerKeyboardActions {
  togglePlayback: () => void;
  seekBy: (offsetSeconds: number) => void;
  /** 音量步进：direction 为 +1（增）或 -1（减）。 */
  volumeStep: (direction: 1 | -1) => void;
  toggleMute: () => void;
  toggleLoopMode: () => void;
  goNext: () => void;
  goPrevious: () => void;
}

function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.isContentEditable)
  );
}

/** 键位表 → 动作派发；命中键位返回 true（容器可据此判定消费）。 */
export function dispatchPlayerKeyboardAction(
  actions: PlayerKeyboardActions,
  key: string,
): boolean {
  switch (key) {
    case ' ':
      actions.togglePlayback();
      return true;
    case 'ArrowLeft':
      actions.seekBy(-SEEK_STEP_SECONDS);
      return true;
    case 'ArrowRight':
      actions.seekBy(SEEK_STEP_SECONDS);
      return true;
    case 'ArrowUp':
      actions.volumeStep(1);
      return true;
    case 'ArrowDown':
      actions.volumeStep(-1);
      return true;
    case 'm':
    case 'M':
      actions.toggleMute();
      return true;
    case 'l':
    case 'L':
      actions.toggleLoopMode();
      return true;
    case 'n':
    case 'N':
      actions.goNext();
      return true;
    case 'p':
    case 'P':
      actions.goPrevious();
      return true;
    default:
      return false;
  }
}

/** 键位帮助条目（键位说明与派发表同源维护）。 */
export const PLAYER_KEY_HELP_ITEMS: readonly { keys: string; label: string }[] = [
  { keys: '空格', label: '播放或暂停' },
  { keys: '← →', label: '快退 / 快进 5 秒' },
  { keys: '↑ ↓', label: '音量增减' },
  { keys: 'M', label: '静音切换' },
  { keys: 'L', label: '单曲循环切换' },
  { keys: 'N / P', label: '下一首 / 上一首' },
];

/** 构造容器 onKeyDown 处理器：可编辑元素聚焦时不抢占键位。 */
export function usePlayerKeyboard(
  actions: PlayerKeyboardActions,
): (event: KeyboardEvent<HTMLElement>) => void {
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  return useCallback((event: KeyboardEvent<HTMLElement>) => {
    if (isEditableTarget(event.target)) {
      return;
    }
    if (dispatchPlayerKeyboardAction(actionsRef.current, event.key)) {
      event.preventDefault();
    }
  }, []);
}

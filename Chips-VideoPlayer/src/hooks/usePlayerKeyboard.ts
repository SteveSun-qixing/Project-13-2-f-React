import { useCallback, type KeyboardEvent } from "react";

export interface PlayerKeyboardActions {
  togglePlayback: () => void | Promise<void>;
  seekBy: (offsetSeconds: number) => void;
  seekToFraction: (fraction: number) => void;
  adjustVolume: (delta: number) => void;
  toggleMute: () => void;
  toggleFullscreen: () => void | Promise<void>;
  togglePictureInPicture: () => void | Promise<void>;
  openKeyHelp: () => void;
  toggleChrome: () => void;
  frameStep: (direction: "backward" | "forward") => void;
}

const FRAME_STEP_SECONDS = 1 / 24;

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  ) {
    return true;
  }

  return target.isContentEditable;
}

export function usePlayerKeyboard(actions: PlayerKeyboardActions): {
  handleKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
} {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>): void => {
      const target = event.target as HTMLElement | null;
      if (target && (target.closest("input, textarea, select") || isEditableTarget(target))) {
        return;
      }

      const withShift = event.shiftKey;

      switch (event.key) {
        case " ":
        case "k":
        case "K":
          event.preventDefault();
          void actions.togglePlayback();
          break;
        case "ArrowLeft":
          event.preventDefault();
          if (withShift) {
            actions.seekBy(-30);
          } else {
            actions.seekBy(-5);
          }
          break;
        case "ArrowRight":
          event.preventDefault();
          if (withShift) {
            actions.seekBy(30);
          } else {
            actions.seekBy(5);
          }
          break;
        case "ArrowUp":
          event.preventDefault();
          actions.adjustVolume(0.05);
          break;
        case "ArrowDown":
          event.preventDefault();
          actions.adjustVolume(-0.05);
          break;
        case "j":
        case "J":
          event.preventDefault();
          actions.seekBy(-10);
          break;
        case "l":
        case "L":
          event.preventDefault();
          actions.seekBy(10);
          break;
        case "f":
        case "F":
          event.preventDefault();
          void actions.toggleFullscreen();
          break;
        case "p":
        case "P":
          event.preventDefault();
          void actions.togglePictureInPicture();
          break;
        case "m":
        case "M":
          event.preventDefault();
          actions.toggleMute();
          break;
        case "?":
          event.preventDefault();
          actions.openKeyHelp();
          break;
        case "Home":
          event.preventDefault();
          actions.seekToFraction(0);
          break;
        case "End":
          event.preventDefault();
          actions.seekToFraction(1);
          break;
        case "[":
          event.preventDefault();
          actions.frameStep("backward");
          break;
        case "]":
          event.preventDefault();
          actions.frameStep("forward");
          break;
        default:
          if (event.key >= "0" && event.key <= "9") {
            event.preventDefault();
            actions.seekToFraction(Number(event.key) / 10);
          }
          break;
      }
    },
    [actions],
  );

  return { handleKeyDown };
}


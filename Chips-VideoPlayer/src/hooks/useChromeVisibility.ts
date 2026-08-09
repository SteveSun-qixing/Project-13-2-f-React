import { useCallback, useEffect, useRef, useState } from "react";

export interface ChromeVisibilityStateInput {
  hasVideo: boolean;
  isPlaying: boolean;
  isMorePanelOpen: boolean;
  isDragActive: boolean;
  hasOverlay: boolean;
}

export function shouldAutoHideChrome(input: ChromeVisibilityStateInput): boolean {
  return (
    input.hasVideo &&
    input.isPlaying &&
    !input.isMorePanelOpen &&
    !input.isDragActive &&
    !input.hasOverlay
  );
}

export const DEFAULT_AUTO_HIDE_DELAY_MS = 2200;

export interface UseChromeVisibilityOptions {
  state: ChromeVisibilityStateInput;
  autoHideDelayMs?: number;
}

export interface ChromeVisibilityController {
  visible: boolean;
  reveal: () => void;
  toggle: () => void;
  scheduleHide: (delayMs?: number) => void;
}

export function useChromeVisibility(options: UseChromeVisibilityOptions): ChromeVisibilityController {
  const { state, autoHideDelayMs = DEFAULT_AUTO_HIDE_DELAY_MS } = options;
  const [visible, setVisible] = useState(true);
  const timerRef = useRef<number | null>(null);

  const shouldAutoHide = shouldAutoHideChrome(state);

  const clearTimer = useCallback((): void => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const scheduleHide = useCallback(
    (delayMs?: number): void => {
      if (!shouldAutoHide) {
        return;
      }

      clearTimer();
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        setVisible(false);
      }, delayMs ?? autoHideDelayMs);
    },
    [autoHideDelayMs, clearTimer, shouldAutoHide],
  );

  const reveal = useCallback((): void => {
    setVisible(true);
    scheduleHide();
  }, [scheduleHide]);

  const toggle = useCallback((): void => {
    clearTimer();
    setVisible((current) => {
      const next = !current;
      if (next) {
        scheduleHide();
      }
      return next;
    });
  }, [clearTimer, scheduleHide]);

  useEffect(() => {
    if (!shouldAutoHide) {
      clearTimer();
      setVisible(true);
      return;
    }

    scheduleHide();
  }, [clearTimer, scheduleHide, shouldAutoHide]);

  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, [clearTimer]);

  return { visible, reveal, toggle, scheduleHide };
}

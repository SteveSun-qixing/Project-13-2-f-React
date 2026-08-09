import { useCallback, useEffect, useState, type MutableRefObject } from "react";

type PictureInPictureVideoElement = HTMLVideoElement & {
  requestPictureInPicture?: () => Promise<unknown>;
};

type PictureInPictureDocument = Document & {
  pictureInPictureEnabled?: boolean;
  pictureInPictureElement?: Element | null;
  exitPictureInPicture?: () => Promise<void>;
};

export function isSurfaceFullscreen(
  fullscreenElement: Element | null | undefined,
  surface: Element | null | undefined,
): boolean {
  return Boolean(surface && fullscreenElement === surface);
}

export interface UseFullscreenOptions {
  surfaceRef: MutableRefObject<HTMLDivElement | null>;
  videoRef: MutableRefObject<HTMLVideoElement | null>;
  sessionKey: string | null;
}

export interface FullscreenController {
  isFullscreen: boolean;
  isPictureInPicture: boolean;
  canUsePictureInPicture: boolean;
  toggleFullscreen: () => Promise<void>;
  togglePictureInPicture: () => Promise<void>;
}

export function useFullscreen(options: UseFullscreenOptions): FullscreenController {
  const { surfaceRef, videoRef, sessionKey } = options;
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPictureInPicture, setIsPictureInPicture] = useState(false);

  const canUsePictureInPicture =
    typeof document !== "undefined" &&
    (document as PictureInPictureDocument).pictureInPictureEnabled === true;

  const toggleFullscreen = useCallback(async (): Promise<void> => {
    if (typeof document === "undefined") {
      return;
    }

    const surface = surfaceRef.current;
    if (!surface || typeof surface.requestFullscreen !== "function") {
      return;
    }

    if (document.fullscreenElement === surface) {
      if (typeof document.exitFullscreen === "function") {
        await document.exitFullscreen();
      }
      return;
    }

    await surface.requestFullscreen();
  }, [surfaceRef]);

  const togglePictureInPicture = useCallback(async (): Promise<void> => {
    if (typeof document === "undefined" || !canUsePictureInPicture) {
      return;
    }

    const doc = document as PictureInPictureDocument;
    const video = videoRef.current as PictureInPictureVideoElement | null;
    if (!video || typeof video.requestPictureInPicture !== "function") {
      return;
    }

    if (doc.pictureInPictureElement === video) {
      await doc.exitPictureInPicture?.();
      return;
    }

    await video.requestPictureInPicture();
  }, [canUsePictureInPicture, videoRef]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return undefined;
    }

    const handleFullscreenChange = (): void => {
      const surface = surfaceRef.current;
      setIsFullscreen(isSurfaceFullscreen(document.fullscreenElement, surface));
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [surfaceRef]);

  useEffect(() => {
    const video = videoRef.current as PictureInPictureVideoElement | null;
    if (!video) {
      return undefined;
    }

    const handleEnterPictureInPicture = (): void => {
      setIsPictureInPicture(true);
    };
    const handleLeavePictureInPicture = (): void => {
      setIsPictureInPicture(false);
    };

    video.addEventListener("enterpictureinpicture", handleEnterPictureInPicture as EventListener);
    video.addEventListener("leavepictureinpicture", handleLeavePictureInPicture as EventListener);

    return () => {
      video.removeEventListener("enterpictureinpicture", handleEnterPictureInPicture as EventListener);
      video.removeEventListener("leavepictureinpicture", handleLeavePictureInPicture as EventListener);
    };
  }, [sessionKey, videoRef]);

  return {
    isFullscreen,
    isPictureInPicture,
    canUsePictureInPicture,
    toggleFullscreen,
    togglePictureInPicture,
  };
}

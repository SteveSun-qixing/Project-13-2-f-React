import { useEffect, useMemo } from "react";
import { useCommandRegistry, type CommandItem } from "@chips/ui";
import {
  useAppRuntime,
  type PhotoViewerRuntimeValue,
} from "../app/AppRuntimeProvider";
import {
  createPhotoViewerCommands,
  type PhotoViewerCommandHandlers,
} from "./photo-viewer-commands";

interface PhotoViewerRuntimeHandlers extends PhotoViewerRuntimeValue {
  fullscreen?: () => void | Promise<void>;
  rotateClockwise?: () => void;
  rotateCounterclockwise?: () => void;
  showInfo?: () => void;
  copyImage?: () => void | Promise<void>;
  firstImage?: () => void;
  lastImage?: () => void;
}

export function usePhotoViewerCommands(): CommandItem[] {
  const runtime = useAppRuntime() as PhotoViewerRuntimeHandlers;
  const { register } = useCommandRegistry();

  const handlers = useMemo<PhotoViewerCommandHandlers>(
    () => ({
      openFile: runtime.openFile,
      saveImage: runtime.saveImage,
      previousImage: runtime.previousImage,
      nextImage: runtime.nextImage,
      zoomOut: () => runtime.zoomActions?.zoomOut(),
      zoomIn: () => runtime.zoomActions?.zoomIn(),
      fitToWindow: () => runtime.zoomActions?.fitToWindow(),
      actualSize: () => runtime.zoomActions?.actualSize(),
      fullscreen: () => void runtime.fullscreen?.(),
      rotateClockwise: () => void runtime.rotateClockwise?.(),
      rotateCounterclockwise: () => void runtime.rotateCounterclockwise?.(),
      showInfo: () => void runtime.showInfo?.(),
      copyImage: () => void runtime.copyImage?.(),
      firstImage: () => void runtime.firstImage?.(),
      lastImage: () => void runtime.lastImage?.(),
    }),
    [runtime],
  );

  const commands = useMemo(
    () =>
      createPhotoViewerCommands(handlers, {
        hasImage: runtime.imageSource !== null,
        isImageLoaded: runtime.isImageLoaded,
        isSaving: runtime.isSaving,
        canPreviousImage: Boolean(runtime.imageTarget && runtime.currentImageIndex > 0),
        canNextImage: Boolean(
          runtime.imageTarget && runtime.currentImageIndex < runtime.imageTarget.images.length - 1,
        ),
        canFirst: Boolean(runtime.imageTarget && runtime.currentImageIndex > 0),
        canLast: Boolean(
          runtime.imageTarget && runtime.currentImageIndex < runtime.imageTarget.images.length - 1,
        ),
      }),
    [
      handlers,
      runtime.currentImageIndex,
      runtime.imageSource,
      runtime.imageTarget,
      runtime.isImageLoaded,
      runtime.isSaving,
    ],
  );

  useEffect(() => {
    register(commands);
  }, [commands, register]);

  return commands;
}

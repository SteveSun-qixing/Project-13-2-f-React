import { useCallback, useMemo } from "react";
import { AppChrome } from "@chips/ui";
import { Filmstrip, type FilmstripItem } from "../components/Filmstrip";
import { InfoPanel, type InfoPanelField } from "../components/InfoPanel";
import { PhotoViewerStage } from "../components/PhotoViewerStage";
import type { ViewerContextMenuItem } from "../components/ViewerContextMenu";
import { usePhotoViewerCommands } from "../commands/usePhotoViewerCommands";
import { resolveFileName } from "../utils/image-viewer";
import { useAppRuntime } from "./AppRuntimeProvider";

export function AppShell(): React.ReactElement {
  const runtime = useAppRuntime();
  const commands = usePhotoViewerCommands();
  const text = runtime.t;

  const hasImage = runtime.imageSource !== null;
  const hasPreviousImage = Boolean(runtime.imageTarget && runtime.currentImageIndex > 0);
  const hasNextImage = Boolean(
    runtime.imageTarget && runtime.currentImageIndex < runtime.imageTarget.images.length - 1,
  );

  const handleNavigateRequest = useCallback(
    (direction: "prev" | "next"): void => {
      if (direction === "next") {
        runtime.nextImage();
        return;
      }
      runtime.previousImage();
    },
    [runtime.nextImage, runtime.previousImage],
  );

  const filmstripItems = useMemo<FilmstripItem[]>(() => {
    const target = runtime.imageTarget;
    if (!target || target.images.length <= 1) {
      return [];
    }

    return target.images.map((image) => ({
      sourceId: image.sourceId,
      fileName:
        image.fileName?.trim() ||
        resolveFileName(image.relativePath || image.filePath || image.sourceId),
      thumbSrc: runtime.getResolvedThumbUri(image.sourceId) ?? undefined,
    }));
  }, [runtime.getResolvedThumbUri, runtime.imageTarget, runtime.thumbCacheRevision]);

  const contextMenuItems: ViewerContextMenuItem[] = [
    { key: "open", label: text("photo-viewer.actions.open"), onSelect: () => void runtime.openFile() },
    {
      key: "save",
      label: text("photo-viewer.actions.save"),
      disabled: !hasImage,
      onSelect: () => void runtime.saveImage(),
    },
    {
      key: "copy",
      label: text("photo-viewer.commands.copy.title"),
      disabled: !hasImage,
      onSelect: () => void runtime.copyImage?.(),
    },
    { key: "separator-1", separator: true },
    {
      key: "previous",
      label: text("photo-viewer.actions.previous"),
      disabled: !hasPreviousImage,
      onSelect: runtime.previousImage,
    },
    {
      key: "next",
      label: text("photo-viewer.actions.next"),
      disabled: !hasNextImage,
      onSelect: runtime.nextImage,
    },
    {
      key: "first",
      label: text("photo-viewer.commands.firstImage.title"),
      disabled: !hasPreviousImage,
      onSelect: () => void runtime.firstImage?.(),
    },
    {
      key: "last",
      label: text("photo-viewer.commands.lastImage.title"),
      disabled: !hasNextImage,
      onSelect: () => void runtime.lastImage?.(),
    },
    { key: "separator-2", separator: true },
    {
      key: "zoom-in",
      label: text("photo-viewer.actions.zoomIn"),
      disabled: !hasImage || !runtime.isImageLoaded,
      onSelect: () => runtime.zoomActions?.zoomIn(),
    },
    {
      key: "zoom-out",
      label: text("photo-viewer.actions.zoomOut"),
      disabled: !hasImage || !runtime.isImageLoaded,
      onSelect: () => runtime.zoomActions?.zoomOut(),
    },
    {
      key: "fit",
      label: text("photo-viewer.actions.fit"),
      disabled: !hasImage || !runtime.isImageLoaded,
      onSelect: () => runtime.zoomActions?.fitToWindow(),
    },
    {
      key: "actual-size",
      label: text("photo-viewer.actions.actualSize"),
      disabled: !hasImage || !runtime.isImageLoaded,
      onSelect: () => runtime.zoomActions?.actualSize(),
    },
    { key: "separator-3", separator: true },
    {
      key: "rotate-clockwise",
      label: text("photo-viewer.commands.rotateClockwise.title"),
      disabled: !hasImage,
      onSelect: () => void runtime.rotateClockwise?.(),
    },
    {
      key: "rotate-counterclockwise",
      label: text("photo-viewer.commands.rotateCounterclockwise.title"),
      disabled: !hasImage,
      onSelect: () => void runtime.rotateCounterclockwise?.(),
    },
    {
      key: "info",
      label: text("photo-viewer.commands.info.title"),
      disabled: !hasImage,
      onSelect: () => void runtime.showInfo?.(),
    },
  ];

  const infoFields: InfoPanelField[] = [];
  if (runtime.imageSource) {
    infoFields.push({ label: text("photo-viewer.info.fileName"), value: runtime.imageSource.fileName });
    if (runtime.imageSource.filePath) {
      infoFields.push({ label: text("photo-viewer.info.path"), value: runtime.imageSource.filePath });
    }
  }
  if (runtime.imageDimensions) {
    infoFields.push({
      label: text("photo-viewer.info.resolution"),
      value: `${runtime.imageDimensions.width} × ${runtime.imageDimensions.height}`,
    });
  }

  return (
    <>
      <AppChrome paletteShortcut="Mod+P" immersive={hasImage} immersiveContentClass="photo-viewer-stage--viewing">
        <PhotoViewerStage
          imageSource={runtime.imageSource}
          imageDimensions={runtime.imageDimensions}
          isImageLoaded={runtime.isImageLoaded}
          isResolving={runtime.isResolving}
          feedback={runtime.feedback}
          onOpenFile={runtime.openFile}
          onDropFile={runtime.dropFile}
          onImageLoad={runtime.handleImageLoad}
          onImageError={runtime.handleImageError}
          setZoomActions={runtime.setZoomActions}
          registerZoomActions={runtime.registerZoomActions}
          onNavigateRequest={handleNavigateRequest}
          onRetry={runtime.reloadCurrent}
          hasPreviousImage={hasPreviousImage}
          hasNextImage={hasNextImage}
          onPreviousImage={runtime.previousImage}
          onNextImage={runtime.nextImage}
          filmstripItems={filmstripItems}
          filmstripCurrentIndex={runtime.currentImageIndex}
          onFilmstripSelect={runtime.jumpTo}
          contextMenuItems={contextMenuItems}
          t={runtime.t}
        />
      </AppChrome>
      <InfoPanel
        open={runtime.infoOpen}
        onClose={() => runtime.hideInfo?.()}
        title={runtime.imageSource?.fileName ?? text("photo-viewer.commands.info.title")}
        closeLabel={text("photo-viewer.info.close")}
        fields={infoFields}
      />
    </>
  );
}

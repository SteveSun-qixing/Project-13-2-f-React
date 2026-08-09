import React, { useEffect, useMemo, useRef, useState } from "react";
import { Spin } from "antd";
import type { PhotoViewerZoomActions } from "../app/AppRuntimeProvider";
import { usePhotoViewerCamera } from "../hooks/usePhotoViewerCamera";
import {
  formatZoomPercent,
  SUPPORTED_IMAGE_EXTENSION_LABEL,
  type ImageDimensions,
} from "../utils/image-viewer";
import { EmptyState } from "./EmptyState";
import { Filmstrip, type FilmstripItem } from "./Filmstrip";
import { NavigationArrows } from "./NavigationArrows";
import { ViewerContextMenu, type ViewerContextMenuItem } from "./ViewerContextMenu";
import { ZoomBadge } from "./ZoomBadge";

interface ImageSource {
  sourceId: string;
  filePath?: string;
  fileName: string;
  resourceUri: string;
  revision: number;
}

interface ViewerFeedback {
  tone: "info" | "success" | "error";
  message: string;
}

type ZoomActionsWithRotation = PhotoViewerZoomActions & {
  rotateClockwise?: () => void;
  rotateCounterclockwise?: () => void;
};

const IMAGE_TRANSITION = "transform 0.2s cubic-bezier(0.25, 0.1, 0.25, 1)";
const FEEDBACK_EXIT_MS = 200;

interface PhotoViewerStageProps {
  imageSource: ImageSource | null;
  isImageLoaded: boolean;
  isResolving: boolean;
  feedback: ViewerFeedback | null;
  onOpenFile: () => void | Promise<void>;
  onDropFile: (file: File | null) => void | Promise<void>;
  onImageLoad: (dimensions: ImageDimensions) => void;
  onImageError: () => void;
  imageDimensions: ImageDimensions | null;
  setZoomActions?: (actions: PhotoViewerZoomActions | null) => void;
  registerZoomActions?: (actions: PhotoViewerZoomActions | null) => void;
  onNavigateRequest?: (direction: "prev" | "next") => void;
  onRetry?: () => void;
  hasPreviousImage?: boolean;
  hasNextImage?: boolean;
  onPreviousImage?: () => void;
  onNextImage?: () => void;
  filmstripItems?: FilmstripItem[];
  filmstripCurrentIndex?: number;
  onFilmstripSelect?: (index: number) => void;
  contextMenuItems?: ViewerContextMenuItem[];
  t: (key: string, params?: Record<string, string | number>) => string;
}

function PhotoViewerStageView(props: PhotoViewerStageProps): React.ReactElement {
  const {
    imageSource,
    isImageLoaded,
    isResolving,
    feedback,
    onOpenFile,
    onDropFile,
    onImageLoad,
    onImageError,
    imageDimensions,
    setZoomActions,
    registerZoomActions,
    onNavigateRequest,
    onRetry,
    hasPreviousImage = false,
    hasNextImage = false,
    onPreviousImage,
    onNextImage,
    filmstripItems = [],
    filmstripCurrentIndex = 0,
    onFilmstripSelect,
    contextMenuItems,
    t,
  } = props;
  const [isDragActive, setIsDragActive] = useState(false);
  const dragDepthRef = useRef(0);
  const camera = usePhotoViewerCamera({
    imageDimensions,
    isImageLoaded,
    sessionKey: imageSource ? `${imageSource.sourceId}:${imageSource.revision}` : null,
    onNavigateRequest,
  });
  const cameraRef = useRef(camera);
  cameraRef.current = camera;

  const [displayedFeedback, setDisplayedFeedback] = useState<ViewerFeedback | null>(null);
  const [isFeedbackExiting, setIsFeedbackExiting] = useState(false);
  const feedbackExitTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const register = registerZoomActions ?? setZoomActions;
    register?.({
      zoomIn: () => cameraRef.current.handleZoom("in"),
      zoomOut: () => cameraRef.current.handleZoom("out"),
      fitToWindow: () => cameraRef.current.setFitMode(),
      actualSize: () => cameraRef.current.setActualSize(),
      rotateClockwise: () => cameraRef.current.rotateClockwise(),
      rotateCounterclockwise: () => cameraRef.current.rotateCounterclockwise(),
    });
    return () => register?.(null);
  }, [registerZoomActions, setZoomActions]);

  useEffect(() => {
    if (feedback) {
      if (feedbackExitTimerRef.current !== null) {
        window.clearTimeout(feedbackExitTimerRef.current);
        feedbackExitTimerRef.current = null;
      }
      setIsFeedbackExiting(false);
      setDisplayedFeedback(feedback);
      return;
    }

    if (!displayedFeedback) {
      return;
    }

    setIsFeedbackExiting(true);
    feedbackExitTimerRef.current = window.setTimeout(() => {
      feedbackExitTimerRef.current = null;
      setDisplayedFeedback(null);
      setIsFeedbackExiting(false);
    }, FEEDBACK_EXIT_MS);

    return () => {
      if (feedbackExitTimerRef.current !== null) {
        window.clearTimeout(feedbackExitTimerRef.current);
        feedbackExitTimerRef.current = null;
      }
    };
  }, [displayedFeedback, feedback]);

  const isSwappedRotation = camera.rotation === 90 || camera.rotation === 270;
  const frameWidth = imageDimensions
    ? isSwappedRotation
      ? imageDimensions.height
      : imageDimensions.width
    : undefined;
  const frameHeight = imageDimensions
    ? isSwappedRotation
      ? imageDimensions.width
      : imageDimensions.height
    : undefined;

  const frameStyle = useMemo(() => {
    if (!frameWidth || !frameHeight || !camera.imageTransform) {
      return undefined;
    }

    return {
      width: `${frameWidth}px`,
      height: `${frameHeight}px`,
      transform: camera.imageTransform,
      transition: camera.transitionEnabled ? IMAGE_TRANSITION : "none",
    };
  }, [camera.imageTransform, camera.transitionEnabled, frameHeight, frameWidth]);

  const zoomPercent = formatZoomPercent(camera.effectiveScale);
  const showArrows = hasPreviousImage || hasNextImage;
  const showRetry = Boolean(onRetry && displayedFeedback?.tone === "error" && !isImageLoaded);
  const viewportLabel =
    imageSource && imageDimensions && isImageLoaded
      ? `${imageSource.fileName}，${
          isSwappedRotation ? imageDimensions.height : imageDimensions.width
        } × ${isSwappedRotation ? imageDimensions.width : imageDimensions.height}，${zoomPercent}`
      : t("photo-viewer.viewer.viewportLabel");

  return (
    <div className="photo-viewer-shell">
      <main
        className={`photo-viewer-stage${isDragActive ? " photo-viewer-stage--drag-active" : ""}${
          imageSource ? " photo-viewer-stage--viewing" : ""
        }`}
        onDragEnter={(event) => {
          event.preventDefault();
          dragDepthRef.current += 1;
          setIsDragActive(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
          if (dragDepthRef.current === 0) {
            setIsDragActive(false);
          }
        }}
        onDrop={(event) => {
          event.preventDefault();
          dragDepthRef.current = 0;
          setIsDragActive(false);
          void onDropFile(event.dataTransfer.files?.[0] ?? null);
        }}
      >
        <ViewerContextMenu items={contextMenuItems}>
          <div className="photo-viewer-frame">
            {imageSource ? (
              <div
                className={`photo-viewer-viewport${camera.isInteractive ? " photo-viewer-viewport--interactive" : ""}${
                  camera.isPanningImage ? " photo-viewer-viewport--panning" : ""
                }`}
                ref={camera.viewportRef}
                role="group"
                aria-label={viewportLabel}
                tabIndex={0}
                onPointerDown={camera.handlePointerDown}
                onPointerMove={camera.handlePointerMove}
                onPointerUp={camera.handlePointerUp}
                onPointerCancel={camera.handlePointerCancel}
                onDoubleClick={camera.handleDoubleClick}
              >
                <div className="photo-viewer-scene">
                  <div className="photo-viewer-image-frame" style={frameStyle}>
                    <img
                      key={`${imageSource.resourceUri}-${imageSource.revision}`}
                      className="photo-viewer-image"
                      src={imageSource.resourceUri}
                      alt={imageSource.fileName}
                      draggable={false}
                      decoding="async"
                      onLoad={(event) => {
                        onImageLoad({
                          width: event.currentTarget.naturalWidth || event.currentTarget.width,
                          height: event.currentTarget.naturalHeight || event.currentTarget.height,
                        });
                      }}
                      onError={onImageError}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState
                title={t("photo-viewer.empty.title")}
                description={isDragActive ? t("photo-viewer.viewer.dragPrompt") : t("photo-viewer.viewer.emptyPrompt")}
                hint={t("photo-viewer.empty.hint", { extensions: SUPPORTED_IMAGE_EXTENSION_LABEL })}
                shortcutText={t("photo-viewer.empty.openShortcut")}
                actionLabel={t("photo-viewer.actions.open")}
                dragActive={isDragActive}
                onOpen={() => void onOpenFile()}
              />
            )}

            {showArrows ? (
              <NavigationArrows
                hasPrevious={hasPreviousImage}
                hasNext={hasNextImage}
                onPrevious={onPreviousImage ?? (() => undefined)}
                onNext={onNextImage ?? (() => undefined)}
                previousLabel={t("photo-viewer.commands.previousImage.title")}
                nextLabel={t("photo-viewer.commands.nextImage.title")}
              />
            ) : null}

            {filmstripItems.length > 1 ? (
              <Filmstrip
                items={filmstripItems}
                currentIndex={filmstripCurrentIndex}
                onSelect={onFilmstripSelect ?? (() => undefined)}
                visible
              />
            ) : null}

            {imageSource && isImageLoaded ? (
              <ZoomBadge
                percent={zoomPercent}
                title={t("photo-viewer.viewer.clickToResetZoom")}
                onClick={() => camera.setFitMode()}
              />
            ) : null}

            {isResolving || (imageSource && !isImageLoaded) ? (
              <div className="photo-viewer-overlay">
                <div className="photo-viewer-overlay__text">
                  <Spin size="small" /> {t("photo-viewer.viewer.loading")}
                </div>
              </div>
            ) : null}

            {displayedFeedback ? (
              <div
                key={`${displayedFeedback.tone}:${displayedFeedback.message}`}
                className={`photo-viewer-feedback photo-viewer-feedback--${displayedFeedback.tone}${
                  isFeedbackExiting ? " photo-viewer-feedback--exiting" : ""
                }`}
                role={displayedFeedback.tone === "error" ? "alert" : "status"}
                aria-live={displayedFeedback.tone === "error" ? "assertive" : "polite"}
              >
                <span className="photo-viewer-feedback__dot" aria-hidden="true" />
                <span className="photo-viewer-feedback__message">{displayedFeedback.message}</span>
                {showRetry ? (
                  <button type="button" className="photo-viewer-feedback__retry" onClick={onRetry}>
                    {t("photo-viewer.actions.retry")}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </ViewerContextMenu>
      </main>
    </div>
  );
}

export const PhotoViewerStage = React.memo(PhotoViewerStageView);
PhotoViewerStage.displayName = "PhotoViewerStage";

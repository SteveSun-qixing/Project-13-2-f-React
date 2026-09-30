import { Dropdown, theme, Tooltip } from '@chips/ui';
import {
  FileImageOutlined,
  LeftOutlined,
  RightOutlined,
  ReloadOutlined,
} from '@chips/ui';
import { useEffect, useMemo, useRef } from 'react';
import type { CSSProperties, ReactElement } from 'react';
import type { ImageDimensions } from '../viewer/image-viewer';
import { formatZoomPercent, SUPPORTED_IMAGE_EXTENSION_LABEL } from '../viewer/image-viewer';
import { usePhotoViewerCamera } from '../viewer/usePhotoViewerCamera';
import type { QueueImage } from '../viewer/openQueue';
import type { MenuProps } from '@chips/ui';
import type { PhotoViewerCameraActions, SessionLoadStatus, ViewerFeedback } from './usePhotoSession';
import { Filmstrip, type FilmstripItem } from './Filmstrip';

/**
 * 查看舞台：视口 + 相机 + 队列导航与反馈浮层（《03-查看器设计》§4.3 缩放与平移、
 * §4.4 队列、§10.3 无障碍语义、§11 空态与错误态）。
 *
 * 相机动作经 ref 通道上登（会话的工具栏与键盘消费），不经过 setState 注册通道；
 * 右键菜单与工具栏共用同一组动作语义。
 */

const IMAGE_TRANSITION = 'transform 0.2s cubic-bezier(0.25, 0.1, 0.25, 1)';

export interface PhotoStageProps {
  readonly currentImage: QueueImage | null;
  readonly currentSrc: string | null;
  readonly loadStatus: SessionLoadStatus;
  readonly dimensions: ImageDimensions | null;
  readonly isImageLoaded: boolean;
  readonly bridgeReady: boolean;
  readonly queueLength: number;
  readonly hasPrevious: boolean;
  readonly hasNext: boolean;
  readonly filmstripItems: readonly FilmstripItem[];
  readonly filmstripIndex: number;
  readonly filmstripVisible: boolean;
  readonly chromeVisible: boolean;
  readonly feedback: ViewerFeedback | null;
  readonly registerCameraActions: (actions: PhotoViewerCameraActions | null) => void;
  readonly onNavigate: (direction: 'prev' | 'next') => void;
  readonly onFilmstripSelect: (index: number) => void;
  readonly onRetry: (() => void) | null;
  readonly onOpenRequest: () => void;
  readonly onSaveCopy: () => void;
  readonly onImageLoad: (dimensions: ImageDimensions) => void;
  readonly onImageError: () => void;
  readonly onPointerActivity: () => void;
}

interface StageToken {
  readonly colorBgLayout: string;
  readonly colorBgElevated: string;
  readonly colorBgMask: string;
  readonly colorBorderSecondary: string;
  readonly colorError: string;
  readonly colorErrorBorder: string;
  readonly colorPrimary: string;
  readonly colorText: string;
  readonly colorTextSecondary: string;
  readonly colorWhite: string;
  readonly borderRadius: number;
  readonly borderRadiusSM: number;
  readonly boxShadowSecondary: string;
  readonly boxShadowTertiary: string;
  readonly fontSize: number;
  readonly fontSizeSM: number;
  readonly fontSizeXL: number;
  readonly marginSM: number;
  readonly marginXS: number;
  readonly marginXXS: number;
  readonly paddingLG: number;
  readonly paddingSM: number;
  readonly paddingXL: number;
  readonly paddingXXS: number;
}

function arrowButtonStyle(token: StageToken): CSSProperties {
  return {
    width: 40,
    height: 40,
    display: 'grid',
    placeItems: 'center',
    borderRadius: '50%',
    border: `1px solid ${token.colorBorderSecondary}`,
    background: token.colorBgElevated,
    color: token.colorText,
    cursor: 'pointer',
    boxShadow: token.boxShadowTertiary,
  };
}

export function PhotoStage(props: PhotoStageProps): ReactElement {
  const {
    currentImage,
    currentSrc,
    loadStatus,
    dimensions,
    isImageLoaded,
    bridgeReady,
    queueLength,
    hasPrevious,
    hasNext,
    filmstripItems,
    filmstripIndex,
    filmstripVisible,
    chromeVisible,
    feedback,
    registerCameraActions,
    onNavigate,
    onFilmstripSelect,
    onRetry,
    onOpenRequest,
    onSaveCopy,
    onImageLoad,
    onImageError,
    onPointerActivity,
  } = props;
  const { token } = theme.useToken();

  const camera = usePhotoViewerCamera({
    imageDimensions: dimensions,
    isImageLoaded,
    sessionKey: currentImage?.uri ?? null,
    onNavigateRequest: onNavigate,
  });
  const cameraRef = useRef(camera);
  cameraRef.current = camera;

  useEffect(() => {
    registerCameraActions({
      zoomIn: () => cameraRef.current.handleZoom('in'),
      zoomOut: () => cameraRef.current.handleZoom('out'),
      fitToWindow: () => cameraRef.current.setFitMode(),
      actualSize: () => cameraRef.current.setActualSize(),
      rotateClockwise: () => cameraRef.current.rotateClockwise(),
      rotateCounterclockwise: () => cameraRef.current.rotateCounterclockwise(),
    });
    return () => registerCameraActions(null);
  }, [registerCameraActions]);

  const isSwappedRotation = camera.rotation === 90 || camera.rotation === 270;
  const frameWidth = dimensions ? (isSwappedRotation ? dimensions.height : dimensions.width) : undefined;
  const frameHeight = dimensions ? (isSwappedRotation ? dimensions.width : dimensions.height) : undefined;

  const frameStyle = useMemo<CSSProperties | undefined>(() => {
    if (frameWidth === undefined || frameHeight === undefined || camera.imageTransform === undefined) {
      return undefined;
    }
    return {
      position: 'absolute',
      left: '50%',
      top: '50%',
      width: `${frameWidth}px`,
      height: `${frameHeight}px`,
      display: 'grid',
      placeItems: 'center',
      transform: camera.imageTransform,
      transition: camera.transitionEnabled ? IMAGE_TRANSITION : 'none',
      willChange: 'transform',
    };
  }, [camera.imageTransform, camera.transitionEnabled, frameHeight, frameWidth]);

  const zoomPercent = formatZoomPercent(camera.effectiveScale);
  const viewportLabel =
    currentImage !== null && isImageLoaded ? `${currentImage.fileName}，${zoomPercent}` : '图片查看视口';

  const contextMenuItems = useMemo<MenuProps['items']>(
    () => [
      { key: 'zoom-in', label: '放大', disabled: !isImageLoaded, onClick: () => cameraRef.current.handleZoom('in') },
      { key: 'zoom-out', label: '缩小', disabled: !isImageLoaded, onClick: () => cameraRef.current.handleZoom('out') },
      { key: 'fit', label: '适应窗口', disabled: !isImageLoaded, onClick: () => cameraRef.current.setFitMode() },
      { key: 'actual', label: '实际大小', disabled: !isImageLoaded, onClick: () => cameraRef.current.setActualSize() },
      { type: 'divider' },
      {
        key: 'rotate-cw',
        label: '顺时针旋转',
        disabled: !isImageLoaded,
        onClick: () => cameraRef.current.rotateClockwise(),
      },
      {
        key: 'rotate-ccw',
        label: '逆时针旋转',
        disabled: !isImageLoaded,
        onClick: () => cameraRef.current.rotateCounterclockwise(),
      },
      { type: 'divider' },
      { key: 'open', label: '打开图片', onClick: onOpenRequest },
      { key: 'save-copy', label: '保存副本', disabled: currentImage === null, onClick: onSaveCopy },
    ],
    [currentImage, isImageLoaded, onOpenRequest, onSaveCopy],
  );

  const emptyDescription = bridgeReady
    ? '等待资源打开链路投递图片，或从本地选择一张图片开始查看。'
    : '窗口桥接未就绪，暂时无法接收图片投递；通道就绪前此提示如实保留。';

  return (
    <div
      data-role="photo-stage"
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: token.colorBgLayout,
      }}
      onPointerMove={onPointerActivity}
    >
      {currentImage === null ? (
        <div
          data-role="photo-empty"
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: token.marginSM,
            padding: token.paddingXL,
            textAlign: 'center',
          }}
        >
          <span aria-hidden="true" style={{ fontSize: 48, color: token.colorTextSecondary, display: 'grid' }}>
            <FileImageOutlined />
          </span>
          <h2 data-role="photo-empty-title" style={{ margin: 0, fontSize: token.fontSizeXL }}>
            未打开图片
          </h2>
          <p style={{ margin: 0, color: token.colorTextSecondary }}>{emptyDescription}</p>
          <p style={{ margin: 0, color: token.colorTextSecondary, fontSize: token.fontSizeSM }}>
            支持格式：{SUPPORTED_IMAGE_EXTENSION_LABEL}
          </p>
          <p style={{ margin: 0, color: token.colorTextSecondary, fontSize: token.fontSizeSM }}>
            快捷键：Ctrl / ⌘ + O 打开图片
          </p>
          <button
            type="button"
            data-role="empty-open"
            onClick={onOpenRequest}
            style={{
              marginTop: token.marginXXS,
              padding: `${token.paddingXXS}px ${token.paddingLG}px`,
              borderRadius: token.borderRadius,
              border: `1px solid ${token.colorPrimary}`,
              background: token.colorPrimary,
              color: token.colorWhite,
              fontSize: token.fontSize,
              cursor: 'pointer',
            }}
          >
            打开图片
          </button>
        </div>
      ) : (
        <Dropdown trigger={['contextMenu']} menu={{ items: contextMenuItems ?? [] }}>
          <div
            data-role="photo-viewport"
            ref={camera.viewportRef}
            role="group"
            aria-label={viewportLabel}
            tabIndex={0}
            onPointerDown={camera.handlePointerDown}
            onPointerMove={camera.handlePointerMove}
            onPointerUp={camera.handlePointerUp}
            onPointerCancel={camera.handlePointerCancel}
            onDoubleClick={camera.handleDoubleClick}
            style={{
              position: 'relative',
              flex: 1,
              minWidth: 0,
              overflow: 'hidden',
              touchAction: 'none',
              overscrollBehavior: 'none',
              cursor: camera.isPanningImage ? 'grabbing' : camera.isInteractive ? 'grab' : 'default',
              outline: 'none',
            }}
          >
            <div style={frameStyle ?? { position: 'absolute', left: '50%', top: '50%' }}>
              {currentSrc !== null ? (
                <img
                  key={currentImage.uri}
                  data-role="stage-image"
                  src={currentSrc}
                  alt={currentImage.fileName}
                  draggable={false}
                  decoding="async"
                  onLoad={(event) => {
                    onImageLoad({
                      width: event.currentTarget.naturalWidth || event.currentTarget.width,
                      height: event.currentTarget.naturalHeight || event.currentTarget.height,
                    });
                  }}
                  onError={onImageError}
                  style={{
                    display: 'block',
                    width: '100%',
                    height: '100%',
                    maxWidth: 'none',
                    maxHeight: 'none',
                    objectFit: 'contain',
                    userSelect: 'none',
                    pointerEvents: 'none',
                  }}
                />
              ) : null}
            </div>

            {chromeVisible && queueLength > 1 ? (
              <>
                <Tooltip title={hasPrevious ? '上一张' : '当前已经是第一张图片'}>
                  <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)' }}>
                    <button
                      type="button"
                      aria-label="上一张"
                      disabled={!hasPrevious}
                      onClick={() => onNavigate('prev')}
                      style={arrowButtonStyle(token)}
                    >
                      <LeftOutlined />
                    </button>
                  </span>
                </Tooltip>
                <Tooltip title={hasNext ? '下一张' : '当前已经是最后一张图片'}>
                  <span style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)' }}>
                    <button
                      type="button"
                      aria-label="下一张"
                      disabled={!hasNext}
                      onClick={() => onNavigate('next')}
                      style={arrowButtonStyle(token)}
                    >
                      <RightOutlined />
                    </button>
                  </span>
                </Tooltip>
              </>
            ) : null}

            {chromeVisible && isImageLoaded ? (
              <button
                type="button"
                data-role="zoom-badge"
                title="点击恢复适应窗口"
                onClick={() => camera.setFitMode()}
                style={{
                  position: 'absolute',
                  left: 16,
                  bottom: 76,
                  padding: `${token.paddingXXS}px ${token.paddingSM}px`,
                  borderRadius: token.borderRadiusSM,
                  border: `1px solid ${token.colorBorderSecondary}`,
                  background: token.colorBgElevated,
                  color: token.colorText,
                  fontSize: token.fontSizeSM,
                  cursor: 'pointer',
                }}
              >
                {zoomPercent}
              </button>
            ) : null}

            {chromeVisible ? (
              <Filmstrip
                items={filmstripItems}
                currentIndex={filmstripIndex}
                onSelect={onFilmstripSelect}
                visible={filmstripVisible}
              />
            ) : null}

            {loadStatus.state === 'loading' ? (
              <div
                role="status"
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'grid',
                  placeItems: 'center',
                  background: token.colorBgMask,
                  color: token.colorText,
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: token.marginXS }}>
                  <ReloadOutlined spin />
                  正在读取图片…
                </span>
              </div>
            ) : null}
          </div>
        </Dropdown>
      )}

      {feedback !== null ? (
        <div
          data-role="photo-feedback"
          role={feedback.tone === 'error' ? 'alert' : 'status'}
          aria-live={feedback.tone === 'error' ? 'assertive' : 'polite'}
          style={{
            position: 'absolute',
            left: '50%',
            bottom: 76,
            transform: 'translateX(-50%)',
            zIndex: 2,
            maxWidth: 'calc(100% - 32px)',
            display: 'flex',
            alignItems: 'center',
            gap: token.marginXS,
            padding: `${token.paddingXXS}px ${token.paddingSM}px`,
            borderRadius: token.borderRadiusSM,
            border: `1px solid ${feedback.tone === 'error' ? token.colorErrorBorder : token.colorBorderSecondary}`,
            background: token.colorBgElevated,
            color: feedback.tone === 'error' ? token.colorError : token.colorText,
            boxShadow: token.boxShadowSecondary,
          }}
        >
          <span>{feedback.message}</span>
          {onRetry !== null && feedback.tone === 'error' ? (
            <button
              type="button"
              data-role="feedback-retry"
              onClick={onRetry}
              style={{
                border: 'none',
                background: 'transparent',
                color: token.colorPrimary,
                cursor: 'pointer',
                fontSize: token.fontSizeSM,
                padding: 0,
              }}
            >
              重试
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

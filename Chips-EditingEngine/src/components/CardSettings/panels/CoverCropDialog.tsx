import React, { useEffect, useMemo, useRef, useState } from 'react';
import { formatMessage } from '../../../lib/messages';
import { ENGINE_ICONS } from '../../../icons/descriptors';
import { RuntimeIcon } from '../../../icons/RuntimeIcon';
import { blobToDataUrl } from '../../../utils/card-cover';
import {
  clampCropRect,
  moveCropRect,
  resizeCropRect,
  resolveContainedImageBounds,
  resolveInitialCropRect,
  type CropPoint,
  type CropRect,
  type CropResizeHandle,
} from './cover-crop-layout';
import './CoverCropDialog.css';

interface CoverCropDialogProps {
  open: boolean;
  imageUrl: string;
  ratio: string;
  onClose: () => void;
  onConfirm: (result: {
    data: Uint8Array;
    previewUrl: string;
    mimeType: string;
  }) => void;
}

type Size = {
  width: number;
  height: number;
};

export function CoverCropDialog({
  open,
  imageUrl,
  ratio,
  onClose,
  onConfirm,
}: CoverCropDialogProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const interactionRef = useRef<{
    pointerId: number;
    mode: 'move' | 'resize';
    startPointer: CropPoint;
    startRect: CropRect;
    handle?: CropResizeHandle;
  } | null>(null);
  const hasInitializedCropRef = useRef(false);

  const [stageSize, setStageSize] = useState<Size>({ width: 0, height: 0 });
  const [naturalSize, setNaturalSize] = useState<Size>({ width: 0, height: 0 });
  const [cropRect, setCropRect] = useState<CropRect>({ x: 0, y: 0, width: 0, height: 0 });

  const imageBounds = useMemo(() => {
    return resolveContainedImageBounds(stageSize, naturalSize);
  }, [naturalSize, stageSize]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const measureStage = () => {
      const stage = stageRef.current;
      if (!stage) {
        return;
      }

      setStageSize({
        width: stage.clientWidth,
        height: stage.clientHeight,
      });
    };

    measureStage();
    window.addEventListener('resize', measureStage);
    return () => {
      window.removeEventListener('resize', measureStage);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const image = new Image();
    const handleLoad = () => {
      setNaturalSize({
        width: image.naturalWidth,
        height: image.naturalHeight,
      });
    };

    image.addEventListener('load', handleLoad);
    image.src = imageUrl;

    return () => {
      image.removeEventListener('load', handleLoad);
    };
  }, [imageUrl, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    hasInitializedCropRef.current = false;
    setCropRect({ x: 0, y: 0, width: 0, height: 0 });
  }, [imageUrl, open, ratio]);

  useEffect(() => {
    if (!open || !imageBounds.width || !imageBounds.height) {
      return;
    }

    setCropRect((previous) => {
      if (!hasInitializedCropRef.current) {
        hasInitializedCropRef.current = true;
        return resolveInitialCropRect(imageBounds, ratio);
      }

      return clampCropRect(previous, imageBounds, ratio);
    });
  }, [imageBounds, open, ratio]);

  if (!open) {
    return null;
  }

  const getStagePoint = (event: React.PointerEvent<HTMLElement>): CropPoint | null => {
    const stageRect = stageRef.current?.getBoundingClientRect();
    if (!stageRect) {
      return null;
    }

    return {
      x: event.clientX - stageRect.left,
      y: event.clientY - stageRect.top,
    };
  };

  const startInteraction = (
    event: React.PointerEvent<HTMLElement>,
    mode: 'move' | 'resize',
    handle?: CropResizeHandle,
  ) => {
    const startPointer = getStagePoint(event);
    const stage = stageRef.current;
    if (!startPointer || !stage) {
      return;
    }

    interactionRef.current = {
      pointerId: event.pointerId,
      mode,
      handle,
      startPointer,
      startRect: cropRect,
    };
    stage.setPointerCapture(event.pointerId);
    event.preventDefault();
    event.stopPropagation();
  };

  const handleStagePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const interaction = interactionRef.current;
    if (!interaction || interaction.pointerId !== event.pointerId) {
      return;
    }

    const pointer = getStagePoint(event);
    if (!pointer) {
      return;
    }

    if (interaction.mode === 'move') {
      const delta = {
        x: pointer.x - interaction.startPointer.x,
        y: pointer.y - interaction.startPointer.y,
      };
      setCropRect(moveCropRect(interaction.startRect, delta, imageBounds));
      return;
    }

    if (interaction.handle) {
      setCropRect(resizeCropRect(interaction.startRect, pointer, interaction.handle, imageBounds, ratio));
    }
  };

  const handleStagePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!interactionRef.current || interactionRef.current.pointerId !== event.pointerId) {
      return;
    }

    interactionRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleConfirm = async () => {
    if (!naturalSize.width || !naturalSize.height || !cropRect.width || !cropRect.height || !imageBounds.scale) {
      return;
    }

    const sourceX = Math.max(0, (cropRect.x - imageBounds.x) / imageBounds.scale);
    const sourceY = Math.max(0, (cropRect.y - imageBounds.y) / imageBounds.scale);
    const sourceWidth = Math.min(naturalSize.width - sourceX, cropRect.width / imageBounds.scale);
    const sourceHeight = Math.min(naturalSize.height - sourceY, cropRect.height / imageBounds.scale);

    const image = new Image();
    image.src = imageUrl;
    await image.decode();

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(sourceWidth));
    canvas.height = Math.max(1, Math.round(sourceHeight));

    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    context.drawImage(
      image,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      canvas.width,
      canvas.height,
    );

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((value) => {
        if (value) {
          resolve(value);
          return;
        }
        reject(new Error('Failed to create cropped image blob.'));
      }, 'image/png');
    });

    onConfirm({
      data: new Uint8Array(await blob.arrayBuffer()),
      previewUrl: await blobToDataUrl(blob),
      mimeType: 'image/png',
    });
  };

  return (
    <div className="cover-crop-dialog" role="dialog" aria-modal="true" aria-label={formatMessage('card_settings.cover_crop_title')}>
      <div className="cover-crop-dialog__panel">
        <div className="cover-crop-dialog__header">
          <div>
            <h3 className="cover-crop-dialog__title">{formatMessage('card_settings.cover_crop_title')}</h3>
            <p className="cover-crop-dialog__subtitle">
              {formatMessage('card_settings.cover_crop_desc')}
            </p>
          </div>

          <button
            type="button"
            className="cover-crop-dialog__close"
            aria-label={formatMessage('card_settings.close')}
            onClick={onClose}
          >
            <RuntimeIcon icon={ENGINE_ICONS.close} />
          </button>
        </div>

        <div
          ref={stageRef}
          className="cover-crop-dialog__stage"
          onPointerMove={handleStagePointerMove}
          onPointerUp={handleStagePointerUp}
          onPointerCancel={handleStagePointerUp}
        >
          <img
            className="cover-crop-dialog__image"
            src={imageUrl}
            alt={formatMessage('cover_maker.preview_alt')}
            style={{
              left: `${imageBounds.x}px`,
              top: `${imageBounds.y}px`,
              width: `${imageBounds.width}px`,
              height: `${imageBounds.height}px`,
            }}
          />

          <div
            className="cover-crop-dialog__crop-box"
            style={{
              left: `${cropRect.x}px`,
              top: `${cropRect.y}px`,
              width: `${cropRect.width}px`,
              height: `${cropRect.height}px`,
            }}
            onPointerDown={(event) => startInteraction(event, 'move')}
          >
            <div className="cover-crop-dialog__crop-grid" />
            {(['nw', 'ne', 'se', 'sw'] as CropResizeHandle[]).map((handle) => (
              <button
                key={handle}
                type="button"
                className={`cover-crop-dialog__handle cover-crop-dialog__handle--${handle}`}
                aria-label={`${formatMessage('card_settings.cover_crop_action')} ${handle}`}
                onPointerDown={(event) => startInteraction(event, 'resize', handle)}
              />
            ))}
          </div>
        </div>

        <div className="cover-crop-dialog__footer">
          <button
            type="button"
            className="cover-crop-dialog__button cover-crop-dialog__button--secondary"
            onClick={onClose}
          >
            {formatMessage('card_settings.cancel')}
          </button>
          <button
            type="button"
            className="cover-crop-dialog__button cover-crop-dialog__button--primary"
            onClick={() => {
              void handleConfirm();
            }}
          >
            {formatMessage('card_settings.cover_crop_apply')}
          </button>
        </div>
      </div>
    </div>
  );
}

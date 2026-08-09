import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { CardWindowBase } from '../CardWindowBase/CardWindowBase';
import { WindowMenu } from '../WindowMenu/WindowMenu';
import { workspaceService } from '../../services/workspace-service';
import { boxDocumentService } from '../../services/box-document-service';
import { useEditorSelection } from '../../context/EditorSelectionContext';
import { useBoxDocumentSession } from '../../hooks/useBoxDocumentSession';
import { useCanvas } from '../../layouts/InfiniteCanvas/CanvasContext';
import type { BoxWindowConfig, Position, Size } from '../../types/window';
import { normalizeCoverRatio, parseCoverRatio } from '../../utils/card-cover';
import { BoxCoverSurface } from './BoxCoverSurface';
import { BoxPreviewSurface } from './BoxPreviewSurface';
import './BoxWindow.css';

const BoxSettingsDialog = lazy(() => import('./BoxSettingsDialog').then((module) => ({ default: module.BoxSettingsDialog })));

export interface BoxWindowProps {
  config: BoxWindowConfig;
  onUpdateConfig: (config: Partial<BoxWindowConfig>) => void;
  onClose: () => void;
  onFocus: () => void;
}

export const BoxWindow = React.memo(function BoxWindow({
  config,
  onUpdateConfig,
  onClose,
  onFocus,
}: BoxWindowProps) {
  const { selectBox } = useEditorSelection();
  const canvasContext = useCanvas();
  const { session, isLoading, error } = useBoxDocumentSession(config.boxId, config.boxPath);
  const loadError = error;
  const isCoverView = config.state === 'cover';
  const coverRatio = session?.metadata.coverRatio ?? '3:4';
  const [coverRenderPosition, setCoverRenderPosition] = useState(config.position);
  const coverRenderPositionRef = useRef(config.position);
  const [isCoverDragging, setIsCoverDragging] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const coverDragStart = useRef({ x: 0, y: 0 });
  const coverInitialPosition = useRef({ x: 0, y: 0 });
  const coverDragMoved = useRef(false);

  useEffect(() => {
    if (!isCoverDragging) {
      coverRenderPositionRef.current = config.position;
      setCoverRenderPosition(config.position);
    }
  }, [config.position, isCoverDragging]);

  useEffect(() => {
    if (!session) {
      return;
    }

    const nextTitle = session.metadata.name?.trim();
    if (nextTitle && nextTitle !== config.title) {
      onUpdateConfig({ title: nextTitle });
    }

    if (session.boxFile !== config.boxPath) {
      onUpdateConfig({ boxPath: session.boxFile });
    }
  }, [config.boxPath, config.title, onUpdateConfig, session]);

  const handleUpdatePosition = useCallback((position: Position) => onUpdateConfig({ position }), [onUpdateConfig]);
  const handleUpdateSize = useCallback((size: Size) => onUpdateConfig({ size }), [onUpdateConfig]);
  const handleMinimize = useCallback(() => onUpdateConfig({ state: 'minimized' }), [onUpdateConfig]);
  const handleCollapse = useCallback(() => {
    onUpdateConfig({ state: config.state === 'collapsed' ? 'normal' : 'collapsed' });
  }, [config.state, onUpdateConfig]);
  const handleSwitchToFile = useCallback(() => {
    selectBox(config.boxId);
    onUpdateConfig({ state: 'normal' });
    onFocus();
  }, [config.boxId, onFocus, onUpdateConfig, selectBox]);
  const handleSwitchToCover = useCallback(() => {
    selectBox(config.boxId);
    onUpdateConfig({ state: 'cover' });
    onFocus();
  }, [config.boxId, onFocus, onUpdateConfig, selectBox]);
  const handleOpenSettings = useCallback(() => {
    selectBox(config.boxId);
    onFocus();
    setIsSettingsOpen(true);
  }, [config.boxId, onFocus, selectBox]);
  const handleCloseSettings = useCallback(() => {
    setIsSettingsOpen(false);
  }, []);

  const handleFocus = useCallback(() => {
    selectBox(config.boxId);
    onFocus();
  }, [config.boxId, onFocus, selectBox]);

  const handleClose = useCallback(async () => {
    try {
      if (session?.isDirty) {
        await boxDocumentService.saveBox(session.boxId);
        await workspaceService.refresh();
      }
      await boxDocumentService.closeBox(config.boxId);
      onClose();
    } catch (reason) {
      console.error('[BoxWindow] Failed to close box window.', reason);
    }
  }, [config.boxId, onClose, session]);

  const handleCoverMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }

    setIsCoverDragging(true);
    coverDragMoved.current = false;
    coverDragStart.current = { x: event.clientX, y: event.clientY };
    coverInitialPosition.current = { ...config.position };
    selectBox(config.boxId);
    onFocus();
    event.preventDefault();
  }, [config.boxId, config.position, onFocus, selectBox]);

  useEffect(() => {
    if (!isCoverDragging) {
      return undefined;
    }

    const handleMouseMove = (event: MouseEvent) => {
      const zoom = canvasContext ? canvasContext.zoom : 1;
      const deltaX = (event.clientX - coverDragStart.current.x) / zoom;
      const deltaY = (event.clientY - coverDragStart.current.y) / zoom;

      if (!coverDragMoved.current && Math.abs(deltaX) + Math.abs(deltaY) > 2 / zoom) {
        coverDragMoved.current = true;
      }

      const nextPosition = {
        x: coverInitialPosition.current.x + deltaX,
        y: coverInitialPosition.current.y + deltaY,
      };
      coverRenderPositionRef.current = nextPosition;
      setCoverRenderPosition(nextPosition);
    };

    const handleMouseUp = () => {
      setIsCoverDragging(false);
      if (coverDragMoved.current) {
        onUpdateConfig({ position: coverRenderPositionRef.current });
      } else {
        handleSwitchToFile();
      }
      coverDragMoved.current = false;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [canvasContext, handleSwitchToFile, isCoverDragging, onUpdateConfig]);

  if (isCoverView) {
    const normalizedRatio = normalizeCoverRatio(coverRatio);
    const ratio = parseCoverRatio(normalizedRatio);
    const coverHeight = 280;
    const coverWidth = Math.min(240, (coverHeight * ratio.width) / ratio.height);

    return (
      <div
        className={`box-cover ${isCoverDragging ? 'box-cover--dragging' : ''}`}
        style={{
          transform: `translate(${coverRenderPosition.x}px, ${coverRenderPosition.y}px)`,
          width: `${coverWidth}px`,
        }}
        onMouseDown={handleCoverMouseDown}
      >
        <div className="box-cover__surface" style={{ aspectRatio: normalizedRatio.replace(':', ' / ') }}>
          <BoxCoverSurface
            boxPath={config.boxPath}
            title={session?.metadata.name || config.title}
            ratio={normalizedRatio}
            className="box-cover__frame"
            onActivate={handleSwitchToFile}
          />
        </div>
      </div>
    );
  }

  return (
    <CardWindowBase
      config={config}
      minWidth={520}
      minHeight={420}
      heightMode="fixed"
      resizableAxes="both"
      onUpdatePosition={handleUpdatePosition}
      onUpdateSize={handleUpdateSize}
      onFocus={handleFocus}
      onClose={() => { void handleClose(); }}
      onMinimize={handleMinimize}
      onCollapse={handleCollapse}
      headerSlot={(
        <WindowMenu
          title={session?.metadata.name || config.title}
          showCover
          showSettings
          onSwitchToCover={handleSwitchToCover}
          onSettings={handleOpenSettings}
        />
      )}
    >
      <div className="box-window">
        {isLoading ? (
          <div className="box-window__state">正在加载箱子...</div>
        ) : loadError ? (
          <div className="box-window__state box-window__state--error">{loadError}</div>
        ) : !session ? (
          <div className="box-window__state">箱子会话不可用</div>
        ) : (
          <BoxPreviewSurface
            session={session}
            className="box-window__preview"
            locale="zh-CN"
          />
        )}
      </div>
      <Suspense fallback={null}>
        <BoxSettingsDialog
          boxId={config.boxId}
          visible={isSettingsOpen}
          session={session}
          onClose={handleCloseSettings}
          onSave={handleCloseSettings}
        />
      </Suspense>
    </CardWindowBase>
  );
});

import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { useThemeRuntime } from '@chips/component-library';
import type { CompositeInteractionPayload } from 'chips-sdk';
import { CardWindowBase } from '../CardWindowBase/CardWindowBase';
import { WindowMenu } from '../WindowMenu/WindowMenu';
import { useCard } from '../../context/CardContext';
import { workspaceService } from '../../services/workspace-service';
import { useCanvas } from '../../layouts/InfiniteCanvas/CanvasContext';
import { useTranslation } from '../../hooks/useTranslation';
import type { CardWindowConfig, Position, Size } from '../../types/window';
import { CompositeCardAssembler } from '../../basecard-runtime/CompositeCardAssembler';
import './CardWindow.css';

const CardSettingsDialog = lazy(() => import('../CardSettings/CardSettingsDialog').then((module) => ({ default: module.CardSettingsDialog })));

export interface CardWindowProps {
    config: CardWindowConfig;
    onUpdateConfig: (config: Partial<CardWindowConfig>) => void;
    onClose: () => void;
    onFocus: () => void;
}

export function CardWindow({
    config,
    onUpdateConfig,
    onClose,
    onFocus
}: CardWindowProps) {
    const { openCards, activeCardId, selectedBaseCardId, setActiveCard, setSelectedBaseCard } = useCard();
    const canvasContext = useCanvas();
    const themeRuntime = useThemeRuntime();
    const { t } = useTranslation();

    const cardInfo = openCards.get(config.cardId);
    const isEditing = !!config.isEditing;
    const windowState = config.state;
    const interactionPolicy = windowState === 'normal' ? 'delegate' : 'native';
    const panByInputRef = useRef(canvasContext.panByInput);
    const zoomByFactorAtPointRef = useRef(canvasContext.zoomByFactorAtPoint);
    const markInteractionSequenceRef = useRef(canvasContext.markInteractionSequence);
    const visibleBaseCards = cardInfo?.structure.basicCards ?? [];

    const [isCoverDragging, setIsCoverDragging] = useState(false);
    const [isPreviewLoading, setIsPreviewLoading] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [previewError, setPreviewError] = useState<string | null>(null);
    const [previewHeight, setPreviewHeight] = useState<number | null>(null);
    const [coverRenderPosition, setCoverRenderPosition] = useState(config.position);

    const coverDragStart = useRef({ x: 0, y: 0 });
    const coverInitialPosition = useRef({ x: 0, y: 0 });
    const coverDragMoved = useRef(false);

    useEffect(() => {
        panByInputRef.current = canvasContext.panByInput;
        zoomByFactorAtPointRef.current = canvasContext.zoomByFactorAtPoint;
        markInteractionSequenceRef.current = canvasContext.markInteractionSequence;
    }, [
        canvasContext.markInteractionSequence,
        canvasContext.panByInput,
        canvasContext.zoomByFactorAtPoint,
    ]);

    useEffect(() => {
        if (!cardInfo || windowState === 'cover' || visibleBaseCards.length === 0) {
            setIsPreviewLoading(false);
            setPreviewError(null);
            setPreviewHeight(null);
            return;
        }

        if (previewHeight === null) {
            setIsPreviewLoading(true);
        }
    }, [cardInfo, previewHeight, visibleBaseCards.length, windowState]);

    useEffect(() => {
        if (!isCoverDragging) {
            setCoverRenderPosition(config.position);
        }
    }, [config.position, isCoverDragging]);

    const toggleEditMode = () => onUpdateConfig({ isEditing: !isEditing });
    const switchToCover = () => onUpdateConfig({ state: 'cover' });
    const restoreFromCover = () => onUpdateConfig({ state: 'normal' });

    const handleUpdatePosition = (pos: Position) => onUpdateConfig({ position: pos });
    const handleUpdateSize = (size: Size) => onUpdateConfig({ size });

    const handleUpdateTitle = async (title: string) => {
        try {
            await workspaceService.renameFile(config.cardId, `${title}.card`);
        } catch (error) {
            console.error('[CardWindow] Failed to rename card metadata.', error);
        }
    };

    const handleMinimize = () => onUpdateConfig({ state: 'minimized' });

    const handleCollapse = () => {
        const newState = windowState === 'collapsed' ? 'normal' : 'collapsed';
        onUpdateConfig({ state: newState });
    };

    const handleOpenSettings = () => {
        setIsSettingsOpen(true);
    };

    const handleCloseSettings = () => {
        setIsSettingsOpen(false);
    };

    const handleCompositeInteraction = useCallback((frame: HTMLIFrameElement, payload: CompositeInteractionPayload) => {
        if (windowState !== 'normal') {
            return;
        }

        markInteractionSequenceRef.current({ suppressDesktopZoom: true });

        if (payload.intent === 'zoom') {
            const zoomDelta = Number(payload.zoomDelta);
            if (!Number.isFinite(zoomDelta)) {
                return;
            }

            const frameRect = frame.getBoundingClientRect();
            const anchorX = frameRect.left + payload.clientX;
            const anchorY = frameRect.top + payload.clientY;
            const zoomFactor = Math.max(0.55, Math.min(1.45, 1 + zoomDelta));
            zoomByFactorAtPointRef.current(zoomFactor, anchorX, anchorY);
            return;
        }

        panByInputRef.current(payload.deltaX, payload.deltaY);
    }, [windowState]);

    const selectBaseCard = useCallback((baseCardId: string) => {
        setActiveCard(config.cardId);
        setSelectedBaseCard(baseCardId);
    }, [config.cardId, setActiveCard, setSelectedBaseCard]);

    const handleWindowFocus = () => {
        setActiveCard(config.cardId);
        onFocus();
    };

    const handleCoverMouseDown = (event: React.MouseEvent) => {
        if (event.button !== 0) return;
        setIsCoverDragging(true);
        coverDragMoved.current = false;
        coverDragStart.current = { x: event.clientX, y: event.clientY };
        coverInitialPosition.current = { ...config.position };
        setCoverRenderPosition({ ...config.position });
        event.preventDefault();
    };

    const handleCoverMouseMove = useCallback((event: MouseEvent) => {
        if (!isCoverDragging) return;
        const zoom = canvasContext?.zoom ?? 1;
        const deltaX = (event.clientX - coverDragStart.current.x) / zoom;
        const deltaY = (event.clientY - coverDragStart.current.y) / zoom;

        if (!coverDragMoved.current && Math.abs(deltaX) + Math.abs(deltaY) > 2 / zoom) {
            coverDragMoved.current = true;
        }

        setCoverRenderPosition({
            x: coverInitialPosition.current.x + deltaX,
            y: coverInitialPosition.current.y + deltaY,
        });
    }, [isCoverDragging, canvasContext]);

    const handleCoverMouseUp = useCallback(() => {
        if (isCoverDragging && !coverDragMoved.current) {
            restoreFromCover();
        } else if (isCoverDragging && coverDragMoved.current) {
            onUpdateConfig({ position: coverRenderPosition });
        }
        setIsCoverDragging(false);
        coverDragMoved.current = false;
    }, [isCoverDragging, coverRenderPosition, onUpdateConfig]);

    useEffect(() => {
        if (isCoverDragging) {
            document.addEventListener('mousemove', handleCoverMouseMove);
            document.addEventListener('mouseup', handleCoverMouseUp);
        } else {
            document.removeEventListener('mousemove', handleCoverMouseMove);
            document.removeEventListener('mouseup', handleCoverMouseUp);
        }
        return () => {
            document.removeEventListener('mousemove', handleCoverMouseMove);
            document.removeEventListener('mouseup', handleCoverMouseUp);
        };
    }, [isCoverDragging, handleCoverMouseMove, handleCoverMouseUp]);

    const coverStyle = {
        transform: `translate(${coverRenderPosition.x}px, ${coverRenderPosition.y}px)`
    };
    const previewContainerStyle: React.CSSProperties = {
        flex: '1 1 auto',
        width: '100%',
        maxWidth: '100%',
        alignSelf: 'stretch',
    };

    if (previewHeight) {
        previewContainerStyle.height = `${previewHeight}px`;
        previewContainerStyle.minHeight = `${previewHeight}px`;
    }

    if (windowState === 'cover') {
        const rawRatio = (cardInfo?.metadata?.coverRatio ?? config.coverRatio)?.replace(':', '/') || '3/4';
        return (
            <div
                className={`card-cover ${isCoverDragging ? 'card-cover--dragging' : ''}`}
                style={coverStyle}
                onMouseDown={handleCoverMouseDown}
            >
                <div className="card-cover__image" style={{ aspectRatio: rawRatio }}>
                    <div className="card-cover__placeholder">
                        {cardInfo?.metadata?.name || t('card_window.untitled')}
                    </div>
                </div>
                <div className="card-cover__title">
                    {cardInfo?.metadata?.name || t('card_window.untitled')}
                </div>
            </div>
        );
    }

    return (
        <>
            <CardWindowBase
                config={config}
                onUpdatePosition={handleUpdatePosition}
                onUpdateSize={handleUpdateSize}
                onFocus={handleWindowFocus}
                onClose={onClose}
                onMinimize={handleMinimize}
                onCollapse={handleCollapse}
                headerSlot={
                    <WindowMenu
                        title={cardInfo?.metadata?.name || t('card_window.untitled')}
                        isEditing={isEditing}
                        showLock={true}
                        showCover={true}
                        showSettings={true}
                        onToggleEdit={toggleEditMode}
                        onSwitchToCover={switchToCover}
                        onUpdateTitle={handleUpdateTitle}
                        onSettings={handleOpenSettings}
                    />
                }
            >
                <div className="card-window__content">
                    {!cardInfo ? (
                        <div className="card-window__loading">
                            <span className="card-window__loading-icon">⏳</span>
                            <span className="card-window__loading-text">{t('card_window.loading')}</span>
                        </div>
                    ) : visibleBaseCards.length === 0 ? (
                        <div className="card-window__empty">
                            <span className="card-window__empty-icon">📄</span>
                            <span className="card-window__empty-text">{t('card_window.empty')}</span>
                            {isEditing && (
                                <span className="card-window__empty-hint">{t('card_window.empty_hint')}</span>
                            )}
                        </div>
                    ) : (
                        <div className="card-window__workspace">
                            <div
                                className="card-window__preview"
                                data-chips-drop-surface="composite-preview"
                                data-chips-card-id={config.cardId}
                                data-chips-base-card-count={visibleBaseCards.length}
                                data-chips-composite-scroll-surface={interactionPolicy}
                                style={previewContainerStyle}
                            >
                                <div className="card-window__preview-frame">
                        <CompositeCardAssembler
                            cardId={config.cardId}
                            cardPath={cardInfo.path}
                            baseCards={visibleBaseCards}
                                        layout={cardInfo?.structure.layout}
                                        mode={isEditing ? 'preview' : 'view'}
                                        interactionPolicy={interactionPolicy}
                                        selectedBaseCardId={selectedBaseCardId}
                                        themeCacheKey={themeRuntime.cacheKey}
                                        onHeightChange={(height) => {
                                            setPreviewHeight((currentHeight) => currentHeight === height ? currentHeight : height);
                                        }}
                                        onLoadingChange={(loading) => {
                                            setIsPreviewLoading(loading);
                                        }}
                                        onErrorChange={(message) => {
                                            setPreviewError(message);
                                        }}
                                        onInteraction={(payload, frame) => {
                                            handleCompositeInteraction(frame, payload);
                                        }}
                                        onBaseCardSelect={(baseCardId) => {
                                            if (!isEditing) {
                                                return;
                                            }
                                            selectBaseCard(baseCardId);
                                        }}
                                    />
                                </div>

                                {isPreviewLoading && previewHeight === null && (
                                    <div className="card-window__overlay">
                                        <span className="card-window__loading-icon">⏳</span>
                                        <span className="card-window__loading-text">{t('card_window.loading')}</span>
                                    </div>
                                )}

                                {previewError && (
                                    <div className="card-window__overlay card-window__overlay--error">
                                        <span className="card-window__empty-icon">⚠️</span>
                                        <span className="card-window__empty-text">{previewError}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </CardWindowBase>
            <Suspense fallback={null}>
                <CardSettingsDialog
                    cardId={config.cardId}
                    visible={isSettingsOpen}
                    onClose={handleCloseSettings}
                    onSave={handleCloseSettings}
                />
            </Suspense>
        </>
    );
}

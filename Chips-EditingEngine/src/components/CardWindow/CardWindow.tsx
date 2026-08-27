import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FileTextOutlined, LoadingOutlined } from '@ant-design/icons';
import type { CompositeInteractionPayload } from 'chips-sdk';
import { CardWindowBase } from '../CardWindowBase/CardWindowBase';
import { WindowMenu } from '../WindowMenu/WindowMenu';
import { useCard } from '../../context/CardContext';
import { useEditorSelection } from '../../context/EditorSelectionContext';
import { getChipsClient } from '../../services/bridge-client';
import { workspaceService } from '../../services/workspace-service';
import { useCanvas } from '../../layouts/InfiniteCanvas/CanvasContext';
import type { CardWindowConfig, Position, Size } from '../../types/window';
import {
    CompositeCardAssembler,
    type BasecardResourceOpenEvent,
} from '../../basecard-runtime/CompositeCardAssembler';
import { normalizeCoverRatio, parseCoverRatio } from '../../utils/card-cover';
import './CardWindow.css';

const CardSettingsDialog = lazy(() => import('../CardSettings/CardSettingsDialog').then((module) => ({ default: module.CardSettingsDialog })));
const COVER_MAX_WIDTH = 208;
const COVER_MAX_HEIGHT = 280;

function toErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

export interface CardWindowProps {
    config: CardWindowConfig;
    onUpdateConfig: (config: Partial<CardWindowConfig>) => void;
    onClose: () => void;
    onFocus: () => void;
}

export const CardWindow = React.memo(function CardWindow({
    config,
    onUpdateConfig,
    onClose,
    onFocus
}: CardWindowProps) {
    const { openCards, activeCardId, selectedBaseCardId, setActiveCard, setSelectedBaseCard } = useCard();
    const { selectCard } = useEditorSelection();
    const canvasContext = useCanvas();

    const cardInfo = openCards.get(config.cardId);
    const isEditing = !!config.isEditing;
    const windowState = config.state;
    const interactionPolicy = windowState === 'normal' ? 'delegate' : 'native';
    const coverCardPath = cardInfo?.path;
    const coverRatioValue = cardInfo?.metadata?.coverRatio ?? config.coverRatio;
    const clientRef = useRef(getChipsClient());
    const panByInputRef = useRef(canvasContext.panByInput);
    const zoomByFactorAtPointRef = useRef(canvasContext.zoomByFactorAtPoint);
    const markInteractionSequenceRef = useRef(canvasContext.markInteractionSequence);
    const coverFrameHostRef = useRef<HTMLDivElement | null>(null);
    const coverFrameRef = useRef<HTMLIFrameElement | null>(null);
    const visibleBaseCards = useMemo(
        // 依赖 basicCards 数组引用：M2 后会话快照更新会整体替换数组，
        // 仅依赖 cardInfo 对象引用无法感知变化，会导致预览不刷新。
        () => cardInfo?.structure.basicCards ?? [],
        [cardInfo?.structure.basicCards],
    );

    const [isCoverDragging, setIsCoverDragging] = useState(false);
    const [isCoverLoading, setIsCoverLoading] = useState(false);
    const [isPreviewLoading, setIsPreviewLoading] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [coverError, setCoverError] = useState<string | null>(null);
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

    useEffect(() => {
        const host = coverFrameHostRef.current;
        if (!host) {
            return;
        }

        while (host.firstChild) {
            host.removeChild(host.firstChild);
        }
        coverFrameRef.current = null;

        if (!coverCardPath || windowState !== 'cover') {
            setIsCoverLoading(false);
            setCoverError(null);
            return;
        }

        let disposed = false;
        let frame: HTMLIFrameElement | null = null;
        let removeFrameListeners = () => undefined;

        setIsCoverLoading(true);
        setCoverError(null);

        clientRef.current.card.coverFrame.render({
            cardFile: coverCardPath,
        }).then((result) => {
            if (disposed) {
                return;
            }

            frame = result.frame;
            coverFrameRef.current = frame;
            frame.style.width = '100%';
            frame.style.height = '100%';
            frame.style.border = 'none';
            frame.style.display = 'block';
            frame.style.background = 'transparent';
            frame.style.pointerEvents = 'none';

            const handleLoad = () => {
                if (disposed) {
                    return;
                }
                setIsCoverLoading(false);
                setCoverError(null);
            };

            frame.addEventListener('load', handleLoad);
            removeFrameListeners = () => {
                frame?.removeEventListener('load', handleLoad);
            };
            host.appendChild(frame);
        }).catch((error: unknown) => {
            if (disposed) {
                return;
            }

            console.error('[CardWindow] Failed to render card cover.', {
                cardId: config.cardId,
                cardFile: coverCardPath,
                error,
            });
            setIsCoverLoading(false);
            setCoverError(error instanceof Error ? error.message : String(error));
        });

        return () => {
            disposed = true;
            removeFrameListeners();
            if (frame) {
                frame.remove();
            }
        };
    }, [config.cardId, coverCardPath, windowState]);

    const toggleEditMode = useCallback(() => onUpdateConfig({ isEditing: !isEditing }), [isEditing, onUpdateConfig]);
    const switchToCover = useCallback(() => onUpdateConfig({ state: 'cover' }), [onUpdateConfig]);
    const restoreFromCover = useCallback(() => onUpdateConfig({ state: 'normal' }), [onUpdateConfig]);

    const handleUpdatePosition = useCallback((pos: Position) => onUpdateConfig({ position: pos }), [onUpdateConfig]);
    const handleUpdateSize = useCallback((size: Size) => onUpdateConfig({ size }), [onUpdateConfig]);

    const handleUpdateTitle = useCallback(async (title: string) => {
        try {
            await workspaceService.renameFile(config.cardId, `${title}.card`);
        } catch (error) {
            console.error('[CardWindow] Failed to rename card metadata.', error);
        }
    }, [config.cardId]);

    const handleMinimize = useCallback(() => onUpdateConfig({ state: 'minimized' }), [onUpdateConfig]);

    const handleCollapse = useCallback(() => {
        const newState = windowState === 'collapsed' ? 'normal' : 'collapsed';
        onUpdateConfig({ state: newState });
    }, [onUpdateConfig, windowState]);

    const handleOpenSettings = useCallback(() => {
        setIsSettingsOpen(true);
    }, []);

    const handleCloseSettings = useCallback(() => {
        setIsSettingsOpen(false);
    }, []);

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

    const handleResourceOpen = useCallback((event: BasecardResourceOpenEvent) => {
        void clientRef.current.resource
            .open({
                intent: 'view',
                resource: event.resource,
            })
            .catch((error: unknown) => {
                const message = toErrorMessage(error);
                console.error('[CardWindow] Failed to open basecard resource through Host route.', {
                    cardId: event.cardId,
                    baseCardId: event.baseCardId,
                    cardType: event.cardType,
                    resourceId: event.resource.resourceId,
                    error,
                });
                void clientRef.current.platform.showMessage({
                    title: '资源打开失败',
                    message: `无法通过 Host 资源路由打开该资源：${message}`,
                }).catch(() => undefined);
            });
    }, []);

    const resolvePreviewResourceUrl = useCallback(async (resourcePath: string) => {
        const cardRootDir = cardInfo?.path;
        if (!cardRootDir) {
            throw new Error('卡片根目录尚未就绪，无法解析预览资源。');
        }

        return clientRef.current.card.resolveResourceUrl(cardRootDir, resourcePath);
    }, [cardInfo?.path]);

    const selectBaseCard = useCallback((baseCardId: string) => {
        setActiveCard(config.cardId);
        setSelectedBaseCard(baseCardId);
        selectCard(config.cardId, baseCardId);
    }, [config.cardId, selectCard, setActiveCard, setSelectedBaseCard]);

    const handleWindowFocus = useCallback(() => {
        const nextBaseCardId = (activeCardId === config.cardId ? selectedBaseCardId : null)
            ?? visibleBaseCards[0]?.id
            ?? null;
        setActiveCard(config.cardId);
        if (nextBaseCardId) {
            setSelectedBaseCard(nextBaseCardId);
        }
        selectCard(config.cardId, nextBaseCardId);
        onFocus();
    }, [activeCardId, config.cardId, onFocus, selectCard, selectedBaseCardId, setActiveCard, setSelectedBaseCard, visibleBaseCards]);

    const handleCoverMouseDown = useCallback((event: React.MouseEvent) => {
        if (event.button !== 0) return;
        setIsCoverDragging(true);
        coverDragMoved.current = false;
        coverDragStart.current = { x: event.clientX, y: event.clientY };
        coverInitialPosition.current = { ...config.position };
        setCoverRenderPosition({ ...config.position });
        event.preventDefault();
    }, [config.position]);

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

    const coverStyle = useMemo(() => ({
        transform: `translate(${coverRenderPosition.x}px, ${coverRenderPosition.y}px)`
    }), [coverRenderPosition.x, coverRenderPosition.y]);

    const previewContainerStyle = useMemo<React.CSSProperties>(() => {
        const style: React.CSSProperties = {
            flex: '1 1 auto',
            width: '100%',
            maxWidth: '100%',
            alignSelf: 'stretch',
        };

        if (previewHeight) {
            style.height = `${previewHeight}px`;
            style.minHeight = `${previewHeight}px`;
        }

        return style;
    }, [previewHeight]);

    if (windowState === 'cover') {
        const normalizedRatio = normalizeCoverRatio(coverRatioValue);
        const ratio = parseCoverRatio(normalizedRatio);
        const maxWidthByHeight = (COVER_MAX_HEIGHT * ratio.width) / ratio.height;
        const coverWidth = Math.min(COVER_MAX_WIDTH, maxWidthByHeight);
        return (
            <div
                className={`card-cover ${isCoverDragging ? 'card-cover--dragging' : ''}`}
                style={{
                    ...coverStyle,
                    width: `${coverWidth}px`,
                }}
                onMouseDown={handleCoverMouseDown}
            >
                <div className="card-cover__surface" style={{ aspectRatio: normalizedRatio.replace(':', ' / ') }}>
                    <div ref={coverFrameHostRef} className="card-cover__frame-host" />
                    {isCoverLoading ? (
                        <div className="card-cover__status card-cover__status--loading" />
                    ) : null}
                    {coverError ? (
                        <div className="card-cover__status card-cover__status--error" />
                    ) : null}
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
                        title={cardInfo?.metadata?.name || '无标题卡片'}
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
                            <span className="card-window__loading-icon">
                                <LoadingOutlined />
                            </span>
                            <span className="card-window__loading-text">加载中…</span>
                        </div>
                    ) : visibleBaseCards.length === 0 ? (
                        <div
                            className="card-window__empty"
                            data-chips-drop-surface="composite-preview"
                            data-chips-card-id={config.cardId}
                            data-chips-base-card-count="0"
                            data-chips-drop-accept={isEditing ? 'true' : 'false'}
                        >
                            <span className="card-window__empty-icon">
                                <FileTextOutlined />
                            </span>
                            <span className="card-window__empty-text">卡片为空</span>
                            {isEditing && (
                                <span className="card-window__empty-hint">从卡箱库拖入内容到此处</span>
                            )}
                        </div>
                    ) : (
                        <div className="card-window__workspace">
                            <div
                                className="card-window__preview"
                                data-chips-drop-surface="composite-preview"
                                data-chips-card-id={config.cardId}
                                data-chips-base-card-count={visibleBaseCards.length}
                                data-chips-drop-accept={isEditing ? 'true' : 'false'}
                                data-chips-composite-scroll-surface={interactionPolicy}
                                style={previewContainerStyle}
                            >
                                <div className="card-window__preview-frame">
                                    <CompositeCardAssembler
                                        cardId={config.cardId}
                                        baseCards={visibleBaseCards}
                                        resolveResourceUrl={resolvePreviewResourceUrl}
                                        layout={cardInfo?.structure.layout}
                                        mode={isEditing ? 'preview' : 'view'}
                                        interactionPolicy={interactionPolicy}
                                        selectedBaseCardId={selectedBaseCardId}
                                        onHeightChange={(height) => {
                                            setPreviewHeight((currentHeight) => currentHeight === height ? currentHeight : height);
                                        }}
                                        onLoadingChange={(loading) => {
                                            setIsPreviewLoading(loading);
                                        }}
                                        onErrorChange={(message) => {
                                            if (message) {
                                                console.error('[CardWindow] Basecard preview failed.', {
                                                    cardId: config.cardId,
                                                    error: message,
                                                });
                                            }
                                        }}
                                        onInteraction={(payload, frame) => {
                                            handleCompositeInteraction(frame, payload);
                                        }}
                                        onResourceOpen={handleResourceOpen}
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
                                        <span className="card-window__loading-icon">
                                            <LoadingOutlined />
                                        </span>
                                        <span className="card-window__loading-text">加载中…</span>
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
});

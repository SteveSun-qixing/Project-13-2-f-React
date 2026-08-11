import React, { startTransition, useDeferredValue, useEffect, useRef, useState } from 'react';
import { Button, Segmented, Tabs, Tooltip } from 'antd';
import { DeleteOutlined, PictureOutlined } from '@ant-design/icons';
import { fileService } from '../../../services/file-service';
import { formatMessage } from '../../../lib/messages';
import {
  createDefaultCoverHtml,
  createImageCoverHtml,
  DEFAULT_COVER_RATIO,
  extractGeneratedImageSource,
  normalizeCoverRatio,
  swapCoverRatio,
  type CardCoverResource,
} from '../../../utils/card-cover';
import { CoverCropDialog } from './CoverCropDialog';
import { resolveCoverPreviewFrameSize, type CoverPreviewFrameSize } from './cover-panel-layout';
import './CoverPanel.css';

type CoverEditorMode = 'image' | 'html';
type CoverOrientation = 'portrait' | 'landscape';
type EditorTabId = 'ratio' | 'content';

interface RatioPreset {
  id: string;
  ratio: string;
  labelKey: string;
}

interface ImageDraft {
  fileName: string;
  sourceUrl: string;
  previewUrl: string;
  resource: CardCoverResource;
}

export interface CoverPanelDraft {
  html: string;
  ratio: string;
  resources: CardCoverResource[];
  dirty: boolean;
  valid: boolean;
}

interface CoverPanelProps {
  cardId: string;
  cardPath: string;
  cardName: string;
  packageDirectoryName?: '.card' | '.box';
  assetDirectoryName?: string;
  currentCoverHtml?: string;
  currentRatio?: string;
  onDraftChange?: (draft: CoverPanelDraft) => void;
}

const EMPTY_RESOURCES: CardCoverResource[] = [];

const COVER_RATIO_PRESETS: RatioPreset[] = [
  { id: 'square', ratio: '1:1', labelKey: 'card_settings.cover_ratio_square' },
  { id: 'book', ratio: '1:1.414', labelKey: 'card_settings.cover_ratio_book' },
  { id: 'photo', ratio: '2:3', labelKey: 'card_settings.cover_ratio_photo' },
  { id: 'standard-photo', ratio: '3:4', labelKey: 'card_settings.cover_ratio_standard_photo' },
  { id: 'golden', ratio: '1:1.618', labelKey: 'card_settings.cover_ratio_golden' },
  { id: 'cinema', ratio: '16:9', labelKey: 'card_settings.cover_ratio_cinema' },
  { id: 'banner', ratio: '2:1', labelKey: 'card_settings.cover_ratio_banner' },
  { id: 'phone', ratio: '9:19.5', labelKey: 'card_settings.cover_ratio_phone' },
  { id: 'magazine', ratio: '1.58:1', labelKey: 'card_settings.cover_ratio_magazine' },
];

function joinPath(...parts: string[]): string {
  return parts.filter(Boolean).join('/').replace(/\\/g, '/').replace(/\/+/g, '/');
}

function guessMimeType(filePath: string): string {
  const lowerPath = filePath.toLowerCase();
  if (lowerPath.endsWith('.png')) {
    return 'image/png';
  }
  if (lowerPath.endsWith('.webp')) {
    return 'image/webp';
  }
  if (lowerPath.endsWith('.gif')) {
    return 'image/gif';
  }
  return 'image/jpeg';
}

function getImageExtension(fileName: string, mimeType: string): string {
  const lowerFileName = fileName.toLowerCase();
  if (lowerFileName.endsWith('.png') || mimeType === 'image/png') {
    return 'png';
  }
  if (lowerFileName.endsWith('.webp') || mimeType === 'image/webp') {
    return 'webp';
  }
  if (lowerFileName.endsWith('.gif') || mimeType === 'image/gif') {
    return 'gif';
  }
  return 'jpg';
}

function revokeUrls(urls: Array<string | null | undefined>): void {
  const uniqueUrls = new Set(urls.filter((url): url is string => Boolean(url)));
  uniqueUrls.forEach((url) => {
    URL.revokeObjectURL(url);
  });
}

function resolveInitialMode(html: string): CoverEditorMode {
  return extractGeneratedImageSource(html) ? 'image' : 'html';
}

function resolveRatioPresetId(ratio: string): string {
  const normalizedRatio = normalizeCoverRatio(ratio);
  const matched = COVER_RATIO_PRESETS.find((item) => (
    item.ratio === normalizedRatio || swapCoverRatio(item.ratio) === normalizedRatio
  ));
  return matched?.id ?? 'standard-photo';
}

function resolveOrientation(ratio: string, presetId: string): CoverOrientation {
  const preset = COVER_RATIO_PRESETS.find((item) => item.id === presetId) ?? COVER_RATIO_PRESETS[3];
  return normalizeCoverRatio(ratio) === swapCoverRatio(preset.ratio) ? 'landscape' : 'portrait';
}

function resolveRatioValue(presetId: string, orientation: CoverOrientation): string {
  const preset = COVER_RATIO_PRESETS.find((item) => item.id === presetId) ?? COVER_RATIO_PRESETS[3];
  return orientation === 'portrait' ? preset.ratio : swapCoverRatio(preset.ratio);
}

function resolveResourceSourcePath(resourcePath: string): string {
  return resourcePath.startsWith('./') ? resourcePath : `./${resourcePath}`;
}

export function CoverPanel({
  cardId,
  cardPath,
  cardName,
  packageDirectoryName = '.card',
  assetDirectoryName = 'cardcover',
  currentCoverHtml,
  currentRatio,
  onDraftChange,
}: CoverPanelProps) {
  const imageDraftRef = useRef<ImageDraft | null>(null);
  const savedPreviewUrlRef = useRef<string | null>(null);
  const previewShellRef = useRef<HTMLDivElement | null>(null);

  const initialHtml = currentCoverHtml?.trim() ? currentCoverHtml : createDefaultCoverHtml(cardName);
  const initialRatio = normalizeCoverRatio(currentRatio ?? DEFAULT_COVER_RATIO);
  const initialMode = resolveInitialMode(initialHtml);
  const initialPresetId = resolveRatioPresetId(initialRatio);
  const initialOrientation = resolveOrientation(initialRatio, initialPresetId);
  const initialGeneratedImageSource = extractGeneratedImageSource(initialHtml);

  const [mode, setMode] = useState<CoverEditorMode>(initialMode);
  const [editorTab, setEditorTab] = useState<EditorTabId>('ratio');
  const [selectedPresetId, setSelectedPresetId] = useState(initialPresetId);
  const [orientation, setOrientation] = useState<CoverOrientation>(initialOrientation);
  const [htmlCode, setHtmlCode] = useState(initialHtml);
  const [imageDraft, setImageDraft] = useState<ImageDraft | null>(null);
  const [savedImagePreviewUrl, setSavedImagePreviewUrl] = useState<string | null>(null);
  const [isCropDialogOpen, setIsCropDialogOpen] = useState(false);
  const [previewContainerSize, setPreviewContainerSize] = useState<CoverPreviewFrameSize>({ width: 0, height: 0 });
  const deferredHtmlCode = useDeferredValue(htmlCode);

  useEffect(() => {
    setMode(initialMode);
    setSelectedPresetId(initialPresetId);
    setOrientation(initialOrientation);
    setHtmlCode(initialHtml);
    revokeUrls([
      imageDraftRef.current?.previewUrl,
      imageDraftRef.current?.sourceUrl,
      savedPreviewUrlRef.current,
    ]);
    imageDraftRef.current = null;
    savedPreviewUrlRef.current = null;
    setImageDraft(null);
    setSavedImagePreviewUrl(null);
  }, [initialHtml, initialMode, initialOrientation, initialPresetId]);

  useEffect(() => {
    return () => {
      revokeUrls([
        imageDraftRef.current?.previewUrl,
        imageDraftRef.current?.sourceUrl,
        savedPreviewUrlRef.current,
      ]);
    };
  }, []);

  useEffect(() => {
    let disposed = false;

    if (!initialGeneratedImageSource || imageDraft) {
      if (savedPreviewUrlRef.current) {
        revokeUrls([savedPreviewUrlRef.current]);
        savedPreviewUrlRef.current = null;
        setSavedImagePreviewUrl(null);
      }
      return undefined;
    }

    const resourcePath = joinPath(cardPath, packageDirectoryName, initialGeneratedImageSource.replace(/^\.\//, ''));

    void (async () => {
      try {
        const resourceData = await fileService.readBinary(resourcePath);
        if (disposed) {
          return;
        }

        const arrayBuffer = resourceData.buffer.slice(
          resourceData.byteOffset,
          resourceData.byteOffset + resourceData.byteLength,
        ) as ArrayBuffer;
        const blob = new Blob([arrayBuffer], { type: guessMimeType(resourcePath) });
        const nextPreviewUrl = URL.createObjectURL(blob);
        revokeUrls([savedPreviewUrlRef.current]);
        savedPreviewUrlRef.current = nextPreviewUrl;
        setSavedImagePreviewUrl(nextPreviewUrl);
      } catch (error) {
        if (!disposed) {
          console.error('[CoverPanel] Failed to load current cover asset preview.', {
            cardId,
            resourcePath,
            error,
          });
        }
      }
    })();

    return () => {
      disposed = true;
    };
  }, [cardId, cardPath, imageDraft, initialGeneratedImageSource]);

  const activeRatio = resolveRatioValue(selectedPresetId, orientation);
  const activeImagePreviewUrl = imageDraft?.previewUrl ?? savedImagePreviewUrl;
  const activeGeneratedSource = imageDraft
    ? resolveResourceSourcePath(imageDraft.resource.path)
    : initialGeneratedImageSource;

  let previewHtml = '';
  if (mode === 'image') {
    if (activeImagePreviewUrl) {
      previewHtml = createImageCoverHtml(activeImagePreviewUrl);
    }
  } else {
    previewHtml = deferredHtmlCode;
    if (activeGeneratedSource && activeImagePreviewUrl && previewHtml.includes(activeGeneratedSource)) {
      previewHtml = previewHtml.split(activeGeneratedSource).join(activeImagePreviewUrl);
    }
  }

  const imageModeHtml = activeGeneratedSource
    ? createImageCoverHtml(activeGeneratedSource)
    : '';
  const draftHtml = mode === 'image' ? imageModeHtml : htmlCode;
  const isDraftValid = mode === 'image' ? Boolean(activeGeneratedSource) : Boolean(htmlCode.trim());
  const isDraftDirty = (
    draftHtml !== initialHtml
    || activeRatio !== initialRatio
    || mode !== initialMode
    || Boolean(imageDraft)
  );

  const previewFrameSize = resolveCoverPreviewFrameSize({
    ratio: activeRatio,
    containerWidth: previewContainerSize.width,
    containerHeight: previewContainerSize.height,
    preferredWidth: 240,
    horizontalPadding: 32,
    verticalPadding: 16,
  });

  useEffect(() => {
    const previewShell = previewShellRef.current;
    if (!previewShell) {
      return undefined;
    }

    const updatePreviewContainerSize = () => {
      const nextSize = {
        width: previewShell.clientWidth,
        height: previewShell.clientHeight,
      };

      setPreviewContainerSize((currentSize) => (
        currentSize.width === nextSize.width && currentSize.height === nextSize.height
          ? currentSize
          : nextSize
      ));
    };

    updatePreviewContainerSize();

    if (typeof ResizeObserver === 'undefined') {
      return undefined;
    }

    const resizeObserver = new ResizeObserver(updatePreviewContainerSize);
    resizeObserver.observe(previewShell);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    onDraftChange?.({
      html: draftHtml,
      ratio: activeRatio,
      resources: mode === 'image' && imageDraft ? [imageDraft.resource] : EMPTY_RESOURCES,
      dirty: isDraftDirty,
      valid: isDraftValid,
    });
  }, [activeRatio, draftHtml, imageDraft, isDraftDirty, isDraftValid, mode, onDraftChange]);

  const ratioOptions = COVER_RATIO_PRESETS.map((item) => ({
    ...item,
    label: formatMessage(item.labelKey),
  }));

  const replaceImageDraft = (nextDraft: ImageDraft | null) => {
    revokeUrls([
      imageDraftRef.current?.previewUrl,
      imageDraftRef.current?.sourceUrl,
    ]);
    imageDraftRef.current = nextDraft;
    startTransition(() => {
      setImageDraft(nextDraft);
    });
  };

  const handleUploadImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) {
      return;
    }

    const fileData = new Uint8Array(await file.arrayBuffer());
    const extension = getImageExtension(file.name, file.type);
    const sourceUrl = URL.createObjectURL(file);
    const nextDraft: ImageDraft = {
      fileName: file.name,
      sourceUrl,
      previewUrl: sourceUrl,
      resource: {
        path: `${assetDirectoryName}/cover-image.${extension}`,
        data: fileData,
      },
    };

    setMode('image');
    replaceImageDraft(nextDraft);
    event.target.value = '';
  };

  const handleRemoveUploadedImage = () => {
    replaceImageDraft(null);
  };

  const handleApplyCrop = (result: { data: Uint8Array; previewUrl: string; mimeType: string }) => {
    void result.mimeType;
    const currentDraft = imageDraftRef.current;
    if (!currentDraft) {
      revokeUrls([result.previewUrl]);
      return;
    }

    const nextDraft: ImageDraft = {
      ...currentDraft,
      previewUrl: result.previewUrl,
      resource: {
        path: `${assetDirectoryName}/cover-image.png`,
        data: result.data,
      },
    };

    revokeUrls([currentDraft.previewUrl === currentDraft.sourceUrl ? null : currentDraft.previewUrl]);
    imageDraftRef.current = nextDraft;
    startTransition(() => {
      setImageDraft(nextDraft);
      setIsCropDialogOpen(false);
    });
  };

  return (
    <div className="cover-panel">
      <div className="cover-panel__preview-pane">
        <div className="cover-panel__preview-header">
          <h3 className="cover-panel__section-title">{formatMessage('card_settings.cover_preview_title')}</h3>

          <span className="cover-panel__preview-ratio">
            {formatMessage('card_settings.cover_preview_ratio', { ratio: activeRatio })}
          </span>
        </div>

        <div ref={previewShellRef} className="cover-panel__preview-shell">
          <div
            className="cover-panel__preview-frame"
            style={{
              aspectRatio: activeRatio.replace(':', ' / '),
              ...(previewFrameSize.width > 0 && previewFrameSize.height > 0
                ? {
                    width: `${previewFrameSize.width}px`,
                    height: `${previewFrameSize.height}px`,
                  }
                : {}),
            }}
          >
            {previewHtml ? (
              <iframe
                key={`${mode}-${activeRatio}-${Boolean(activeImagePreviewUrl)}`}
                title={formatMessage('card_settings.cover_preview_title')}
                className="cover-panel__preview-iframe"
                sandbox="allow-scripts"
                srcDoc={previewHtml}
              />
            ) : (
              <div className="cover-panel__preview-empty">
                <span className="cover-panel__preview-empty-title">
                  {formatMessage('card_settings.cover_preview_empty_title')}
                </span>
                <span className="cover-panel__preview-empty-text">
                  {mode === 'image'
                    ? formatMessage('card_settings.cover_preview_empty_image')
                    : formatMessage('card_settings.cover_preview_empty_html')}
                </span>
              </div>
            )}
          </div>

        </div>
      </div>

      <div className="cover-panel__editor-pane">
        <Tabs
          className="cover-panel__editor-tabs"
          activeKey={editorTab}
          onChange={(key: string) => setEditorTab(key as EditorTabId)}
          items={[
            {
              key: 'ratio',
              label: formatMessage('card_settings.cover_tab_ratio'),
              children: (
                <div className="cover-panel__editor-scroll">
                  <section className="cover-panel__section">
                    <div className="cover-panel__section-header">
                      <h3 className="cover-panel__section-title">{formatMessage('card_settings.cover_ratio_label')}</h3>
                    </div>

                    <div className="cover-panel__ratio-grid">
                      {ratioOptions.map((item) => (
                        <Tooltip key={item.id} title={item.label} placement="top">
                          <button
                            type="button"
                            className={`cover-panel__ratio-card ${selectedPresetId === item.id ? 'cover-panel__ratio-card--active' : ''}`}
                            onClick={() => setSelectedPresetId(item.id)}
                            aria-label={item.label}
                          >
                            <span
                              className="cover-panel__ratio-card-shape"
                              style={{ aspectRatio: item.ratio.replace(':', ' / ') }}
                            />
                            <span className="cover-panel__ratio-card-label">{item.label}</span>
                          </button>
                        </Tooltip>
                      ))}
                    </div>

                    <div className="cover-panel__orientation-row">
                      <span className="cover-panel__orientation-label">
                        {formatMessage('card_settings.cover_orientation_label')}
                      </span>
                      <Segmented
                        value={orientation}
                        onChange={(value) => setOrientation(value as CoverOrientation)}
                        options={[
                          { value: 'portrait', label: formatMessage('card_settings.cover_orientation_portrait') },
                          { value: 'landscape', label: formatMessage('card_settings.cover_orientation_landscape') },
                        ]}
                      />
                    </div>
                  </section>
                </div>
              ),
            },
            {
              key: 'content',
              label: formatMessage('card_settings.cover_tab_content'),
              children: (
                <div className="cover-panel__editor-scroll">
                  <section className="cover-panel__section">
                    <div className="cover-panel__section-header">
                      <h3 className="cover-panel__section-title">{formatMessage('card_settings.cover_mode_label')}</h3>
                    </div>

                    <Segmented
                      value={mode}
                      onChange={(value) => setMode(value as CoverEditorMode)}
                      options={[
                        { value: 'image', label: formatMessage('cover_maker.mode_image') },
                        { value: 'html', label: formatMessage('cover_maker.mode_html') },
                      ]}
                    />
                  </section>

                  {mode === 'image' ? (
                    <section className="cover-panel__section">
                      <div className="cover-panel__section-header">
                        <h3 className="cover-panel__section-title">{formatMessage('card_settings.cover_image_title')}</h3>
                      </div>

                      <label className="cover-panel__upload-card">
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/gif"
                          className="cover-panel__file-input"
                          onChange={(event) => {
                            void handleUploadImage(event);
                          }}
                        />
                        <span className="cover-panel__upload-icon">
                          <PictureOutlined />
                        </span>
                        <span className="cover-panel__upload-title">{formatMessage('cover_maker.image_upload_text')}</span>
                        <span className="cover-panel__upload-hint">{formatMessage('cover_maker.image_upload_hint')}</span>
                      </label>

                      {imageDraft ? (
                        <div className="cover-panel__asset-card">
                          <div className="cover-panel__asset-info">
                            <span className="cover-panel__asset-title">{imageDraft.fileName}</span>
                            <span className="cover-panel__asset-meta">
                              {formatMessage('card_settings.cover_image_ready')}
                            </span>
                          </div>

                          <div className="cover-panel__asset-actions">
                            <Button
                              type="primary"
                              size="small"
                              onClick={() => setIsCropDialogOpen(true)}
                            >
                              {formatMessage('card_settings.cover_crop_action')}
                            </Button>
                            <Tooltip title={formatMessage('cover_maker.remove')}>
                              <Button
                                size="small"
                                icon={<DeleteOutlined />}
                                onClick={handleRemoveUploadedImage}
                              />
                            </Tooltip>
                          </div>
                        </div>
                      ) : initialMode === 'image' ? (
                        <div className="cover-panel__info-card">
                          <span className="cover-panel__info-title">{formatMessage('card_settings.cover_image_current_title')}</span>
                          <span className="cover-panel__info-text">
                            {formatMessage('card_settings.cover_image_current_desc')}
                          </span>
                        </div>
                      ) : (
                        <div className="cover-panel__info-card">
                          <span className="cover-panel__info-title">{formatMessage('card_settings.cover_image_waiting_title')}</span>
                          <span className="cover-panel__info-text">
                            {formatMessage('card_settings.cover_image_waiting_desc')}
                          </span>
                        </div>
                      )}
                    </section>
                  ) : (
                    <section className="cover-panel__section">
                      <div className="cover-panel__section-header">
                        <h3 className="cover-panel__section-title">{formatMessage('card_settings.cover_html_title')}</h3>
                      </div>

                      <textarea
                        value={htmlCode}
                        className="cover-panel__html-input"
                        spellCheck={false}
                        onChange={(event) => setHtmlCode(event.target.value)}
                        placeholder={formatMessage('cover_maker.html_placeholder')}
                      />
                    </section>
                  )}
                </div>
              ),
            },
          ]}
        />
      </div>

      {imageDraft ? (
        <CoverCropDialog
          open={isCropDialogOpen}
          imageUrl={imageDraft.sourceUrl}
          ratio={activeRatio}
          onClose={() => setIsCropDialogOpen(false)}
          onConfirm={handleApplyCrop}
        />
      ) : null}
    </div>
  );
}

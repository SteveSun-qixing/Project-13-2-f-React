import React, { startTransition, useDeferredValue, useEffect, useRef, useState } from 'react';
import { fileService } from '../../../services/file-service';
import { useTranslation } from '../../../hooks/useTranslation';
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
import './CoverPanel.css';

type CoverEditorMode = 'image' | 'html';
type CoverOrientation = 'portrait' | 'landscape';

interface RatioPreset {
  id: string;
  ratio: string;
  labelKey: string;
  fallbackLabel: string;
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
  currentCoverHtml?: string;
  currentRatio?: string;
  onDraftChange?: (draft: CoverPanelDraft) => void;
}

const EMPTY_RESOURCES: CardCoverResource[] = [];

const COVER_RATIO_PRESETS: RatioPreset[] = [
  { id: 'square', ratio: '1:1', labelKey: 'card_settings.cover_ratio_square', fallbackLabel: '1:1（正方形）' },
  { id: 'book', ratio: '1:1.414', labelKey: 'card_settings.cover_ratio_book', fallbackLabel: '1:1.414（书本比例）' },
  { id: 'photo', ratio: '2:3', labelKey: 'card_settings.cover_ratio_photo', fallbackLabel: '2:3（照片比例）' },
  { id: 'standard-photo', ratio: '3:4', labelKey: 'card_settings.cover_ratio_standard_photo', fallbackLabel: '3:4（标准照片）' },
  { id: 'golden', ratio: '1:1.618', labelKey: 'card_settings.cover_ratio_golden', fallbackLabel: '1:1.618（黄金比例）' },
  { id: 'cinema', ratio: '16:9', labelKey: 'card_settings.cover_ratio_cinema', fallbackLabel: '16:9（电影比例）' },
  { id: 'banner', ratio: '2:1', labelKey: 'card_settings.cover_ratio_banner', fallbackLabel: '2:1（横幅比例）' },
  { id: 'phone', ratio: '9:19.5', labelKey: 'card_settings.cover_ratio_phone', fallbackLabel: '9:19.5（手机比例）' },
  { id: 'magazine', ratio: '1.58:1', labelKey: 'card_settings.cover_ratio_magazine', fallbackLabel: '1.58:1（杂志比例）' },
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
  currentCoverHtml,
  currentRatio,
  onDraftChange,
}: CoverPanelProps) {
  const { t } = useTranslation();
  const imageDraftRef = useRef<ImageDraft | null>(null);
  const savedPreviewUrlRef = useRef<string | null>(null);

  const initialHtml = currentCoverHtml?.trim() ? currentCoverHtml : createDefaultCoverHtml(cardName);
  const initialRatio = normalizeCoverRatio(currentRatio ?? DEFAULT_COVER_RATIO);
  const initialMode = resolveInitialMode(initialHtml);
  const initialPresetId = resolveRatioPresetId(initialRatio);
  const initialOrientation = resolveOrientation(initialRatio, initialPresetId);
  const initialGeneratedImageSource = extractGeneratedImageSource(initialHtml);

  const [mode, setMode] = useState<CoverEditorMode>(initialMode);
  const [selectedPresetId, setSelectedPresetId] = useState(initialPresetId);
  const [orientation, setOrientation] = useState<CoverOrientation>(initialOrientation);
  const [htmlCode, setHtmlCode] = useState(initialHtml);
  const [imageDraft, setImageDraft] = useState<ImageDraft | null>(null);
  const [savedImagePreviewUrl, setSavedImagePreviewUrl] = useState<string | null>(null);
  const [isCropDialogOpen, setIsCropDialogOpen] = useState(false);
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

    const resourcePath = joinPath(cardPath, initialGeneratedImageSource.replace(/^\.\//, ''));

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
    label: t(item.labelKey) || item.fallbackLabel,
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
        path: `cardcover/cover-image.${extension}`,
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
        path: 'cardcover/cover-image.png',
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
          <div>
            <h3 className="cover-panel__section-title">{t('card_settings.cover_preview_title') || '封面预览'}</h3>
            <p className="cover-panel__section-desc">
              {t('card_settings.cover_preview_desc') || '左侧窗口实时显示当前 cover.html 的效果。'}
            </p>
          </div>

          <span className="cover-panel__preview-ratio">
            {(t('card_settings.cover_preview_ratio') || '比例 {ratio}').replace('{ratio}', activeRatio)}
          </span>
        </div>

        <div className="cover-panel__preview-shell">
          <div className="cover-panel__preview-frame" style={{ aspectRatio: activeRatio.replace(':', ' / ') }}>
            {previewHtml ? (
              <iframe
                key={`${mode}-${activeRatio}-${Boolean(activeImagePreviewUrl)}`}
                title={t('card_settings.cover_preview_title') || '封面预览'}
                className="cover-panel__preview-iframe"
                sandbox="allow-scripts"
                srcDoc={previewHtml}
              />
            ) : (
              <div className="cover-panel__preview-empty">
                <span className="cover-panel__preview-empty-title">
                  {t('card_settings.cover_preview_empty_title') || '等待生成封面'}
                </span>
                <span className="cover-panel__preview-empty-text">
                  {mode === 'image'
                    ? (t('card_settings.cover_preview_empty_image') || '上传图片后会在这里实时预览。')
                    : (t('card_settings.cover_preview_empty_html') || '输入 HTML 代码后会在这里实时预览。')}
                </span>
              </div>
            )}
          </div>

          <div className="cover-panel__preview-caption">
            <span>{cardName}</span>
            <span>{t('card_settings.cover_preview_runtime_note') || '封面最终以 cover.html 独立输出，不继承主题和多语言。'}</span>
          </div>
        </div>
      </div>

      <div className="cover-panel__editor-pane">
        <div className="cover-panel__editor-scroll">
          <section className="cover-panel__section">
            <div className="cover-panel__section-header">
              <h3 className="cover-panel__section-title">{t('card_settings.cover_ratio_label') || '封面比例'}</h3>
              <p className="cover-panel__section-desc">
                {t('card_settings.cover_ratio_desc') || '默认使用 3:4 竖版，支持在同一比例下切换横竖方向。'}
              </p>
            </div>

            <div className="cover-panel__ratio-grid">
              {ratioOptions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`cover-panel__ratio-card ${selectedPresetId === item.id ? 'cover-panel__ratio-card--active' : ''}`}
                  onClick={() => setSelectedPresetId(item.id)}
                >
                  <span className="cover-panel__ratio-card-label">{item.label}</span>
                </button>
              ))}
            </div>

            <div className="cover-panel__segmented">
              <button
                type="button"
                className={`cover-panel__segmented-button ${orientation === 'portrait' ? 'cover-panel__segmented-button--active' : ''}`}
                onClick={() => setOrientation('portrait')}
              >
                {t('card_settings.cover_orientation_portrait') || '竖版'}
              </button>
              <button
                type="button"
                className={`cover-panel__segmented-button ${orientation === 'landscape' ? 'cover-panel__segmented-button--active' : ''}`}
                onClick={() => setOrientation('landscape')}
              >
                {t('card_settings.cover_orientation_landscape') || '横版'}
              </button>
            </div>
          </section>

          <section className="cover-panel__section">
            <div className="cover-panel__section-header">
              <h3 className="cover-panel__section-title">{t('card_settings.cover_mode_label') || '编辑模式'}</h3>
              <p className="cover-panel__section-desc">
                {t('card_settings.cover_mode_desc') || '封面最终都会落到 cover.html，这里只决定生成方式。'}
              </p>
            </div>

            <div className="cover-panel__segmented">
              <button
                type="button"
                className={`cover-panel__segmented-button ${mode === 'image' ? 'cover-panel__segmented-button--active' : ''}`}
                onClick={() => setMode('image')}
              >
                {t('cover_maker.mode_image') || '图片封面'}
              </button>
              <button
                type="button"
                className={`cover-panel__segmented-button ${mode === 'html' ? 'cover-panel__segmented-button--active' : ''}`}
                onClick={() => setMode('html')}
              >
                {t('cover_maker.mode_html') || 'HTML封面'}
              </button>
            </div>
          </section>

          {mode === 'image' ? (
            <section className="cover-panel__section">
              <div className="cover-panel__section-header">
                <h3 className="cover-panel__section-title">{t('card_settings.cover_image_title') || '上传图片'}</h3>
                <p className="cover-panel__section-desc">
                  {t('card_settings.cover_image_desc') || '上传后可打开裁剪弹窗，按当前比例生成最终封面图片。'}
                </p>
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

                <span className="cover-panel__upload-title">{t('cover_maker.image_upload_text') || '点击或拖拽图片到此处上传'}</span>
                <span className="cover-panel__upload-hint">{t('cover_maker.image_upload_hint') || '建议比例 3:4，文件大小不超过 5MB'}</span>
              </label>

              {imageDraft ? (
                <div className="cover-panel__asset-card">
                  <div className="cover-panel__asset-info">
                    <span className="cover-panel__asset-title">{imageDraft.fileName}</span>
                    <span className="cover-panel__asset-meta">
                      {t('card_settings.cover_image_ready') || '已载入图片，可继续裁剪或直接保存。'}
                    </span>
                  </div>

                  <div className="cover-panel__asset-actions">
                    <button
                      type="button"
                      className="cover-panel__action-button cover-panel__action-button--primary"
                      onClick={() => setIsCropDialogOpen(true)}
                    >
                      {t('card_settings.cover_crop_action') || '裁剪'}
                    </button>
                    <button
                      type="button"
                      className="cover-panel__action-button"
                      onClick={handleRemoveUploadedImage}
                    >
                      {t('cover_maker.remove') || '删除'}
                    </button>
                  </div>
                </div>
              ) : initialMode === 'image' ? (
                <div className="cover-panel__info-card">
                  <span className="cover-panel__info-title">{t('card_settings.cover_image_current_title') || '当前封面来自已保存图片'}</span>
                  <span className="cover-panel__info-text">
                    {t('card_settings.cover_image_current_desc') || '如果需要替换或重新裁剪，请重新上传一张图片。'}
                  </span>
                </div>
              ) : (
                <div className="cover-panel__info-card">
                  <span className="cover-panel__info-title">{t('card_settings.cover_image_waiting_title') || '尚未选择图片'}</span>
                  <span className="cover-panel__info-text">
                    {t('card_settings.cover_image_waiting_desc') || '上传图片后会自动生成引用该图片的 cover.html。'}
                  </span>
                </div>
              )}
            </section>
          ) : (
            <section className="cover-panel__section">
              <div className="cover-panel__section-header">
                <h3 className="cover-panel__section-title">{t('card_settings.cover_html_title') || 'cover.html 代码'}</h3>
                <p className="cover-panel__section-desc">
                  {t('card_settings.cover_html_desc') || '这里输入的内容会直接写入 cover.html。'}
                </p>
              </div>

              <textarea
                value={htmlCode}
                className="cover-panel__html-input"
                spellCheck={false}
                onChange={(event) => setHtmlCode(event.target.value)}
                placeholder={t('cover_maker.html_placeholder') || '输入 <html>...</html>'}
              />
            </section>
          )}
        </div>
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

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import type { IconDescriptor } from 'chips-sdk';
import { formatMessage } from '../../lib/messages';
import type {
  CoverCreationMode,
  TemplateStyle,
  TemplateConfig,
  CoverData,
  CoverMakerProps,
} from './types';
import { TemplateGrid } from './TemplateGrid';
import { TemplatePreview } from './TemplatePreview';
import { generateImageCoverHtml } from './templates/index';
import { ENGINE_ICONS } from '../../icons/descriptors';
import { RuntimeIcon } from '../../icons/RuntimeIcon';
import './CoverMaker.css';

export function CoverMaker({
  cardId,
  currentCoverHtml,
  visible,
  onClose,
  onSave,
  onPreview,
}: CoverMakerProps) {
  const titleId = useMemo(() => `cover-maker-title-${cardId}`, [cardId]);

  const [currentMode, setCurrentMode] = useState<CoverCreationMode>('template');

  const modeOptions = useMemo(() => [
    { id: 'image' as CoverCreationMode, name: formatMessage('cover_maker.mode_image'), icon: ENGINE_ICONS.image, description: formatMessage('cover_maker.mode_image_desc') },
    { id: 'html' as CoverCreationMode, name: formatMessage('cover_maker.mode_html'), icon: ENGINE_ICONS.code, description: formatMessage('cover_maker.mode_html_desc') },
    { id: 'zip' as CoverCreationMode, name: formatMessage('cover_maker.mode_zip'), icon: ENGINE_ICONS.zip, description: formatMessage('cover_maker.mode_zip_desc') },
    { id: 'template' as CoverCreationMode, name: formatMessage('cover_maker.mode_template'), icon: ENGINE_ICONS.palette, description: formatMessage('cover_maker.mode_template_desc') },
  ] satisfies Array<{ id: CoverCreationMode; name: string; icon: IconDescriptor; description: string }>, []);

  // Image mode state
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  // HTML mode state
  const [htmlCode, setHtmlCode] = useState('');

  // ZIP mode state
  const [selectedZip, setSelectedZip] = useState<File | null>(null);
  const [zipFileName, setZipFileName] = useState<string | null>(null);

  // Template mode state
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateStyle | null>('minimal-white');
  const [templateConfig, setTemplateConfig] = useState<TemplateConfig>({
    title: '',
    subtitle: '',
    author: '',
    date: '',
  });

  const [generatedHtml, setGeneratedHtml] = useState<string>('');

  const coverRatios = useMemo(() => [
    { value: '1/1', label: formatMessage('cover_maker.ratio_square') },
    { value: '3/4', label: formatMessage('cover_maker.ratio_standard') },
    { value: '4/3', label: formatMessage('cover_maker.ratio_landscape') },
    { value: '9/16', label: formatMessage('cover_maker.ratio_phone') },
    { value: '16/9', label: formatMessage('cover_maker.ratio_video') },
    { value: '2/3', label: formatMessage('cover_maker.ratio_book') },
  ], []);

  const [selectedRatio, setSelectedRatio] = useState('3/4');

  const canSave = useMemo(() => {
    switch (currentMode) {
      case 'image':
        return selectedImage !== null;
      case 'html':
        return htmlCode.trim().length > 0;
      case 'zip':
        return selectedZip !== null;
      case 'template':
        return selectedTemplate !== null && templateConfig.title.trim().length > 0;
      default:
        return false;
    }
  }, [currentMode, selectedImage, htmlCode, selectedZip, selectedTemplate, templateConfig.title]);

  const previewHtml = useMemo(() => {
    switch (currentMode) {
      case 'image':
        if (imagePreviewUrl) {
          return generateImageCoverHtml(imagePreviewUrl);
        }
        return '';
      case 'html':
        return htmlCode;
      case 'template':
        return generatedHtml;
      default:
        return '';
    }
  }, [currentMode, imagePreviewUrl, htmlCode, generatedHtml]);

  const switchMode = (mode: CoverCreationMode) => {
    setCurrentMode(mode);
  };

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setSelectedImage(file);
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
      setImagePreviewUrl(URL.createObjectURL(file));
    }
  };

  const clearImage = () => {
    setSelectedImage(null);
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
      setImagePreviewUrl(null);
    }
  };

  const handleZipSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && (file.type === 'application/zip' || file.name.endsWith('.zip'))) {
      setSelectedZip(file);
      setZipFileName(file.name);
    }
  };

  const clearZip = () => {
    setSelectedZip(null);
    setZipFileName(null);
  };

  const handleHtmlGenerated = (html: string) => {
    setGeneratedHtml(html);
  };

  const handleSave = async () => {
    if (!canSave) return;

    let coverData: CoverData;

    switch (currentMode) {
      case 'image': {
        if (!selectedImage) return;
        const imageBuffer = await selectedImage.arrayBuffer();
        coverData = {
          mode: 'image',
          imageData: {
            filename: selectedImage.name,
            data: new Uint8Array(imageBuffer),
            mimeType: selectedImage.type,
          },
        };
        break;
      }
      case 'html':
        coverData = {
          mode: 'html',
          htmlContent: htmlCode,
        };
        break;
      case 'zip': {
        if (!selectedZip) return;
        const zipBuffer = await selectedZip.arrayBuffer();
        coverData = {
          mode: 'zip',
          zipData: {
            data: new Uint8Array(zipBuffer),
            entryFile: 'index.html',
          },
        };
        break;
      }
      case 'template':
        if (!selectedTemplate) return;
        coverData = {
          mode: 'template',
          htmlContent: generatedHtml,
          templateConfig: {
            templateId: selectedTemplate,
            config: { ...templateConfig },
          },
        };
        break;
      default:
        return;
    }

    if (onSave) onSave(coverData);
    if (onClose) onClose();
  };

  const handleCancel = () => {
    if (onClose) onClose();
  };

  const handleOverlayClick = (event: React.MouseEvent) => {
    if ((event.target as HTMLElement).classList.contains('cover-maker-overlay')) {
      handleCancel();
    }
  };

  const handleGlobalKeydown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape' && visible) {
      handleCancel();
    }
  }, [visible, onClose]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    if (typeof currentCoverHtml === 'string' && currentCoverHtml.trim().length > 0) {
      setHtmlCode(currentCoverHtml);
      setCurrentMode('html');
      return;
    }

    setHtmlCode('');
    setCurrentMode('template');
  }, [currentCoverHtml, visible]);

  useEffect(() => {
    if (!visible || !onPreview) {
      return;
    }

    onPreview(previewHtml);
  }, [onPreview, previewHtml, visible]);

  useEffect(() => {
    document.addEventListener('keydown', handleGlobalKeydown);
    return () => {
      document.removeEventListener('keydown', handleGlobalKeydown);
    };
  }, [handleGlobalKeydown]);

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

  if (!visible) return null;

  return (
    <div className="cover-maker-overlay" onClick={handleOverlayClick}>
      <div className="cover-maker" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="cover-maker__header">
          <h2 id={titleId} className="cover-maker__title">{formatMessage('cover_maker.title')}</h2>
          <button
            className="cover-maker__close"
            type="button"
            aria-label={formatMessage('cover_maker.close')}
            onClick={handleCancel}
          >
            <RuntimeIcon icon={ENGINE_ICONS.close} />
          </button>
        </div>

        <div className="cover-maker__modes">
          {modeOptions.map(mode => (
            <button
              key={mode.id}
              className={`cover-maker__mode-btn ${currentMode === mode.id ? 'cover-maker__mode-btn--active' : ''}`}
              type="button"
              onClick={() => switchMode(mode.id)}
            >
              <span className="cover-maker__mode-icon">
                <RuntimeIcon icon={mode.icon} />
              </span>
              <span className="cover-maker__mode-name">{mode.name}</span>
            </button>
          ))}
        </div>

        <div className="cover-maker__content">
          <div className="cover-maker__form">
            {currentMode === 'image' && (
              <div className="cover-maker__section">
                <p className="cover-maker__description">
                  {formatMessage('cover_maker.image_description')}
                </p>
                <div className="cover-maker__upload-area">
                  <input
                    type="file"
                    accept="image/*"
                    className="cover-maker__file-input"
                    onChange={handleImageSelect}
                  />
                  {!selectedImage ? (
                    <div className="cover-maker__upload-placeholder">
                      <span className="cover-maker__upload-icon">
                        <RuntimeIcon icon={ENGINE_ICONS.image} />
                      </span>
                      <span className="cover-maker__upload-text">{formatMessage('cover_maker.image_upload_text')}</span>
                      <span className="cover-maker__upload-hint">{formatMessage('cover_maker.image_upload_hint')}</span>
                    </div>
                  ) : (
                    <div className="cover-maker__upload-selected">
                      {imagePreviewUrl && (
                        <img
                          src={imagePreviewUrl}
                          className="cover-maker__image-thumb"
                          alt={formatMessage('cover_maker.preview_alt')}
                        />
                      )}
                      <div className="cover-maker__file-info">
                        <span className="cover-maker__file-name">{selectedImage.name}</span>
                        <button
                          type="button"
                          className="cover-maker__file-remove"
                          onClick={clearImage}
                        >
                          {formatMessage('cover_maker.remove')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {currentMode === 'html' && (
              <div className="cover-maker__section">
                <p className="cover-maker__description">
                  {formatMessage('cover_maker.html_description')}
                </p>
                <div className="cover-maker__field">
                  <label className="cover-maker__label">{formatMessage('cover_maker.html_label')}</label>
                  <textarea
                    value={htmlCode}
                    onChange={(e) => setHtmlCode(e.target.value)}
                    className="cover-maker__code-input chips-textarea__inner"
                    placeholder={formatMessage('cover_maker.html_placeholder')}
                    rows={12}
                  />
                </div>
              </div>
            )}

            {currentMode === 'zip' && (
              <div className="cover-maker__section">
                <p className="cover-maker__description">
                  {formatMessage('cover_maker.zip_description')}
                </p>
                <div className="cover-maker__upload-area">
                  <input
                    type="file"
                    accept=".zip,application/zip"
                    className="cover-maker__file-input"
                    onChange={handleZipSelect}
                  />
                  {!selectedZip ? (
                    <div className="cover-maker__upload-placeholder">
                      <span className="cover-maker__upload-icon">
                        <RuntimeIcon icon={ENGINE_ICONS.zip} />
                      </span>
                      <span className="cover-maker__upload-text">{formatMessage('cover_maker.zip_upload_text')}</span>
                      <span className="cover-maker__upload-hint">{formatMessage('cover_maker.zip_upload_hint')}</span>
                    </div>
                  ) : (
                    <div className="cover-maker__upload-selected">
                      <span className="cover-maker__zip-icon">
                        <RuntimeIcon icon={ENGINE_ICONS.zip} />
                      </span>
                      <div className="cover-maker__file-info">
                        <span className="cover-maker__file-name">{zipFileName}</span>
                        <button
                          type="button"
                          className="cover-maker__file-remove"
                          onClick={clearZip}
                        >
                          {formatMessage('cover_maker.remove')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <div className="cover-maker__notice">
                  <span className="cover-maker__notice-icon">
                    <RuntimeIcon icon={ENGINE_ICONS.info} />
                  </span>
                  <span className="cover-maker__notice-text">
                    {formatMessage('cover_maker.zip_notice')}
                  </span>
                </div>
              </div>
            )}

            {currentMode === 'template' && (
              <div className="cover-maker__section">
                <p className="cover-maker__description">
                  {formatMessage('cover_maker.template_description')}
                </p>
                <div className="cover-maker__field">
                  <label className="cover-maker__label">{formatMessage('cover_maker.template_style')}</label>
                  <TemplateGrid value={selectedTemplate} onChange={setSelectedTemplate} />
                </div>
                <div className="cover-maker__field">
                  <label className="cover-maker__label">
                    {formatMessage('cover_maker.title_label')}
                    <span className="cover-maker__required">*</span>
                  </label>
                  <input
                    value={templateConfig.title}
                    onChange={(e) => setTemplateConfig({ ...templateConfig, title: e.target.value })}
                    className="cover-maker__input chips-input__inner"
                    placeholder={formatMessage('cover_maker.title_placeholder')}
                  />
                </div>
                <div className="cover-maker__field">
                  <label className="cover-maker__label">{formatMessage('cover_maker.subtitle')}</label>
                  <input
                    value={templateConfig.subtitle}
                    onChange={(e) => setTemplateConfig({ ...templateConfig, subtitle: e.target.value })}
                    className="cover-maker__input chips-input__inner"
                    placeholder={formatMessage('cover_maker.subtitle_placeholder')}
                  />
                </div>
                <div className="cover-maker__field-row">
                  <div className="cover-maker__field">
                    <label className="cover-maker__label">{formatMessage('cover_maker.author')}</label>
                    <input
                      value={templateConfig.author}
                      onChange={(e) => setTemplateConfig({ ...templateConfig, author: e.target.value })}
                      className="cover-maker__input chips-input__inner"
                      placeholder={formatMessage('cover_maker.author_placeholder')}
                    />
                  </div>
                  <div className="cover-maker__field">
                    <label className="cover-maker__label">{formatMessage('cover_maker.date')}</label>
                    <input
                      value={templateConfig.date}
                      onChange={(e) => setTemplateConfig({ ...templateConfig, date: e.target.value })}
                      className="cover-maker__input chips-input__inner"
                      placeholder={formatMessage('cover_maker.date_placeholder')}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="cover-maker__preview-panel">
            <div className="cover-maker__preview-header">
              <label className="cover-maker__label">{formatMessage('cover_maker.ratio')}</label>
              <select
                value={selectedRatio}
                onChange={e => setSelectedRatio(e.target.value)}
                className="cover-maker__select chips-select__selector"
              >
                {coverRatios.map(ratio => (
                  <option key={ratio.value} value={ratio.value}>
                    {ratio.label}
                  </option>
                ))}
              </select>
            </div>

            {currentMode === 'template' ? (
              <TemplatePreview
                templateId={selectedTemplate}
                config={templateConfig}
                aspectRatio={selectedRatio}
                onHtmlGenerated={handleHtmlGenerated}
              />
            ) : currentMode === 'html' ? (
              <TemplatePreview
                templateId={null}
                config={{ title: '' }}
                customHtml={htmlCode}
                aspectRatio={selectedRatio}
              />
            ) : currentMode === 'image' && imagePreviewUrl ? (
              <TemplatePreview
                templateId={null}
                config={{ title: '' }}
                customHtml={previewHtml}
                aspectRatio={selectedRatio}
              />
            ) : (
              <div className="cover-maker__preview-placeholder">
                <span className="cover-maker__preview-placeholder-icon">
                  <RuntimeIcon icon={ENGINE_ICONS.preview} />
                </span>
                <span className="cover-maker__preview-placeholder-text">
                  {currentMode === 'zip' ? formatMessage('cover_maker.preview_zip') : formatMessage('cover_maker.preview_default')}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="cover-maker__footer">
          <button
            type="button"
            className="cover-maker__btn cover-maker__btn--secondary"
            onClick={handleCancel}
          >
            {formatMessage('cover_maker.cancel')}
          </button>
          <button
            type="button"
            className="cover-maker__btn cover-maker__btn--primary"
            disabled={!canSave}
            onClick={handleSave}
          >
            {formatMessage('cover_maker.save')}
          </button>
        </div>
      </div>
    </div>
  );
}

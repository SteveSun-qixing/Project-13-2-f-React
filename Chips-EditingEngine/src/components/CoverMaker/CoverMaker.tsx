import React, { useEffect, useMemo, useState } from 'react';
import { Button, Flex, Modal, Segmented } from 'antd';
import {
  CodeOutlined,
  FileZipOutlined,
  PictureOutlined,
} from '@ant-design/icons';
import { formatMessage } from '../../lib/messages';
import type {
  CoverCreationMode,
  CoverData,
  CoverMakerProps,
} from './types';
import { CoverHtmlPreview } from './CoverHtmlPreview';
import './CoverMaker.css';

function generateImageCoverHtml(imagePath: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html { height: 100%; }
    body {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f5f5f5;
    }
    img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }
  </style>
</head>
<body>
  <img src="${imagePath}" alt="Cover" />
</body>
</html>`;
}

export function CoverMaker({
  cardId,
  currentCoverHtml,
  visible,
  onClose,
  onSave,
  onPreview,
}: CoverMakerProps) {
  const [currentMode, setCurrentMode] = useState<CoverCreationMode>('image');

  const modeOptions = useMemo(
    () => [
      { value: 'image' as CoverCreationMode, label: formatMessage('cover_maker.mode_image'), icon: <PictureOutlined /> },
      { value: 'html' as CoverCreationMode, label: formatMessage('cover_maker.mode_html'), icon: <CodeOutlined /> },
      { value: 'zip' as CoverCreationMode, label: formatMessage('cover_maker.mode_zip'), icon: <FileZipOutlined /> },
    ],
    [],
  );

  // Image mode state
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  // HTML mode state
  const [htmlCode, setHtmlCode] = useState('');

  // ZIP mode state
  const [selectedZip, setSelectedZip] = useState<File | null>(null);
  const [zipFileName, setZipFileName] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);

  const coverRatios = useMemo(
    () => [
      { value: '1/1', label: formatMessage('cover_maker.ratio_square') },
      { value: '3/4', label: formatMessage('cover_maker.ratio_standard') },
      { value: '4/3', label: formatMessage('cover_maker.ratio_landscape') },
      { value: '9/16', label: formatMessage('cover_maker.ratio_phone') },
      { value: '16/9', label: formatMessage('cover_maker.ratio_video') },
      { value: '2/3', label: formatMessage('cover_maker.ratio_book') },
    ],
    [],
  );

  const [selectedRatio, setSelectedRatio] = useState('3/4');

  const canSave = useMemo(() => {
    switch (currentMode) {
      case 'image':
        return selectedImage !== null;
      case 'html':
        return htmlCode.trim().length > 0;
      case 'zip':
        return selectedZip !== null;
      default:
        return false;
    }
  }, [currentMode, selectedImage, htmlCode, selectedZip]);

  const previewHtml = useMemo(() => {
    switch (currentMode) {
      case 'image':
        if (imagePreviewUrl) {
          return generateImageCoverHtml(imagePreviewUrl);
        }
        return '';
      case 'html':
        return htmlCode;
      default:
        return '';
    }
  }, [currentMode, imagePreviewUrl, htmlCode]);

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

  const handleSave = async () => {
    if (!canSave) return;

    let coverData: CoverData;

    switch (currentMode) {
      case 'image': {
        if (!selectedImage) return;
        setIsSaving(true);
        try {
          const imageBuffer = await selectedImage.arrayBuffer();
          coverData = {
            mode: 'image',
            imageData: {
              filename: selectedImage.name,
              data: new Uint8Array(imageBuffer),
              mimeType: selectedImage.type,
            },
          };
        } finally {
          setIsSaving(false);
        }
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
        setIsSaving(true);
        try {
          const zipBuffer = await selectedZip.arrayBuffer();
          coverData = {
            mode: 'zip',
            zipData: {
              data: new Uint8Array(zipBuffer),
              entryFile: 'index.html',
            },
          };
        } finally {
          setIsSaving(false);
        }
        break;
      }
      default:
        return;
    }

    if (onSave) onSave(coverData);
    if (onClose) onClose();
  };

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
    setCurrentMode('image');
  }, [currentCoverHtml, visible]);

  useEffect(() => {
    if (!visible || !onPreview) {
      return;
    }

    onPreview(previewHtml);
  }, [onPreview, previewHtml, visible]);

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

  const renderModeContent = () => {
    if (currentMode === 'image') {
      return (
        <div className="cover-maker__section">
          <label className="cover-maker__upload-card">
            <input
              type="file"
              accept="image/*"
              className="cover-maker__file-input"
              onChange={handleImageSelect}
            />
            <span className="cover-maker__upload-icon">
              <PictureOutlined />
            </span>
            <span className="cover-maker__upload-text">{formatMessage('cover_maker.image_upload_text')}</span>
            <span className="cover-maker__upload-hint">{formatMessage('cover_maker.image_upload_hint')}</span>
          </label>
          {selectedImage && (
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
                <Button size="small" onClick={clearImage}>
                  {formatMessage('cover_maker.remove')}
                </Button>
              </div>
            </div>
          )}
        </div>
      );
    }

    if (currentMode === 'html') {
      return (
        <div className="cover-maker__section">
          <div className="cover-maker__field">
            <label className="cover-maker__label">{formatMessage('cover_maker.html_label')}</label>
            <textarea
              value={htmlCode}
              onChange={(e) => setHtmlCode(e.target.value)}
              className="cover-maker__code-input"
              placeholder={formatMessage('cover_maker.html_placeholder')}
              rows={12}
              spellCheck={false}
            />
          </div>
        </div>
      );
    }

    if (currentMode === 'zip') {
      return (
        <div className="cover-maker__section">
          <label className="cover-maker__upload-card">
            <input
              type="file"
              accept=".zip,application/zip"
              className="cover-maker__file-input"
              onChange={handleZipSelect}
            />
            <span className="cover-maker__upload-icon">
              <FileZipOutlined />
            </span>
            <span className="cover-maker__upload-text">{formatMessage('cover_maker.zip_upload_text')}</span>
            <span className="cover-maker__upload-hint">{formatMessage('cover_maker.zip_upload_hint')}</span>
          </label>
          {selectedZip && (
            <div className="cover-maker__upload-selected">
              <span className="cover-maker__zip-icon">
                <FileZipOutlined />
              </span>
              <div className="cover-maker__file-info">
                <span className="cover-maker__file-name">{zipFileName}</span>
                <Button size="small" onClick={clearZip}>
                  {formatMessage('cover_maker.remove')}
                </Button>
              </div>
            </div>
          )}
          <div className="cover-maker__notice">
            <span className="cover-maker__notice-text">
              {formatMessage('cover_maker.zip_notice')}
            </span>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <Modal
      open={visible}
      title={formatMessage('cover_maker.title')}
      onCancel={onClose}
      width="90%"
      centered
      destroyOnHidden
      mask={{ closable: true }}
      rootClassName="cover-maker-root"
      footer={
        <Flex justify="flex-end" gap={12}>
          <Button onClick={onClose}>{formatMessage('cover_maker.cancel')}</Button>
          <Button
            type="primary"
            loading={isSaving}
            disabled={!canSave}
            onClick={() => { void handleSave(); }}
          >
            {formatMessage('cover_maker.save')}
          </Button>
        </Flex>
      }
    >
      <div className="cover-maker">
        <Segmented
          className="cover-maker__modes"
          value={currentMode}
          onChange={(value) => setCurrentMode(value as CoverCreationMode)}
          options={modeOptions.map((option) => ({
            value: option.value,
            label: (
              <Flex align="center" gap={6}>
                {option.icon}
                <span>{option.label}</span>
              </Flex>
            ),
          }))}
        />

        <div className="cover-maker__content">
          <div className="cover-maker__form">{renderModeContent()}</div>

          <div className="cover-maker__preview-panel">
            <div className="cover-maker__preview-header">
              <span className="cover-maker__preview-label">{formatMessage('cover_maker.ratio')}</span>
              <select
                value={selectedRatio}
                onChange={(e) => setSelectedRatio(e.target.value)}
                className="cover-maker__select"
              >
                {coverRatios.map((ratio) => (
                  <option key={ratio.value} value={ratio.value}>
                    {ratio.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="cover-maker__preview-viewport">
              {currentMode === 'html' ? (
                <CoverHtmlPreview
                  customHtml={htmlCode}
                  aspectRatio={selectedRatio}
                />
              ) : currentMode === 'image' && imagePreviewUrl ? (
                <CoverHtmlPreview
                  customHtml={previewHtml}
                  aspectRatio={selectedRatio}
                />
              ) : (
                <div className="cover-maker__preview-placeholder">
                  <span className="cover-maker__preview-placeholder-icon">
                    {currentMode === 'zip' ? <FileZipOutlined /> : <PictureOutlined />}
                  </span>
                  <span className="cover-maker__preview-placeholder-text">
                    {currentMode === 'zip' ? formatMessage('cover_maker.preview_zip') : formatMessage('cover_maker.preview_default')}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

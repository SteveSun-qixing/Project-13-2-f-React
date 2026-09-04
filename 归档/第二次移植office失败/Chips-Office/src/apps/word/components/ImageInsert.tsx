import React, { useCallback, useRef, useState } from 'react';
import { Modal, Upload, Button, message } from 'antd';
import { InboxOutlined, PictureOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
import type { ImageInsertConfig } from '../types';
import { formatMessage } from '../lib/messages';

interface ImageInsertProps {
  visible: boolean;
  onClose: () => void;
  onInsert: (config: ImageInsertConfig) => void;
}

/** 引擎可嵌入的图片 MIME（NewImage.mime / ImageInsertConfig.mimeType 仅支持这三种） */
const SUPPORTED_MIME_TYPES: readonly string[] = ['image/png', 'image/jpeg', 'image/gif'];
const MAX_SIZE = 10 * 1024 * 1024;

/**
 * 把浏览器上报的自由字符串 MIME 归一化为引擎支持的联合类型。
 * 部分系统/浏览器会把 .jpg 上报为非标准的 "image/jpg"（合法 MIME 是 "image/jpeg"），
 * 因此在类型边界处统一归一化，确保 jpg 文件始终按 image/jpeg 嵌入。
 */
function normalizeImageMime(fileType: string): ImageInsertConfig['mimeType'] {
  if (fileType === 'image/gif') {
    return 'image/gif';
  }
  if (fileType === 'image/png') {
    return 'image/png';
  }
  return 'image/jpeg';
}

export function ImageInsert({ visible, onClose, onInsert }: ImageInsertProps) {
  const [imageData, setImageData] = useState<{
    data: string;
    mimeType: 'image/png' | 'image/jpeg' | 'image/gif';
    widthPx: number;
    heightPx: number;
  } | null>(null);

  const handleFileSelect = useCallback(async (file: File): Promise<boolean> => {
    if (!SUPPORTED_MIME_TYPES.includes(file.type)) {
      message.error(formatMessage('word.image.unsupported'));
      return false;
    }

    if (file.size > MAX_SIZE) {
      message.error('图片大小不能超过 10MB');
      return false;
    }

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        const img = new Image();
        img.onload = () => {
          setImageData({
            data: dataUrl,
            mimeType: normalizeImageMime(file.type),
            widthPx: img.width,
            heightPx: img.height,
          });
          resolve(true);
        };
        img.onerror = () => {
          message.error('图片加载失败');
          resolve(false);
        };
        img.src = dataUrl;
      };
      reader.onerror = () => {
        message.error('文件读取失败');
        resolve(false);
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const uploadProps: UploadProps = {
    name: 'file',
    multiple: false,
    accept: SUPPORTED_MIME_TYPES.join(','),
    showUploadList: false,
    beforeUpload: handleFileSelect,
  };

  const handleClose = useCallback(() => {
    setImageData(null);
    onClose();
  }, [onClose]);

  const handleInsert = useCallback(() => {
    if (imageData) {
      // mimeType 在选择文件时已归一化为引擎支持的联合类型，可直接写入文档
      onInsert({
        data: imageData.data.split(',')[1],
        mimeType: imageData.mimeType,
        widthPx: imageData.widthPx,
        heightPx: imageData.heightPx,
        align: 'center',
        wrap: 'inline',
      });
      handleClose();
    }
  }, [imageData, onInsert, handleClose]);

  return (
    <Modal
      title={
        <span>
          <PictureOutlined style={{ marginRight: 8 }} />
          {formatMessage('word.image.title')}
        </span>
      }
      open={visible}
      onCancel={handleClose}
      footer={
        imageData ? (
          <>
            <Button onClick={handleClose}>{formatMessage('word.dialog.cancel')}</Button>
            <Button type="primary" onClick={handleInsert}>
              {formatMessage('word.dialog.confirm')}
            </Button>
          </>
        ) : null
      }
      width={480}
    >
      <div className="image-insert">
        {!imageData ? (
          <Upload.Dragger {...uploadProps} className="image-insert__uploader">
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">{formatMessage('word.image.selectFile')}</p>
            <p className="ant-upload-hint">{formatMessage('word.image.dragHint')}</p>
          </Upload.Dragger>
        ) : (
          <div className="image-insert__preview">
            <img src={imageData.data} alt="预览" className="image-insert__preview-image" />
            <p className="image-insert__preview-info">
              {imageData.widthPx} x {imageData.heightPx} px
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default ImageInsert;

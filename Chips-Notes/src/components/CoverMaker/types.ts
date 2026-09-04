/**
 * 封面快速制作器类型定义
 * @module components/cover-maker/types
 */

export type CoverCreationMode = 'image' | 'html' | 'zip';

export interface CoverData {
  mode: CoverCreationMode;
  htmlContent?: string;
  imageData?: {
    filename: string;
    data: Uint8Array;
    mimeType: string;
  };
  zipData?: {
    data: Uint8Array;
    entryFile: string;
  };
}

export interface CoverCreationResult {
  success: boolean;
  htmlContent?: string;
  resources?: {
    path: string;
    data: Uint8Array;
  }[];
  error?: string;
}

export interface CoverMakerProps {
  cardId: string;
  currentCoverHtml?: string;
  visible: boolean;
  onClose?: () => void;
  onSave?: (data: CoverData) => void;
  onPreview?: (html: string) => void;
}

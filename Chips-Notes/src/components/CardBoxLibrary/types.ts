import type { IconDescriptor } from "chips-sdk";

/**
 * 卡箱库类型定义
 */

export const CHIPS_DRAG_DATA_TYPE = 'application/x-chips-drag-data';

export interface CardTypeDefinition {
  id: string;
  name: string;
  icon: IconDescriptor;
  description: string;
  keywords: string[];
}

export interface LayoutTypeDefinition {
  id: string;
  name: string;
  icon: IconDescriptor;
  description: string;
  keywords: string[];
}

export interface CardLibraryDragData {
  type: 'card';
  typeId: string;
  name: string;
}

export interface LayoutLibraryDragData {
  type: 'layout';
  typeId: string;
  name: string;
}

export interface WorkspaceFileDragData {
  type: 'workspace-file';
  fileId: string;
  fileType: 'card' | 'box';
  filePath: string;
  name: string;
}

export type DragData = CardLibraryDragData | LayoutLibraryDragData | WorkspaceFileDragData;

export interface DragState {
  isDragging: boolean;
  data: DragData | null;
  previewPosition: { x: number; y: number } | null;
}

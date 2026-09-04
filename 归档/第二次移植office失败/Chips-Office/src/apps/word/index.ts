export { WordEditor } from './WordEditor';
export { WordViewer } from './WordViewer';
export { WordToolbar } from './components/Toolbar';
export { PageCanvas } from './components/PageCanvas';
export { BlockRenderer } from './components/BlockRenderer';
export { TableEditor } from './components/TableEditor';
export { ImageInsert } from './components/ImageInsert';
export { CommentPanel } from './components/CommentPanel';
export { useDocument } from './hooks/useDocument';

export type {
  WordDocumentState,
  WordDocumentMetadata,
  WordDocumentContent,
  WordEditorState,
  CursorPosition,
  ActiveFormats,
  WordToolbarCommand,
  TableCellInfo,
  TableSelection,
  ImageInsertConfig,
  TableInsertConfig,
  CommentAction,
  CommentData,
  PageDimensions,
  RenderContext,
  FontOption,
  FontSizeOption,
  ColorOption,
  ToolbarConfig,
} from './types';

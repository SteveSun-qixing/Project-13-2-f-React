export type { Block, CommentInfo, SectionSettings } from '../../engine/docx-engine/src/types';
import type { Block, CommentInfo, SectionSettings } from '../../engine/docx-engine/src/types';

/** Word 文档状态 */
export interface WordDocumentState {
  /** 文档是否已加载 */
  isLoaded: boolean;
  /** 文档是否正在加载 */
  isLoading: boolean;
  /** 文档是否正在保存 */
  isSaving: boolean;
  /** 是否有未保存的更改 */
  isDirty: boolean;
  /** 错误信息 */
  error: string | null;
  /** 文档元数据 */
  metadata: WordDocumentMetadata | null;
  /** 解析后的文档内容 */
  content: WordDocumentContent | null;
}

/** Word 文档元数据 */
export interface WordDocumentMetadata {
  /** 文件名 */
  fileName: string;
  /** 文件路径 */
  filePath: string | null;
  /** 文件大小（字节） */
  size: number;
  /** 创建时间 */
  createdAt: Date | null;
  /** 修改时间 */
  modifiedAt: Date | null;
  /** 作者 */
  author: string | null;
  /** 标题 */
  title: string | null;
  /** 主题 */
  subject: string | null;
}

/** Word 文档内容 */
export interface WordDocumentContent {
  /** 文档块列表 */
  blocks: Block[];
  /** 批注列表 */
  comments: CommentInfo[];
  /** 脚注列表 */
  footnotes: Block[];
  /** 尾注列表 */
  endnotes: Block[];
  /** 页眉信息 */
  headerText: string | null;
  /** 页脚信息 */
  footerText: string | null;
  /** 水印文本 */
  watermarkText: string | null;
  /** 文档页面设置 */
  sectionSettings: SectionSettings;
  /** 文档样式映射 */
  styles: Map<string, unknown>;
  /** 编号定义映射 */
  numbering: Map<string, unknown>;
}

/** 编辑器状态 */
export interface WordEditorState {
  /** 当前选中的块 ID */
  selectedBlockId: string | null;
  /** 当前光标位置 */
  cursorPosition: CursorPosition | null;
  /** 当前激活的格式 */
  activeFormats: ActiveFormats;
  /** 当前缩放比例 */
  zoom: number;
  /** 当前页码 */
  currentPage: number;
  /** 总页数 */
  totalPages: number;
  /** 字数统计 */
  wordCount: number;
  /** 是否只读模式 */
  readOnly: boolean;
  /** 是否显示批注面板 */
  showCommentPanel: boolean;
  /** 选中的批注 ID */
  selectedCommentId: string | null;
}

/** 光标位置 */
export interface CursorPosition {
  /** 块 ID */
  blockId: string;
  /** 在块内的偏移量 */
  offset: number;
}

/** 激活的格式状态 */
export interface ActiveFormats {
  /** 是否加粗 */
  bold: boolean;
  /** 是否斜体 */
  italic: boolean;
  /** 是否有下划线 */
  underline: boolean;
  /** 是否有删除线 */
  strikethrough: boolean;
  /** 上标/下标 */
  vertAlign: 'none' | 'superscript' | 'subscript';
  /** 字体名称 */
  fontName: string | null;
  /** 字体大小（半磅） */
  fontSize: number | null;
  /** 文字颜色 */
  color: string | null;
  /** 背景颜色 */
  highlight: string | null;
  /** 对齐方式 */
  align: 'left' | 'center' | 'right' | 'justify' | null;
  /** 列表样式 */
  listStyle: 'bullet' | 'ordered' | null;
  /** 列表编号 ID */
  listNumId: string | null;
  /** 列表级别 */
  listLevel: number | null;
  /** 标题级别 */
  headingLevel: number | null;
}

/** 工具栏命令 */
export type WordToolbarCommand =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strikethrough'
  | 'superscript'
  | 'subscript'
  | 'fontName'
  | 'fontSize'
  | 'fontSizeIncrease'
  | 'fontSizeDecrease'
  | 'textColor'
  | 'highlight'
  | 'alignLeft'
  | 'alignCenter'
  | 'alignRight'
  | 'alignJustify'
  | 'orderedList'
  | 'unorderedList'
  | 'decreaseIndent'
  | 'increaseIndent'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'paragraph'
  | 'insertImage'
  | 'insertTable'
  | 'insertComment'
  | 'undo'
  | 'redo';

/** 表格单元格信息 */
export interface TableCellInfo {
  /** 行索引 */
  rowIndex: number;
  /** 列索引 */
  colIndex: number;
  /** 单元格内容 */
  content: string;
  /** 是否被选中 */
  isSelected: boolean;
  /** 是否是合并单元格 */
  isMerged: boolean;
}

/** 表格选择区域 */
export interface TableSelection {
  /** 开始单元格 */
  startCell: TableCellInfo;
  /** 结束单元格 */
  endCell: TableCellInfo;
}

/** 插入图片配置 */
export interface ImageInsertConfig {
  /** 图片数据（Base64） */
  data: string;
  /** 图片 MIME 类型 */
  mimeType: 'image/png' | 'image/jpeg' | 'image/gif';
  /** 图片宽度（像素） */
  widthPx: number;
  /** 图片高度（像素） */
  heightPx: number;
  /** 对齐方式 */
  align?: 'left' | 'center' | 'right';
  /** 文字环绕方式 */
  wrap?: 'inline' | 'square-left' | 'square-right' | 'top-bottom';
}

/** 插入表格配置 */
export interface TableInsertConfig {
  /** 行数 */
  rows: number;
  /** 列数 */
  columns: number;
}

/** 批注操作 */
export type CommentAction = 'add' | 'reply' | 'delete' | 'resolve';

/** 批注数据 */
export interface CommentData {
  /** 批注 ID */
  id: string;
  /** 批注内容 */
  content: string;
  /** 作者 */
  author: string;
  /** 创建时间 */
  createdAt: Date;
  /** 所属块 ID */
  blockId: string;
  /** 父批注 ID（用于回复） */
  parentId?: string;
  /** 是否已解决 */
  isResolved: boolean;
}

/** 页面尺寸 */
export interface PageDimensions {
  /** 页面宽度（twips） */
  widthTwips: number;
  /** 页面高度（twips） */
  heightTwips: number;
  /** 上边距（twips） */
  marginTop: number;
  /** 下边距（twips） */
  marginBottom: number;
  /** 左边距（twips） */
  marginLeft: number;
  /** 右边距（twips） */
  marginRight: number;
  /** 转换为像素的缩放因子 */
  dpiFactor: number;
}

/** 渲染上下文 */
export interface RenderContext {
  /** 页面尺寸 */
  pageDimensions: PageDimensions;
  /** 缩放比例 */
  zoom: number;
  /** 当前页码 */
  currentPage: number;
  /** 是否只读模式 */
  readOnly: boolean;
  /** 是否显示批注标记 */
  showCommentMarkers: boolean;
  /** 选中的批注 ID */
  selectedCommentId: string | null;
}

/** 字体选项 */
export interface FontOption {
  /** 字体名称 */
  name: string;
  /** 是否等宽字体 */
  isMonospace: boolean;
  /** 是否 CJK 字体 */
  isCjk: boolean;
}

/** 字号选项 */
export interface FontSizeOption {
  /** 字号名称 */
  name: string;
  /** 半磅值 */
  halfPoints: number;
}

/** 颜色选项 */
export interface ColorOption {
  /** 颜色名称 */
  name: string;
  /** 十六进制颜色值（不含 #） */
  hex: string;
}

/** 工具栏配置 */
export interface ToolbarConfig {
  /** 字体列表 */
  fonts: FontOption[];
  /** 字号列表 */
  fontSizes: FontSizeOption[];
  /** 颜色列表 */
  colors: ColorOption[];
  /** 是否显示批注按钮 */
  showCommentButton: boolean;
}

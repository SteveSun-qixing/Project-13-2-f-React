/**
 * 笔记（富文本基础卡片）类型定义
 *
 * 每篇笔记对应一个符合《Chips 卡片文件规范》的 `.card` 文件，
 * 以内嵌卡片的形式保存在笔记本（`.box` 箱子）中。
 */

/**
 * Markdown 能力声明
 * 对应 base.richtext 配置中的 markdown_capabilities，规范要求 7 项全部显式写入
 */
export interface MarkdownCapabilities {
  commonmark: boolean;
  gfm: boolean;
  math: boolean;
  highlight: boolean;
  underline: boolean;
  superscript: boolean;
  subscript: boolean;
}

/**
 * 富文本基础卡片配置
 * 对应卡片文件中 content/<baseCardId>.yaml 的结构
 */
export interface RichTextNoteConfig {
  card_type: 'base.richtext';
  theme: string;
  locale: string;
  content_format: 'markdown';
  content_source: 'inline' | 'file';
  /** content_source=inline 时的内联 Markdown */
  content_text?: string;
  /** content_source=file 时的卡片根目录相对 .md 资源路径 */
  content_file?: string;
  markdown_capabilities: MarkdownCapabilities;
}

/**
 * 笔记文档
 * 解析一个 `.card` 文件后的完整结构化数据
 */
export interface NoteDocument {
  /** 卡片 ID（metadata.yaml 的 card_id） */
  cardId: string;
  /** 富文本基础卡片 ID（structure.yaml 第一个条目的 id） */
  baseCardId: string;
  /** 笔记标题（metadata.yaml 的 name） */
  title: string;
  createdAt: string;
  modifiedAt: string;
  coverRatio: string;
  /** 富文本配置 */
  config: RichTextNoteConfig;
  /** 笔记的 Markdown 全文（inline 与 file 两种来源归一后的结果） */
  markdown: string;
}

/**
 * 笔记
 * 来自箱子条目（structure.yaml 的 entries）的目录树数据
 */
export interface Note {
  /** 箱子条目 ID（entry_id） */
  entryId: string;
  /** 卡片文档 ID（snapshot.document_id，可能缺失） */
  cardId?: string;
  /** 所属笔记本 ID（箱子 box_id） */
  notebookId: string;
  /** 所属笔记本的箱子文件路径 */
  notebookPath: string;
  /** 内嵌卡片在箱子包内的相对路径（entry.url） */
  url: string;
  /** 笔记标题（snapshot.title） */
  title: string;
  /** 摘要（snapshot.summary） */
  summary: string;
  /** 最近修改时间（snapshot.last_known_modified_at） */
  modifiedAt: string;
}

/**
 * 笔记编辑器状态
 */
export interface NoteEditorState {
  /** 当前打开的笔记 */
  note: Note | null;
  /** 当前笔记的文档数据 */
  document: NoteDocument | null;
  /** 编辑中的 Markdown 内容 */
  content: string;
  /** 是否有未保存修改 */
  modified: boolean;
  /** 是否正在加载 */
  loading: boolean;
  /** 是否正在保存 */
  saving: boolean;
  /** 错误信息 */
  error?: string;
}

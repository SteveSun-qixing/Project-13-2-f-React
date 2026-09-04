/**
 * 常量定义
 */

/** 薯片文件标准版本 */
export const CHIP_STANDARDS_VERSION = '1.0.0';

/** 富文本基础卡片类型标识 */
export const RICHTEXT_CARD_TYPE = 'base.richtext';

/** 富文本内容格式 */
export const RICHTEXT_CONTENT_FORMAT = 'markdown';

/** 内容默认语言 */
export const CONTENT_LOCALE = 'zh-CN';

/**
 * 薯片笔记创建的笔记本首选文档库布局箱子
 * 与生态内"文档库布局箱子保存卡片"的常规用法保持一致
 */
export const NOTEBOOK_LAYOUT_TYPE = 'chips.layout.documentlibrary.blp';

/**
 * 文档库布局插件未安装时的回退布局
 * 布局类型只影响箱子的默认展示方式，不影响薯片笔记自身的数据结构
 */
export const NOTEBOOK_LAYOUT_FALLBACK = 'chips.layout.grid';

/** 笔记本文件扩展名 */
export const NOTEBOOK_FILE_EXTENSION = '.box';

/** 笔记文件扩展名 */
export const NOTE_FILE_EXTENSION = '.card';

/** 默认工作目录名称（挂在 Host 工作区根路径下） */
export const WORKSPACE_DIR_NAME = 'ChipsNotes';

/** 运行时目录名称（位于工作目录内，存放解包态卡片） */
export const RUNTIME_DIR_NAME = '.chips-notes-runtime';

/** 应用配置键（client.config 存储） */
export const NOTES_CONFIG_KEY = 'chips.notes.config';

/**
 * 富文本内联存储阈值（纯文本 Unicode 字符数）
 * 超过该阈值时按规范转写为卡片根目录 .md 资源文件（content_source=file）
 */
export const MAX_INLINE_RICHTEXT_LENGTH = 200;

/** file 存储模式下 Markdown 资源的卡片根目录相对路径前缀 */
export const RICHTEXT_RESOURCE_DIR = 'richtext';

/** Markdown 资源 MIME 类型 */
export const MARKDOWN_MIME_TYPE = 'text/markdown';

/** 默认封面比例 */
export const DEFAULT_COVER_RATIO = '3:4';

/** 侧边栏默认宽度 */
export const DEFAULT_SIDEBAR_WIDTH = 260;

/** 侧边栏最小宽度 */
export const MIN_SIDEBAR_WIDTH = 200;

/** 侧边栏最大宽度 */
export const MAX_SIDEBAR_WIDTH = 400;

/** 自动保存防抖延迟（毫秒） */
export const AUTO_SAVE_DEBOUNCE_MS = 500;

/** 摘要最大长度（纯文本字符数） */
export const NOTE_SUMMARY_MAX_LENGTH = 100;

/** 默认笔记内容模板 */
export const DEFAULT_NOTE_MARKDOWN = '';

/** 编辑器内容最大宽度（px） */
export const EDITOR_MAX_WIDTH = 720;

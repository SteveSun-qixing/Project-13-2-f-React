/**
 * 笔记领域数据模型（重写件）。
 *
 * 权威口径：旧仓 `Chips-Notes/src/services/notebook-service.ts` 的「以 `.box` 为笔记本、
 * `.card` 为笔记」领域划分保留；旧 `NotebookInfo`/`NoteInfo`/`TreeNode` 依附旧 SDK 客户端
 * 扫描链（矩阵判重写），本模型改以平台文档链路为唯一事实源——全部标识取自
 * `document:open` 回包（`documentId` = `card_id` / `box_id`，跨会话稳定），不私建第二份 ID。
 *
 * 目录扫描通道（工作区笔记本/笔记枚举）属 `filesystem:read:${workspace}` 域，
 * 宿主处理器缺位（工单036 后续段），本臂不伪造列表——库内容只经显式打开投递增长。
 */

import type { BoxMetadata, CardMetadata, ContentNode, DocumentKind, Entry, StructureModel, Tag } from '@chips/sdk';

/** 库内单份文档摘要：`document:open` 回包的领域投影（字段一一对应，不自造标识）。 */
export interface OpenedDocumentSummary {
  /** 稳定文档标识（`card_id` / `box_id`）。 */
  readonly documentId: string;
  /** 打开时的来源引用（归一前原样保留，供重开与展示）。 */
  readonly source: string;
  readonly kind: DocumentKind;
  readonly title: string;
  /** 打开时的快速指纹摘要。 */
  readonly digest: string;
}

/** 笔记库：笔记本（box）与笔记（card）两类文档的分区集合。 */
export interface NotesLibrary {
  readonly notebooks: readonly OpenedDocumentSummary[];
  readonly notes: readonly OpenedDocumentSummary[];
}

export const EMPTY_NOTES_LIBRARY: NotesLibrary = { notebooks: [], notes: [] };

function byTitle(left: OpenedDocumentSummary, right: OpenedDocumentSummary): number {
  return left.title.localeCompare(right.title, 'zh-Hans-CN');
}

/**
 * 把一份打开回包并入库：按 `documentId` 幂等（重复打开整体替换、不重复计数），
 * 按 `kind` 分区（box → 笔记本，card → 笔记），区内按标题排序。
 */
export function addDocument(library: NotesLibrary, summary: OpenedDocumentSummary): NotesLibrary {
  const replace = (list: readonly OpenedDocumentSummary[]): OpenedDocumentSummary[] => {
    const rest = list.filter((item) => item.documentId !== summary.documentId);
    return [...rest, summary].sort(byTitle);
  };
  if (summary.kind === 'box') {
    return { notebooks: replace(library.notebooks), notes: library.notes };
  }
  return { notebooks: library.notebooks, notes: replace(library.notes) };
}

/** 按 `documentId` 查找库内摘要；未收录返回 `null`。 */
export function findDocument(
  library: NotesLibrary,
  documentId: string,
): OpenedDocumentSummary | null {
  return (
    library.notebooks.find((item) => item.documentId === documentId) ??
    library.notes.find((item) => item.documentId === documentId) ??
    null
  );
}

/** 笔记本领域视图：盒子元数据与条目清单（条目即笔记在笔记本中的组织形态）。 */
export interface NotebookDetail {
  readonly kind: 'box';
  readonly metadata: BoxMetadata;
  readonly entries: readonly Entry[];
}

/** 笔记领域视图：卡片元数据与结构清单（内容节点载荷按需逐节点读取）。 */
export interface NoteOutline {
  readonly kind: 'card';
  readonly metadata: CardMetadata;
  readonly structure: StructureModel;
}

export type NoteDocumentDetail = NotebookDetail | NoteOutline;

/** 结构化标签拍平为展示串（`Tag = string | readonly string[]`，末段为值）。 */
export function flattenTag(tag: Tag): string {
  return Array.isArray(tag) ? tag.join('：') : (tag as string);
}

/** 元数据标签拍平为展示串数组。 */
export function flattenTags(tags: readonly Tag[] | undefined): readonly string[] {
  return (tags ?? []).map(flattenTag);
}

/** 条目展示名：取 `url` 末段作为条目名（`url` 本身保留供详情呈现）。 */
export function entryDisplayName(entry: Entry): string {
  const segments = entry.url.split('/').filter((segment) => segment.length > 0);
  const last = segments[segments.length - 1];
  return last ?? entry.url;
}

/** 卡片结构清单中的内容节点编号（content 切片按节点逐个读取的读取序）。 */
export function structureNodeIds(structure: StructureModel): readonly string[] {
  return structure.structure.map((item) => item.id);
}

/** 条目清单按 `enabled` 分组计数（呈现用：启用 / 停用条数）。 */
export function countEntriesByEnabled(entries: readonly Entry[]): {
  readonly enabled: number;
  readonly disabled: number;
} {
  let enabled = 0;
  let disabled = 0;
  for (const entry of entries) {
    if (entry.enabled) {
      enabled += 1;
    } else {
      disabled += 1;
    }
  }
  return { enabled, disabled };
}

/**
 * 内容节点载荷的呈现串：节点值是插件专有不透明字段（01-卡片文件格式 §6.1），
 * 界面以 `card_type` + 结构化 JSON 文本如实呈现，不做语义猜解。
 */
export function contentNodeDisplay(node: ContentNode): string {
  return JSON.stringify(node.value, null, 2);
}

/**
 * 来源引用的非空守卫：空白输入不进入打开链（`document:open` 的 `source` 必须非空）。
 */
export function normalizeDocumentSource(input: string): string | null {
  const trimmed = input.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * 重命名投影：写后重读元数据得到的名称回填库摘要标题（列表与工作台同源翻正）。
 *
 * 投影来源是 `document:read` 重读回包（宿主模型唯一事实源），不是本地输入拼装；
 * 无命中（文档不在库内）原样返回同一引用。
 */
export function applyDocumentTitle(
  library: NotesLibrary,
  documentId: string,
  title: string,
): NotesLibrary {
  const rename = (list: readonly OpenedDocumentSummary[]): readonly OpenedDocumentSummary[] =>
    list.map((item) => (item.documentId === documentId ? { ...item, title } : item));
  const notebooks = rename(library.notebooks);
  const notes = rename(library.notes);
  if (notebooks === library.notebooks && notes === library.notes) {
    return library;
  }
  return { notebooks, notes };
}

/**
 * 写链错误的行内处置指引（简体中文；错误码本体始终随提示呈现，不吞错）。
 *
 * 文案口径与宿主 `errors.ts` 登记文案同源（冲突可重试 / 外部修改需重开 / 保存失败可重试）。
 */
export function writeErrorGuidance(code: string): string {
  if (code === 'DOCUMENT_WRITE_CONFLICT') {
    return '文档正被其他会话写入，请稍后重试';
  }
  if (code === 'DOCUMENT_SOURCE_CHANGED') {
    return '文档已在外部修改，请刷新视图或重新打开后再试';
  }
  if (code === 'DOCUMENT_NOT_OPEN') {
    return '文档会话不存在，请重新打开文档';
  }
  if (code === 'DOCUMENT_SAVE_FAILED') {
    return '保存未完成，请核对文档可用性后重试';
  }
  if (code === 'DOCUMENT_REVISION_INVALID' || code === 'DOCUMENT_SAVE_RECEIPT_INVALID') {
    return '通道回执异常，请重试；若持续出现请重新打开文档';
  }
  return '请重试；若持续失败请重新打开文档';
}

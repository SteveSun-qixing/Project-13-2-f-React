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

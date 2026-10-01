/**
 * 资源浏览域：条目呈现数据模型（全新建，无旧仓母型——《04-资源管理器产品设计》§1.4 逐条落面）。
 *
 * 权威口径：
 * - 职责边界（§1.1）：资源管理器只**浏览与呈现**——不创建卡片/箱子、不编辑内容、不解析
 *   `.card` / `.box`、不实现第二写口；打开经平台路由；
 * - 目录树数据源（§1.4 规则 1）：工作区目录结构属 `filesystem:read:${workspace}` 域，
 *   宿主处理器缺位（工单036 后续段），本臂不伪造目录树——位置呈现降级为「按来源打开」；
 * - 条目呈现契约（§2.3/§四）：条目属性来自文档链路的类型化切片（元数据/结构/条目），
 *   标识一律取自 `document:open` 回包，不自造 ID。
 */

import type { BoxMetadata, CardMetadata, DocumentKind, Entry, StructureModel, Tag } from '@chips/sdk';

/** 已打开资源的浏览摘要：`document:open` 回包的领域投影（字段一一对应，不自造标识）。 */
export interface BrowsedDocumentSummary {
  /** 稳定文档标识（`card_id` / `box_id`）。 */
  readonly documentId: string;
  /** 打开时的来源引用（归一前原样保留，供重开与展示）。 */
  readonly source: string;
  readonly kind: DocumentKind;
  readonly title: string;
  /** 打开时的快速指纹摘要。 */
  readonly digest: string;
}

/** 浏览记录集：按 `documentId` 幂等的已打开文档清单（最近打开在后）。 */
export interface BrowsedDocuments {
  readonly items: readonly BrowsedDocumentSummary[];
}

export const EMPTY_BROWSED_DOCUMENTS: BrowsedDocuments = { items: [] };

/** 文档浏览视图：卡片 → 结构与资源计数；箱子 → 元数据与条目清单。 */
export type DocumentBrowseDetail =
  | { readonly kind: 'card'; readonly metadata: CardMetadata; readonly structure: StructureModel }
  | { readonly kind: 'box'; readonly metadata: BoxMetadata; readonly entries: readonly Entry[] };

/** 条目呈现视图：箱子条目的展示投影（名称取 `url` 末段，`url` 保留供详情）。 */
export interface EntryPresentation {
  readonly entryId: string;
  readonly url: string;
  readonly name: string;
  readonly enabled: boolean;
}

/** 条目呈现投影：按 `enabled` 前置、名称升序（zh 词序）排列。 */
export function presentEntries(entries: readonly Entry[]): readonly EntryPresentation[] {
  const presentations = entries.map((entry) => ({
    entryId: entry.entry_id,
    url: entry.url,
    name: entryDisplayName(entry),
    enabled: entry.enabled,
  }));
  return presentations.sort((left, right) => {
    if (left.enabled !== right.enabled) {
      return left.enabled ? -1 : 1;
    }
    return left.name.localeCompare(right.name, 'zh-Hans-CN');
  });
}

/** 条目展示名：取 `url` 末段作为条目名。 */
export function entryDisplayName(entry: Entry): string {
  const segments = entry.url.split('/').filter((segment) => segment.length > 0);
  const last = segments[segments.length - 1];
  return last ?? entry.url;
}

/** 结构化标签拍平为展示串（`Tag = string | readonly string[]`，末段为值）。 */
export function flattenTag(tag: Tag): string {
  return Array.isArray(tag) ? tag.join('：') : (tag as string);
}

/** 元数据标签拍平为展示串数组（卡片必携、箱子可选）。 */
export function flattenTags(tags: readonly Tag[] | undefined): readonly string[] {
  return (tags ?? []).map(flattenTag);
}

/** 条目分页切片（`document:read` entries range 语义的前端镜像；越界截断、步进非负）。 */
export function sliceEntriesPage(
  entries: readonly Entry[],
  offset: number,
  limit: number,
): readonly Entry[] {
  if (!Number.isInteger(offset) || offset < 0) {
    return [];
  }
  if (!Number.isInteger(limit) || limit < 1) {
    return [];
  }
  return entries.slice(offset, offset + limit);
}

/** 结构资源计数（卡片 manifest 呈现用）。 */
export function structureResourceCounts(structure: StructureModel): {
  readonly cardCount: number;
  readonly resourceCount: number;
} {
  return {
    cardCount: structure.manifest.card_count,
    resourceCount: structure.manifest.resource_count,
  };
}

/** 浏览记录收录：按 `documentId` 幂等（重复打开整体替换并移至末位）。 */
export function addBrowsedDocument(
  records: BrowsedDocuments,
  summary: BrowsedDocumentSummary,
): BrowsedDocuments {
  return {
    items: [...records.items.filter((item) => item.documentId !== summary.documentId), summary],
  };
}

/** 按 `documentId` 查找浏览记录；未收录返回 `null`。 */
export function findBrowsedDocument(
  records: BrowsedDocuments,
  documentId: string,
): BrowsedDocumentSummary | null {
  return records.items.find((item) => item.documentId === documentId) ?? null;
}

/** 来源引用非空守卫：空白输入不进入打开链。 */
export function normalizeBrowseSource(input: string): string | null {
  const trimmed = input.trim();
  return trimmed.length > 0 ? trimmed : null;
}

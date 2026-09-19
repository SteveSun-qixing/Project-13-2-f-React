/**
 * 能力契约公共类型（04-能力契约规范 §2.3）。
 */

import type { BoxMetadata, CardMetadata, ContentNode, Entry, StructureModel } from '../document.js';

/** 空输入：无参数能力的输入形状。 */
export type VoidInput = Record<string, never>;

/** 文档类型判别键。 */
export type DocumentKind = 'card' | 'box';

/** 文档模型分片。 */
export type DocumentPart = 'metadata' | 'structure' | 'content' | 'entries';

/** 文档模型切片联合：`document:read` / `document:write` 的 `value` 取值域。 */
export type DocumentModel =
  | CardMetadata
  | BoxMetadata
  | StructureModel
  | ContentNode
  | readonly Entry[];

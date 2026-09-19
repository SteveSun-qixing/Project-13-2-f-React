/**
 * `document:*` 能力契约类型（04-能力契约规范 §7.3）。
 *
 * 卡片与箱子共用同一条链路与同一套接口（R8）；
 * `documentId` 取自文档稳定标识（`card_id` / `box_id`），跨会话、跨重命名稳定。
 */

import type { Diagnostic } from '../document.js';
import type { DocumentKind, DocumentModel, DocumentPart } from './common.js';

/** 初始内容装配提示；不承载内容初值（初值只来自插件 `createInitialContent()`）。 */
export interface IDocumentCreateContent {
  /** 卡片首个节点的卡片类型正式标识；省略时取平台默认。 */
  cardType?: string;
  /** 箱子初始布局类型；省略取平台默认。 */
  layoutType?: string;
}

export interface IDocumentCreateInput {
  kind: DocumentKind;
  parent: string;
  name?: string;
  initialContent?: IDocumentCreateContent;
}

export interface IDocumentCreateOutput {
  /** 新建文档的稳定标识；口径与 `document:open` 一致。 */
  documentId: string;
  /** 新建文档的受管引用；卡片为目录态、箱子为归档态。 */
  source: string;
}

export interface IDocumentOpenInput {
  source: string;
  kind?: DocumentKind;
}

export interface IDocumentOpenOutput {
  /** = `card_id` / `box_id`，跨会话稳定。 */
  documentId: string;
  source: string;
  kind: DocumentKind;
  title: string;
  /** 打开时的快速指纹摘要（不读取资源字节）。 */
  digest: string;
}

export interface IDocumentReadInput {
  documentId: string;
  part: DocumentPart;
  nodeId?: string;
  range?: { offset: number; limit: number };
}

export interface IDocumentReadOutput {
  part: DocumentPart;
  value: DocumentModel;
  diagnostics: readonly Diagnostic[];
}

export interface IDocumentWriteInput {
  documentId: string;
  part: DocumentPart;
  nodeId?: string;
  value: DocumentModel | null;
}

export interface IDocumentWriteOutput {
  /** 写入成功后的内存模型修订号；从 1 开始，每次成功写入前进 1。 */
  revision: number;
}

export interface IDocumentSaveInput {
  documentId: string;
}

export interface IDocumentSaveOutput {
  source: string;
  /** 保存后的包内容摘要（目录态）或文件摘要（归档态）。 */
  digest: string;
}

/** 导出形态：归档单文件或目录。 */
export type DocumentExportForm = 'archive' | 'directory';

export interface IDocumentExportInput {
  documentId: string;
  target: string;
  form: DocumentExportForm;
  overwrite?: boolean;
}

export interface IDocumentExportOutput {
  target: string;
  /** 导出产物的包内容摘要（目录态）或文件摘要（归档态）。 */
  digest: string;
}

/**
 * 笔记存储契约消费面（重写件）。
 *
 * 权威链路：`document:open` / `document:read` / `document:write` / `document:save`
 * 四能力已由工单036 波 C3 翻正为宿主真实现（`packages/host/src/capabilities/document/`），
 * 本网关是插件侧唯一读写入口——经 `chips.request` 正式面调用，不私建解析、不直连文件系统。
 *
 * 组合语义（《04-能力契约规范》§7.3、宿主 `validation.ts` 判例同源）：
 * - 卡片（card）：`metadata` / `structure` / `content`（必须携带 `nodeId`）；不支持 `entries`；
 * - 箱子（box）：`metadata` / `structure` / `content`（不携带 `nodeId`）/ `entries`（可分页）。
 *
 * 写臂（本臂翻正）：`document:write` 只改宿主内存模型并回执 `{ revision }`（严格递增，
 * 从 1 开始）；落盘唯一入口是 `document:save`（回执 `{ source, digest }`）。应用写面
 * 覆盖 `metadata`（重命名/描述）与 `content`（内容节点值，携带 `nodeId`）两族切片；
 * `structure` / `entries` 写属编辑链路与箱子组织臂（裁决 B4：结构替换与内容成员须在
 * 同一保存中一致，应用不拆开写），不在本网关写面开放。
 *
 * 插件侧防御性复核码（不白信通道；与在册码分列，仅用于通道回执形态异常）：
 * - `DOCUMENT_PART_MISMATCH`：读回包切片与请求不一致；
 * - `DOCUMENT_REVISION_INVALID`：写回执修订号缺失/非正整数/未严格递增；
 * - `DOCUMENT_SAVE_RECEIPT_INVALID`：保存回包缺 `source` / `digest`；
 * - `DOCUMENT_GATEWAY_ERROR`：无错误码抛出值的兜底归一。
 */

import { chips } from '@chips/sdk';
import type {
  BoxMetadata,
  CardMetadata,
  ContentNode,
  DocumentKind,
  Entry,
  IDocumentOpenOutput,
  IDocumentReadOutput,
  IDocumentSaveOutput,
  IDocumentWriteOutput,
  StructureModel,
} from '@chips/sdk';
import type { NotebookDetail, NoteOutline, OpenedDocumentSummary } from './model';

/** 打开链错误：携带 Bridge 归一错误码（`BRIDGE_*` / `DOCUMENT_*`），界面直接呈现。 */
export class DocumentGatewayError extends Error {
  public readonly code: string;

  public constructor(code: string, message: string) {
    super(message);
    this.name = 'DocumentGatewayError';
    this.code = code;
  }
}

function toGatewayError(error: unknown): DocumentGatewayError {
  if (error instanceof DocumentGatewayError) {
    return error;
  }
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string' && code.length > 0) {
      return new DocumentGatewayError(code, error instanceof Error ? error.message : '未知错误');
    }
  }
  return new DocumentGatewayError('DOCUMENT_GATEWAY_ERROR', error instanceof Error ? error.message : '未知错误');
}

/** 从抛出值提取归一错误码与消息（编辑会话写通道/投影通道共用）。 */
export function describeGatewayError(error: unknown): { code: string; message: string } {
  const normalized = toGatewayError(error);
  return { code: normalized.code, message: normalized.message };
}

function toSummary(output: IDocumentOpenOutput): OpenedDocumentSummary {
  return {
    documentId: output.documentId,
    source: output.source,
    kind: output.kind,
    title: output.title,
    digest: output.digest,
  };
}

/** 笔记文档读写网关：`document:open` / `document:read` 的类型化读取面与写臂消费面。 */
export interface NotesDocumentGateway {
  /** 打开来源引用并返回库摘要（幂等：同一来源由宿主会话记录去重）。 */
  open(source: string): Promise<OpenedDocumentSummary>;
  /** 读卡片元数据切片。 */
  readCardMetadata(documentId: string): Promise<CardMetadata>;
  /** 读箱子元数据切片。 */
  readBoxMetadata(documentId: string): Promise<BoxMetadata>;
  /** 读结构切片（卡片 → 节点清单；箱子 → 条目同源结构）。 */
  readStructure(documentId: string): Promise<StructureModel>;
  /** 读箱子条目切片（`range` 分页，缺省整表）。 */
  readEntries(documentId: string, range?: { offset: number; limit: number }): Promise<readonly Entry[]>;
  /** 读卡片单个内容节点（`nodeId` 必携）。 */
  readCardContent(documentId: string, nodeId: string): Promise<ContentNode>;
  /** 读箱子内容切片（布局配置，不携带 `nodeId`）。 */
  readBoxContent(documentId: string): Promise<ContentNode>;
  /** 写模型切片（整体替换；`document:write` 回执 `{ revision }`，严格递增）。 */
  writeSlice(request: NotesDocumentWriteRequest): Promise<number>;
  /** 持久化文档（落盘唯一入口；`document:save` 回执 `{ source, digest }`）。 */
  saveDocument(documentId: string): Promise<NotesDocumentSaveReceipt>;
}

async function requestRead(
  documentId: string,
  part: 'metadata' | 'structure' | 'content' | 'entries',
  extra: Record<string, unknown>,
): Promise<IDocumentReadOutput> {
  try {
    return await chips.request<IDocumentReadOutput>('document:read', {
      documentId,
      part,
      ...extra,
    });
  } catch (error: unknown) {
    throw toGatewayError(error);
  }
}

/** 判定回包切片与请求一致性（宿主回包字段的防御性复核，不白信通道）。 */
function assertPart(output: IDocumentReadOutput, part: string): void {
  if (output.part !== part) {
    throw new DocumentGatewayError('DOCUMENT_PART_MISMATCH', '文档读取回包切片与请求不一致');
  }
}

/**
 * 写切片请求（`document:write` 输入的应用写面收窄：`metadata` / `content` 两族）。
 *
 * `value` 为整体替换的模型切片：元数据切片（`CardMetadata` / `BoxMetadata`）、内容节点
 * （`ContentNode`）或一般对象切片；数组与 null 不在本网关写面取值内（宿主语义：
 * 仅结构/条目族与成员删除使用，见 `04-能力契约规范` §7.3）。
 */
export interface NotesDocumentWriteRequest {
  readonly documentId: string;
  readonly part: 'metadata' | 'content';
  /** `part: 'content'` 且卡片文档时必携（成员定位；`04-能力契约规范` §7.3）。 */
  readonly nodeId?: string;
  readonly value: Record<string, unknown> | CardMetadata | BoxMetadata | ContentNode;
}

/** `document:save` 回执（落盘完成后交付保存位置与包摘要）。 */
export interface NotesDocumentSaveReceipt {
  readonly source: string;
  readonly digest: string;
}

/** 写回执守卫：修订号必须是正整数（`04-能力契约规范` §7.3：从 1 开始，每次成功写入前进 1）。 */
function assertRevisionReceipt(output: unknown): number {
  const revision = (output as { revision?: unknown } | null | undefined)?.revision;
  if (typeof revision !== 'number' || !Number.isInteger(revision) || revision <= 0) {
    throw new DocumentGatewayError('DOCUMENT_REVISION_INVALID', '文档写入回执缺少有效的修订号');
  }
  return revision;
}

/** 保存回执守卫：`source` / `digest` 必须为非空字符串。 */
function assertSaveReceipt(output: unknown): NotesDocumentSaveReceipt {
  const record = (output ?? {}) as { source?: unknown; digest?: unknown };
  if (typeof record.source !== 'string' || record.source.length === 0) {
    throw new DocumentGatewayError('DOCUMENT_SAVE_RECEIPT_INVALID', '文档保存回执缺少来源引用');
  }
  if (typeof record.digest !== 'string' || record.digest.length === 0) {
    throw new DocumentGatewayError('DOCUMENT_SAVE_RECEIPT_INVALID', '文档保存回执缺少包摘要');
  }
  return { source: record.source, digest: record.digest };
}

function createChipsDocumentGateway(): NotesDocumentGateway {
  return {
    async open(source: string): Promise<OpenedDocumentSummary> {
      let output: IDocumentOpenOutput;
      try {
        output = await chips.request<IDocumentOpenOutput>('document:open', { source });
      } catch (error: unknown) {
        throw toGatewayError(error);
      }
      return toSummary(output);
    },

    async readCardMetadata(documentId: string): Promise<CardMetadata> {
      const output = await requestRead(documentId, 'metadata', {});
      assertPart(output, 'metadata');
      const value = output.value as CardMetadata;
      if (typeof value.card_id !== 'string' || value.card_id.length === 0) {
        throw new DocumentGatewayError('DOCUMENT_METADATA_INVALID', '卡片元数据缺少 card_id');
      }
      return value;
    },

    async readBoxMetadata(documentId: string): Promise<BoxMetadata> {
      const output = await requestRead(documentId, 'metadata', {});
      assertPart(output, 'metadata');
      const value = output.value as BoxMetadata;
      if (typeof value.box_id !== 'string' || value.box_id.length === 0) {
        throw new DocumentGatewayError('DOCUMENT_METADATA_INVALID', '箱子元数据缺少 box_id');
      }
      return value;
    },

    async readStructure(documentId: string): Promise<StructureModel> {
      const output = await requestRead(documentId, 'structure', {});
      assertPart(output, 'structure');
      const value = output.value as StructureModel;
      if (!Array.isArray(value.structure)) {
        throw new DocumentGatewayError('DOCUMENT_STRUCTURE_INVALID', '结构切片缺少 structure 数组');
      }
      return value;
    },

    async readEntries(
      documentId: string,
      range?: { offset: number; limit: number },
    ): Promise<readonly Entry[]> {
      const output = await requestRead(
        documentId,
        'entries',
        range === undefined ? {} : { range: { offset: range.offset, limit: range.limit } },
      );
      assertPart(output, 'entries');
      const value: unknown = output.value;
      if (!Array.isArray(value)) {
        throw new DocumentGatewayError('DOCUMENT_ENTRIES_INVALID', '条目切片必须是数组');
      }
      return value as readonly Entry[];
    },

    async readCardContent(documentId: string, nodeId: string): Promise<ContentNode> {
      const output = await requestRead(documentId, 'content', { nodeId });
      assertPart(output, 'content');
      const value = output.value as ContentNode;
      if (typeof value.node_id !== 'string' || value.node_id.length === 0) {
        throw new DocumentGatewayError('DOCUMENT_CONTENT_INVALID', '内容节点缺少 node_id');
      }
      return value;
    },

    async readBoxContent(documentId: string): Promise<ContentNode> {
      const output = await requestRead(documentId, 'content', {});
      assertPart(output, 'content');
      const value = output.value as ContentNode;
      if (typeof value.card_type !== 'string' || value.card_type.length === 0) {
        throw new DocumentGatewayError('DOCUMENT_CONTENT_INVALID', '内容切片缺少 card_type');
      }
      return value;
    },

    async writeSlice(request: NotesDocumentWriteRequest): Promise<number> {
      const input: Record<string, unknown> = {
        documentId: request.documentId,
        part: request.part,
        value: request.value,
      };
      if (request.nodeId !== undefined) {
        input.nodeId = request.nodeId;
      }
      let output: IDocumentWriteOutput;
      try {
        output = await chips.request<IDocumentWriteOutput>('document:write', input);
      } catch (error: unknown) {
        throw toGatewayError(error);
      }
      return assertRevisionReceipt(output);
    },

    async saveDocument(documentId: string): Promise<NotesDocumentSaveReceipt> {
      let output: IDocumentSaveOutput;
      try {
        output = await chips.request<IDocumentSaveOutput>('document:save', { documentId });
      } catch (error: unknown) {
        throw toGatewayError(error);
      }
      return assertSaveReceipt(output);
    },
  };
}

/**
 * 笔记本/笔记整卷装配：打开摘要 → 元数据 + 结构 +（箱子）条目一次成卷。
 *
 * 卡片的内容节点载荷不在装配面读取（按节点懒加载，见 `readCardContent`）。
 */
export async function loadNotebookDetail(
  gateway: NotesDocumentGateway,
  documentId: string,
): Promise<NotebookDetail> {
  const [metadata, entries] = await Promise.all([
    gateway.readBoxMetadata(documentId),
    gateway.readEntries(documentId),
  ]);
  return { kind: 'box', metadata, entries };
}

export async function loadNoteOutline(
  gateway: NotesDocumentGateway,
  documentId: string,
): Promise<NoteOutline> {
  const [metadata, structure] = await Promise.all([
    gateway.readCardMetadata(documentId),
    gateway.readStructure(documentId),
  ]);
  return { kind: 'card', metadata, structure };
}

/** 文档类型推断（打开前的展示预判；以 `document:open` 回包 `kind` 为准）。 */
export function kindLabel(kind: DocumentKind): string {
  return kind === 'box' ? '笔记本' : '笔记';
}

/**
 * 窗口会话默认网关：渲染上下文内共享（组合根消费）；测试经 `createChipsDocumentGateway`
 * 建立隔离实例（`chips.request` 由测试桥替换）。
 */
const windowGateway = createChipsDocumentGateway();

export function createIsolatedDocumentGateway(): NotesDocumentGateway {
  return createChipsDocumentGateway();
}

export function getWindowDocumentGateway(): NotesDocumentGateway {
  return windowGateway;
}

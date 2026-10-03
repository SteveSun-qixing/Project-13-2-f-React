/**
 * 富文本文档存储契约消费面（编辑臂）。
 *
 * 权威链路：`document:open` / `document:read` / `document:write` / `document:save` 四能力已由
 * 工单036 波 C3 翻正为宿主真实现（`packages/host/src/capabilities/document/`）；`document:create`
 * 与 `document:export` 的宿主实现在途（第十三项候裁，缺位已登记工单），本网关按 04-能力契约
 * 规范 §7.3 正式契约消费，宿主缺位时透传真实错误码，不假成功、不临时绕过。
 *
 * 本网关是应用插件侧唯一读写入口——经 `chips.request` 正式面调用，不私建解析、不直连文件系统
 * （`.card` 字节打包归宿主文档服务与解析链，01-卡片文件格式 §17「链路唯一」）。
 *
 * 写臂（编辑回流唯一时序第③拍）：`document:write` 只改宿主内存模型并回执 `{ revision }`
 * （严格递增，从 1 开始）；落盘唯一入口是 `document:save`（回执 `{ source, digest }`）。
 * 本应用为固定复合卡片编辑器，写面只开放卡片 `content` 切片（按节点整体替换）；
 * `structure` / `metadata` 写属编辑链路职责，不在本网关写面开放。
 *
 * 插件侧防御性复核码（不白信通道；与在册码分列，仅用于通道回执形态异常）：
 * - `DOCUMENT_PART_MISMATCH`：读回包切片与请求不一致；
 * - `DOCUMENT_REVISION_INVALID`：写回执修订号缺失/非正整数；
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
  IDocumentCreateInput,
  IDocumentCreateOutput,
  IDocumentExportInput,
  IDocumentExportOutput,
  IDocumentOpenOutput,
  IDocumentReadOutput,
  IDocumentSaveOutput,
  IDocumentWriteOutput,
  StructureModel,
} from '@chips/sdk';

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
  return new DocumentGatewayError(
    'DOCUMENT_GATEWAY_ERROR',
    error instanceof Error ? error.message : '未知错误'
  );
}

/** 从抛出值提取归一错误码与消息（编辑会话写通道/投影通道与界面层共用）。 */
export function describeGatewayError(error: unknown): { code: string; message: string } {
  const normalized = toGatewayError(error);
  return { code: normalized.code, message: normalized.message };
}

/** 打开文档的库摘要（库浏览面条目事实源）。 */
export interface OpenedDocumentSummary {
  readonly documentId: string;
  readonly source: string;
  readonly kind: DocumentKind;
  readonly title: string;
  readonly digest: string;
}

/** `document:save` 回执（落盘完成后交付保存位置与包摘要）。 */
export interface DocumentSaveReceipt {
  readonly source: string;
  readonly digest: string;
}

/** 富文本文档网关：document:* 正式能力的类型化消费面。 */
export interface RichTextDocumentGateway {
  /** 打开来源引用并返回库摘要（幂等：同一来源由宿主会话记录去重）。 */
  open(source: string): Promise<OpenedDocumentSummary>;
  /** 读卡片元数据切片。 */
  readCardMetadata(documentId: string): Promise<CardMetadata>;
  /** 读箱子元数据切片（卡箱浏览面只读摘要）。 */
  readBoxMetadata(documentId: string): Promise<BoxMetadata>;
  /** 读结构切片（固定复合卡片 → 单节点清单）。 */
  readStructure(documentId: string): Promise<StructureModel>;
  /** 读卡片单个内容节点（`nodeId` 必携）。 */
  readCardContent(documentId: string, nodeId: string): Promise<ContentNode>;
  /** 读箱子条目切片（`range` 分页，缺省整表；卡箱浏览面只读摘要）。 */
  readEntries(
    documentId: string,
    range?: { offset: number; limit: number }
  ): Promise<readonly Entry[]>;
  /** 写卡片内容节点（整体替换；`document:write` 回执 `{ revision }`，严格递增）。 */
  writeCardContent(
    documentId: string,
    nodeId: string,
    value: Record<string, unknown>
  ): Promise<number>;
  /** 持久化文档（落盘唯一入口；`document:save` 回执 `{ source, digest }`）。 */
  saveDocument(documentId: string): Promise<DocumentSaveReceipt>;
  /** 新建文档（宿主实现在途；按正式契约调用，缺位时透传真实错误码）。 */
  createDocument(input: IDocumentCreateInput): Promise<IDocumentCreateOutput>;
  /** 导出文档（宿主实现在途，第十三项；按正式契约调用，缺位时透传真实错误码）。 */
  exportDocument(input: IDocumentExportInput): Promise<IDocumentExportOutput>;
}

async function requestRead(
  documentId: string,
  part: 'metadata' | 'structure' | 'content' | 'entries',
  extra: Record<string, unknown>
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

/** 写回执守卫：修订号必须是正整数（04-能力契约规范 §7.3：从 1 开始，每次成功写入前进 1）。 */
function assertRevisionReceipt(output: unknown): number {
  const revision = (output as { revision?: unknown } | null | undefined)?.revision;
  if (typeof revision !== 'number' || !Number.isInteger(revision) || revision <= 0) {
    throw new DocumentGatewayError('DOCUMENT_REVISION_INVALID', '文档写入回执缺少有效的修订号');
  }
  return revision;
}

/** 保存回执守卫：`source` / `digest` 必须为非空字符串。 */
function assertSaveReceipt(output: IDocumentSaveOutput): DocumentSaveReceipt {
  const record = (output ?? {}) as { source?: unknown; digest?: unknown };
  if (typeof record.source !== 'string' || record.source.length === 0) {
    throw new DocumentGatewayError('DOCUMENT_SAVE_RECEIPT_INVALID', '文档保存回执缺少来源引用');
  }
  if (typeof record.digest !== 'string' || record.digest.length === 0) {
    throw new DocumentGatewayError('DOCUMENT_SAVE_RECEIPT_INVALID', '文档保存回执缺少包摘要');
  }
  return { source: record.source, digest: record.digest };
}

function createChipsDocumentGateway(): RichTextDocumentGateway {
  return {
    async open(source: string): Promise<OpenedDocumentSummary> {
      let output: IDocumentOpenOutput;
      try {
        output = await chips.request<IDocumentOpenOutput>('document:open', { source });
      } catch (error: unknown) {
        throw toGatewayError(error);
      }
      return {
        documentId: output.documentId,
        source: output.source,
        kind: output.kind,
        title: output.title,
        digest: output.digest,
      };
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

    async readCardContent(documentId: string, nodeId: string): Promise<ContentNode> {
      const output = await requestRead(documentId, 'content', { nodeId });
      assertPart(output, 'content');
      const value = output.value as ContentNode;
      if (typeof value.node_id !== 'string' || value.node_id.length === 0) {
        throw new DocumentGatewayError('DOCUMENT_CONTENT_INVALID', '内容节点缺少 node_id');
      }
      return value;
    },

    async readEntries(
      documentId: string,
      range?: { offset: number; limit: number }
    ): Promise<readonly Entry[]> {
      const output = await requestRead(
        documentId,
        'entries',
        range === undefined ? {} : { range: { offset: range.offset, limit: range.limit } }
      );
      assertPart(output, 'entries');
      const value: unknown = output.value;
      if (!Array.isArray(value)) {
        throw new DocumentGatewayError('DOCUMENT_ENTRIES_INVALID', '条目切片必须是数组');
      }
      return value as readonly Entry[];
    },

    async writeCardContent(
      documentId: string,
      nodeId: string,
      value: Record<string, unknown>
    ): Promise<number> {
      let output: IDocumentWriteOutput;
      try {
        output = await chips.request<IDocumentWriteOutput>('document:write', {
          documentId,
          part: 'content',
          nodeId,
          value,
        });
      } catch (error: unknown) {
        throw toGatewayError(error);
      }
      return assertRevisionReceipt(output);
    },

    async saveDocument(documentId: string): Promise<DocumentSaveReceipt> {
      let output: IDocumentSaveOutput;
      try {
        output = await chips.request<IDocumentSaveOutput>('document:save', { documentId });
      } catch (error: unknown) {
        throw toGatewayError(error);
      }
      return assertSaveReceipt(output);
    },

    async createDocument(input: IDocumentCreateInput): Promise<IDocumentCreateOutput> {
      try {
        return await chips.request<IDocumentCreateOutput>('document:create', {
          kind: input.kind,
          parent: input.parent,
          ...(input.name === undefined ? {} : { name: input.name }),
          ...(input.initialContent === undefined ? {} : { initialContent: input.initialContent }),
        });
      } catch (error: unknown) {
        throw toGatewayError(error);
      }
    },

    async exportDocument(input: IDocumentExportInput): Promise<IDocumentExportOutput> {
      try {
        return await chips.request<IDocumentExportOutput>('document:export', {
          documentId: input.documentId,
          target: input.target,
          form: input.form,
          ...(input.overwrite === undefined ? {} : { overwrite: input.overwrite }),
        });
      } catch (error: unknown) {
        throw toGatewayError(error);
      }
    },
  };
}

/**
 * 窗口会话默认网关：渲染上下文内共享（组合根消费）；测试经 `createIsolatedDocumentGateway`
 * 建立隔离实例（`chips.request` 由测试桥替换，02-SDK-API规范 §3.2 惰性绑定口径）。
 */
const windowGateway = createChipsDocumentGateway();

export function createIsolatedDocumentGateway(): RichTextDocumentGateway {
  return createChipsDocumentGateway();
}

export function getWindowDocumentGateway(): RichTextDocumentGateway {
  return windowGateway;
}

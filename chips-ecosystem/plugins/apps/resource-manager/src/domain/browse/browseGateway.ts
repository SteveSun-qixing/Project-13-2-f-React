/**
 * 资源浏览域：只读消费面（全新建，《04-资源管理器产品设计》§1.4 权限声明落面）。
 *
 * 真实现消费（resources:read 解锁且宿主已落位的通道）：
 * - `document:open` / `document:read`（工单036 波 C3 翻正为 chips-resource changeset 真实现）——
 *   按来源打开文档并读取元数据/结构/条目切片，承载条目呈现契约消费面；
 * - 写臂（`resource:write` / `resources:write`）候工单036 后续段注册，本臂不接线、不声明权限。
 *
 * 降级登记（如实呈现，不伪造）：
 * - 工作区目录树数据源 `filesystem:read:${workspace}` 域宿主处理器缺位（工单036 后续段），
 *   目录树呈现降级为「按来源打开」的显式入口；
 * - `resource:open` 打开意图路由未落位，条目「打开」动作只上报意图失败原因，不伪造打开成功。
 */

import { chips } from '@chips/sdk';
import type {
  BoxMetadata,
  CardMetadata,
  Entry,
  IDocumentOpenOutput,
  IDocumentReadOutput,
  StructureModel,
} from '@chips/sdk';
import type { BrowsedDocumentSummary, DocumentBrowseDetail } from './entryModel';

/** 浏览链错误：携带 Bridge 归一错误码，界面直接呈现。 */
export class BrowseGatewayError extends Error {
  public readonly code: string;

  public constructor(code: string, message: string) {
    super(message);
    this.name = 'BrowseGatewayError';
    this.code = code;
  }
}

function toGatewayError(error: unknown): BrowseGatewayError {
  if (error instanceof BrowseGatewayError) {
    return error;
  }
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string' && code.length > 0) {
      return new BrowseGatewayError(code, error instanceof Error ? error.message : '未知错误');
    }
  }
  return new BrowseGatewayError('BROWSE_GATEWAY_ERROR', error instanceof Error ? error.message : '未知错误');
}

/** 资源浏览只读网关：`document:open` / `document:read` 的类型化封装。 */
export interface ResourceBrowseGateway {
  /** 打开来源引用并返回浏览摘要。 */
  open(source: string): Promise<BrowsedDocumentSummary>;
  /** 读卡片摘要视图（元数据 + 结构）。 */
  readCardDetail(documentId: string): Promise<DocumentBrowseDetail & { kind: 'card' }>;
  /** 读箱子摘要视图（元数据 + 条目清单，`range` 分页可选）。 */
  readBoxDetail(
    documentId: string,
    range?: { offset: number; limit: number },
  ): Promise<DocumentBrowseDetail & { kind: 'box' }>;
}

async function requestRead(
  documentId: string,
  part: 'metadata' | 'structure' | 'entries',
  extra: Record<string, unknown>,
): Promise<IDocumentReadOutput> {
  try {
    return await chips.request<IDocumentReadOutput>('document:read', { documentId, part, ...extra });
  } catch (error: unknown) {
    throw toGatewayError(error);
  }
}

/** 回包切片与请求一致性防御复核（不白信通道）。 */
function assertPart(output: IDocumentReadOutput, part: string): void {
  if (output.part !== part) {
    throw new BrowseGatewayError('DOCUMENT_PART_MISMATCH', '文档读取回包切片与请求不一致');
  }
}

function createChipsBrowseGateway(): ResourceBrowseGateway {
  return {
    async open(source: string): Promise<BrowsedDocumentSummary> {
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

    async readCardDetail(documentId: string): Promise<DocumentBrowseDetail & { kind: 'card' }> {
      const [metadataOutput, structureOutput] = await Promise.all([
        requestRead(documentId, 'metadata', {}),
        requestRead(documentId, 'structure', {}),
      ]);
      assertPart(metadataOutput, 'metadata');
      assertPart(structureOutput, 'structure');
      const metadata = metadataOutput.value as CardMetadata;
      if (typeof metadata.card_id !== 'string' || metadata.card_id.length === 0) {
        throw new BrowseGatewayError('DOCUMENT_METADATA_INVALID', '卡片元数据缺少 card_id');
      }
      const structure = structureOutput.value as StructureModel;
      if (!Array.isArray(structure.structure)) {
        throw new BrowseGatewayError('DOCUMENT_STRUCTURE_INVALID', '结构切片缺少 structure 数组');
      }
      return { kind: 'card', metadata, structure };
    },

    async readBoxDetail(
      documentId: string,
      range?: { offset: number; limit: number },
    ): Promise<DocumentBrowseDetail & { kind: 'box' }> {
      const [metadataOutput, entriesOutput] = await Promise.all([
        requestRead(documentId, 'metadata', {}),
        requestRead(
          documentId,
          'entries',
          range === undefined ? {} : { range: { offset: range.offset, limit: range.limit } },
        ),
      ]);
      assertPart(metadataOutput, 'metadata');
      assertPart(entriesOutput, 'entries');
      const metadata = metadataOutput.value as BoxMetadata;
      if (typeof metadata.box_id !== 'string' || metadata.box_id.length === 0) {
        throw new BrowseGatewayError('DOCUMENT_METADATA_INVALID', '箱子元数据缺少 box_id');
      }
      const entries = entriesOutput.value as readonly Entry[];
      if (!Array.isArray(entries)) {
        throw new BrowseGatewayError('DOCUMENT_ENTRIES_INVALID', '条目切片必须是数组');
      }
      return { kind: 'box', metadata, entries };
    },
  };
}

/**
 * 窗口会话默认网关：渲染上下文内共享（组合根消费）；测试经 `createIsolatedBrowseGateway`
 * 建立隔离实例（`chips.request` 由测试桥替换）。
 */
const windowGateway = createChipsBrowseGateway();

export function createIsolatedBrowseGateway(): ResourceBrowseGateway {
  return createChipsBrowseGateway();
}

export function getWindowBrowseGateway(): ResourceBrowseGateway {
  return windowGateway;
}

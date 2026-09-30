/**
 * document:* 链路消费：把 `document:open` / `document:read` 的模型切片收窄为转换核心输入。
 *
 * - 只消费宿主文档服务产出的在册形状（04-能力契约规范 §8.3 约束 4「不解析文档」）；
 * - 切片形状不合法 → `CONVERTER_RENDER_FAILED`（details.part 标明切片）；
 * - 单个内容节点不存在（`DOCUMENT_NOT_FOUND`）→ 节点级警告后跳过，不中断导出；
 *   其余 `DOCUMENT_*` / 通道错误原样透传（直连服务消费方按原码分支）。
 */

import type { IServiceBridge } from '@chips/sdk';

import {
  DOCUMENT_NOT_FOUND_CODE,
  createInputUnsupportedError,
  createRenderFailedError,
  hasChipsErrorCode,
} from './errors.js';
import type {
  ICardDocumentModel,
  ICardMetadataView,
  ICardResourceEntry,
  ICardStructureEntry,
  ICardContentNodeModel,
  ICardToHtmlWarning,
} from './types.js';

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const asOptionalString = (value: unknown): string | undefined => {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
};

function narrowStructureEntries(value: unknown): ICardStructureEntry[] {
  if (!Array.isArray(value)) {
    throw createRenderFailedError('文档结构切片形状不合法。', { part: 'structure' });
  }
  const entries: ICardStructureEntry[] = [];
  for (const item of value) {
    if (!isRecord(item) || typeof item.id !== 'string' || item.id.length === 0) {
      throw createRenderFailedError('文档结构条目形状不合法。', { part: 'structure' });
    }
    entries.push({
      id: item.id,
      type: typeof item.type === 'string' ? item.type : '',
    });
  }
  return entries;
}

function narrowResources(value: unknown): ICardResourceEntry[] {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw createRenderFailedError('文档资源清单形状不合法。', { part: 'structure' });
  }
  const resources: ICardResourceEntry[] = [];
  for (const item of value) {
    if (!isRecord(item) || typeof item.path !== 'string' || item.path.length === 0) {
      throw createRenderFailedError('文档资源条目形状不合法。', { part: 'structure' });
    }
    resources.push({
      path: item.path,
      type: typeof item.type === 'string' ? item.type : '',
      ...(typeof item.width === 'number' ? { width: item.width } : {}),
      ...(typeof item.height === 'number' ? { height: item.height } : {}),
    });
  }
  return resources;
}

function narrowMetadata(value: unknown, documentId: string): ICardMetadataView {
  if (!isRecord(value) || typeof value.name !== 'string' || value.name.length === 0) {
    throw createRenderFailedError('文档元数据切片形状不合法。', { part: 'metadata' });
  }
  const tags: (string | readonly string[])[] = Array.isArray(value.tags)
    ? value.tags.filter(
        (tag): tag is string | string[] =>
          typeof tag === 'string' ||
          (Array.isArray(tag) && tag.every((item) => typeof item === 'string'))
      )
    : [];
  const createdAt = asOptionalString(value.created_at);
  const modifiedAt = asOptionalString(value.modified_at);
  const theme = asOptionalString(value.theme);
  return {
    cardId: asOptionalString(value.card_id) ?? documentId,
    name: value.name,
    ...(createdAt !== undefined ? { createdAt } : {}),
    ...(modifiedAt !== undefined ? { modifiedAt } : {}),
    ...(theme !== undefined ? { theme } : {}),
    tags,
  };
}

function narrowContentNode(value: unknown, nodeId: string): ICardContentNodeModel {
  if (!isRecord(value)) {
    throw createRenderFailedError('文档内容切片形状不合法。', { part: 'content', nodeId });
  }
  return {
    nodeId,
    cardType: typeof value.card_type === 'string' ? value.card_type : '',
    value,
    diagnostics: [],
  };
}

/**
 * 读取并收窄卡片文档模型。
 *
 * @param bridge 服务插件自身会话的出站能力面
 * @param source 卡片文档受管引用（document:open 输入 `source`）
 */
export async function readCardDocumentModel(
  bridge: IServiceBridge,
  source: string
): Promise<ICardDocumentModel> {
  const opened = await bridge.request<{ documentId: string; source: string; kind: string; digest: string }>(
    'document:open',
    { source, kind: 'card' }
  );
  if (opened.kind !== 'card') {
    throw createInputUnsupportedError('来源不是卡片文档，导出服务只接受卡片。', 'source-not-card');
  }

  const documentId = opened.documentId;
  const metadataRead = await bridge.request<{ value: unknown }>('document:read', {
    documentId,
    part: 'metadata',
  });
  const structureRead = await bridge.request<{ value: unknown }>('document:read', {
    documentId,
    part: 'structure',
  });

  // `document:read` 的 `structure` 切片 value 为 StructureModel：`{ structure, manifest }`
  // （@chips/sdk 文档模型切片联合，chips-parser 解析域 L1 视图）。
  const structureSlice = isRecord(structureRead.value) ? structureRead.value : undefined;
  const structure = narrowStructureEntries(structureSlice?.structure);
  const manifest = isRecord(structureSlice?.manifest) ? structureSlice.manifest : {};
  const resources = narrowResources(manifest.resources);
  const metadata = narrowMetadata(metadataRead.value, documentId);

  const nodes: ICardContentNodeModel[] = [];
  const nodeWarnings: ICardToHtmlWarning[] = [];
  for (const entry of structure) {
    try {
      const read = await bridge.request<{ value: unknown }>('document:read', {
        documentId,
        part: 'content',
        nodeId: entry.id,
      });
      nodes.push(narrowContentNode(read.value, entry.id));
    } catch (error) {
      if (hasChipsErrorCode(error, DOCUMENT_NOT_FOUND_CODE)) {
        nodeWarnings.push({
          code: 'CONVERTER_NODE_UNAVAILABLE',
          message: `内容节点 ${entry.id} 不可用，已在导出产物中跳过。`,
        });
        continue;
      }
      throw error;
    }
  }

  return {
    documentId,
    source: opened.source,
    digest: opened.digest,
    title: metadata.name,
    metadata,
    structure,
    resources,
    nodes,
    nodeWarnings,
  };
}

/**
 * 箱子文档写端编解码（metadata.yaml / content.yaml / structure.yaml / cover.html）
 *
 * 逻辑来源：Chips-EditingEngine `src/services/box-document-service.ts`（task034 M3 上移）。
 * 与 Host box-service 读取端（normalizeMetadata/normalizeContent/normalizeEntries）为
 * 同一模型的对称写端，字段口径必须保持一致。
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import yaml from 'yaml';
import { createError } from '../../../../src/shared/errors';
import type { BoxContent, BoxEntrySnapshot, BoxLayoutConfig, BoxMetadata } from '../box-service';
import type { BoxSessionSnapshot } from './types';

const asRecord = (value: unknown): Record<string, unknown> => {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
};

export const serializeMetadata = (metadata: BoxMetadata): Record<string, unknown> => {
  const raw: Record<string, unknown> = {
    chip_standards_version: metadata.chipStandardsVersion,
    box_id: metadata.boxId,
    name: metadata.name,
    created_at: metadata.createdAt,
    modified_at: metadata.modifiedAt,
    active_layout_type: metadata.activeLayoutType,
  };

  if (metadata.coverRatio) raw.cover_ratio = metadata.coverRatio;
  if (metadata.description) raw.description = metadata.description;
  if (metadata.tags) raw.tags = metadata.tags;
  if (metadata.coverAsset) raw.cover_asset = metadata.coverAsset;
  if (metadata.owner) raw.owner = metadata.owner;
  if (metadata.source) raw.source = metadata.source;

  return raw;
};

export const serializeLayoutConfig = (config: BoxLayoutConfig): Record<string, unknown> => {
  const raw: Record<string, unknown> = {};
  if (config.schemaVersion) raw.schema_version = config.schemaVersion;
  if (config.props) raw.props = config.props;
  if (config.assetRefs && config.assetRefs.length > 0) raw.asset_refs = config.assetRefs;

  for (const [key, value] of Object.entries(config)) {
    if (key === 'schemaVersion' || key === 'props' || key === 'assetRefs') {
      continue;
    }
    raw[key] = value;
  }

  return raw;
};

export const serializeContent = (content: BoxContent): Record<string, unknown> => {
  return {
    active_layout_type: content.activeLayoutType,
    layout_configs: Object.fromEntries(
      Object.entries(content.layoutConfigs).map(([layoutType, config]) => [
        layoutType,
        serializeLayoutConfig(config),
      ]),
    ),
  };
};

export const serializeEntry = (entry: BoxEntrySnapshot): Record<string, unknown> => {
  const rawSnapshot: Record<string, unknown> = {};
  if (entry.snapshot.documentId) rawSnapshot.document_id = entry.snapshot.documentId;
  if (entry.snapshot.title) rawSnapshot.title = entry.snapshot.title;
  if (entry.snapshot.summary) rawSnapshot.summary = entry.snapshot.summary;
  if (entry.snapshot.tags) rawSnapshot.tags = entry.snapshot.tags;
  if (entry.snapshot.cover) {
    rawSnapshot.cover = {
      mode: entry.snapshot.cover.mode,
      ...(entry.snapshot.cover.assetPath ? { asset_path: entry.snapshot.cover.assetPath } : {}),
      ...(entry.snapshot.cover.mimeType ? { mime_type: entry.snapshot.cover.mimeType } : {}),
      ...(typeof entry.snapshot.cover.width === 'number' ? { width: entry.snapshot.cover.width } : {}),
      ...(typeof entry.snapshot.cover.height === 'number' ? { height: entry.snapshot.cover.height } : {}),
    };
  }
  if (entry.snapshot.lastKnownModifiedAt) rawSnapshot.last_known_modified_at = entry.snapshot.lastKnownModifiedAt;
  if (entry.snapshot.contentType) rawSnapshot.content_type = entry.snapshot.contentType;

  const rawHints: Record<string, unknown> = {};
  if (typeof entry.layoutHints?.sortKey !== 'undefined') rawHints.sort_key = entry.layoutHints.sortKey;
  if (typeof entry.layoutHints?.aspectRatio === 'number') rawHints.aspect_ratio = entry.layoutHints.aspectRatio;
  if (entry.layoutHints?.group) rawHints.group = entry.layoutHints.group;
  if (typeof entry.layoutHints?.priority === 'number') rawHints.priority = entry.layoutHints.priority;

  return {
    entry_id: entry.entryId,
    url: entry.url,
    enabled: entry.enabled,
    snapshot: rawSnapshot,
    ...(Object.keys(rawHints).length > 0 ? { layout_hints: rawHints } : {}),
  };
};

export const serializeStructure = (entries: BoxEntrySnapshot[]): Record<string, unknown> => {
  return {
    entries: entries.map((entry) => serializeEntry(entry)),
  };
};

/** 将会话快照序列化写盘（重建 .box 四个正式文件）。 */
export async function writeBoxDocumentFiles(
  workspaceDir: string,
  snapshot: Pick<BoxSessionSnapshot, 'metadata' | 'coverHtml' | 'content' | 'entries'>,
): Promise<void> {
  const boxDir = path.join(workspaceDir, '.box');
  await fs.mkdir(boxDir, { recursive: true });

  await fs.writeFile(
    path.join(boxDir, 'metadata.yaml'),
    yaml.stringify(serializeMetadata(snapshot.metadata)),
    'utf-8',
  );
  await fs.writeFile(
    path.join(boxDir, 'content.yaml'),
    yaml.stringify(serializeContent(snapshot.content)),
    'utf-8',
  );
  await fs.writeFile(
    path.join(boxDir, 'cover.html'),
    snapshot.coverHtml,
    'utf-8',
  );
  await fs.writeFile(
    path.join(boxDir, 'structure.yaml'),
    yaml.stringify(serializeStructure(snapshot.entries)),
    'utf-8',
  );
}

/** 规范化条目排序键（按可见顺序重建 sortKey）。 */
export const normalizeEntrySortOrder = (entries: BoxEntrySnapshot[]): BoxEntrySnapshot[] => {
  return entries.map((entry, index) => ({
    ...entry,
    layoutHints: {
      ...entry.layoutHints,
      sortKey: index,
    },
  }));
};

export const asBoxRecord = asRecord;

export const BOX_DEFAULT_LAYOUT_TYPE = 'chips.layout.grid';

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';
import * as yaml from 'js-yaml';
import * as unzipper from 'unzipper';
import { eq, and, isNull, desc, count, inArray, type SQL } from 'drizzle-orm';
import { db } from '../db/client';
import { boxes, type Box, type NewBox } from '../db/schema/boxes';
import { cards } from '../db/schema/cards';
import { deleteObject } from '../storage/s3';
import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/codes';
import type {
  BoxMetadata,
  BoxStructure,
  BoxUnpackResult,
  EnrichedBoxEntryRef,
} from '../types/box';
import type { PaginationInput, UpdateBoxInput } from '../schemas/content.schemas';
import type { PagedResult } from './card.service';

interface BoxSummaryRecord {
  id: string;
  title: string;
  coverUrl: string | null;
  coverRatio: string | null;
  documentUrl: string | null;
  layoutPlugin: string | null;
  visibility: Box['visibility'];
  createdAt: Date;
}

/** .box 包内必需配置文件（对齐 Host box-service） */
const REQUIRED_BOX_FILES = ['.box/metadata.yaml', '.box/structure.yaml', '.box/content.yaml', '.box/cover.html'];

/** 判断 url 是否为外部绝对 URL（scheme:// 形式） */
const SCHEME_URL_PATTERN = /^[a-z][a-z0-9+.-]*:\/\//i;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getCoverRatioFromMetadata(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object') {
    return null;
  }

  const rawRatio = (metadata as { cover_ratio?: unknown }).cover_ratio;
  return typeof rawRatio === 'string' && rawRatio.trim() ? rawRatio.trim() : null;
}

/**
 * 校验解析后的箱子内容（metadata/structure/content）。
 * 与 Host box-service 的正式格式口径保持一致。
 */
export function validateParsedBox(metadata: unknown, structure: unknown, content: unknown): void {
  if (!isPlainObject(metadata)) {
    throw AppError.badRequest(ErrorCode.FILE_CORRUPT, 'Invalid .box file: metadata must be an object');
  }

  for (const field of ['box_id', 'name', 'active_layout_type'] as const) {
    if (typeof metadata[field] !== 'string' || metadata[field].trim().length === 0) {
      throw AppError.badRequest(ErrorCode.FILE_CORRUPT, `Invalid .box file: metadata.${field} is required`);
    }
  }

  if (!isPlainObject(structure) || !Array.isArray(structure.entries)) {
    throw AppError.badRequest(ErrorCode.FILE_CORRUPT, 'Invalid .box file: structure.entries must be an array');
  }

  for (const [index, entry] of structure.entries.entries()) {
    if (!isPlainObject(entry)) {
      throw AppError.badRequest(ErrorCode.FILE_CORRUPT, `Invalid .box file: structure.entries[${index}] must be an object`);
    }
    if (
      typeof entry.entry_id !== 'string' ||
      entry.entry_id.trim().length === 0 ||
      typeof entry.url !== 'string' ||
      entry.url.trim().length === 0 ||
      typeof entry.enabled !== 'boolean'
    ) {
      throw AppError.badRequest(
        ErrorCode.FILE_CORRUPT,
        `Invalid .box file: structure.entries[${index}] is missing required fields`,
      );
    }
  }

  if (!isPlainObject(content)) {
    throw AppError.badRequest(ErrorCode.FILE_CORRUPT, 'Invalid .box file: content must be an object');
  }
}

async function paginateBoxes(
  where: SQL | undefined,
  pagination: PaginationInput,
): Promise<PagedResult<Box>> {
  const { page, pageSize } = pagination;
  const offset = (page - 1) * pageSize;

  const [items, totalRows] = await Promise.all([
    db.query.boxes.findMany({
      where,
      orderBy: [desc(boxes.createdAt)],
      limit: pageSize,
      offset,
    }),
    where
      ? db.select({ count: count() }).from(boxes).where(where)
      : db.select({ count: count() }).from(boxes),
  ]);

  const total = Number(totalRows[0]?.count ?? 0);
  return {
    items,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

async function paginateBoxSummaries(
  where: SQL | undefined,
  pagination: PaginationInput,
): Promise<PagedResult<BoxSummaryRecord>> {
  const { page, pageSize } = pagination;
  const offset = (page - 1) * pageSize;

  const [items, totalRows] = await Promise.all([
    db.query.boxes.findMany({
      where,
      columns: {
        id: true,
        title: true,
        coverUrl: true,
        coverRatio: true,
        documentUrl: true,
        layoutPlugin: true,
        visibility: true,
        createdAt: true,
      },
      orderBy: [desc(boxes.createdAt)],
      limit: pageSize,
      offset,
    }),
    where
      ? db.select({ count: count() }).from(boxes).where(where)
      : db.select({ count: count() }).from(boxes),
  ]);

  const total = Number(totalRows[0]?.count ?? 0);
  return {
    items,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

/** ZIP 魔数 */
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

async function validateZipMagic(filePath: string): Promise<void> {
  const fd = fs.openSync(filePath, 'r');
  const header = Buffer.alloc(4);
  fs.readSync(fd, header, 0, 4, 0);
  fs.closeSync(fd);
  if (!header.equals(ZIP_MAGIC)) {
    throw AppError.badRequest(ErrorCode.FILE_CORRUPT, 'File is not a valid ZIP archive');
  }
}

/**
 * 把 .box ZIP 解包到临时目录。
 * 注意：unzipper.Parse({ forceStream: true }) 不会触发 entry 事件，
 * 必须使用 unzipper.Parse() 的事件流形式。
 */
async function extractZip(filePath: string, tempDir: string): Promise<void> {
  const realTempDir = fs.realpathSync(tempDir);
  const parser = fs.createReadStream(filePath).pipe(unzipper.Parse());
  const pendingWrites: Array<Promise<void>> = [];

  parser.on('entry', (entry: unzipper.Entry) => {
    const destPath = path.resolve(realTempDir, entry.path);
    if (!destPath.startsWith(realTempDir + path.sep) && destPath !== realTempDir) {
      entry.autodrain();
      return;
    }
    if (entry.type === 'Directory') {
      fs.mkdirSync(destPath, { recursive: true });
      entry.autodrain();
    } else {
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      pendingWrites.push(
        new Promise<void>((resolve, reject) => {
          const output = fs.createWriteStream(destPath);
          entry.on('error', reject);
          output.on('finish', resolve);
          output.on('error', reject);
          entry.pipe(output);
        }),
      );
    }
  });

  await new Promise<void>((resolve, reject) => {
    parser.on('finish', resolve);
    parser.on('error', reject);
  });
  await Promise.all(pendingWrites);
}

async function unpackBox(boxFilePath: string): Promise<BoxUnpackResult> {
  await validateZipMagic(boxFilePath);

  const tempDir = path.join(os.tmpdir(), `ccps-box-${uuidv4()}`);
  fs.mkdirSync(tempDir, { recursive: true });

  try {
    await extractZip(boxFilePath, tempDir);

    for (const requiredFile of REQUIRED_BOX_FILES) {
      if (!fs.existsSync(path.join(tempDir, requiredFile))) {
        throw AppError.badRequest(ErrorCode.FILE_CORRUPT, `Invalid .box file: missing ${requiredFile}`);
      }
    }

    const metadata = yaml.load(fs.readFileSync(path.join(tempDir, '.box/metadata.yaml'), 'utf-8'));
    const structure = yaml.load(fs.readFileSync(path.join(tempDir, '.box/structure.yaml'), 'utf-8'));
    const content = yaml.load(fs.readFileSync(path.join(tempDir, '.box/content.yaml'), 'utf-8'));

    validateParsedBox(metadata, structure, content);

    return {
      tempDir,
      metadata: metadata as BoxMetadata,
      structure: structure as BoxStructure,
      content: content as Record<string, unknown>,
    };
  } catch (err) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    throw err;
  }
}

export const BoxService = {
  /**
   * 解包 .box 文件并解析正式格式（metadata/structure/content）。
   * 返回的 tempDir 由调用方负责清理。
   */
  async unpack(boxFilePath: string): Promise<BoxUnpackResult> {
    return unpackBox(boxFilePath);
  },

  /**
   * 落库箱子记录。
   * 源 .box 对象由调用方先保存到对象存储，create 只负责解析结果与源对象信息的持久化。
   * 传入 boxId 时更新对应上传会话的占位记录，否则新建记录。
   */
  async create(params: {
    userId: string;
    roomId?: string;
    visibility: 'public' | 'private';
    fileSizeBytes: number;
    sourceBoxBucket?: string;
    sourceBoxKey?: string;
    sourceBoxUrl?: string | null;
    sourceBoxSha256?: string | null;
    metadata: unknown;
    structure: unknown;
    content: unknown;
    title?: string;
    boxFileId?: string;
    layoutPlugin?: string | null;
    coverRatio?: string | null;
    coverBucket?: string | null;
    coverKey?: string | null;
    boxId?: string;
  }): Promise<Box> {
    const { userId, roomId, visibility, fileSizeBytes, metadata, structure, content } = params;
    validateParsedBox(metadata, structure, content);

    const boxId = params.boxId ?? uuidv4();
    const parsedMetadata = metadata as BoxMetadata;
    const hasCover = Boolean(params.coverBucket && params.coverKey);
    const values = {
      userId,
      roomId: roomId ?? null,
      boxFileId: params.boxFileId ?? parsedMetadata.box_id ?? null,
      title: params.title ?? parsedMetadata.name ?? '未命名箱子',
      coverRatio: params.coverRatio ?? getCoverRatioFromMetadata(metadata),
      coverUrl: hasCover ? `/api/v1/boxes/${boxId}/cover` : null,
      coverBucket: params.coverBucket ?? null,
      coverKey: params.coverKey ?? null,
      documentUrl: `/api/v1/boxes/${boxId}/view`,
      layoutPlugin: params.layoutPlugin ?? parsedMetadata.active_layout_type ?? null,
      metadata: metadata as Record<string, unknown>,
      structure: structure as Record<string, unknown>,
      content: content as Record<string, unknown>,
      visibility,
      fileSizeBytes,
      sourceBoxBucket: params.sourceBoxBucket ?? null,
      sourceBoxKey: params.sourceBoxKey ?? null,
      sourceBoxUrl: params.sourceBoxUrl ?? null,
      sourceBoxSha256: params.sourceBoxSha256 ?? null,
      sourceBoxStoredAt: params.sourceBoxBucket ? new Date() : null,
    } as NewBox;

    if (params.boxId) {
      const [box] = await db
        .update(boxes)
        .set({ ...values, updatedAt: new Date() })
        .where(and(eq(boxes.id, boxId), eq(boxes.userId, userId)))
        .returning();
      if (!box) {
        throw AppError.notFound(ErrorCode.BOX_NOT_FOUND, 'Box not found');
      }
      return box;
    }

    const [box] = await db.insert(boxes).values({ id: boxId, ...values } as NewBox).returning();
    return box;
  },

  /**
   * 上传会话创建时的占位记录（源对象与元数据尚未提交）。
   */
  async createPlaceholder(params: {
    userId: string;
    title: string;
    roomId?: string;
    visibility: 'public' | 'private';
    publishedByClient?: string;
  }): Promise<Box> {
    const [box] = await db
      .insert(boxes)
      .values({
        userId: params.userId,
        roomId: params.roomId ?? null,
        title: params.title,
        visibility: params.visibility,
        fileSizeBytes: 0,
      } as NewBox)
      .returning();
    return box;
  },

  async findById(boxId: string): Promise<Box | undefined> {
    return db.query.boxes.findFirst({ where: eq(boxes.id, boxId) });
  },

  async getAccessible(boxId: string, requesterId: string | null): Promise<Box> {
    const box = await this.findById(boxId);
    if (!box) {
      throw AppError.notFound(ErrorCode.BOX_NOT_FOUND, 'Box not found');
    }
    if (box.visibility === 'private' && box.userId !== requesterId) {
      throw AppError.notFound(ErrorCode.BOX_NOT_FOUND, 'Box not found');
    }
    return box;
  },

  async update(boxId: string, userId: string, patch: UpdateBoxInput): Promise<Box> {
    const box = await this.findById(boxId);
    if (!box || box.userId !== userId) {
      throw AppError.notFound(ErrorCode.BOX_NOT_FOUND, 'Box not found');
    }

    if (patch.roomId) {
      const { RoomService } = await import('./room.service.js');
      await RoomService.assertOwnedByUser(patch.roomId, userId);
    }

    const [updated] = await db
      .update(boxes)
      .set({
        ...(patch.roomId !== undefined ? { roomId: patch.roomId } : {}),
        ...(patch.visibility !== undefined ? { visibility: patch.visibility } : {}),
        updatedAt: new Date(),
      })
      .where(eq(boxes.id, boxId))
      .returning();
    return updated;
  },

  async delete(boxId: string, userId: string): Promise<void> {
    const box = await this.findById(boxId);
    if (!box || box.userId !== userId) {
      throw AppError.notFound(ErrorCode.BOX_NOT_FOUND, 'Box not found');
    }
    if (box.sourceBoxBucket && box.sourceBoxKey) {
      await deleteObject(box.sourceBoxBucket, box.sourceBoxKey);
    }
    await db.delete(boxes).where(eq(boxes.id, boxId));
  },

  /**
   * 将 structure.entries 中的引用与社区内公开就绪卡片进行匹配
   */
  async enrichCardRefs(structure: BoxStructure): Promise<EnrichedBoxEntryRef[]> {
    const entries = structure?.entries ?? [];
    const documentIds = [
      ...new Set(
        entries
          .map((entry) => entry.snapshot?.document_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const communityCards = documentIds.length
      ? await db.query.cards.findMany({
          where: and(
            inArray(cards.cardFileId, documentIds),
            eq(cards.status, 'ready'),
            eq(cards.visibility, 'public'),
          ),
        })
      : [];
    const cardsByFileId = new Map(
      communityCards
        .filter((card) => card.cardFileId)
        .map((card) => [card.cardFileId as string, card]),
    );

    return entries.map((entry) => {
      const documentId = entry.snapshot?.document_id;
      const communityCard = documentId ? cardsByFileId.get(documentId) : undefined;
      return {
        entry_id: entry.entry_id,
        url: entry.url,
        document_id: documentId,
        title: entry.snapshot?.title,
        content_type: entry.snapshot?.content_type,
        embedded: !SCHEME_URL_PATTERN.test(entry.url),
        communityCardId: communityCard?.id,
        communityViewUrl: communityCard ? `/api/v1/cards/${communityCard.id}/view` : undefined,
        communityRenderStatusUrl: communityCard
          ? `/api/v1/cards/${communityCard.id}/render-status`
          : undefined,
      };
    });
  },

  async listByUser(
    userId: string,
    requesterId: string | null,
    pagination: PaginationInput,
    filters?: { visibility?: string },
  ): Promise<PagedResult<Box>> {
    const isOwner = userId === requesterId;
    return paginateBoxes(
      and(
        eq(boxes.userId, userId),
        filters?.visibility ? eq(boxes.visibility, filters.visibility as Box['visibility']) : isOwner ? undefined : eq(boxes.visibility, 'public'),
      ),
      pagination,
    );
  },

  async listByRoom(
    roomId: string,
    requesterId: string | null,
    ownerUserId: string,
    pagination: PaginationInput,
  ): Promise<PagedResult<BoxSummaryRecord>> {
    const isOwner = requesterId === ownerUserId;
    return paginateBoxSummaries(
      and(
        eq(boxes.roomId, roomId),
        isOwner ? undefined : eq(boxes.visibility, 'public'),
      ),
      pagination,
    );
  },

  async listRootByUser(
    userId: string,
    requesterId: string | null,
    pagination: PaginationInput,
  ): Promise<PagedResult<BoxSummaryRecord>> {
    const isOwner = userId === requesterId;
    return paginateBoxSummaries(
      and(
        eq(boxes.userId, userId),
        isNull(boxes.roomId),
        isOwner ? undefined : eq(boxes.visibility, 'public'),
      ),
      pagination,
    );
  },

  toDTO(box: Box) {
    return {
      id: box.id,
      boxFileId: box.boxFileId,
      userId: box.userId,
      roomId: box.roomId,
      title: box.title,
      coverUrl: box.coverUrl,
      documentUrl: box.documentUrl,
      coverRatio: box.coverRatio ?? getCoverRatioFromMetadata(box.metadata),
      layoutPlugin: box.layoutPlugin,
      visibility: box.visibility,
      fileSizeBytes: box.fileSizeBytes,
      metadata: box.metadata,
      createdAt: box.createdAt,
      updatedAt: box.updatedAt,
    };
  },

  toSummaryDTO(box: BoxSummaryRecord) {
    return {
      id: box.id,
      title: box.title,
      coverUrl: box.coverUrl,
      documentUrl: box.documentUrl,
      coverRatio: box.coverRatio,
      layoutPlugin: box.layoutPlugin,
      visibility: box.visibility,
      createdAt: box.createdAt,
    };
  },
};

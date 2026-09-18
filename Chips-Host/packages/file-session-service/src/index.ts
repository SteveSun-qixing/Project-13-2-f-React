import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import type { PALStorage, FileWatchEvent } from '../../pal/src';
import { createError } from '../../../src/shared/errors';
import { guessMimeType } from '../../../src/shared/mime';

/**
 * 万能文件会话服务（《15-万能文件处理协议》§3.1 / §5.3 的 Host 正式实现）。
 *
 * 会话是任意文件的字节级读写抽象：open/create → read/write → persist → close。
 * 服务不解析任何文件格式；格式语义由调用方插件承担。所有动作返回的信封
 * （{document} / {document, bytes, ...}）与 Chips-SDK FileApi 的解包约定一致。
 */

export type FileSessionStatus = 'clean' | 'dirty' | 'watching' | 'closed';

export interface FileSessionServiceOptions {
  workspacePath: string;
  storage: Pick<PALStorage, 'readFile' | 'writeFile' | 'stat' | 'mkdir' | 'watch'>;
}

export interface FileSessionDescriptor {
  sessionId: string;
  documentId: string;
  filePath: string;
  fileName: string;
  format: string;
  mimeType: string;
  size: number;
  revision: number;
  status: FileSessionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface FileSessionCreateInput {
  format?: string;
  fileName?: string;
  initialBytes?: unknown;
  options?: {
    mimeType?: string;
    encoding?: 'utf-8' | 'binary';
    watch?: boolean;
  };
}

export interface FileSessionOpenInput {
  filePath: string;
  format?: string;
  options?: {
    readOnly?: boolean;
    watch?: boolean;
  };
}

export interface FileSessionReadInput {
  sessionId: string;
  options?: {
    offset?: number;
    length?: number;
    encoding?: 'utf-8' | 'binary';
  };
}

export interface FileSessionWriteInput {
  sessionId: string;
  bytes: unknown;
  options?: {
    offset?: number;
  };
}

export interface FileSessionPersistInput {
  sessionId: string;
  options?: {
    filePath?: string;
    backup?: boolean;
  };
}

export interface FileSessionCloseInput {
  sessionId: string;
  options?: {
    persist?: boolean;
  };
}

export interface FileSessionWatchInput {
  sessionId: string;
  timeoutMs?: number;
}

interface FileSessionRecord {
  descriptor: FileSessionDescriptor;
  bytes: Uint8Array;
  readOnly: boolean;
  watched: boolean;
}

const BLANK_ZIP_FORMATS = new Set(['docx', 'pptx', 'xlsx']);
const DEFAULT_TIMEOUT_MS = 5_000;
const MAX_TIMEOUT_MS = 30_000;

const nowIso = (): string => new Date().toISOString();

const asBytes = (value: unknown, action: string): Uint8Array => {
  if (typeof value === 'string') {
    return new TextEncoder().encode(value);
  }
  if (value instanceof Uint8Array) {
    return Uint8Array.from(value);
  }
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value.slice(0));
  }
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
  }
  if (Buffer.isBuffer(value)) {
    return Uint8Array.from(value);
  }
  if (Array.isArray(value) && value.every((item) => Number.isInteger(item) && item >= 0 && item <= 255)) {
    return Uint8Array.from(value);
  }
  if (value && typeof value === 'object' && 'type' in value && 'data' in value) {
    const record = value as { type?: unknown; data?: unknown };
    if (record.type === 'Buffer') {
      return asBytes(record.data, action);
    }
  }
  throw createError('FILE_CONTENT_INVALID', `${action}: bytes must be binary data.`);
};

const normalizeName = (name: string | undefined, format: string): string => {
  const extension = canonicalExtension(format);
  const fallback = `未命名文档${extension}`;
  const input = typeof name === 'string' && name.trim() ? name.trim() : fallback;
  const basename = path.basename(input).replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').trim();
  if (!basename) {
    return fallback;
  }
  return basename.toLowerCase().endsWith(extension) ? basename : `${basename}${extension}`;
};

const canonicalExtension = (format: string): string => {
  if (format.startsWith('.')) {
    return format.toLowerCase();
  }
  const byFormat: Record<string, string> = {
    docx: '.docx', pptx: '.pptx', xlsx: '.xlsx', pdf: '.pdf',
    txt: '.txt', md: '.md', csv: '.csv', rtf: '.rtf', html: '.html', json: '.json',
  };
  return byFormat[format] ?? '.bin';
};

const formatFromPath = (filePath: string): string => {
  const extension = path.extname(filePath).toLowerCase().replace(/^\./, '');
  const knownByExtension: Record<string, string> = {
    docx: 'docx', docm: 'docx', dotx: 'docx',
    pptx: 'pptx', pptm: 'pptx', potx: 'pptx',
    xlsx: 'xlsx', xlsm: 'xlsx', xltx: 'xlsx',
    pdf: 'pdf', txt: 'txt', md: 'md', csv: 'csv', rtf: 'rtf', html: 'html', json: 'json',
  };
  return knownByExtension[extension] ?? 'binary';
};

const normalizeLocalPath = (value: string, action: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('file://')) {
    try {
      return fileURLToPath(trimmed);
    } catch {
      throw createError('INVALID_ARGUMENT', `${action}: invalid file URL.`);
    }
  }
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
    throw createError('INVALID_ARGUMENT', `${action}: only local file paths are supported.`);
  }
  return trimmed;
};

const normalizeOffset = (value: number | undefined, max: number, action: string): number => {
  if (value === undefined) return 0;
  if (!Number.isSafeInteger(value) || value < 0 || value > max) {
    throw createError('INVALID_ARGUMENT', `${action}: offset must be a non-negative safe integer within range.`);
  }
  return value;
};

const normalizeLength = (value: number | undefined, action: string): number => {
  if (value === undefined) return Number.MAX_SAFE_INTEGER;
  if (!Number.isSafeInteger(value) || value < 0) {
    throw createError('INVALID_ARGUMENT', `${action}: length must be a non-negative safe integer.`);
  }
  return value;
};

export class FileSessionService {
  private readonly sessions = new Map<string, FileSessionRecord>();
  private readonly closedSessionIds = new Set<string>();

  public constructor(private readonly options: FileSessionServiceOptions) {}

  public async create(input: FileSessionCreateInput): Promise<{ document: FileSessionDescriptor }> {
    const action = 'file.session.create';
    const format = typeof input?.format === 'string' && input.format.trim() ? input.format.trim().toLowerCase() : 'binary';
    const fileName = normalizeName(input.fileName, format);
    const directory = path.join(this.options.workspacePath, 'documents');
    await this.options.storage.mkdir(directory, { recursive: true });
    const filePath = await this.uniqueWorkspacePath(directory, fileName);
    const bytes = input.initialBytes === undefined || input.initialBytes === null
      ? createBlankFileBytes(format)
      : asBytes(input.initialBytes, action);
    if (bytes.length === 0 && BLANK_ZIP_FORMATS.has(format)) {
      throw createError('FILE_CONTENT_INVALID', `${action}: office formats require non-empty initial bytes.`);
    }
    const timestamp = nowIso();
    await this.options.storage.writeFile(filePath, Buffer.from(bytes));
    const descriptor = this.buildDescriptor({
      sessionId: crypto.randomUUID(),
      documentId: crypto.randomUUID(),
      filePath,
      fileName: path.basename(filePath),
      format,
      mimeType: input.options?.mimeType ?? guessMimeType(filePath),
      bytes,
      revision: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
      watched: input.options?.watch === true,
    });
    this.sessions.set(descriptor.sessionId, { descriptor, bytes, readOnly: false, watched: input.options?.watch === true });
    return { document: { ...descriptor } };
  }

  public async open(input: FileSessionOpenInput): Promise<{ document: FileSessionDescriptor }> {
    const action = 'file.session.open';
    const filePath = normalizeLocalPath(String(input?.filePath ?? ''), action);
    if (!filePath) {
      throw createError('INVALID_ARGUMENT', `${action}: filePath is required.`);
    }
    const read = await this.options.storage.readFile(filePath);
    const bytes = asBytes(read, action);
    const format = input.format === undefined || input.format === null
      ? formatFromPath(filePath)
      : String(input.format);
    const timestamp = nowIso();
    const watched = input.options?.watch === true;
    const descriptor = this.buildDescriptor({
      sessionId: crypto.randomUUID(),
      documentId: crypto.createHash('sha256').update(filePath).digest('hex').slice(0, 32),
      filePath,
      fileName: path.basename(filePath),
      format,
      mimeType: guessMimeType(filePath),
      bytes,
      revision: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
      watched,
    });
    this.sessions.set(descriptor.sessionId, {
      descriptor,
      bytes,
      readOnly: input.options?.readOnly === true,
      watched,
    });
    return { document: { ...descriptor } };
  }

  public read(input: FileSessionReadInput): {
    document: FileSessionDescriptor;
    bytes: Uint8Array;
    offset: number;
    length: number;
    totalSize: number;
    revision: number;
  } {
    const action = 'file.session.read';
    const session = this.requireSession(input?.sessionId, action);
    const offset = normalizeOffset(input.options?.offset, session.bytes.length, action);
    const length = normalizeLength(input.options?.length, action);
    const end = Math.min(session.bytes.length, offset + length);
    const bytes = session.bytes.slice(offset, end);
    return {
      document: { ...session.descriptor },
      bytes,
      offset,
      length: bytes.byteLength,
      totalSize: session.bytes.length,
      revision: session.descriptor.revision,
    };
  }

  public write(input: FileSessionWriteInput): { document: FileSessionDescriptor } {
    const action = 'file.session.write';
    const session = this.requireSession(input?.sessionId, action);
    if (session.readOnly) {
      throw createError('INVALID_ARGUMENT', `${action}: session was opened read-only.`);
    }
    const bytes = asBytes(input.bytes, action);
    // 默认完整替换；只有显式 offset 才区间写入，避免新内容较短时残留旧尾部。
    const offset = input.options?.offset === undefined
      ? null
      : normalizeOffset(input.options.offset, Number.MAX_SAFE_INTEGER, action);
    const end = offset === null ? bytes.length : Math.max(session.bytes.length, offset + bytes.length);
    const next = new Uint8Array(end);
    if (offset !== null) next.set(session.bytes);
    next.set(bytes, offset ?? 0);
    session.bytes = next;
    session.descriptor = this.buildDescriptor({
      ...session.descriptor,
      bytes: next,
      revision: session.descriptor.revision + 1,
      updatedAt: nowIso(),
    }, 'dirty');
    return { document: { ...session.descriptor } };
  }

  public get(sessionId: string): { document: FileSessionDescriptor } {
    const session = this.requireSession(sessionId, 'file.session.get');
    return { document: { ...session.descriptor } };
  }

  public async persist(input: FileSessionPersistInput): Promise<{ document: FileSessionDescriptor }> {
    const action = 'file.session.persist';
    const session = this.requireSession(input?.sessionId, action);
    if (session.readOnly) {
      throw createError('INVALID_ARGUMENT', `${action}: session was opened read-only.`);
    }
    const targetPath = normalizeLocalPath(String(input.options?.filePath?.trim() || session.descriptor.filePath), action);
    if (!targetPath) {
      throw createError('INVALID_ARGUMENT', `${action}: filePath is required.`);
    }
    if (input.options?.backup === true && await this.pathExists(targetPath)) {
      const backupPath = `${targetPath}.bak`;
      await this.options.storage.writeFile(backupPath, Buffer.from(session.bytes));
    }
    await this.options.storage.writeFile(targetPath, Buffer.from(session.bytes));
    session.descriptor = this.buildDescriptor({
      ...session.descriptor,
      bytes: session.bytes,
      filePath: targetPath,
      fileName: path.basename(targetPath),
      updatedAt: nowIso(),
    }, 'clean');
    return { document: { ...session.descriptor } };
  }

  public async close(input: FileSessionCloseInput): Promise<{ ack: true }> {
    const action = 'file.session.close';
    const session = this.requireSession(input?.sessionId, action);
    if (input.options?.persist === true && session.descriptor.status === 'dirty' && !session.readOnly) {
      await this.persist({ sessionId: input.sessionId });
    }
    this.sessions.delete(input.sessionId);
    this.closedSessionIds.add(input.sessionId);
    return { ack: true };
  }

  public async watch(input: FileSessionWatchInput): Promise<{ event: FileWatchEvent | null }> {
    const action = 'file.session.watch';
    const session = this.requireSession(input?.sessionId, action);
    const timeoutMs = Math.min(
      typeof input.timeoutMs === 'number' && input.timeoutMs > 0 ? input.timeoutMs : DEFAULT_TIMEOUT_MS,
      MAX_TIMEOUT_MS,
    );
    const event = await new Promise<FileWatchEvent | null>(async (resolve, reject) => {
      let settled = false;
      let subscription: Awaited<ReturnType<PALStorage['watch']>> | undefined;
      const closeWatch = async (): Promise<void> => {
        if (settled && !subscription) {
          return;
        }
        await subscription?.close();
        subscription = undefined;
      };
      const timer = setTimeout(() => {
        void closeWatch();
        settled = true;
        resolve(null);
      }, timeoutMs);
      try {
        subscription = await this.options.storage.watch(session.descriptor.filePath, (watchEvent) => {
          if (settled) {
            return;
          }
          settled = true;
          clearTimeout(timer);
          void closeWatch();
          resolve(watchEvent);
        });
      } catch (error) {
        clearTimeout(timer);
        settled = true;
        reject(error);
        return;
      }
      if (settled) {
        await closeWatch();
      }
    });
    return { event };
  }

  private requireSession(sessionId: string, action: string): FileSessionRecord {
    if (typeof sessionId !== 'string' || !sessionId) {
      throw createError('INVALID_ARGUMENT', `${action}: sessionId is required.`);
    }
    if (this.closedSessionIds.has(sessionId)) {
      throw createError('FILE_SESSION_CLOSED', `${action}: session already closed: ${sessionId}`);
    }
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw createError('FILE_SESSION_NOT_FOUND', `${action}: session not found: ${sessionId}`);
    }
    return session;
  }

  private async pathExists(filePath: string): Promise<boolean> {
    try {
      await this.options.storage.stat(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async uniqueWorkspacePath(directory: string, fileName: string): Promise<string> {
    const extension = path.extname(fileName);
    const stem = path.basename(fileName, extension);
    let candidate = path.join(directory, fileName);
    for (let index = 2; index < 10000; index += 1) {
      if (await this.pathExists(candidate)) {
        candidate = path.join(directory, `${stem}-${index}${extension}`);
        continue;
      }
      return candidate;
    }
    throw createError('FILE_WRITE_FAILED', 'Unable to allocate a unique file session path.');
  }

  private buildDescriptor(
    input: {
      sessionId: string;
      documentId: string;
      filePath: string;
      fileName: string;
      format: string;
      mimeType: string;
      bytes: Uint8Array;
      revision: number;
      createdAt: string;
      updatedAt: string;
      watched?: boolean;
    },
    forcedStatus?: FileSessionStatus,
  ): FileSessionDescriptor {
    const status: FileSessionStatus = forcedStatus
      ?? (input.watched ? 'watching' : 'clean');
    return {
      sessionId: input.sessionId,
      documentId: input.documentId,
      filePath: input.filePath,
      fileName: input.fileName,
      format: input.format,
      mimeType: input.mimeType,
      size: input.bytes.byteLength,
      revision: input.revision,
      status,
      createdAt: input.createdAt,
      updatedAt: input.updatedAt,
    };
  }
}

const createBlankFileBytes = (format: string): Uint8Array => {
  if (format === 'pdf') {
    return createBlankPdfBytes();
  }
  if (BLANK_ZIP_FORMATS.has(format)) {
    return buildZipStore(createBlankOoxmlEntries(format));
  }
  return new Uint8Array();
};

const createBlankOoxmlEntries = (format: string): Record<string, string> => {
  const common = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/></Types>';
  const entries: Record<string, string> = {
    '[Content_Types].xml': common,
    '_rels/.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>',
  };
  if (format === 'docx') {
    entries['[Content_Types].xml'] = common.replace('</Types>', '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
    entries['_rels/.rels'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>';
    entries['word/document.xml'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p/></w:body></w:document>';
    entries['word/_rels/document.xml.rels'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
  } else if (format === 'pptx') {
    entries['[Content_Types].xml'] = common.replace('</Types>', '<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/></Types>');
    entries['_rels/.rels'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/></Relationships>';
    entries['ppt/presentation.xml'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldMasterIdLst/></p:presentation>';
    entries['ppt/_rels/presentation.xml.rels'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
  } else {
    entries['[Content_Types].xml'] = common.replace('</Types>', '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/></Types>');
    entries['_rels/.rels'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';
    entries['xl/workbook.xml'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheets/></workbook>';
    entries['xl/_rels/workbook.xml.rels'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
  }
  return entries;
};

const createBlankPdfBytes = (): Uint8Array => {
  const encoder = new TextEncoder();
  const header = '%PDF-1.4\n';
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [] /Count 0 >>\nendobj\n',
  ];
  let content = header;
  const offsets = [0];
  for (const object of objects) {
    offsets.push(encoder.encode(content).byteLength);
    content += object;
  }
  const xrefOffset = encoder.encode(content).byteLength;
  content += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index <= objects.length; index += 1) {
    content += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  }
  content += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return encoder.encode(content);
};

const buildZipStore = (entries: Record<string, string>): Uint8Array => {
  const encoder = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const [name, text] of Object.entries(entries)) {
    const nameBytes = encoder.encode(name);
    const data = encoder.encode(text);
    const crc = crc32(data);
    const local = new Uint8Array(30 + nameBytes.length + data.length);
    const view = new DataView(local.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 0x800, true);
    view.setUint32(14, crc, true);
    view.setUint32(18, data.length, true);
    view.setUint32(22, data.length, true);
    view.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    local.set(data, 30 + nameBytes.length);
    locals.push(local);

    const central = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x800, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, data.length, true);
    centralView.setUint32(24, data.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    centrals.push(central);
    offset += local.length;
  }
  const centralOffset = offset;
  const centralSize = centrals.reduce((total, value) => total + value.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, centrals.length, true);
  endView.setUint16(10, centrals.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, centralOffset, true);
  const output = new Uint8Array(centralOffset + centralSize + end.length);
  let cursor = 0;
  for (const local of locals) { output.set(local, cursor); cursor += local.length; }
  for (const central of centrals) { output.set(central, cursor); cursor += central.length; }
  output.set(end, cursor);
  return output;
};

const crc32 = (data: Uint8Array): number => {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
};

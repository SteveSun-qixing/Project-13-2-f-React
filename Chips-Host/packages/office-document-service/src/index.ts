import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import type { PALStorage } from '../../pal/src';
import { createError } from '../../../src/shared/errors';

export type OfficeDocumentFormat = 'docx' | 'pptx' | 'xlsx' | 'pdf' | 'binary';
export type OfficeDocumentSessionStatus = 'clean' | 'dirty' | 'closed';

export interface OfficeDocumentServiceOptions {
  workspacePath: string;
  storage: Pick<PALStorage, 'readFile' | 'writeFile' | 'stat' | 'mkdir'>;
}

export interface OfficeDocumentDescriptor {
  sessionId: string;
  documentId: string;
  filePath: string;
  fileName: string;
  format: OfficeDocumentFormat;
  mimeType: string;
  size: number;
  revision: number;
  status: OfficeDocumentSessionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface OfficeDocumentOpenInput {
  filePath: string;
  format?: OfficeDocumentFormat;
}

export interface OfficeDocumentCreateInput {
  format: OfficeDocumentFormat;
  fileName?: string;
  initialBytes?: unknown;
}

export interface OfficeDocumentReadInput {
  sessionId: string;
  offset?: number;
  length?: number;
}

export interface OfficeDocumentWriteInput {
  sessionId: string;
  bytes: unknown;
  offset?: number;
}

export interface OfficeDocumentPersistInput {
  sessionId: string;
  filePath?: string;
}

export interface OfficeDocumentCloseInput {
  sessionId: string;
  persist?: boolean;
}

interface OfficeDocumentSession {
  descriptor: OfficeDocumentDescriptor;
  bytes: Uint8Array;
}

const MIME_BY_FORMAT: Record<OfficeDocumentFormat, string> = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pdf: 'application/pdf',
  binary: 'application/octet-stream',
};

const normalizeFormat = (value: unknown, action: string): OfficeDocumentFormat => {
  if (value === 'docx' || value === 'pptx' || value === 'xlsx' || value === 'pdf' || value === 'binary') {
    return value;
  }
  throw createError('INVALID_ARGUMENT', `${action}: format must be docx, pptx, xlsx, pdf, or binary.`);
};

const EXT_BY_FORMAT: Record<OfficeDocumentFormat, string> = {
  docx: '.docx',
  pptx: '.pptx',
  xlsx: '.xlsx',
  pdf: '.pdf',
  binary: '.bin',
};

const FORMAT_BY_EXTENSION: Record<string, OfficeDocumentFormat> = {
  '.docx': 'docx',
  '.docm': 'docx',
  '.dotx': 'docx',
  '.pptx': 'pptx',
  '.pptm': 'pptx',
  '.potx': 'pptx',
  '.xlsx': 'xlsx',
  '.xlsm': 'xlsx',
  '.xltx': 'xlsx',
  '.pdf': 'pdf',
};

const nowIso = (): string => new Date().toISOString();

const asBytes = (value: unknown): Uint8Array => {
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
      return asBytes(record.data);
    }
  }
  throw createError('FILE_CONTENT_INVALID', 'Office document bytes must be binary data.');
};

const normalizeName = (name: string | undefined, format: OfficeDocumentFormat): string => {
  const fallback = `未命名文档${EXT_BY_FORMAT[format]}`;
  const input = typeof name === 'string' && name.trim() ? name.trim() : fallback;
  const basename = path.basename(input).replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').trim();
  if (!basename) {
    return fallback;
  }
  const ext = EXT_BY_FORMAT[format];
  return basename.toLowerCase().endsWith(ext) ? basename : `${basename}${ext}`;
};

const formatFromPath = (filePath: string): OfficeDocumentFormat => {
  const extension = path.extname(filePath).toLowerCase();
  return FORMAT_BY_EXTENSION[extension] ?? 'binary';
};

const normalizeLocalPath = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('file://')) {
    try {
      return fileURLToPath(trimmed);
    } catch {
      throw createError('INVALID_ARGUMENT', 'office.document.open: invalid file URL.');
    }
  }
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
    throw createError('INVALID_ARGUMENT', 'office.document.open: only local file paths are supported.');
  }
  return trimmed;
};

const formatFromBytes = (bytes: Uint8Array): OfficeDocumentFormat | undefined => {
  if (bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d) {
    return 'pdf';
  }
  if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
    return undefined;
  }
  return undefined;
};

/** Host-only document byte/session service. It deliberately does not parse Office formats. */
export class OfficeDocumentService {
  private readonly sessions = new Map<string, OfficeDocumentSession>();

  public constructor(private readonly options: OfficeDocumentServiceOptions) {}

  public async create(input: OfficeDocumentCreateInput): Promise<{ document: OfficeDocumentDescriptor }> {
    const format = normalizeFormat(input?.format, 'office.document.create');
    const fileName = normalizeName(input.fileName, format);
    const directory = path.join(this.options.workspacePath, 'documents');
    await this.options.storage.mkdir(directory, { recursive: true });
    const documentId = crypto.randomUUID();
    const filePath = await this.uniqueWorkspacePath(directory, fileName);
    const bytes = input.initialBytes === undefined ? createBlankDocumentBytes(format) : asBytes(input.initialBytes);
    const timestamp = nowIso();
    await this.options.storage.writeFile(filePath, Buffer.from(bytes));
    const descriptor = this.buildDescriptor({
      sessionId: crypto.randomUUID(),
      documentId,
      filePath,
      fileName: path.basename(filePath),
      format,
      bytes,
      revision: 0,
      status: 'clean',
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    const session = { descriptor, bytes };
    this.sessions.set(descriptor.sessionId, session);
    return { document: { ...descriptor } };
  }

  public async open(input: OfficeDocumentOpenInput): Promise<{ document: OfficeDocumentDescriptor }> {
    const filePath = normalizeLocalPath(input.filePath);
    if (!filePath) {
      throw createError('INVALID_ARGUMENT', 'office.document.open: filePath is required.');
    }
    const read = await this.options.storage.readFile(filePath);
    const bytes = asBytes(read);
    const format = input.format === undefined ? formatFromPath(filePath) : normalizeFormat(input.format, 'office.document.open');
    const timestamp = nowIso();
    const descriptor = this.buildDescriptor({
      sessionId: crypto.randomUUID(),
      documentId: crypto.createHash('sha256').update(filePath).digest('hex').slice(0, 32),
      filePath,
      fileName: path.basename(filePath),
      format,
      bytes,
      revision: 0,
      status: 'clean',
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    this.sessions.set(descriptor.sessionId, { descriptor, bytes });
    return { document: { ...descriptor } };
  }

  public read(input: OfficeDocumentReadInput): { document: OfficeDocumentDescriptor; bytes: Uint8Array } {
    const session = this.requireSession(input.sessionId);
    const offset = normalizeOffset(input.offset, session.bytes.length);
    const end = input.length === undefined ? session.bytes.length : Math.min(session.bytes.length, offset + normalizeLength(input.length));
    return { document: { ...session.descriptor }, bytes: session.bytes.slice(offset, end) };
  }

  public write(input: OfficeDocumentWriteInput): { document: OfficeDocumentDescriptor } {
    const session = this.requireSession(input.sessionId);
    const bytes = asBytes(input.bytes);
    // 文档保存默认是完整替换；只有显式 offset 才执行区间写入，避免新包较短时残留旧尾部。
    const offset = input.offset === undefined ? null : normalizeOffset(input.offset, Number.MAX_SAFE_INTEGER);
    const end = offset === null ? bytes.length : Math.max(session.bytes.length, offset + bytes.length);
    const next = new Uint8Array(end);
    if (offset !== null) next.set(session.bytes);
    next.set(bytes, offset ?? 0);
    session.bytes = next;
    session.descriptor = this.buildDescriptor({ ...session.descriptor, bytes: next, revision: session.descriptor.revision + 1, status: 'dirty', updatedAt: nowIso() });
    return { document: { ...session.descriptor } };
  }

  public get(sessionId: string): { document: OfficeDocumentDescriptor } {
    const session = this.requireSession(sessionId);
    return { document: { ...session.descriptor } };
  }

  public async persist(input: OfficeDocumentPersistInput): Promise<{ document: OfficeDocumentDescriptor }> {
    const session = this.requireSession(input.sessionId);
    const targetPath = normalizeLocalPath(input.filePath?.trim() || session.descriptor.filePath);
    if (!targetPath) {
      throw createError('INVALID_ARGUMENT', 'office.document.persist: filePath is required.');
    }
    await this.options.storage.writeFile(targetPath, Buffer.from(session.bytes));
    session.descriptor = this.buildDescriptor({ ...session.descriptor, bytes: session.bytes, filePath: targetPath, fileName: path.basename(targetPath), status: 'clean', updatedAt: nowIso() });
    return { document: { ...session.descriptor } };
  }

  public async close(input: OfficeDocumentCloseInput): Promise<{ ack: true }> {
    const session = this.requireSession(input.sessionId);
    if (input.persist && session.descriptor.status === 'dirty') {
      await this.persist({ sessionId: input.sessionId });
    }
    session.descriptor = { ...session.descriptor, status: 'closed', updatedAt: nowIso() };
    this.sessions.delete(input.sessionId);
    return { ack: true };
  }

  private requireSession(sessionId: string): OfficeDocumentSession {
    const session = this.sessions.get(sessionId);
    if (!session || session.descriptor.status === 'closed') {
      throw createError('SESSION_NOT_FOUND', `Office document session not found: ${sessionId}`);
    }
    return session;
  }

  private async uniqueWorkspacePath(directory: string, fileName: string): Promise<string> {
    const extension = path.extname(fileName);
    const stem = path.basename(fileName, extension);
    let candidate = path.join(directory, fileName);
    for (let index = 2; index < 10000; index += 1) {
      try {
        await this.options.storage.stat(candidate);
        candidate = path.join(directory, `${stem}-${index}${extension}`);
      } catch {
        return candidate;
      }
    }
    throw createError('FILE_WRITE_FAILED', 'Unable to allocate a unique office document path.');
  }

  private buildDescriptor(input: {
    sessionId: string;
    documentId: string;
    filePath: string;
    fileName: string;
    format: OfficeDocumentFormat;
    bytes: Uint8Array;
    revision: number;
    status: OfficeDocumentSessionStatus;
    createdAt: string;
    updatedAt: string;
  }): OfficeDocumentDescriptor {
    return {
      sessionId: input.sessionId,
      documentId: input.documentId,
      filePath: input.filePath,
      fileName: input.fileName,
      format: input.format,
      mimeType: MIME_BY_FORMAT[input.format],
      size: input.bytes.byteLength,
      revision: input.revision,
      status: input.status,
      createdAt: input.createdAt,
      updatedAt: input.updatedAt,
    };
  }
}

const normalizeOffset = (value: number | undefined, max: number): number => {
  if (value === undefined) return 0;
  if (!Number.isSafeInteger(value) || value < 0 || value > max) {
    throw createError('INVALID_ARGUMENT', 'office.document: offset must be a non-negative safe integer.');
  }
  return value;
};

const normalizeLength = (value: number): number => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw createError('INVALID_ARGUMENT', 'office.document.read: length must be a non-negative safe integer.');
  }
  return value;
};

const createBlankDocumentBytes = (format: OfficeDocumentFormat): Uint8Array => {
  if (format === 'pdf') {
    return createBlankPdfBytes();
  }
  if (format === 'binary') {
    return new Uint8Array();
  }
  const common = {
    '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/></Types>',
  };
  const entries: Record<string, string> = { ...common };
  if (format === 'docx') {
    entries['[Content_Types].xml'] = common['[Content_Types].xml'].replace('</Types>', '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
    entries['_rels/.rels'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>';
    entries['word/document.xml'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p/></w:body></w:document>';
    entries['word/_rels/document.xml.rels'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
  } else if (format === 'pptx') {
    entries['[Content_Types].xml'] = common['[Content_Types].xml'].replace('</Types>', '<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/></Types>');
    entries['_rels/.rels'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/></Relationships>';
    entries['ppt/presentation.xml'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldMasterIdLst/></p:presentation>';
    entries['ppt/_rels/presentation.xml.rels'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
  } else {
    entries['[Content_Types].xml'] = common['[Content_Types].xml'].replace('</Types>', '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/></Types>');
    entries['_rels/.rels'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';
    entries['xl/workbook.xml'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheets/></workbook>';
    entries['xl/_rels/workbook.xml.rels'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
  }
  return buildZipStore(entries);
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

export { formatFromBytes };

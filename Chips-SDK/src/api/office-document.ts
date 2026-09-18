import type { CoreClient } from '../types/client';
import { createError } from '../types/errors';

export type OfficeDocumentFormat = 'docx' | 'pptx' | 'xlsx' | 'pdf' | 'binary';
export type OfficeDocumentSessionStatus = 'clean' | 'dirty' | 'closed';

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

export interface OfficeDocumentApi {
  create(input: { format: OfficeDocumentFormat; fileName?: string; initialBytes?: Uint8Array }): Promise<OfficeDocumentDescriptor>;
  open(input: { filePath: string; format?: OfficeDocumentFormat }): Promise<OfficeDocumentDescriptor>;
  read(sessionId: string, options?: { offset?: number; length?: number }): Promise<{ document: OfficeDocumentDescriptor; bytes: Uint8Array }>;
  write(sessionId: string, bytes: Uint8Array, options?: { offset?: number }): Promise<OfficeDocumentDescriptor>;
  get(sessionId: string): Promise<OfficeDocumentDescriptor>;
  persist(sessionId: string, filePath?: string): Promise<OfficeDocumentDescriptor>;
  close(sessionId: string, options?: { persist?: boolean }): Promise<void>;
}

const normalizeBytes = (value: unknown): Uint8Array => {
  if (value instanceof Uint8Array) return Uint8Array.from(value);
  if (value instanceof ArrayBuffer) return new Uint8Array(value.slice(0));
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
  if (Buffer.isBuffer(value)) return Uint8Array.from(value);
  if (Array.isArray(value)) return Uint8Array.from(value as number[]);
  if (typeof value === 'string') {
    try {
      const binary = atob(value);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return bytes;
    } catch { /* not base64 */ }
  }
  if (value && typeof value === 'object' && 'type' in value && 'data' in value && (value as { type?: unknown }).type === 'Buffer') {
    return normalizeBytes((value as { data: unknown }).data);
  }
  throw createError('INVALID_RESPONSE', 'office.document.read: response is not binary content.');
};

export function createOfficeDocumentApi(client: CoreClient): OfficeDocumentApi {
  return {
    async create(input) {
      if (!input?.format) throw createError('INVALID_ARGUMENT', 'office.document.create: format is required.');
      const result = await client.invoke<{ format: OfficeDocumentFormat; fileName?: string; initialBytes?: Uint8Array }, { document: OfficeDocumentDescriptor }>('office.document.create', input);
      return result.document;
    },
    async open(input) {
      if (!input?.filePath) throw createError('INVALID_ARGUMENT', 'office.document.open: filePath is required.');
      const result = await client.invoke<typeof input, { document: OfficeDocumentDescriptor }>('office.document.open', input);
      return result.document;
    },
    async read(sessionId, options) {
      if (!sessionId) throw createError('INVALID_ARGUMENT', 'office.document.read: sessionId is required.');
      const result = await client.invoke<{ sessionId: string; offset?: number; length?: number }, { document: OfficeDocumentDescriptor; bytes: unknown }>('office.document.read', { sessionId, ...options });
      return { document: result.document, bytes: normalizeBytes(result.bytes) };
    },
    async write(sessionId, bytes, options) {
      if (!sessionId) throw createError('INVALID_ARGUMENT', 'office.document.write: sessionId is required.');
      if (!(bytes instanceof Uint8Array)) throw createError('INVALID_ARGUMENT', 'office.document.write: bytes must be Uint8Array.');
      const result = await client.invoke<{ sessionId: string; bytes: Uint8Array; offset?: number }, { document: OfficeDocumentDescriptor }>('office.document.write', { sessionId, bytes, ...options });
      return result.document;
    },
    async get(sessionId) {
      if (!sessionId) throw createError('INVALID_ARGUMENT', 'office.document.get: sessionId is required.');
      const result = await client.invoke<{ sessionId: string }, { document: OfficeDocumentDescriptor }>('office.document.get', { sessionId });
      return result.document;
    },
    async persist(sessionId, filePath) {
      if (!sessionId) throw createError('INVALID_ARGUMENT', 'office.document.persist: sessionId is required.');
      const result = await client.invoke<{ sessionId: string; filePath?: string }, { document: OfficeDocumentDescriptor }>('office.document.persist', { sessionId, ...(filePath ? { filePath } : {}) });
      return result.document;
    },
    async close(sessionId, options) {
      if (!sessionId) throw createError('INVALID_ARGUMENT', 'office.document.close: sessionId is required.');
      await client.invoke<{ sessionId: string; persist?: boolean }, { ack: true }>('office.document.close', { sessionId, ...options });
    },
  };
}

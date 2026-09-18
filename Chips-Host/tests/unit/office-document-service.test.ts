import { describe, expect, it } from 'vitest';
import { OfficeDocumentService } from '../../packages/office-document-service/src';

function createStorage() {
  const files = new Map<string, Buffer>();
  return {
    files,
    async mkdir() {},
    async stat(filePath: string) {
      const value = files.get(filePath);
      if (!value) throw new Error('missing');
      return { path: filePath, size: value.length, isFile: true, isDirectory: false, mtimeMs: Date.now() };
    },
    async readFile(filePath: string) {
      const value = files.get(filePath);
      if (!value) throw new Error('missing');
      return Buffer.from(value);
    },
    async writeFile(filePath: string, bytes: Buffer) {
      files.set(filePath, Buffer.from(bytes));
    },
  };
}

describe('OfficeDocumentService', () => {
  it('creates a valid blank docx in the workspace and round-trips bytes', async () => {
    const storage = createStorage();
    const service = new OfficeDocumentService({ workspacePath: '/workspace', storage });
    const created = await service.create({ format: 'docx', fileName: '报告' });
    expect(created.document.filePath).toMatch(/\/workspace\/documents\/报告\.docx$/);
    expect(created.document.status).toBe('clean');
    const bytes = storage.files.get(created.document.filePath);
    expect(bytes?.subarray(0, 4).toString('hex')).toBe('504b0304');

    const read = service.read({ sessionId: created.document.sessionId });
    expect(read.bytes.length).toBeGreaterThan(100);
    const changed = service.write({ sessionId: created.document.sessionId, bytes: Uint8Array.from([1, 2, 3]) });
    expect(changed.document.status).toBe('dirty');
    expect(service.read({ sessionId: created.document.sessionId }).bytes).toEqual(Uint8Array.from([1, 2, 3]));
    await service.persist({ sessionId: created.document.sessionId });
    expect(storage.files.get(created.document.filePath)?.subarray(0, 3)).toEqual(Buffer.from([1, 2, 3]));
    await service.close({ sessionId: created.document.sessionId });
    expect(() => service.get(created.document.sessionId)).toThrow('session not found');
  });

  it('opens arbitrary binary files without format-specific parsing', async () => {
    const storage = createStorage();
    storage.files.set('/workspace/input.dat', Buffer.from([0, 255, 4]));
    const service = new OfficeDocumentService({ workspacePath: '/workspace', storage });
    const opened = await service.open({ filePath: '/workspace/input.dat' });
    expect(opened.document.format).toBe('binary');
    expect(service.read({ sessionId: opened.document.sessionId }).bytes).toEqual(Uint8Array.from([0, 255, 4]));
  });

  it('creates each supported office format with a non-empty container', async () => {
    const storage = createStorage();
    const service = new OfficeDocumentService({ workspacePath: '/workspace', storage });
    for (const format of ['docx', 'pptx', 'xlsx', 'pdf'] as const) {
      const created = await service.create({ format });
      const bytes = storage.files.get(created.document.filePath);
      expect(bytes?.length).toBeGreaterThan(20);
      if (format === 'pdf') {
        expect(bytes?.subarray(0, 5).toString()).toBe('%PDF-');
      } else {
        expect(bytes?.subarray(0, 4).toString('hex')).toBe('504b0304');
      }
    }
  });
});

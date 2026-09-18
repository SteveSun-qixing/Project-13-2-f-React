import { describe, expect, it, vi } from 'vitest';
import { FileSessionService } from '../../packages/file-session-service/src';
import { decryptOfficeFile, isEncryptedContainer } from '../../packages/file-session-service/src/office-crypto';
import { OfficeDocumentService } from '../../packages/office-document-service/src';

function createStorage() {
  const files = new Map<string, Buffer>();
  const watchHandlers = new Map<string, (event: { type: 'rename' | 'change'; path: string; timestamp: number }) => void>();
  return {
    files,
    watchHandlers,
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
      const handler = watchHandlers.get(filePath);
      if (handler) {
        handler({ type: 'change', path: filePath, timestamp: Date.now() });
      }
    },
    async watch(filePath: string, onEvent: (event: { type: 'rename' | 'change'; path: string; timestamp: number }) => void) {
      watchHandlers.set(filePath, onEvent);
      return {
        id: `watch-${filePath}`,
        close: async () => {
          watchHandlers.delete(filePath);
        },
      };
    },
  };
}

describe('FileSessionService', () => {
  it('create：空白 OOXML/PDF 格式立即落盘且非空，重名自动加后缀', async () => {
    const storage = createStorage();
    const service = new FileSessionService({ workspacePath: '/workspace', storage });
    const first = await service.create({ format: 'docx', fileName: '报告' });
    const second = await service.create({ format: 'docx', fileName: '报告' });
    expect(first.document.filePath).toMatch(/\/workspace\/documents\/报告\.docx$/);
    expect(second.document.filePath).toMatch(/报告-2\.docx$/);
    for (const created of [first, second]) {
      const bytes = storage.files.get(created.document.filePath);
      expect(bytes?.subarray(0, 4).toString('hex')).toBe('504b0304');
      expect(created.document.status).toBe('clean');
    }
  });

  it('create：zip 格式拒绝零字节 initialBytes（FILE_CONTENT_INVALID）', async () => {
    const storage = createStorage();
    const service = new FileSessionService({ workspacePath: '/workspace', storage });
    await expect(
      service.create({ format: 'xlsx', fileName: '空.xlsx', initialBytes: new Uint8Array() }),
    ).rejects.toMatchObject({ code: 'FILE_CONTENT_INVALID' });
  });

  it('open → read（含分块）→ write → persist → close 全链路', async () => {
    const storage = createStorage();
    storage.files.set('/workspace/资料.txt', Buffer.from('你好，薯片办公'));
    expect(new TextDecoder().decode(storage.files.get('/workspace/资料.txt'))).toBe('你好，薯片办公');
    const service = new FileSessionService({ workspacePath: '/workspace', storage });
    const opened = await service.open({ filePath: '/workspace/资料.txt' });
    expect(opened.document.format).toBe('txt');
    expect(opened.document.mimeType).toBe('text/plain');

    const full = service.read({ sessionId: opened.document.sessionId });
    expect(full.totalSize).toBe(full.bytes.byteLength);
    expect(full.revision).toBe(0);
    const chunk = service.read({ sessionId: opened.document.sessionId, options: { offset: 0, length: 6 } });
    expect(chunk.length).toBe(6);
    expect(new TextDecoder().decode(chunk.bytes)).toBe('你好');
    expect(full.totalSize).toBe(21);

    const written = service.write({
      sessionId: opened.document.sessionId,
      bytes: new TextEncoder().encode('世界'),
      options: { offset: 6 },
    });
    expect(written.document.status).toBe('dirty');
    expect(written.document.revision).toBe(1);

    const persisted = await service.persist({ sessionId: opened.document.sessionId });
    expect(persisted.document.status).toBe('clean');
    expect(storage.files.get('/workspace/资料.txt')?.length).toBe(21);
    expect(new TextDecoder().decode(storage.files.get('/workspace/资料.txt'))).toBe('你好世界片办公');

    await service.close({ sessionId: opened.document.sessionId });
    await expect(async () => service.get(opened.document.sessionId))
      .rejects.toMatchObject({ code: 'FILE_SESSION_CLOSED' });
  });

  it('close 后的会话返回 FILE_SESSION_CLOSED 而非 NOT_FOUND', async () => {
    const storage = createStorage();
    storage.files.set('/workspace/a.txt', Buffer.from('a'));
    const service = new FileSessionService({ workspacePath: '/workspace', storage });
    const opened = await service.open({ filePath: '/workspace/a.txt' });
    await service.close({ sessionId: opened.document.sessionId });
    await expect(async () => service.read({ sessionId: opened.document.sessionId }))
      .rejects.toMatchObject({ code: 'FILE_SESSION_CLOSED' });
  });

  it('close({persist:true}) 自动保存脏会话', async () => {
    const storage = createStorage();
    storage.files.set('/workspace/b.txt', Buffer.from('old'));
    const service = new FileSessionService({ workspacePath: '/workspace', storage });
    const opened = await service.open({ filePath: '/workspace/b.txt' });
    service.write({ sessionId: opened.document.sessionId, bytes: new TextEncoder().encode('new-content') });
    await service.close({ sessionId: opened.document.sessionId, options: { persist: true } });
    expect(new TextDecoder().decode(storage.files.get('/workspace/b.txt'))).toBe('new-content');
  });

  it('persist 另存到新路径并更新描述符', async () => {
    const storage = createStorage();
    storage.files.set('/workspace/src.txt', Buffer.from('content'));
    const service = new FileSessionService({ workspacePath: '/workspace', storage });
    const opened = await service.open({ filePath: '/workspace/src.txt' });
    const persisted = await service.persist({ sessionId: opened.document.sessionId, options: { filePath: '/workspace/dest.txt' } });
    expect(persisted.document.filePath).toBe('/workspace/dest.txt');
    expect(storage.files.get('/workspace/dest.txt')).toBeDefined();
  });

  it('readOnly 会话拒绝写入', async () => {
    const storage = createStorage();
    storage.files.set('/workspace/c.txt', Buffer.from('c'));
    const service = new FileSessionService({ workspacePath: '/workspace', storage });
    const opened = await service.open({ filePath: '/workspace/c.txt', options: { readOnly: true } });
    expect(() => service.write({ sessionId: opened.document.sessionId, bytes: new TextEncoder().encode('x') }))
      .toThrow('read-only');
  });

  it('watch：开启监听的会话状态为 watching，文件变更回传事件', async () => {
    const storage = createStorage();
    storage.files.set('/workspace/d.txt', Buffer.from('d'));
    const service = new FileSessionService({ workspacePath: '/workspace', storage });
    const opened = await service.open({ filePath: '/workspace/d.txt', options: { watch: true } });
    expect(opened.document.status).toBe('watching');

    const pending = service.watch({ sessionId: opened.document.sessionId, timeoutMs: 2_000 });
    await service.write({ sessionId: opened.document.sessionId, bytes: new TextEncoder().encode('changed') });
    await service.persist({ sessionId: opened.document.sessionId });
    const result = await pending;
    expect(result.event?.type).toBe('change');
    expect(result.event?.path).toBe('/workspace/d.txt');
  });

  it('watch：超时返回 null 事件', async () => {
    const storage = createStorage();
    storage.files.set('/workspace/e.txt', Buffer.from('e'));
    const service = new FileSessionService({ workspacePath: '/workspace', storage });
    const opened = await service.open({ filePath: '/workspace/e.txt' });
    const result = await service.watch({ sessionId: opened.document.sessionId, timeoutMs: 50 });
    expect(result.event).toBeNull();
  });
});

describe('office.crypto.decrypt', () => {
  it('非加密容器直接拒绝', () => {
    expect(isEncryptedContainer(new Uint8Array([0x50, 0x4b, 0x03, 0x04]))).toBe(false);
    expect(isEncryptedContainer(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))).toBe(true);
  });

  it('对非加密文件返回 OFFICE_CRYPTO_FAILED', async () => {
    const storage = createStorage();
    storage.files.set('/workspace/plain.docx', Buffer.from([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]));
    await expect(
      decryptOfficeFile({ filePath: '/workspace/plain.docx', password: 'pw' }, storage),
    ).rejects.toMatchObject({ code: 'OFFICE_CRYPTO_FAILED' });
  });

  it('加密 docx 用正确密码解出明文、错误密码返回 OFFICE_CRYPTO_WRONG_PASSWORD', async () => {
    const officeCrypto = require('officecrypto-tool') as {
      encrypt: (buffer: Buffer, options: { password: string }) => Promise<Buffer>;
    };
    // fixture 用正式服务产出的空白 docx（合法 OOXML zip 容器），ECMA-376 agile 加密要求真实容器。
    const storage = createStorage();
    const docService = new OfficeDocumentService({ workspacePath: '/workspace', storage });
    const blank = await docService.create({ format: 'docx', fileName: 'blank.docx' });
    const plaintext = Buffer.from(storage.files.get(blank.document.filePath));
    const encrypted = await officeCrypto.encrypt(plaintext, { password: 'secret-123' });
    storage.files.set('/workspace/secret.docx', encrypted);

    const decrypted = await decryptOfficeFile({ filePath: '/workspace/secret.docx', password: 'secret-123' }, storage);
    expect(new TextDecoder().decode(decrypted.bytes)).toBe(new TextDecoder().decode(plaintext));

    await expect(
      decryptOfficeFile({ filePath: '/workspace/secret.docx', password: 'wrong' }, storage),
    ).rejects.toMatchObject({ code: 'OFFICE_CRYPTO_WRONG_PASSWORD' });
  });
});

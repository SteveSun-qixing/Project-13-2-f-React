import { describe, expect, it } from 'vitest';
import { XlsxEngineService } from '../../packages/xlsx-engine-service/src';
import { buildMinimalXlsx } from './helpers/zip-fixture';

const fs = require('node:fs') as typeof import('node:fs');
const os = require('node:os') as typeof import('node:os');
const path = require('node:path') as typeof import('node:path');
const { execSync } = require('node:child_process') as typeof import('node:child_process');

const mockSidecarPath = path.join(__dirname, 'helpers', 'xlsx-sidecar-mock.mjs');

/** mock sidecar 需要可执行权限； vitest 环境内按需 chmod。 */
const ensureExecutable = (filePath: string): string => {
  execSync(`chmod +x '${filePath}'`);
  return filePath;
};

function writeFixture(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chips-xlsx-test-'));
  const filePath = path.join(dir, 'book.xlsx');
  fs.writeFileSync(filePath, Buffer.from(buildMinimalXlsx('hello-sidecar')));
  return filePath;
}

const realBinaryAvailable = (): boolean => {
  const platformDir = `${process.platform}-${process.arch}`;
  const candidate = path.join(__dirname, '..', '..', 'resources', 'engines', 'xlsx-sidecar', platformDir, 'xlsx-sidecar');
  return fs.existsSync(candidate);
};

describe('XlsxEngineService（mock sidecar 协议层）', () => {
  it('open/readRange/close 全协议往返', async () => {
    const service = new XlsxEngineService({ binaryPath: ensureExecutable(mockSidecarPath) });
    try {
      const opened = await service.open({ path: '/ws/book.xlsx', locale: 'zh' }) as { sessionId: string; sheets: Array<{ id: string }> };
      expect(opened.sessionId).toBe('sess-mock-1');
      expect(opened.sheets[0]?.id).toBe('sheet-1');

      const range = await service.readRange({
        sessionId: opened.sessionId,
        sheetId: opened.sheets[0].id,
        range: { startRow: 0, endRow: 1, startColumn: 0, endColumn: 1 },
      }) as { cells: Array<{ value: string }> };
      expect(range.cells[0]?.value).toBe('mock');

      await service.close({ sessionId: opened.sessionId });
    } finally {
      await service.stop();
    }
  });

  it('readEntries 将 sidecar 落盘条目读回为 base64 内容', async () => {
    const service = new XlsxEngineService({ binaryPath: ensureExecutable(mockSidecarPath) });
    try {
      const result = await service.readEntries({ path: '/ws/book.xlsx', entries: ['xl/workbook.xml'] });
      expect(result.entries[0]?.name).toBe('xl/workbook.xml');
      expect(Buffer.from(result.entries[0].contentBase64, 'base64').toString()).toBe('content-of-xl/workbook.xml');
    } finally {
      await service.stop();
    }
  });

  it('saveArchive 将 base64 条目物化为临时文件并回传结果', async () => {
    const sourcePath = writeFixture();
    const service = new XlsxEngineService({ binaryPath: ensureExecutable(mockSidecarPath) });
    try {
      const targetPath = path.join(path.dirname(sourcePath), 'book-out.xlsx');
      const result = await service.saveArchive({
        sourcePath,
        targetPath,
        replacements: [{ name: 'xl/worksheets/sheet1.xml', contentBase64: Buffer.from('<worksheet/>').toString('base64') }],
        removals: [],
        additions: [],
      }) as { touched: Array<{ kind: string; name: string; bytes: number }> };
      expect(result.touched[0]?.kind).toBe('replace');
      expect(result.touched[0]?.name).toBe('xl/worksheets/sheet1.xml');
      expect(result.touched[0]?.bytes).toBeGreaterThan(0);
      expect(fs.existsSync(targetPath)).toBe(true);
    } finally {
      await service.stop();
    }
  });

  it('sidecar 退出后 pending 请求被拒绝（OFFICE_ENGINE_FAILED）', async () => {
    const service = new XlsxEngineService({ binaryPath: ensureExecutable(mockSidecarPath) });
    await service.open({ path: '/ws/book.xlsx' });
    await service.stop();
    await expect(service.readRange({
      sessionId: 'sess-mock-1',
      sheetId: 'sheet-1',
      range: { startRow: 0, endRow: 0, startColumn: 0, endColumn: 0 },
    })).rejects.toMatchObject({ code: 'OFFICE_ENGINE_FAILED' });
  });

  it('二进制缺失时返回 OFFICE_ENGINE_BINARY_MISSING', async () => {
    const service = new XlsxEngineService({ binaryPath: '/nonexistent/xlsx-sidecar' });
    await expect(service.open({ path: '/ws/book.xlsx' })).rejects.toMatchObject({ code: 'OFFICE_ENGINE_FAILED' });
  });
});

describe('XlsxEngineService（真实 sidecar 二进制集成）', () => {
  it('构造最小 xlsx：open → readRange → saveArchive 替换内容 → 重开验证', async () => {
    if (!realBinaryAvailable()) {
      throw new Error('real xlsx-sidecar binary missing under resources/engines — run Chips-Host/scripts/build-xlsx-sidecar.mjs');
    }
    const sourcePath = writeFixture();
    const service = new XlsxEngineService();
    try {
      const opened = await service.open({ path: sourcePath, locale: 'zh' }) as {
        sessionId: string;
        sheets: Array<{ id: string; name: string; rowCount: number; columnCount: number }>;
      };
      expect(opened.sheets[0]?.name).toBe('Sheet1');
      const sheetMeta = opened.sheets[0];

      const range = await service.readRange({
        sessionId: opened.sessionId,
        sheetId: sheetMeta.id,
        range: {
          startRow: 0,
          endRow: Math.min(1, sheetMeta.rowCount - 1),
          startColumn: 0,
          endColumn: Math.min(1, sheetMeta.columnCount - 1),
        },
      }) as { cells: Array<{ value?: string; rich?: Array<{ text?: string }> }> };
      const firstCell = range.cells[0];
      const cellText = firstCell?.value ?? firstCell?.rich?.map((run) => run.text ?? '').join('') ?? '';
      expect(cellText).toBe('hello-sidecar');

      const manifest = await service.archiveManifest({ path: sourcePath }) as { entries: Array<{ name: string }> };
      expect(manifest.entries.map((entry) => entry.name)).toContain('xl/worksheets/sheet1.xml');

      const targetPath = path.join(path.dirname(sourcePath), 'book-edited.xlsx');
      const replacedXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>edited</t></is></c></row></sheetData></worksheet>';
      const saveResult = await service.saveArchive({
        sourcePath,
        targetPath,
        replacements: [{ name: 'xl/worksheets/sheet1.xml', contentBase64: Buffer.from(replacedXml).toString('base64') }],
        removals: [],
        additions: [],
      }) as { beforeEntries: Array<{ name: string }>; afterEntries: Array<{ name: string }> };
      expect(saveResult.beforeEntries.some((entry) => entry.name === 'xl/worksheets/sheet1.xml')).toBe(true);
      expect(saveResult.afterEntries.some((entry) => entry.name === 'xl/worksheets/sheet1.xml')).toBe(true);

      const reopened = await service.open({ path: targetPath, locale: 'zh' }) as { sessionId: string; sheets: Array<{ id: string }> };
      const reread = await service.readRange({
        sessionId: reopened.sessionId,
        sheetId: reopened.sheets[0].id,
        range: {
          startRow: 0,
          endRow: Math.min(1, reopened.sheets[0].rowCount - 1),
          startColumn: 0,
          endColumn: Math.min(1, reopened.sheets[0].columnCount - 1),
        },
      }) as { cells: Array<{ value?: string; rich?: Array<{ text?: string }> }> };
      const newCell = reread.cells[0];
      const newText = newCell?.value ?? newCell?.rich?.map((run) => run.text ?? '').join('') ?? '';
      expect(newText).toBe('edited');

      await service.close({ sessionId: reopened.sessionId });
      await service.close({ sessionId: opened.sessionId });
    } finally {
      await service.stop();
    }
  });
});

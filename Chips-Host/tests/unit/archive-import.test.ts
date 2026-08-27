import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { importArchiveBundle } from '../../packages/zip-service/src/archive-import';
import { StoreZipService } from '../../packages/zip-service/src';

const tempRoots: string[] = [];

const createTempRoot = async (): Promise<string> => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'chips-archive-import-'));
  tempRoots.push(root);
  return root;
};

const createZip = async (zipPath: string, files: Record<string, string>): Promise<void> => {
  const zip = new StoreZipService();
  const sourceDir = await fs.mkdtemp(path.join(os.tmpdir(), 'chips-archive-src-'));
  tempRoots.push(sourceDir);
  for (const [filePath, content] of Object.entries(files)) {
    const absolutePath = path.join(sourceDir, filePath);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, content);
  }
  await zip.compress(sourceDir, zipPath);
};

describe('archive-import 契约测试', () => {
  let root: string;
  let zip: StoreZipService;

  beforeEach(async () => {
    root = await createTempRoot();
    zip = new StoreZipService();
  });

  afterEach(async () => {
    for (const tempRoot of tempRoots) {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
    tempRoots.length = 0;
  });

  it('剥离单一顶层目录并导入资源', async () => {
    const zipPath = path.join(root, 'bundle.zip');
    await createZip(zipPath, {
      'webapp/index.html': '<html>hi</html>',
      'webapp/app.js': 'console.log(1)',
      'webapp/style.css': 'body {}',
      'webapp/img.png': 'png-bytes',
    });

    const result = await importArchiveBundle(
      {
        zipFile: zipPath,
        targetRoot: root,
        preferredRootDir: 'webapp',
        excludeSystemArtifacts: true,
      },
      zip,
    );

    expect(result.rootDir).toBe('webapp');
    expect(result.resourcePaths.sort()).toEqual(['app.js', 'img.png', 'index.html', 'style.css']);
    expect(result.discardedEntries).toHaveLength(0);
    expect(await fs.stat(path.join(root, 'webapp', 'index.html')).then(() => true).catch(() => false)).toBe(true);
  });

  it('stripSingleRootDir=false 时保留顶层目录', async () => {
    const zipPath = path.join(root, 'bundle.zip');
    await createZip(zipPath, {
      'webapp/index.html': '<html>hi</html>',
      'webapp/app.js': 'x',
    });

    const result = await importArchiveBundle(
      {
        zipFile: zipPath,
        targetRoot: root,
        preferredRootDir: 'bundle',
        stripSingleRootDir: false,
      },
      zip,
    );
    expect(result.resourcePaths.sort()).toEqual(['webapp/app.js', 'webapp/index.html']);
  });

  it('入口文件位于 ZIP 根时正常导入', async () => {
    const zipPath = path.join(root, 'site.zip');
    await createZip(zipPath, {
      'index.html': '<html>hi</html>',
      'main.js': 'x',
      'assets/logo.png': 'y',
    });

    const result = await importArchiveBundle(
      {
        zipFile: zipPath,
        targetRoot: root,
        preferredRootDir: 'site',
        entryFile: 'index.html',
      },
      zip,
    );
    expect(result.rootDir).toBe('site');
    expect(result.entryFile).toBe('index.html');
    expect(result.resourcePaths).toContain('index.html');
    expect(result.resourcePaths).toContain('assets/logo.png');
  });

  it('include 过滤丢弃不匹配条目', async () => {
    const zipPath = path.join(root, 'filter.zip');
    await createZip(zipPath, {
      'a/index.html': '<html>hi</html>',
      'a/photo.png': 'png',
      'a/notes.txt': 'text',
    });

    const result = await importArchiveBundle(
      {
        zipFile: zipPath,
        targetRoot: root,
        preferredRootDir: 'a',
        include: { extensions: ['html', 'png'] },
      },
      zip,
    );
    expect(result.resourcePaths.sort()).toEqual(['index.html', 'photo.png']);
    expect(result.discardedEntries.some((entry) => entry.reason === 'filter-mismatch')).toBe(true);
  });

  it('清理 __MACOSX 与 .DS_Store 系统垃圾', async () => {
    const zipPath = path.join(root, 'clean.zip');
    await createZip(zipPath, {
      'app/index.html': '<html>hi</html>',
      '__MACOSX/._index.html': 'junk',
      'app/.DS_Store': 'junk',
    });

    const result = await importArchiveBundle(
      {
        zipFile: zipPath,
        targetRoot: root,
        preferredRootDir: 'app',
        excludeSystemArtifacts: true,
      },
      zip,
    );
    expect(result.resourcePaths).toEqual(['index.html']);
    expect(result.discardedEntries.some((entry) => entry.reason === 'system-artifact')).toBe(true);
  });

  it('失败时回滚目标目录', async () => {
    const zipPath = path.join(root, 'bad.zip');
    await createZip(zipPath, {
      'app/index.html': '<html>hi</html>',
    });

    // 通过入口文件指向不存在的文件触发失败
    await expect(
      importArchiveBundle(
        {
          zipFile: zipPath,
          targetRoot: root,
          preferredRootDir: 'app',
          entryFile: 'missing.html',
        },
        zip,
      ),
    ).rejects.toThrow();

    const targetDir = path.join(root, 'app');
    expect(await fs.stat(targetDir).then(() => true).catch(() => false)).toBe(false);
  });

  it('图片魔数嗅探替换 MIME', async () => {
    const zipPath = path.join(root, 'mime.zip');
    await createZip(zipPath, {
      'img/fake.png': '\x89PNG\r\n\x1a\nreal-png-bytes',
    });

    const result = await importArchiveBundle(
      {
        zipFile: zipPath,
        targetRoot: root,
        preferredRootDir: 'img',
      },
      zip,
    );
    expect(result.entries[0]?.mimeType).toBe('image/png');
  });
});

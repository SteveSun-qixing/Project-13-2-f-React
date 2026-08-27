import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { enumerateResourceFiles } from './card-unpack.js';

const tempDirs: string[] = [];

function createTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccps-card-unpack-test-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('enumerateResourceFiles', () => {
  it('会扫描卡片内所有非结构配置文件资源，不依赖所在目录位置', () => {
    const tempDir = createTempDir();

    fs.mkdirSync(path.join(tempDir, '.card', 'cardcover'), { recursive: true });
    fs.mkdirSync(path.join(tempDir, 'content'), { recursive: true });
    fs.mkdirSync(path.join(tempDir, 'assets', 'gallery'), { recursive: true });

    fs.writeFileSync(path.join(tempDir, '.card', 'metadata.yaml'), 'id: demo\nname: demo\n', 'utf-8');
    fs.writeFileSync(path.join(tempDir, '.card', 'structure.yaml'), 'structure: []\n', 'utf-8');
    fs.writeFileSync(path.join(tempDir, '.card', 'cover.html'), '<img src="./cardcover/cover-image.png">', 'utf-8');
    fs.writeFileSync(path.join(tempDir, 'content', 'node.yaml'), 'card_type: ImageCard\n', 'utf-8');

    fs.writeFileSync(path.join(tempDir, '.card', 'cardcover', 'cover-image.png'), 'cover', 'utf-8');
    fs.writeFileSync(path.join(tempDir, 'poster.png'), 'poster', 'utf-8');
    fs.writeFileSync(path.join(tempDir, 'assets', 'gallery', 'demo.webp'), 'gallery', 'utf-8');

    const result = enumerateResourceFiles(tempDir);

    expect(result.map((item) => item.relativePath)).toEqual([
      '.card/cardcover/cover-image.png',
      'assets/gallery/demo.webp',
      'poster.png',
    ]);
  });
});

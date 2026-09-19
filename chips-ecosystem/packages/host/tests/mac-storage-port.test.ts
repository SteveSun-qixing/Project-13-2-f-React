import { mkdtemp, readdir, readFile, rm, symlink, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PAL_ERROR_CODES } from '../src/platform/errors.js';
import type { StorageWatchEvent } from '../src/platform/contracts/index.js';
import { createMacStoragePort } from '../src/platform/mac/storage-port.js';

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'chips-pal-storage-'));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('macOS storage port · read', () => {
  it('should read utf-8 text', async () => {
    const file = join(root, 'note.txt');
    await writeFile(file, '你好，薯片', 'utf8');

    const result = await createMacStoragePort().read(file);
    expect(result).toEqual({ content: '你好，薯片', encoding: 'utf-8' });
  });

  it('should read base64 bytes', async () => {
    const file = join(root, 'blob.bin');
    await writeFile(file, Buffer.from([0xff, 0xfe, 0x01]));

    const result = await createMacStoragePort().read(file, { encoding: 'base64' });
    expect(result.encoding).toBe('base64');
    expect(Buffer.from(result.content, 'base64')).toEqual(Buffer.from([0xff, 0xfe, 0x01]));
  });

  it('should reject undecodable utf-8 with FILE_DECODE_FAILED', async () => {
    const file = join(root, 'invalid.bin');
    await writeFile(file, Buffer.from([0xff, 0xfe]));
    const port = createMacStoragePort();

    await expect(port.read(file)).rejects.toMatchObject({
      code: PAL_ERROR_CODES.FILE_DECODE_FAILED,
    });
    await expect(port.read(file, { encoding: 'base64' })).resolves.toBeDefined();
  });

  it('should map missing files to FILE_NOT_FOUND', async () => {
    await expect(createMacStoragePort().read(join(root, 'nope.txt'))).rejects.toMatchObject({
      code: PAL_ERROR_CODES.FILE_NOT_FOUND,
    });
  });

  it('should reject relative paths', async () => {
    await expect(createMacStoragePort().read('relative.txt')).rejects.toMatchObject({
      code: PAL_ERROR_CODES.FILE_IO_FAILED,
    });
  });

  it('should respond to cancelled and expired calls', async () => {
    const file = join(root, 'note.txt');
    await writeFile(file, 'x', 'utf8');
    const port = createMacStoragePort();
    const controller = new AbortController();
    controller.abort();

    await expect(port.read(file, { signal: controller.signal })).rejects.toMatchObject({
      code: PAL_ERROR_CODES.BRIDGE_CANCELLED,
    });
    await expect(port.read(file, { deadline: Date.now() - 1 })).rejects.toMatchObject({
      code: PAL_ERROR_CODES.BRIDGE_TIMEOUT,
    });
  });
});

describe('macOS storage port · write', () => {
  it('should write text atomically and leave no temporary files', async () => {
    const file = join(root, 'note.txt');
    const port = createMacStoragePort();
    await port.write(file, '第一版');
    await port.write(file, '第二版');

    expect(await readFile(file, 'utf8')).toBe('第二版');
    const entries = await readdir(root);
    expect(entries.filter((name) => name.includes('chips-tmp'))).toEqual([]);
  });

  it('should write base64 payloads as raw bytes', async () => {
    const file = join(root, 'blob.bin');
    await createMacStoragePort().write(file, Buffer.from([1, 2, 3]).toString('base64'), {
      encoding: 'base64',
    });
    expect(await readFile(file)).toEqual(Buffer.from([1, 2, 3]));
  });

  it('should not create missing parent directories', async () => {
    await expect(createMacStoragePort().write(join(root, 'missing', 'note.txt'), 'x')).rejects.toMatchObject({
      code: PAL_ERROR_CODES.FILE_NOT_FOUND,
    });
  });
});

describe('macOS storage port · list', () => {
  it('should list entries sorted by code units', async () => {
    await writeFile(join(root, 'b.txt'), 'b');
    await writeFile(join(root, 'a.txt'), 'a');
    await mkdir(join(root, 'c'));
    await writeFile(join(root, 'c', 'd.txt'), 'd');

    const flat = await createMacStoragePort().list(root);
    expect(flat).toEqual(['a.txt', 'b.txt', 'c']);

    const recursive = await createMacStoragePort().list(root, { recursive: true });
    expect(recursive).toEqual(['a.txt', 'b.txt', 'c', 'c/d.txt']);
  });

  it('should produce a stable descending-to-ascending sort', async () => {
    for (const name of ['z.txt', 'm.txt', 'a.txt', 'b.txt']) {
      await writeFile(join(root, name), name);
    }
    const entries = await createMacStoragePort().list(root);
    expect(entries).toEqual(['a.txt', 'b.txt', 'm.txt', 'z.txt']);
  });

  it('should not follow symbolic links', async () => {
    await writeFile(join(root, 'target.txt'), 'x');
    await symlink(join(root, 'target.txt'), join(root, 'link.txt'));
    await symlink(tmpdir(), join(root, 'link-dir'));

    const entries = await createMacStoragePort().list(root, { recursive: true });
    expect(entries).toEqual(['target.txt']);
  });

  it('should reject a non-directory target', async () => {
    const file = join(root, 'note.txt');
    await writeFile(file, 'x');
    await expect(createMacStoragePort().list(file)).rejects.toMatchObject({
      code: PAL_ERROR_CODES.FILE_NOT_DIRECTORY,
    });
  });
});

describe('macOS storage port · mkdir / delete', () => {
  it('should create directories recursively when requested', async () => {
    const port = createMacStoragePort();
    const nested = join(root, 'a', 'b', 'c');
    await port.mkdir(nested, { recursive: true });
    expect(await readdir(join(root, 'a'))).toEqual(['b']);
  });

  it('should map existing directories to FILE_ALREADY_EXISTS without recursive', async () => {
    const port = createMacStoragePort();
    await port.mkdir(join(root, 'dir'));
    await expect(port.mkdir(join(root, 'dir'))).rejects.toMatchObject({
      code: PAL_ERROR_CODES.FILE_ALREADY_EXISTS,
    });
    await expect(port.mkdir(join(root, 'dir'), { recursive: true })).resolves.toBeUndefined();
  });

  it('should delete files and recursive trees', async () => {
    const port = createMacStoragePort();
    const file = join(root, 'file.txt');
    await writeFile(file, 'x');
    await port.delete(file);
    await expect(port.delete(file)).rejects.toMatchObject({
      code: PAL_ERROR_CODES.FILE_NOT_FOUND,
    });

    await mkdir(join(root, 'tree', 'child'), { recursive: true });
    await expect(port.delete(join(root, 'tree'))).rejects.toMatchObject({
      code: PAL_ERROR_CODES.FILE_NOT_EMPTY,
    });
    await port.delete(join(root, 'tree'), { recursive: true });
    await expect(readdir(join(root, 'tree'))).rejects.toThrow();
  });

  it('should delete an empty directory without the recursive flag', async () => {
    const port = createMacStoragePort();
    const empty = join(root, 'empty');
    await port.mkdir(empty);
    await port.delete(empty);
    await expect(readdir(empty)).rejects.toThrow();
  });
});

describe('macOS storage port · move / copy', () => {
  it('should move a file and respect overwrite semantics', async () => {
    const port = createMacStoragePort();
    const source = join(root, 'source.txt');
    const target = join(root, 'target.txt');
    await writeFile(source, 'source');
    await writeFile(target, 'target');

    await expect(port.move(source, target)).rejects.toMatchObject({
      code: PAL_ERROR_CODES.FILE_ALREADY_EXISTS,
    });
    await port.move(source, target, { overwrite: true });
    expect(await readFile(target, 'utf8')).toBe('source');
  });

  it('should move directories and fail for missing sources', async () => {
    const port = createMacStoragePort();
    await mkdir(join(root, 'dir', 'child'), { recursive: true });
    await port.move(join(root, 'dir'), join(root, 'moved'));
    expect(await readdir(join(root, 'moved'))).toEqual(['child']);

    await expect(port.move(join(root, 'missing'), join(root, 'x'))).rejects.toMatchObject({
      code: PAL_ERROR_CODES.FILE_NOT_FOUND,
    });
  });

  it('should copy files and directory trees without following symlinks', async () => {
    const port = createMacStoragePort();
    const source = join(root, 'source.txt');
    await writeFile(source, 'source');
    await port.copy(source, join(root, 'copy.txt'));
    expect(await readFile(join(root, 'copy.txt'), 'utf8')).toBe('source');

    await mkdir(join(root, 'tree', 'child'), { recursive: true });
    await writeFile(join(root, 'tree', 'child', 'file.txt'), 'x');
    await port.copy(join(root, 'tree'), join(root, 'tree-copy'));
    expect(await readdir(join(root, 'tree-copy', 'child'))).toEqual(['file.txt']);

    await expect(port.copy(source, join(root, 'copy.txt'))).rejects.toMatchObject({
      code: PAL_ERROR_CODES.FILE_ALREADY_EXISTS,
    });
    await expect(port.copy(join(root, 'missing'), join(root, 'x'))).rejects.toMatchObject({
      code: PAL_ERROR_CODES.FILE_NOT_FOUND,
    });
  });
});

describe('macOS storage port · watch', () => {
  it('should emit change events and stop after dispose', async () => {
    const port = createMacStoragePort();
    const events: StorageWatchEvent[] = [];
    const subscription = await port.watch(root, (event) => events.push(event));

    await writeFile(join(root, 'watched.txt'), 'x');
    await vi.waitFor(() => {
      expect(events.length).toBeGreaterThan(0);
    });
    expect(events[0]?.path.startsWith(root)).toBe(true);
    expect(['rename', 'change']).toContain(events[0]?.type);
    expect(typeof events[0]?.timestamp).toBe('number');

    subscription.dispose();
    subscription.dispose();
    const countAfterDispose = events.length;
    await writeFile(join(root, 'after.txt'), 'y');
    await new Promise<void>((resolve) => setTimeout(resolve, 50));
    expect(events.length).toBe(countAfterDispose);
  });

  it('should map a missing watch target to FILE_NOT_FOUND', async () => {
    await expect(createMacStoragePort().watch(join(root, 'missing'), () => undefined)).rejects.toMatchObject({
      code: PAL_ERROR_CODES.FILE_NOT_FOUND,
    });
  });
});

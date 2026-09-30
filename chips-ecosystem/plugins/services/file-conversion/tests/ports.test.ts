/**
 * 宿主文件端口（createBridgeFilePort）装配测试：以内存 Bridge 验证 `file:*`
 * 正式链路收窄投影的编解码与动作映射（含 base64 二进制往返），不 mock 投影本身。
 */

import { describe, expect, it } from 'vitest';

import { createBridgeFilePort } from '../src/ports.js';
import { decodeBase64, encodeBase64 } from '../src/base64.js';
import type { IServiceBridge } from '@chips/sdk';

interface BridgeRecord {
  readonly action: string;
  readonly payload?: Record<string, unknown> | undefined;
}

function createBridge(initial: Map<string, Uint8Array | string> = new Map()): {
  bridge: IServiceBridge;
  calls: BridgeRecord[];
  store: Map<string, Uint8Array | string>;
  moved: { source: string; target: string; overwrite: unknown }[];
  deleted: { path: string; recursive: unknown }[];
} {
  const calls: BridgeRecord[] = [];
  const moved: { source: string; target: string; overwrite: unknown }[] = [];
  const deleted: { path: string; recursive: unknown }[] = [];
  const asText = (value: unknown): string => (typeof value === 'string' ? value : '');
  const bridge = {
    request: (action: string, payload?: Record<string, unknown>): Promise<unknown> => {
      calls.push({ action, payload });
      if (action === 'file:list') {
        const directory = asText(payload?.directory);
        const prefix = directory.endsWith('/') ? directory : `${directory}/`;
        return Promise.resolve({
          entries: [...initial.keys()]
            .filter((path) => path.startsWith(prefix))
            .map((path) => path.slice(prefix.length)),
        });
      }
      if (action === 'file:read') {
        const path = asText(payload?.path);
        const value = initial.get(path);
        if (value === undefined) {
          return Promise.reject(new Error(`missing: ${path}`));
        }
        const isBase64 = payload?.encoding === 'base64';
        return Promise.resolve({
          content:
            value instanceof Uint8Array
              ? encodeBase64(value)
              : isBase64
                ? encodeBase64(new TextEncoder().encode(value))
                : value,
          encoding: isBase64 ? 'base64' : 'utf-8',
        });
      }
      if (action === 'file:write') {
        const path = asText(payload?.path);
        const data = asText(payload?.data);
        initial.set(path, payload?.encoding === 'base64' ? decodeBase64(data) : data);
        return Promise.resolve({});
      }
      if (action === 'file:move') {
        moved.push({
          source: asText(payload?.source),
          target: asText(payload?.target),
          overwrite: payload?.overwrite,
        });
        return Promise.resolve({});
      }
      if (action === 'file:delete') {
        deleted.push({ path: asText(payload?.path), recursive: payload?.recursive });
        return Promise.resolve({});
      }
      if (action === 'file:mkdir') {
        return Promise.resolve({});
      }
      return Promise.reject(new Error(`unexpected: ${action}`));
    },
  };
  return { bridge: bridge as unknown as IServiceBridge, calls, store: initial, moved, deleted };
}

function createSeedEntries(
  ...pairs: readonly (readonly [string, Uint8Array | string])[]
): Map<string, Uint8Array | string> {
  return new Map(pairs);
}

describe('createBridgeFilePort（宿主文件端口投影）', () => {
  it('file:list 直传 directory 并回传相对条目（recursive 参数透传）', async () => {
    const env = createBridge(
      createSeedEntries(['/site/index.html', '<html></html>'], ['/site/assets/a.png', new Uint8Array([1])])
    );
    const port = createBridgeFilePort(env.bridge);

    await expect(port.listDirectory('/site', true)).resolves.toEqual(['index.html', 'assets/a.png']);
    await expect(port.listDirectory('/site')).resolves.toEqual(['index.html', 'assets/a.png']);
    expect(env.calls[0]).toMatchObject({ action: 'file:list', payload: { directory: '/site', recursive: true } });
    expect(env.calls[1]).toMatchObject({ action: 'file:list', payload: { directory: '/site' } });
  });

  it('readText / readBytes：utf-8 与 base64 编码分别投影', async () => {
    const env = createBridge(
      createSeedEntries(['/a/page.html', '<html>页</html>'], ['/a/img.png', new Uint8Array([0x89, 0x50, 0x4e, 0x47])])
    );
    const port = createBridgeFilePort(env.bridge);

    await expect(port.readText('/a/page.html')).resolves.toBe('<html>页</html>');
    const bytes = await port.readBytes('/a/img.png');
    expect([...bytes]).toEqual([0x89, 0x50, 0x4e, 0x47]);
    expect(env.calls[0]?.payload).toMatchObject({ path: '/a/page.html', encoding: 'utf-8' });
    expect(env.calls[1]?.payload).toMatchObject({ path: '/a/img.png', encoding: 'base64' });
  });

  it('writeText / writeBytes：文本与 base64 编码分别投影且字节往返一致', async () => {
    const env = createBridge();
    const port = createBridgeFilePort(env.bridge);

    await port.writeText('/a/index.html', '<html>页</html>');
    await port.writeBytes('/a/out.pdf', new Uint8Array([0x25, 0x50, 0x44, 0x46]));

    expect(env.store.get('/a/index.html')).toBe('<html>页</html>');
    expect(env.store.get('/a/out.pdf')).toEqual(new Uint8Array([0x25, 0x50, 0x44, 0x46]));
    expect(env.calls[1]?.payload).toMatchObject({ path: '/a/out.pdf', encoding: 'base64' });
  });

  it('movePath / deletePath / makeDirectory 直传动作与参数', async () => {
    const env = createBridge();
    const port = createBridgeFilePort(env.bridge);

    await port.makeDirectory('/staging/root');
    await port.movePath('/staging/root/final/x.pdf', '/out/x.pdf', true);
    await port.deletePath('/staging/root', true);
    await port.deletePath('/staging/root');

    expect(env.calls[0]).toMatchObject({ action: 'file:mkdir', payload: { path: '/staging/root', recursive: true } });
    expect(env.moved[0]).toEqual({ source: '/staging/root/final/x.pdf', target: '/out/x.pdf', overwrite: true });
    expect(env.deleted[0]).toEqual({ path: '/staging/root', recursive: true });
    expect(env.deleted[1]).toEqual({ path: '/staging/root', recursive: undefined });
  });
});

/**
 * 服务插件入口测试：IServicePlugin 同族形态（start/stop/health）、
 * ctx.inject 服务互调装配（依赖就绪前不注册服务）、错误面与取消透传。
 */

import { describe, expect, it } from 'vitest';

import { ChipsError, type IServiceContext } from '@chips/sdk';

import {
  CARD_CONVERTER_SERVICE_NAME,
  FILE_CONVERSION_PLUGIN_ID,
  FILE_CONVERSION_SERVICE_NAME,
  HTML_TO_IMAGE_SERVICE_NAME,
  HTML_TO_PDF_SERVICE_NAME,
} from '../src/descriptor.js';
import main from '../src/main.js';
import type { IFileConvertRequest, ISiblingPorts } from '../src/types.js';

interface InjectRecord {
  readonly dependencies: readonly string[];
  readonly callback: (scope: IServiceContext) => void;
}

/** 有状态内存 Bridge：file:* 语义与执行器测试的 fake 端口同构，提供方写 → 编排读互通。 */
function createBridge(store: Map<string, string>): {
  request(action: string, payload?: Record<string, unknown>): Promise<unknown>;
} {
  const asText = (value: unknown): string => (typeof value === 'string' ? value : '');
  return {
    request: (action, payload) => {
      if (action === 'file:list') {
        const directory = asText(payload?.directory);
        const prefix = directory.endsWith('/') ? directory : `${directory}/`;
        return Promise.resolve({
          entries: [...store.keys()]
            .filter((path) => path.startsWith(prefix))
            .map((path) => path.slice(prefix.length)),
        });
      }
      if (action === 'file:write') {
        store.set(asText(payload?.path), asText(payload?.data));
        return Promise.resolve({});
      }
      if (action === 'file:move') {
        const source = asText(payload?.source);
        const target = asText(payload?.target);
        const value = store.get(source);
        if (value !== undefined) {
          store.set(target, value);
          store.delete(source);
        }
        return Promise.resolve({});
      }
      if (action === 'file:delete') {
        const path = asText(payload?.path);
        const prefix = path.endsWith('/') ? path : `${path}/`;
        for (const key of [...store.keys()]) {
          if (key === path || key.startsWith(prefix)) {
            store.delete(key);
          }
        }
        return Promise.resolve({});
      }
      return Promise.resolve({});
    },
  };
}

function createFakeContext(): {
  ctx: IServiceContext;
  provided: Map<string, unknown>;
  injections: InjectRecord[];
  readonly store: Map<string, string>;
} {
  const provided = new Map<string, unknown>();
  const injections: InjectRecord[] = [];
  const store = new Map<string, string>();
  const ctx = {
    pluginId: FILE_CONVERSION_PLUGIN_ID,
    bridge: createBridge(store),
    logger: {
      debug: () => undefined,
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined,
    },
    provide: (name: string, service: unknown) => {
      provided.set(name, service);
    },
    inject: (dependencies: readonly string[], callback: (scope: IServiceContext) => void) => {
      injections.push({ dependencies, callback });
    },
  } as unknown as IServiceContext;
  return { ctx, provided, injections, store };
}

/** 兄弟服务端口族：cardToHtml 按提供方契约把产物写到请求的 output.path。 */
function createSiblings(store: Map<string, string>): ISiblingPorts {
  return {
    cardConverter: {
      cardToHtml: (input) => {
        store.set(input.output.path, 'artifact');
        return Promise.resolve({ outputPath: input.output.path, entryFile: 'index.html' });
      },
    },
    htmlToPdf: { htmlToPdf: () => Promise.resolve({ bytes: new Uint8Array([1]) }) },
    htmlToImage: { htmlToImage: () => Promise.resolve({ bytes: new Uint8Array([2]) }) },
  };
}

/** 注入回调面以 Cordis 服务名为键（ctx.inject 正式面的运行时形态）。 */
function toScope(siblings: ISiblingPorts): IServiceContext {
  return {
    [CARD_CONVERTER_SERVICE_NAME]: siblings.cardConverter,
    [HTML_TO_PDF_SERVICE_NAME]: siblings.htmlToPdf,
    [HTML_TO_IMAGE_SERVICE_NAME]: siblings.htmlToImage,
  } as unknown as IServiceContext;
}

describe('FileConversionServicePlugin', () => {
  it('start 声明三个提供方服务依赖并经注入回调装配（依赖就绪前不注册）', async () => {
    const { ctx, provided, injections } = createFakeContext();
    await main.start(ctx);

    expect(provided.size).toBe(0);
    expect(injections).toHaveLength(1);
    expect(injections[0]?.dependencies).toEqual([
      CARD_CONVERTER_SERVICE_NAME,
      HTML_TO_PDF_SERVICE_NAME,
      HTML_TO_IMAGE_SERVICE_NAME,
    ]);

    injections[0]?.callback(toScope(createSiblings(new Map())));
    expect(provided.has(FILE_CONVERSION_SERVICE_NAME)).toBe(true);
  });

  it('注入后注册的服务暴露 convert 操作并可端到端执行', async () => {
    const { ctx, provided, injections, store } = createFakeContext();
    await main.start(ctx);
    injections[0]?.callback(toScope(createSiblings(store)));

    const service = provided.get(FILE_CONVERSION_SERVICE_NAME) as {
      convert(request: unknown): Promise<{ pipeline: { capability: string }[]; outputPath: string }>;
    };
    const result = await service.convert({
      source: { type: 'card', path: '/workspace/demo.card' },
      target: { type: 'html' },
      output: { path: '/workspace/out/demo.html' },
    });
    expect(result.pipeline).toEqual([
      { capability: 'content-converter.card-to-html', service: 'content-converter', operation: 'cardToHtml' },
    ]);
    expect(result.outputPath).toBe('/workspace/out/demo.html');
    expect(store.get('/workspace/out/demo.html')).toBe('artifact');
  });

  it('注入面缺兄弟服务即 TypeError（不假接线）', async () => {
    const { ctx, injections } = createFakeContext();
    await main.start(ctx);
    expect(() => injections[0]?.callback({} as unknown as IServiceContext)).toThrowError(TypeError);
  });

  it('convert 输入非法按在册码拒绝', async () => {
    const { ctx, provided, injections } = createFakeContext();
    await main.start(ctx);
    injections[0]?.callback(toScope(createSiblings(new Map())));
    const service = provided.get(FILE_CONVERSION_SERVICE_NAME) as { convert(request: unknown): Promise<unknown> };

    let caught: unknown;
    try {
      await service.convert({});
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ChipsError);
    expect((caught as ChipsError).code).toBe('CONVERTER_INPUT_UNSUPPORTED');
  });

  it('stop 幂等且不抛出', async () => {
    await main.stop();
    await main.stop();
  });

  it('health 返回 true', async () => {
    await expect(main.health()).resolves.toBe(true);
  });

  it('入口默认导出与命名导出同源', async () => {
    const { default: entry } = await import('../src/index.js');
    expect(entry).toBe(main);
  });
});

describe('请求契约面（类型冒烟）', () => {
  it('IFileConvertRequest 形状稳定', () => {
    const request: IFileConvertRequest = {
      source: { type: 'html', path: '/a' },
      target: { type: 'image' },
      output: { path: '/b', overwrite: true },
      options: {
        html: { packageMode: 'directory', includeAssets: true, includeManifest: false },
        pdf: { pageSize: 'A4', landscape: false, printBackground: true, marginMm: { top: 10 } },
        image: { format: 'png', width: 794, height: 600, scaleFactor: 1, background: 'transparent' },
      },
    };
    expect(request.source.type).toBe('html');
  });
});

/**
 * 转换编排执行器测试：以同族 fake 端口（兄弟服务端口 + 文件端口）替代平台接线，
 * 断言全部落在真实编排行为上——链路执行顺序、暂存与提交、取消安全点、
 * 错误面在册码透传与归一、警告聚合（不 mock 编排逻辑本身）。
 */

import { describe, expect, it } from 'vitest';

import { ChipsError, type IServiceLogger } from '@chips/sdk';

import { BRIDGE_CANCELLED, CONVERTER_INPUT_UNSUPPORTED, CONVERTER_RENDER_FAILED } from '../src/errors.js';
import { createFileConversionService } from '../src/executor.js';
import type {
  ICardToHtmlPort,
  IFileConvertRequest,
  IFilePort,
  IHtmlToImagePort,
  IHtmlToPdfPort,
  ISiblingPorts,
  ImageFormat,
} from '../src/types.js';

const logger: IServiceLogger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

const textBytes = (text: string): Uint8Array => new TextEncoder().encode(text);

/**
 * 内存文件系统 fake：语义对齐 7.1 file:* 在册行为
 * （目录判定以「存在以该路径为前缀的条目」为准；文件路径列举返回 FILE_NOT_DIRECTORY）。
 */
function createFakeFilePort(initial: Record<string, string> = {}): IFilePort & { store: Map<string, string> } {
  const store = new Map<string, string>(Object.entries(initial));

  return {
    store,
    listDirectory(directory, recursive) {
      const prefix = directory.endsWith('/') ? directory : `${directory}/`;
      const hits = [...store.keys()].filter((path) => path.startsWith(prefix));
      if (hits.length === 0) {
        if (store.has(directory.replace(/\/$/, ''))) {
          return Promise.reject(new ChipsError({ code: 'FILE_NOT_DIRECTORY', message: `目标不是目录：${directory}` }));
        }
        return Promise.reject(new ChipsError({ code: 'FILE_NOT_FOUND', message: `目录不存在：${directory}` }));
      }
      if (recursive === true) {
        return Promise.resolve(hits.map((path) => path.slice(prefix.length)).sort());
      }
      const direct = new Set<string>();
      for (const path of hits) {
        const segment = path.slice(prefix.length).split('/')[0] ?? '';
        if (segment.length > 0) {
          direct.add(segment);
        }
      }
      return Promise.resolve([...direct].sort());
    },
    readText(path) {
      const value = store.get(path);
      if (value === undefined) {
        return Promise.reject(new ChipsError({ code: 'FILE_NOT_FOUND', message: `文件不存在：${path}` }));
      }
      return Promise.resolve(value);
    },
    readBytes(path) {
      const value = store.get(path);
      if (value === undefined) {
        return Promise.reject(new ChipsError({ code: 'FILE_NOT_FOUND', message: `文件不存在：${path}` }));
      }
      return Promise.resolve(textBytes(value));
    },
    writeText(path, data) {
      store.set(path, data);
      return Promise.resolve();
    },
    writeBytes(path, data) {
      store.set(path, new TextDecoder().decode(data));
      return Promise.resolve();
    },
    makeDirectory() {
      // 内存 fake：目录仅以路径前缀语义存在，无需落实体。
      return Promise.resolve();
    },
    movePath(source, target, overwrite) {
      const value = store.get(source);
      if (value === undefined) {
        return Promise.reject(new ChipsError({ code: 'FILE_NOT_FOUND', message: `来源不存在：${source}` }));
      }
      if (store.has(target) && overwrite !== true) {
        return Promise.reject(new ChipsError({ code: 'FILE_ALREADY_EXISTS', message: `目标已存在：${target}` }));
      }
      store.set(target, value);
      store.delete(source);
      return Promise.resolve();
    },
    deletePath(path, recursive) {
      const prefix = path.endsWith('/') ? path : `${path}/`;
      let hit = false;
      for (const key of [...store.keys()]) {
        if (key === path || key.startsWith(prefix)) {
          if (recursive !== true && key !== path) {
            return Promise.reject(new ChipsError({ code: 'FILE_NOT_EMPTY', message: `目录非空：${path}` }));
          }
          store.delete(key);
          hit = true;
        }
      }
      if (!hit) {
        return Promise.reject(new ChipsError({ code: 'FILE_NOT_FOUND', message: `目标不存在：${path}` }));
      }
      return Promise.resolve();
    },
  };
}

interface CardOutcome {
  entryFile?: string;
  warnings?: { code: string; message: string }[];
  /** 提供方是否真实落盘产物（缺省 true；false 用于谎报产物分支）。 */
  write?: boolean;
  /** 目录态产物（产物为 `<outputPath>/index.html`）；缺省为单文件产物。 */
  asDirectory?: boolean;
  error?: Error;
}

interface PdfOutcome {
  bytes?: Uint8Array;
  warnings?: { code: string; message: string }[];
  error?: Error;
}

interface ImageOutcome {
  bytes?: Uint8Array;
  format?: ImageFormat;
  error?: Error;
}

interface ExecutorHarness {
  readonly file: ReturnType<typeof createFakeFilePort>;
  readonly cardCalls: unknown[];
  readonly pdfCalls: unknown[];
  readonly imageCalls: unknown[];
  readonly service: ReturnType<typeof createFileConversionService>;
  setCardOutcome(outcome: CardOutcome): void;
  setPdfOutcome(outcome: PdfOutcome): void;
  setImageOutcome(outcome: ImageOutcome): void;
}

function createHarness(fileInitial: Record<string, string> = {}): ExecutorHarness {
  const file = createFakeFilePort(fileInitial);
  const cardCalls: unknown[] = [];
  const pdfCalls: unknown[] = [];
  const imageCalls: unknown[] = [];

  let cardOutcome: CardOutcome = { entryFile: 'index.html' };
  let pdfOutcome: PdfOutcome = { bytes: new Uint8Array([1, 2, 3]) };
  let imageOutcome: ImageOutcome = { bytes: new Uint8Array([9]) };

  const cardConverter: ICardToHtmlPort = {
    cardToHtml(input) {
      cardCalls.push(input);
      if (cardOutcome.error) {
        return Promise.reject(cardOutcome.error);
      }
      if (cardOutcome.write !== false) {
        // 提供方契约：产物落在请求的 output.path（目录态为该目录下的入口文件）。
        file.store.set(
          cardOutcome.asDirectory === true ? `${input.output.path}/index.html` : input.output.path,
          'artifact'
        );
      }
      return Promise.resolve({
        outputPath: input.output.path,
        ...(cardOutcome.entryFile !== undefined ? { entryFile: cardOutcome.entryFile } : {}),
        ...(cardOutcome.warnings !== undefined ? { warnings: cardOutcome.warnings } : {}),
      });
    },
  };
  const htmlToPdf: IHtmlToPdfPort = {
    htmlToPdf(input, options, call) {
      pdfCalls.push({ input, options, call });
      if (pdfOutcome.error) {
        return Promise.reject(pdfOutcome.error);
      }
      return Promise.resolve({
        bytes: pdfOutcome.bytes ?? new Uint8Array([1]),
        ...(pdfOutcome.warnings !== undefined ? { warnings: pdfOutcome.warnings } : {}),
      });
    },
  };
  const htmlToImage: IHtmlToImagePort = {
    htmlToImage(input, options, call) {
      imageCalls.push({ input, options, call });
      if (imageOutcome.error) {
        return Promise.reject(imageOutcome.error);
      }
      return Promise.resolve({
        bytes: imageOutcome.bytes ?? new Uint8Array([9]),
        ...(imageOutcome.format !== undefined ? { format: imageOutcome.format } : {}),
      });
    },
  };

  const service = createFileConversionService({ siblings: { cardConverter, htmlToPdf, htmlToImage }, file, logger });

  return {
    file,
    cardCalls,
    pdfCalls,
    imageCalls,
    service,
    setCardOutcome(outcome) {
      cardOutcome = outcome;
    },
    setPdfOutcome(outcome) {
      pdfOutcome = outcome;
    },
    setImageOutcome(outcome) {
      imageOutcome = outcome;
    },
  };
}

const cardToHtmlRequest: IFileConvertRequest = {
  source: { type: 'card', path: '/workspace/demo.card' },
  target: { type: 'html' },
  output: { path: '/workspace/out/demo.html' },
};

describe('createFileConversionService 装配守卫', () => {
  it('端口缺失即 TypeError（不假接线）', () => {
    expect(() =>
      createFileConversionService({
        siblings: undefined as unknown as ISiblingPorts,
        file: createFakeFilePort(),
        logger,
      })
    ).toThrowError(TypeError);
  });
});

describe('card → html 直接导出', () => {
  it('单腿执行：调用提供方、产物回执指向终路径、暂存提交并清理', async () => {
    const harness = createHarness({ '/workspace/demo.card': 'card' });
    harness.setCardOutcome({
      entryFile: 'index.html',
      warnings: [{ code: 'W1', message: '一' }],
    });

    const result = await harness.service.convert(cardToHtmlRequest);

    expect(harness.cardCalls).toHaveLength(1);
    const call = harness.cardCalls[0] as {
      source: string;
      output: { path: string; packageMode: string; overwrite: boolean };
    };
    expect(call.source).toBe('/workspace/demo.card');
    expect(call.output.path.startsWith('/workspace/out/.chips-file-conversion-output-')).toBe(true);
    expect(call.output.path.endsWith('/final/demo.html')).toBe(true);
    expect(call.output.packageMode).toBe('zip');
    expect(call.output.overwrite).toBe(false);

    expect(result.sourceType).toBe('card');
    expect(result.targetType).toBe('html');
    expect(result.outputPath).toBe('/workspace/out/demo.html');
    expect(result.artifacts).toEqual([
      { type: 'html-zip', path: '/workspace/out/demo.html', entryFile: 'index.html', mimeType: 'application/zip' },
    ]);
    expect(result.pipeline).toEqual([
      { capability: 'content-converter.card-to-html', service: 'content-converter', operation: 'cardToHtml' },
    ]);
    expect(result.warnings).toEqual([{ code: 'W1', message: '一' }]);
    // 提交后终路径持有产物，暂存根（含备份目录）已清理
    expect(harness.file.store.get('/workspace/out/demo.html')).toBe('artifact');
    const leftovers = [...harness.file.store.keys()].filter((path) => path.includes('.chips-file-conversion-'));
    expect(leftovers).toEqual([]);
  });

  it('输出已存在且未请求覆盖：CONVERTER_INPUT_UNSUPPORTED + reason=output-exists，不发起转换', async () => {
    const harness = createHarness({ '/workspace/demo.card': 'card', '/workspace/out/demo.html': 'old' });
    let caught: unknown;
    try {
      await harness.service.convert(cardToHtmlRequest);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ChipsError);
    expect((caught as ChipsError).code).toBe(CONVERTER_INPUT_UNSUPPORTED);
    expect((caught as ChipsError).details).toMatchObject({ reason: 'output-exists' });
    expect(harness.cardCalls).toHaveLength(0);
  });

  it('overwrite：先备份旧产物再发布，暂存根清理', async () => {
    const harness = createHarness({ '/workspace/demo.card': 'card', '/workspace/out/demo.html': 'old' });
    harness.setCardOutcome({ entryFile: 'index.html' });

    const result = await harness.service.convert({
      ...cardToHtmlRequest,
      output: { path: '/workspace/out/demo.html', overwrite: true },
    });

    expect(result.outputPath).toBe('/workspace/out/demo.html');
    expect(harness.file.store.get('/workspace/out/demo.html')).toBe('artifact');
    const leftovers = [...harness.file.store.keys()].filter((path) => path.includes('.chips-file-conversion-output-'));
    expect(leftovers).toEqual([]);
  });

  it('zip 包形态：提供方诚实拒绝原样透传（不私造兜底）', async () => {
    const harness = createHarness({ '/workspace/demo.card': 'card' });
    const service = createFileConversionService({
      siblings: {
        cardConverter: {
          cardToHtml: () =>
            Promise.reject(
              new ChipsError({
                code: CONVERTER_INPUT_UNSUPPORTED,
                message: '压缩态导出依赖宿主压缩能力域，该域尚未在平台登记。',
                details: { reason: 'zip-package-mode-unavailable' },
              })
            ),
        },
        htmlToPdf: { htmlToPdf: () => Promise.reject(new Error('unreachable')) },
        htmlToImage: { htmlToImage: () => Promise.reject(new Error('unreachable')) },
      },
      file: harness.file,
      logger,
    });

    let caught: unknown;
    try {
      await service.convert(cardToHtmlRequest);
    } catch (error) {
      caught = error;
    }
    expect((caught as ChipsError).code).toBe(CONVERTER_INPUT_UNSUPPORTED);
    expect((caught as ChipsError).details).toMatchObject({ reason: 'zip-package-mode-unavailable' });
  });
});

describe('card → pdf 两腿链路', () => {
  it('中间 HTML 目录态 → 读包装配纯内存输入 → 字节落暂存 → 提交与清理', async () => {
    const harness = createHarness({ '/workspace/demo.card': 'card' });
    // 提供方在请求的中间目录落入口文件（asDirectory 臂）；资源装配覆盖见 html 来源链路组
    harness.setCardOutcome({
      entryFile: 'index.html',
      asDirectory: true,
      warnings: [{ code: 'W_H', message: '中' }],
    });
    harness.setPdfOutcome({ bytes: new Uint8Array([37, 68, 70]), warnings: [{ code: 'W_P', message: '尾' }] });

    const result = await harness.service.convert({
      source: { type: 'card', path: '/workspace/demo.card' },
      target: { type: 'pdf' },
      output: { path: '/workspace/out/demo.pdf' },
      options: { pdf: { pageSize: 'A4' } },
    });

    expect(harness.cardCalls).toHaveLength(1);
    expect(harness.pdfCalls).toHaveLength(1);
    const cardCall = harness.cardCalls[0] as { output: { path: string; packageMode: string; overwrite: boolean } };
    expect(cardCall.output.packageMode).toBe('directory');
    expect(cardCall.output.overwrite).toBe(true);
    expect(cardCall.output.path.endsWith('/html')).toBe(true);
    const pdfCall = harness.pdfCalls[0] as {
      input: { html: string; assets: Record<string, Uint8Array> };
      options: unknown;
      call: { signal?: AbortSignal };
    };
    expect(pdfCall.input.html).toBe('artifact');
    expect(Object.keys(pdfCall.input.assets)).toEqual([]);
    expect(pdfCall.options).toEqual({ pageSize: 'A4' });

    expect(result.artifacts).toEqual([{ type: 'pdf', path: '/workspace/out/demo.pdf', mimeType: 'application/pdf' }]);
    expect(result.pipeline).toEqual([
      { capability: 'content-converter.card-to-html', service: 'content-converter', operation: 'cardToHtml' },
      { capability: 'content-converter.html-to-pdf', service: 'content-html-to-pdf', operation: 'htmlToPdf' },
    ]);
    expect(result.warnings).toEqual([
      { code: 'W_H', message: '中' },
      { code: 'W_P', message: '尾' },
    ]);
    const leftovers = [...harness.file.store.keys()].filter((path) => path.includes('.chips-file-conversion-'));
    expect(leftovers).toEqual([]);
  });

  it('空 PDF 字节按 CONVERTER_RENDER_FAILED 收口且不落盘', async () => {
    const harness = createHarness({ '/workspace/demo.card': 'card' });
    harness.setCardOutcome({ entryFile: 'index.html', asDirectory: true });
    harness.setPdfOutcome({ bytes: new Uint8Array([]) });

    let caught: unknown;
    try {
      await harness.service.convert({
        source: { type: 'card', path: '/workspace/demo.card' },
        target: { type: 'pdf' },
        output: { path: '/workspace/out/demo.pdf' },
      });
    } catch (error) {
      caught = error;
    }
    expect((caught as ChipsError).code).toBe(CONVERTER_RENDER_FAILED);
    expect((caught as ChipsError).details).toMatchObject({ reason: 'empty-render-output' });
    const leftovers = [...harness.file.store.keys()].filter((path) => path.endsWith('.pdf'));
    expect(leftovers).toEqual([]);
  });
});

describe('html 来源链路', () => {
  it('目录形态（list 探测成功）：入口缺省 index.html，资产随包装配', async () => {
    const harness = createHarness({
      '/workspace/site/index.html': '<html><body>站点</body></html>',
      '/workspace/site/assets/pic.webp': 'WEBP',
      '/workspace/site/extra.css': 'body{}',
    });
    harness.setImageOutcome({ bytes: new Uint8Array([8, 8]), format: 'webp' });

    const result = await harness.service.convert({
      source: { type: 'html', path: '/workspace/site' },
      target: { type: 'image' },
      output: { path: '/workspace/out/site.webp' },
      options: { image: { format: 'webp' } },
    });

    const imageCall = harness.imageCalls[0] as { input: { html: string; assets: Record<string, Uint8Array> } };
    expect(imageCall.input.html).toBe('<html><body>站点</body></html>');
    expect(Object.keys(imageCall.input.assets).sort()).toEqual(['assets/pic.webp', 'extra.css']);
    expect(result.artifacts).toEqual([{ type: 'image', path: '/workspace/out/site.webp', mimeType: 'image/webp' }]);
  });

  it('文件形态（list 非 FILE_NOT_FOUND 错误）：入口取末段、目录取父级', async () => {
    const harness = createHarness({ '/workspace/site/page.html': '<html></html>' });
    harness.setImageOutcome({ bytes: new Uint8Array([7]) });

    await harness.service.convert({
      source: { type: 'html', path: '/workspace/site/page.html' },
      target: { type: 'image' },
      output: { path: '/workspace/out/page.png' },
    });

    const imageCall = harness.imageCalls[0] as { input: { html: string; assets: Record<string, Uint8Array> } };
    expect(imageCall.input.html).toBe('<html></html>');
    // 入口文件本身不进资产表
    expect(Object.keys(imageCall.input.assets)).toEqual([]);
  });

  it('来源不存在（FILE_NOT_FOUND）：CONVERTER_INPUT_UNSUPPORTED + reason=source-not-found', async () => {
    const harness = createHarness();
    let caught: unknown;
    try {
      await harness.service.convert({
        source: { type: 'html', path: '/workspace/missing' },
        target: { type: 'pdf' },
        output: { path: '/workspace/out/x.pdf' },
      });
    } catch (error) {
      caught = error;
    }
    expect((caught as ChipsError).code).toBe(CONVERTER_INPUT_UNSUPPORTED);
    expect((caught as ChipsError).details).toMatchObject({ reason: 'source-not-found' });
  });

  it('目录形态含子目录条目：目录条目跳过、其文件纳入资产', async () => {
    const harness = createHarness({
      '/workspace/site/index.html': '<html></html>',
      '/workspace/site/assets/a.png': 'A',
      '/workspace/site/assets/b.png': 'B',
    });
    harness.setImageOutcome({ bytes: new Uint8Array([1]) });
    // 递归列举在真实宿主可能包含目录条目；fake 以探测臂模拟目录命中
    const originalList = harness.file.listDirectory.bind(harness.file);
    harness.file.listDirectory = (directory, recursive) => {
      if (directory === '/workspace/site' && recursive === true) {
        return Promise.resolve(['assets', 'assets/a.png', 'assets/b.png', 'index.html']);
      }
      return originalList(directory, recursive);
    };

    await harness.service.convert({
      source: { type: 'html', path: '/workspace/site' },
      target: { type: 'image' },
      output: { path: '/workspace/out/site.png' },
    });

    const imageCall = harness.imageCalls[0] as { input: { assets: Record<string, Uint8Array> } };
    expect(Object.keys(imageCall.input.assets).sort()).toEqual(['assets/a.png', 'assets/b.png']);
  });
});

describe('取消与错误归一', () => {
  it('预取消：任何端口调用前以 BRIDGE_CANCELLED 收口', async () => {
    const harness = createHarness({ '/workspace/demo.card': 'card' });
    const controller = new AbortController();
    controller.abort();
    let caught: unknown;
    try {
      await harness.service.convert(cardToHtmlRequest, { signal: controller.signal });
    } catch (error) {
      caught = error;
    }
    expect((caught as ChipsError).code).toBe(BRIDGE_CANCELLED);
    expect(harness.cardCalls).toHaveLength(0);
  });

  it('腿间取消：以 BRIDGE_CANCELLED 收口且暂存清理', async () => {
    const file = createFakeFilePort({ '/workspace/demo.card': 'card' });
    const controller = new AbortController();
    const cardConverter: ICardToHtmlPort = {
      cardToHtml(input) {
        // 提供方在请求的中间目录落入口文件
        file.store.set(`${input.output.path}/index.html`, '<html></html>');
        return Promise.resolve({ outputPath: input.output.path, entryFile: 'index.html' });
      },
    };
    const imagePort: IHtmlToImagePort = {
      htmlToImage: () => {
        controller.abort();
        return Promise.resolve({ bytes: new Uint8Array([1]) });
      },
    };
    const service = createFileConversionService({
      siblings: {
        cardConverter,
        htmlToPdf: { htmlToPdf: () => Promise.reject(new Error('unreachable')) },
        htmlToImage: imagePort,
      },
      file,
      logger,
    });

    let caught: unknown;
    try {
      await service.convert(
        {
          source: { type: 'card', path: '/workspace/demo.card' },
          target: { type: 'image' },
          output: { path: '/workspace/out/demo.png' },
        },
        { signal: controller.signal }
      );
    } catch (error) {
      caught = error;
    }
    expect((caught as ChipsError).code).toBe(BRIDGE_CANCELLED);
    const leftovers = [...file.store.keys()].filter((path) => path.includes('.chips-file-conversion-'));
    expect(leftovers).toEqual([]);
  });

  it('提供方 ChipsError 原样透传（直连消费方按原码分支）', async () => {
    const harness = createHarness({ '/workspace/demo.card': 'card' });
    harness.setCardOutcome({ entryFile: 'index.html', asDirectory: true });
    const original = new ChipsError({ code: 'CONVERTER_OUTPUT_TOO_LARGE', message: '超限。', details: { bytes: 9 } });
    harness.setPdfOutcome({ error: original });

    let caught: unknown;
    try {
      await harness.service.convert({
        source: { type: 'card', path: '/workspace/demo.card' },
        target: { type: 'pdf' },
        output: { path: '/workspace/out/demo.pdf' },
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBe(original);
  });

  it('提供方非 ChipsError 归一为 CONVERTER_RENDER_FAILED 并携带 cause', async () => {
    const harness = createHarness({ '/workspace/demo.card': 'card' });
    harness.setCardOutcome({ entryFile: 'index.html', asDirectory: true });
    harness.setPdfOutcome({ error: new Error('boom') });

    let caught: unknown;
    try {
      await harness.service.convert({
        source: { type: 'card', path: '/workspace/demo.card' },
        target: { type: 'pdf' },
        output: { path: '/workspace/out/demo.pdf' },
      });
    } catch (error) {
      caught = error;
    }
    expect((caught as ChipsError).code).toBe(CONVERTER_RENDER_FAILED);
    expect((caught as ChipsError).details).toMatchObject({
      capability: 'content-converter.html-to-pdf',
      cause: 'boom',
    });
  });

  it('来源卡片缺失：存在性预检归一为 source-not-found', async () => {
    const harness = createHarness();
    let caught: unknown;
    try {
      await harness.service.convert(cardToHtmlRequest);
    } catch (error) {
      caught = error;
    }
    expect((caught as ChipsError).code).toBe(CONVERTER_INPUT_UNSUPPORTED);
    expect((caught as ChipsError).details).toMatchObject({ reason: 'source-not-found' });
  });

  it('提供方谎报产物（暂存缺失）按 CONVERTER_RENDER_FAILED 收口', async () => {
    const harness = createHarness({ '/workspace/demo.card': 'card' });
    harness.setCardOutcome({ entryFile: 'index.html', write: false });

    let caught: unknown;
    try {
      await harness.service.convert(cardToHtmlRequest);
    } catch (error) {
      caught = error;
    }
    expect((caught as ChipsError).code).toBe(CONVERTER_RENDER_FAILED);
    expect((caught as ChipsError).details).toMatchObject({ reason: 'artifact-missing' });
  });
});

describe('提交与回滚（旧 commitStagedFinalOutput 语义）', () => {
  it('发布失败：已备份的旧产物回滚还原，错误原样抛出', async () => {
    const harness = createHarness({ '/workspace/demo.card': 'card', '/workspace/out/demo.html': 'old' });
    harness.setCardOutcome({ entryFile: 'index.html' });
    // 发布腿前置换掉 movePath：暂存 → 终路径失败，随后备份 → 终路径回滚
    const originalMove = harness.file.movePath.bind(harness.file);
    let moveCount = 0;
    harness.file.movePath = (source, target, overwrite) => {
      moveCount += 1;
      if (moveCount === 2) {
        return Promise.reject(new ChipsError({ code: 'FILE_NOT_FOUND', message: `来源不存在：${source}` }));
      }
      return originalMove(source, target, overwrite);
    };

    let caught: unknown;
    try {
      await harness.service.convert({
        ...cardToHtmlRequest,
        output: { path: '/workspace/out/demo.html', overwrite: true },
      });
    } catch (error) {
      caught = error;
    }
    expect((caught as ChipsError).code).toBe('FILE_NOT_FOUND');
    // 回滚后终路径持有旧产物，备份位已清空
    expect(harness.file.store.get('/workspace/out/demo.html')).toBe('old');
    expect(moveCount).toBe(3);
  });

  it('备份失败：发布中止、旧产物原地保留、平台码原样抛出', async () => {
    const harness = createHarness({ '/workspace/demo.card': 'card', '/workspace/out/demo.html': 'old' });
    harness.setCardOutcome({ entryFile: 'index.html' });
    const originalMove = harness.file.movePath.bind(harness.file);
    let moveCount = 0;
    harness.file.movePath = (source, target, overwrite) => {
      moveCount += 1;
      if (moveCount === 1) {
        return Promise.reject(new ChipsError({ code: 'FILE_BUSY', message: '目标占用。' }));
      }
      return originalMove(source, target, overwrite);
    };

    let caught: unknown;
    try {
      await harness.service.convert({
        ...cardToHtmlRequest,
        output: { path: '/workspace/out/demo.html', overwrite: true },
      });
    } catch (error) {
      caught = error;
    }
    expect((caught as ChipsError).code).toBe('FILE_BUSY');
    expect(harness.file.store.get('/workspace/out/demo.html')).toBe('old');
    expect(moveCount).toBe(1);
  });

  it('发布与回滚双失败：以原始发布错误收口（还原失败仅记日志）', async () => {
    const harness = createHarness({ '/workspace/demo.card': 'card', '/workspace/out/demo.html': 'old' });
    harness.setCardOutcome({ entryFile: 'index.html' });
    const originalMove = harness.file.movePath.bind(harness.file);
    let moveCount = 0;
    harness.file.movePath = (source, target, overwrite) => {
      moveCount += 1;
      // 1 备份成功；2 发布失败；3 回滚失败
      if (moveCount >= 2) {
        return Promise.reject(new ChipsError({ code: 'FILE_NOT_FOUND', message: `来源不存在：${source}` }));
      }
      return originalMove(source, target, overwrite);
    };

    let caught: unknown;
    try {
      await harness.service.convert({
        ...cardToHtmlRequest,
        output: { path: '/workspace/out/demo.html', overwrite: true },
      });
    } catch (error) {
      caught = error;
    }
    expect((caught as ChipsError).code).toBe('FILE_NOT_FOUND');
    expect(moveCount).toBe(3);
  });
});

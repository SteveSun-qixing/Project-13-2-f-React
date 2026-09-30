import { describe, expect, it } from 'vitest';

import type { IServiceContext } from '@chips/sdk';

import main from '../src/main.js';
import { CORDIS_SERVICE_NAME, CONTENT_CAPABILITY_ID } from '../src/descriptor.js';
import type { IHtmlToImageService } from '../src/types.js';

function createFakeContext(): { ctx: IServiceContext; provided: Map<string, unknown> } {
  const provided = new Map<string, unknown>();
  const ctx = {
    pluginId: 'chips.service.htmltoimage',
    logger: {
      debug: () => undefined,
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined,
    },
    provide: (name: string, service: unknown) => {
      provided.set(name, service);
    },
  } as unknown as IServiceContext;
  return { ctx, provided };
}

describe('HtmlToImageServicePlugin', () => {
  it('start 注册 content-html-to-image Cordis 服务', async () => {
    const { ctx, provided } = createFakeContext();
    await main.start(ctx);
    expect(provided.has(CORDIS_SERVICE_NAME)).toBe(true);
    const service = provided.get(CORDIS_SERVICE_NAME) as IHtmlToImageService;
    expect(service.capabilityId).toBe(CONTENT_CAPABILITY_ID);
  });

  it('注册的服务暴露原子操作 htmlToImage', async () => {
    const { ctx, provided } = createFakeContext();
    await main.start(ctx);
    const service = provided.get(CORDIS_SERVICE_NAME) as IHtmlToImageService;
    expect(typeof service.htmlToImage).toBe('function');
  });

  it('stop 幂等且不抛出', async () => {
    await main.stop();
    await main.stop();
  });

  it('health 返回 true', async () => {
    await expect(main.health()).resolves.toBe(true);
  });

  it('未绑定渲染承载时操作按已登记码收口', async () => {
    const { ctx, provided } = createFakeContext();
    await main.start(ctx);
    const service = provided.get(CORDIS_SERVICE_NAME) as IHtmlToImageService;
    await expect(service.htmlToImage({ html: '<p></p>' })).rejects.toMatchObject({
      code: 'CONVERTER_RENDER_FAILED',
      details: { reason: 'RENDER_CARRIER_UNBOUND' },
    });
  });
});

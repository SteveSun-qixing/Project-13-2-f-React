/**
 * 服务入口与插件契约断言：输入校验、错误面词表、取消语义、
 * IServicePlugin 生命周期（start 提供 / stop 幂等 / health 只读）。
 */

import { describe, expect, it, vi } from 'vitest';
import { ChipsError } from '@chips/sdk';
import { createMarkdownService } from '../src/service.js';
import { createMarkdownPlugin, MARKDOWN_SERVICE_NAME } from '../src/plugin.js';
import { MAX_MARKDOWN_INPUT_LENGTH } from '../src/limits.js';
import type { IMarkdownService } from '../src/types.js';
import type { IServiceContext } from '@chips/sdk';

const service = createMarkdownService();

// 谓词必须返回布尔（vitest `toSatisfy` 签名为 `(value: unknown) => boolean`，且实现按
// 返回值判定通过与否，无返回值恒判失败）；三条断言全部通过后才返回 true，断言强度不变。
function expectChipsError(code: string): (error: unknown) => boolean {
  return (error: unknown) => {
    expect(error).toBeInstanceOf(ChipsError);
    const chipsError = error as ChipsError;
    expect(chipsError.code).toBe(code);
    expect(chipsError.message.length).toBeGreaterThan(0);
    return true;
  };
}

describe('输入校验与错误面（只复用既有词表，不新增错误码）', () => {
  it('非对象输入按 BRIDGE_INVALID_INPUT 收口', async () => {
    await expect(
      service.renderHtml(null as unknown as Parameters<typeof service.renderHtml>[0])
    ).rejects.toSatisfy(expectChipsError('BRIDGE_INVALID_INPUT'));
    await expect(
      service.parseBlocks('文本' as unknown as Parameters<typeof service.parseBlocks>[0])
    ).rejects.toSatisfy(expectChipsError('BRIDGE_INVALID_INPUT'));
  });

  it('markdown 字段非字符串按 BRIDGE_INVALID_INPUT 收口', async () => {
    await expect(
      service.renderHtml({ markdown: 42 as unknown as string })
    ).rejects.toSatisfy(expectChipsError('BRIDGE_INVALID_INPUT'));
  });

  it('超过长度上限按 BRIDGE_INVALID_INPUT 收口，details 只含长度诊断', async () => {
    const oversized = 'a'.repeat(MAX_MARKDOWN_INPUT_LENGTH + 1);
    const promise = service.renderHtml({ markdown: oversized });
    await expect(promise).rejects.toSatisfy(expectChipsError('BRIDGE_INVALID_INPUT'));
    try {
      await service.renderHtml({ markdown: oversized });
    } catch (error) {
      const chipsError = error as ChipsError;
      expect(chipsError.details).toEqual({
        length: MAX_MARKDOWN_INPUT_LENGTH + 1,
        maxLength: MAX_MARKDOWN_INPUT_LENGTH,
      });
    }
  });

  it('上限边界值（恰好等于上限）可正常渲染', async () => {
    const boundary = 'a'.repeat(MAX_MARKDOWN_INPUT_LENGTH);
    await expect(service.renderHtml({ markdown: boundary })).resolves.toMatchObject({
      html: expect.stringContaining('<p>') as string,
    });
  });

  it('选项为非对象按 BRIDGE_INVALID_INPUT 收口', async () => {
    await expect(
      service.renderHtml({ markdown: 'x', options: 'breaks' as unknown as undefined })
    ).rejects.toSatisfy(expectChipsError('BRIDGE_INVALID_INPUT'));
  });

  it('选项未知键按 BRIDGE_INVALID_INPUT 收口（选项面拒绝静默扩张）', async () => {
    await expect(
      service.renderHtml({
        markdown: 'x',
        options: { html: true } as unknown as Record<string, never>,
      })
    ).rejects.toSatisfy(expectChipsError('BRIDGE_INVALID_INPUT'));
  });

  it('选项值类型错误按 BRIDGE_INVALID_INPUT 收口', async () => {
    await expect(
      service.renderHtml({ markdown: 'x', options: { breaks: 1 as unknown as boolean } })
    ).rejects.toSatisfy(expectChipsError('BRIDGE_INVALID_INPUT'));
  });

  it('取消信号在入口安全点生效，错误码 BRIDGE_CANCELLED', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      service.renderHtml({ markdown: '# x' }, { signal: controller.signal })
    ).rejects.toSatisfy(expectChipsError('BRIDGE_CANCELLED'));
    await expect(
      service.parseBlocks({ markdown: '# x' }, { signal: controller.signal })
    ).rejects.toSatisfy(expectChipsError('BRIDGE_CANCELLED'));
  });
});

describe('插件契约（IServicePlugin）', () => {
  function createContextStub(): { ctx: IServiceContext; provided: Map<string, unknown> } {
    const provided = new Map<string, unknown>();
    const ctx = {
      pluginId: 'chips.service.markdown',
      provide: vi.fn((name: string, serviceObject: unknown) => {
        provided.set(name, serviceObject);
      }),
    } as unknown as IServiceContext;
    return { ctx, provided };
  }

  it('start 以 Cordis 服务提供 markdown 服务名，且不注册 Bridge 能力', async () => {
    const plugin = createMarkdownPlugin();
    const { ctx, provided } = createContextStub();
    await plugin.start(ctx);
    expect(provided.has(MARKDOWN_SERVICE_NAME)).toBe(true);
    const serviceObject = provided.get(MARKDOWN_SERVICE_NAME) as Record<string, unknown>;
    expect(typeof serviceObject.renderHtml).toBe('function');
    expect(typeof serviceObject.parseBlocks).toBe('function');
  });

  it('stop 幂等：重复调用为 no-op 不抛出', async () => {
    const plugin = createMarkdownPlugin();
    await expect(plugin.stop()).resolves.toBeUndefined();
    await expect(plugin.stop()).resolves.toBeUndefined();
  });

  it('health 只读恒可用且无副作用', async () => {
    const plugin = createMarkdownPlugin();
    await expect(plugin.health()).resolves.toBe(true);
    await expect(plugin.health()).resolves.toBe(true);
  });

  it('插件提供的对象全方法可直接调用（无 this 绑定要求）', async () => {
    const plugin = createMarkdownPlugin();
    const { ctx, provided } = createContextStub();
    await plugin.start(ctx);
    const serviceObject = provided.get(MARKDOWN_SERVICE_NAME) as IMarkdownService;
    // 从对象上解构方法后调用，验证不依赖 this。
    const { renderHtml } = serviceObject;
    await expect(renderHtml({ markdown: '直接调用' })).resolves.toMatchObject({
      html: '<p>直接调用</p>\n',
    });
  });
});

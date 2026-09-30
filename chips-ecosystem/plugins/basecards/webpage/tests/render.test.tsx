import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import type { BaseCardView, IBaseCardEditorEventMap } from '@chips/sdk';
import {
  CONTENT_HEIGHT_MESSAGE_TYPE,
  DEFAULT_CONTENT,
  VIEWPORT_MESSAGE_TYPE,
  buildContent,
  type IWebpageContent,
} from '../src/config';
import { createInitialContent } from '../src/main';
import { renderEditor, renderView } from '../src/render';

function createBasecard(
  content: Record<string, unknown>,
  overrides: Partial<BaseCardView> = {},
): BaseCardView {
  return {
    kind: 'basecard',
    node_id: 'a1B2c3D4e5',
    card_type: 'base.webpage',
    content,
    revision: 1,
    card: {
      card_id: 'z9Y8x7W6v5',
      name: '示例卡片',
      chip_standards_version: '1.0.0',
      cover_ratio: '3:2',
      tags: [],
    },
    ...overrides,
  };
}

function contentFrom(partial: Partial<IWebpageContent>): Record<string, unknown> {
  return buildContent({ ...DEFAULT_CONTENT, ...partial });
}

function bundleContentPartial(): Partial<IWebpageContent> {
  return {
    source_type: 'bundle',
    source_url: '',
    bundle_root: 'web-bundle',
    resource_paths: ['web-bundle/index.html'],
  };
}

function bundleContent(): Record<string, unknown> {
  return contentFrom(bundleContentPartial());
}

/** 在测试文档注入受管基址（渲染帧 `<base href="{resourceBase}">` 的等效物）。 */
function attachResourceBase(baseHref: string): void {
  const base = document.createElement('base');
  base.setAttribute('href', baseHref);
  document.head.appendChild(base);
}

/**
 * jsdom 未实现带 `src` 的嵌套浏览上下文（`contentWindow` 为 null）：
 * 补齐最小帧窗口面（postMessage / addEventListener / removeEventListener），
 * 不 mock 任何插件业务行为。
 */
function ensureFrameWindow(frame: HTMLIFrameElement): {
  postMessage: ReturnType<typeof vi.fn>;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
} {
  const existing = (frame as { contentWindow?: unknown }).contentWindow;
  if (existing) {
    return existing as ReturnType<typeof ensureFrameWindow>;
  }
  const stub = {
    postMessage: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  Object.defineProperty(frame, 'contentWindow', { configurable: true, value: stub });
  Object.defineProperty(frame, 'contentDocument', { configurable: true, value: null });
  return stub;
}

/** 经原型原生 setter 写入受控输入值（模拟真实用户输入，绕过 React 变更去重）。 */
function writeInputValue(
  element: HTMLInputElement | HTMLTextAreaElement,
  value: string,
): void {
  // 原型上的原生 value setter 是唯一正规提取入口（lib 静态方法引用，不消费 this）。
  const proto =
    element instanceof HTMLTextAreaElement
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(element, value);
}

function queryWebpageInput(container: HTMLElement, label: string): HTMLInputElement | null {
  return container.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`);
}

function reportContentHeight(frame: HTMLIFrameElement, contentHeight: number): void {
  window.dispatchEvent(
    new MessageEvent('message', {
      source: (frame as { contentWindow: unknown }).contentWindow as MessageEvent['source'],
      data: {
        type: CONTENT_HEIGHT_MESSAGE_TYPE,
        payload: { version: 1, contentHeight },
      },
    }),
  );
}

/** 让 microtask/宏任务链（能力调用承诺、表单异步校验）在 act 内收敛。 */
async function settleAsyncWork(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.head.querySelector('base')?.remove();
});

describe('renderView：空态与地址来源', () => {
  it('空来源呈现简体中文空态提示', () => {
    const container = document.createElement('div');
    const dispose = renderView(createBasecard(createInitialContent()), container);
    expect(typeof dispose).toBe('function');
    expect(container.querySelector('[data-chips-webpage-view]')).not.toBeNull();
    expect(container.textContent).toContain('暂无网页内容');
    expect(container.querySelector('iframe')).toBeNull();
  });

  it('合法地址渲染收紧沙箱 iframe 并同步提交首帧', () => {
    const container = document.createElement('div');
    renderView(
      createBasecard(contentFrom({ source_url: 'https://chips.example.com/page' })),
      container,
    );
    const frame = container.querySelector('iframe');
    expect(frame).not.toBeNull();
    expect(frame?.getAttribute('src')).toBe('https://chips.example.com/page');
    expect(frame?.getAttribute('sandbox')).toBe('allow-scripts allow-forms allow-popups');
    expect(frame?.getAttribute('sandbox')).not.toContain('allow-same-origin');
    expect(frame?.getAttribute('title')).toBe('网页内容');
    expect(container.textContent).toContain('网页加载中');
  });

  it('非法地址呈现错误提示且不建帧', () => {
    const container = document.createElement('div');
    renderView(createBasecard(contentFrom({ source_url: 'javascript:alert(1)' })), container);
    expect(container.querySelector('iframe')).toBeNull();
    expect(container.textContent).toContain('网页地址不合法');
  });

  it('帧加载未在时限内完成时呈现拒绝嵌入提示（fixed 视口保持 7:16）', async () => {
    vi.useFakeTimers();
    try {
      const container = document.createElement('div');
      renderView(
        createBasecard(contentFrom({ source_url: 'https://chips.example.com/page' })),
        container,
      );
      act(() => {}); // 量测效果挂载（在假时钟上装载 10s 超时臂）
      await vi.advanceTimersByTimeAsync(10_000);
      act(() => {});
      expect(container.textContent).toContain('该网页禁止被 iframe 嵌入');
      const viewport = container.querySelector<HTMLElement>('[data-chips-webpage-viewport]');
      expect(viewport?.style.height).toBe('1463px');
    } finally {
      vi.useRealTimers();
    }
  });

  it('load 时向帧窗口同步下发视口协议载荷', () => {
    const container = document.createElement('div');
    renderView(
      createBasecard(contentFrom({ source_url: 'https://chips.example.com/page' })),
      container,
    );
    const frame = container.querySelector('iframe');
    expect(frame).not.toBeNull();
    const frameWindow = ensureFrameWindow(frame!);
    frame!.dispatchEvent(new Event('load'));
    // 当前量测宽度取兜底 640（jsdom 容器宽度 0）；fixed 视口高 1463、量测未收敛前 scrollMode 为 false
    expect(frameWindow.postMessage).toHaveBeenCalledWith(
      {
        type: VIEWPORT_MESSAGE_TYPE,
        payload: {
          version: 1,
          displayMode: 'fixed',
          fixedRatio: '7:16',
          width: 640,
          height: 1463,
          baseHeight: 1463,
          maxHeight: 1463,
          scrollMode: false,
        },
      },
      '*',
    );
  });

  it('更新调用覆盖旧内容且释放句柄幂等', () => {
    const container = document.createElement('div');
    const dispose = renderView(createBasecard(createInitialContent()), container);
    expect(container.textContent).toContain('暂无网页内容');
    renderView(
      createBasecard(contentFrom({ source_url: 'https://chips.example.com/page' }), { revision: 2 }),
      container,
    );
    expect(container.textContent).not.toContain('暂无网页内容');
    expect(container.querySelectorAll('iframe').length).toBe(1);
    dispose();
    dispose();
  });

  it('释放后清空容器，迟到的内容高度回报不再触发改动', async () => {
    attachResourceBase('chips-resource://card-7f3a/');
    const container = document.createElement('div');
    const dispose = renderView(
      createBasecard(contentFrom({ ...bundleContentPartial(), display_mode: 'free' })),
      container,
    );
    await settleAsyncWork(); // src 臂承诺链回落
    expect(container.querySelector('iframe')).not.toBeNull();
    dispose();
    expect(container.querySelector('[data-chips-webpage-view]')).toBeNull();
    expect(() =>
      window.dispatchEvent(
        new MessageEvent('message', {
          source: null,
          data: {
            type: CONTENT_HEIGHT_MESSAGE_TYPE,
            payload: { version: 1, contentHeight: 9000 },
          },
        }),
      ),
    ).not.toThrow();
  });
});

describe('renderView：视口同步与高度自适应', () => {
  it('内容高度回报驱动 free 模式高度展开', async () => {
    attachResourceBase('chips-resource://card-7f3a/');
    const container = document.createElement('div');
    renderView(
      createBasecard(contentFrom({ ...bundleContentPartial(), display_mode: 'free' })),
      container,
    );
    await settleAsyncWork(); // src 臂回落与量测效果挂载
    const frame = container.querySelector('iframe');
    expect(frame).not.toBeNull();
    ensureFrameWindow(frame!);
    act(() => {
      frame!.dispatchEvent(new Event('load'));
    });
    act(() => {
      reportContentHeight(frame!, 5000);
    });
    const viewport = container.querySelector<HTMLElement>('[data-chips-webpage-viewport]');
    expect(viewport?.style.height).toBe('5000px');
    expect(viewport?.className).not.toContain('chips-webpage-card__viewport--scroll');
  });

  it('内容高度超过宽度 20 倍时转滚动并封顶', async () => {
    attachResourceBase('chips-resource://card-7f3a/');
    const container = document.createElement('div');
    renderView(
      createBasecard(contentFrom({ ...bundleContentPartial(), display_mode: 'free' })),
      container,
    );
    await settleAsyncWork();
    const frame = container.querySelector('iframe');
    ensureFrameWindow(frame!);
    act(() => {
      frame!.dispatchEvent(new Event('load'));
    });
    act(() => {
      reportContentHeight(frame!, 20000);
    });
    const viewport = container.querySelector<HTMLElement>('[data-chips-webpage-viewport]');
    expect(viewport?.style.height).toBe('12800px');
    expect(viewport?.className).toContain('chips-webpage-card__viewport--scroll');
  });

  it('非帧来源或非协议消息不触发高度改动', () => {
    const container = document.createElement('div');
    renderView(
      createBasecard(
        contentFrom({ source_url: 'https://chips.example.com/page', display_mode: 'free' }),
      ),
      container,
    );
    act(() => {});
    window.dispatchEvent(
      new MessageEvent('message', {
        source: null,
        data: {
          type: CONTENT_HEIGHT_MESSAGE_TYPE,
          payload: { version: 1, contentHeight: 5000 },
        },
      }),
    );
    window.dispatchEvent(
      new MessageEvent('message', {
        source: null,
        data: { type: 'chips:other', payload: { contentHeight: 5000 } },
      }),
    );
    expect(container.querySelector('iframe')).not.toBeNull();
    expect(
      container.querySelector<HTMLElement>('[data-chips-webpage-viewport]')?.style.height,
    ).not.toBe('5000px');
  });
});

describe('renderView：bundle 来源双臂', () => {
  it('resource:read 可用时经 srcdoc 臂加载（base 指向包目录、桥脚本注入）', async () => {
    const request = vi.fn().mockResolvedValue({
      uri: 'chips-resource://card-7f3a/web-bundle/index.html',
      mimeType: 'text/html',
      size: 96,
      data: new TextEncoder().encode(
        '<!doctype html><html><head><title>bundle</title></head><body><main>bundle</main></body></html>',
      ),
    });
    vi.stubGlobal('chips', { request, subscribe: vi.fn(), resource: vi.fn() });
    attachResourceBase('chips-resource://card-7f3a/');

    const container = document.createElement('div');
    renderView(createBasecard(bundleContent()), container);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0)); // resource:read 承诺链与重渲染收敛
    });
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith('resource:read', {
      uri: 'chips-resource://card-7f3a/web-bundle/index.html',
    });
    const frame = container.querySelector('iframe');
    expect(frame).not.toBeNull();
    const srcdoc = frame?.getAttribute('srcdoc') ?? '';
    expect(srcdoc).toContain('<base href="chips-resource://card-7f3a/web-bundle/" />');
    expect(srcdoc).toContain('<title>bundle</title>');
    expect(srcdoc).toContain('<main>bundle</main>');
    expect(srcdoc).toContain(VIEWPORT_MESSAGE_TYPE);
    expect(frame?.getAttribute('src')).toBeNull();
  });

  it('resource:read 拒绝时回退帧内资源协议 src 臂', async () => {
    const request = vi.fn().mockRejectedValue(new Error('RESOURCE_PERMISSION_DENIED'));
    vi.stubGlobal('chips', { request, subscribe: vi.fn(), resource: vi.fn() });
    attachResourceBase('chips-resource://card-7f3a/');

    const container = document.createElement('div');
    renderView(createBasecard(bundleContent()), container);
    await settleAsyncWork(); // resource:read 拒绝承诺链收敛后回退 src 臂
    const frame = container.querySelector('iframe');
    expect(frame).not.toBeNull();
    expect(frame?.getAttribute('src')).toBe('chips-resource://card-7f3a/web-bundle/index.html');
    expect(frame?.getAttribute('srcdoc')).toBeNull();
  });

  it('能力通道不可用（渲染帧未注入 chips）时回退 src 臂', async () => {
    attachResourceBase('chips-resource://card-7f3a/');
    expect((window as { chips?: unknown }).chips).toBeUndefined();

    const container = document.createElement('div');
    renderView(createBasecard(bundleContent()), container);
    await settleAsyncWork(); // SDK_BRIDGE_UNAVAILABLE 异步拒绝后回退 src 臂
    const frame = container.querySelector('iframe');
    expect(frame?.getAttribute('src')).toBe('chips-resource://card-7f3a/web-bundle/index.html');
  });

  it('无受管基址（无法解析包内入口）时诚实呈现加载失败', () => {
    expect(document.baseURI).not.toContain('chips-resource');
    const container = document.createElement('div');
    renderView(createBasecard(bundleContent()), container);
    act(() => {});
    expect(container.querySelector('iframe')).toBeNull();
    expect(container.textContent).toContain('网页包加载失败');
  });
});

// ---------- 编辑态 ----------

function collectEvents(editor: ReturnType<typeof renderEditor>): {
  changes: IBaseCardEditorEventMap['change'][];
  dirties: IBaseCardEditorEventMap['dirty'][];
} {
  const changes: IBaseCardEditorEventMap['change'][] = [];
  const dirties: IBaseCardEditorEventMap['dirty'][] = [];
  editor.subscribe('change', (payload) => {
    changes.push(payload);
  });
  editor.subscribe('dirty', (payload) => {
    dirties.push(payload);
  });
  return { changes, dirties };
}

describe('renderEditor', () => {
  it('挂载后呈现编辑表单，getChange 初始为 null', () => {
    const container = document.createElement('div');
    const editor = renderEditor(createBasecard(createInitialContent()), container);
    expect(container.querySelector('form')).not.toBeNull();
    expect(queryWebpageInput(container, '网页地址')).not.toBeNull();
    expect(editor.isDirty()).toBe(false);
    expect(editor.getChange()).toBeNull();
    editor.dispose();
  });

  it('输入合法网址即发布 flat 内容 replace 变更并标记 dirty', () => {
    const container = document.createElement('div');
    const editor = renderEditor(createBasecard(createInitialContent()), container);
    const { changes, dirties } = collectEvents(editor);
    const input = queryWebpageInput(container, '网页地址');
    expect(input).not.toBeNull();
    act(() => {
      writeInputValue(input!, 'https://chips.example.com/page');
      input!.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const change = editor.getChange();
    expect(change).not.toBeNull();
    expect(change!.kind).toBe('replace');
    const content = change!.kind === 'replace' ? change!.content : {};
    expect(content['card_type']).toBe('base.webpage');
    expect(content['source_type']).toBe('url');
    expect(content['source_url']).toBe('https://chips.example.com/page');
    expect(content['bundle_root']).toBe('');
    expect(content['entry_file']).toBe('index.html');
    expect(content['fixed_ratio']).toBe('7:16');
    expect(content['max_height_ratio']).toBe(20);
    expect(editor.isDirty()).toBe(true);
    expect(changes.length).toBe(1);
    expect(dirties).toEqual([{ isDirty: true }]);
    editor.dispose();
  });

  it('非法网址呈现行内错误且不发布变更', async () => {
    const container = document.createElement('div');
    const editor = renderEditor(createBasecard(createInitialContent()), container);
    const { changes } = collectEvents(editor);
    const input = queryWebpageInput(container, '网页地址');
    act(() => {
      writeInputValue(input!, '不是地址');
      input!.dispatchEvent(new Event('input', { bubbles: true }));
    });
    // rc-field-form 异步校验链收敛（antd v6 校验与提示渲染需多轮宏任务）；全程置于 act 内
    await act(async () => {
      for (let round = 0; round < 20; round += 1) {
        if (container.textContent.includes('请输入合法的 http(s) 网页地址')) {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
    });
    expect(editor.getChange()).toBeNull();
    expect(changes.length).toBe(0);
    editor.dispose();
  });

  it('切换显示模式发布 free 变更', () => {
    const container = document.createElement('div');
    const editor = renderEditor(
      createBasecard(contentFrom({ source_url: 'https://chips.example.com/page' })),
      container,
    );
    const inputs = container.querySelectorAll<HTMLInputElement>('.ant-segmented-item-input');
    expect(inputs.length).toBeGreaterThanOrEqual(2);
    act(() => {
      inputs[1]!.click();
    });
    const change = editor.getChange();
    expect(change).not.toBeNull();
    const content = change!.kind === 'replace' ? change!.content : {};
    expect(content['display_mode']).toBe('free');
    editor.dispose();
  });

  it('切换 bundle 模式后维护安全路径与资源清单，完整即发布', () => {
    const container = document.createElement('div');
    const editor = renderEditor(createBasecard(createInitialContent()), container);
    const inputs = container.querySelectorAll<HTMLInputElement>('.ant-segmented-item-input');
    act(() => {
      inputs[3]!.click();
    });
    const rootInput = queryWebpageInput(container, '网页目录');
    expect(rootInput).not.toBeNull();
    const textarea = container.querySelector<HTMLTextAreaElement>('textarea');
    expect(textarea).not.toBeNull();

    act(() => {
      writeInputValue(rootInput!, './web-bundle');
      rootInput!.dispatchEvent(new Event('input', { bubbles: true }));
    });
    // 清单缺入口文件：不发布
    expect(editor.getChange()).toBeNull();

    act(() => {
      writeInputValue(
        textarea!,
        'web-bundle/assets/b.css\n./web-bundle/index.html\nweb-bundle/assets/b.css\n',
      );
      textarea!.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const change = editor.getChange();
    expect(change).not.toBeNull();
    const payload = change!.kind === 'replace' ? change!.content : {};
    expect(payload['source_type']).toBe('bundle');
    expect(payload['bundle_root']).toBe('web-bundle');
    expect(payload['entry_file']).toBe('index.html');
    expect(payload['resource_paths']).toEqual([
      'web-bundle/assets/b.css',
      'web-bundle/index.html',
    ]);
    editor.dispose();
  });

  it('清除来源发布空 url 配置变更', () => {
    const container = document.createElement('div');
    const editor = renderEditor(createBasecard(bundleContent()), container);
    const clearButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.includes('清除来源'),
    );
    expect(clearButton).not.toBeNull();
    act(() => {
      clearButton!.click();
    });
    const change = editor.getChange();
    expect(change).not.toBeNull();
    const content = change!.kind === 'replace' ? change!.content : {};
    expect(content['source_type']).toBe('url');
    expect(content['source_url']).toBe('');
    expect(content['bundle_root']).toBe('');
    expect(content['resource_paths']).toEqual([]);
    editor.dispose();
  });

  it('markCommitted 以新 revision 清除待提交变更', () => {
    const container = document.createElement('div');
    const editor = renderEditor(createBasecard(createInitialContent()), container);
    const input = queryWebpageInput(container, '网页地址');
    act(() => {
      writeInputValue(input!, 'https://chips.example.com/page');
      input!.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(editor.isDirty()).toBe(true);
    editor.markCommitted(2);
    expect(editor.isDirty()).toBe(false);
    expect(editor.getChange()).toBeNull();
    editor.markCommitted(1);
    editor.dispose();
  });

  it('dispose 后丢弃待提交变更且不再发布事件', () => {
    const container = document.createElement('div');
    const editor = renderEditor(createBasecard(createInitialContent()), container);
    const { changes } = collectEvents(editor);
    const input = queryWebpageInput(container, '网页地址');
    editor.dispose();
    expect(editor.state).toBe('disposed');
    act(() => {
      writeInputValue(input!, 'https://chips.example.com/page');
      input!.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(editor.getChange()).toBeNull();
    expect(changes.length).toBe(0);
    editor.dispose();
  });

  it('dispose 后同一容器可重新挂载编辑器，不并存两个编辑器', () => {
    const container = document.createElement('div');
    const first = renderEditor(createBasecard(createInitialContent()), container);
    first.dispose();
    const second = renderEditor(createBasecard(createInitialContent()), container);
    expect(second).not.toBe(first);
    expect(container.querySelectorAll('form').length).toBe(1);
    second.dispose();
  });
});

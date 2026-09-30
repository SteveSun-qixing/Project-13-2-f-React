import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BaseCardView } from '@chips/sdk';
import { DEFAULT_CONFIG, buildContent, validateConfig } from '../src/config';
import { renderEditor, renderView } from '../src/render';
import type { IBaseCardEditorEventMap } from '@chips/sdk';

/**
 * 经 HTMLInputElement 原型的原生 value setter 写值：
 * React 受控输入在实例上覆盖了 value 属性，直接赋值会被变更追踪去重；
 * 必须经原型原生 setter 携带接收器写入才能触发 onChange（模拟真实用户输入）。
 */
function writeInputValue(input: HTMLInputElement, value: string): void {
  // Object.getOwnPropertyDescriptor 是 lib 静态方法引用（不消费 this），
  // 提取原生 setter 的唯一正规入口，此处 unbound-method 属误报，定向豁免。
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')
    ?.set;
  setter?.call(input, value);
}

function createBasecard(
  config: Record<string, unknown>,
  overrides: Partial<BaseCardView> = {}
): BaseCardView {
  return {
    kind: 'basecard',
    node_id: 'a1B2c3D4e5',
    card_type: 'base.hyperlink',
    content: buildContent({ ...DEFAULT_CONFIG, ...config }),
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

const FULL_CONFIG = {
  anchor_text: '薯片生态官网',
  url: 'https://chips.example.com',
  description: '官网首页',
  icon_url: '',
  display_density: 'comfortable' as const,
  show_security_hint: true,
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('renderView', () => {
  it('呈现锚点文本、主机名与安全提示，同步提交首帧', () => {
    const container = document.createElement('div');
    const dispose = renderView(createBasecard(FULL_CONFIG), container);
    expect(typeof dispose).toBe('function');
    expect(container.querySelector('[data-card-type="base.hyperlink"]')).not.toBeNull();
    expect(container.textContent).toContain('薯片生态官网');
    expect(container.textContent).toContain('chips.example.com');
    expect(container.textContent).toContain('安全的 HTTPS 链接');
    expect(container.querySelector('button')).not.toBeNull();
  });

  it('非法 URL 呈现不可打开状态且不提供打开按钮', () => {
    const container = document.createElement('div');
    renderView(createBasecard({ ...FULL_CONFIG, url: '不是地址' }), container);
    expect(container.querySelector('button')).toBeNull();
    expect(container.textContent).toContain('链接地址无效，无法打开');
  });

  it('空配置回退默认配置并提示未填写链接地址', () => {
    const container = document.createElement('div');
    renderView(createBasecard({}), container);
    expect(container.textContent).toContain('未命名链接');
    expect(container.textContent).toContain('尚未填写链接地址');
  });

  it('关闭安全提示时不呈现提示文案', () => {
    const container = document.createElement('div');
    renderView(createBasecard({ ...FULL_CONFIG, show_security_hint: false }), container);
    expect(container.textContent).not.toContain('安全的 HTTPS 链接');
  });

  it('点击打开按钮经 SDK chips 客户端真调用 shell:openExternal', async () => {
    const request = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('chips', { request, subscribe: vi.fn(), resource: vi.fn() });
    const container = document.createElement('div');
    renderView(createBasecard(FULL_CONFIG), container);
    const button = container.querySelector('button');
    expect(button).not.toBeNull();
    button!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith('shell:openExternal', {
      url: 'https://chips.example.com/',
    });
    expect(container.querySelector('[role="status"]')).toBeNull();
  });

  it('打开被拒绝时呈现行内错误提示，不伪造成功', async () => {
    const request = vi.fn().mockRejectedValue(new Error('unavailable'));
    vi.stubGlobal('chips', { request, subscribe: vi.fn(), resource: vi.fn() });
    const container = document.createElement('div');
    renderView(createBasecard(FULL_CONFIG), container);
    container.querySelector('button')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await vi.waitFor(() => {
      expect(container.querySelector('[role="status"]')?.textContent).toContain(
        '链接暂时无法打开'
      );
    });
  });

  it('更新调用覆盖旧内容且释放句柄幂等', () => {
    const container = document.createElement('div');
    const dispose = renderView(createBasecard(FULL_CONFIG), container);
    renderView(
      createBasecard({ ...FULL_CONFIG, anchor_text: '更新后的标题' }, { revision: 2 }),
      container
    );
    expect(container.textContent).toContain('更新后的标题');
    expect(container.textContent).not.toContain('薯片生态官网');
    dispose();
    dispose();
  });
});

describe('renderEditor', () => {
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

  function setFieldValue(container: HTMLElement, value: string): void {
    const input = container.querySelector<HTMLInputElement>('input');
    expect(input).not.toBeNull();
    writeInputValue(input!, value);
    input!.dispatchEvent(new Event('input', { bubbles: true }));
  }

  it('挂载后容器内呈现编辑表单，getChange 初始为 null', () => {
    const container = document.createElement('div');
    const editor = renderEditor(createBasecard(FULL_CONFIG), container);
    expect(container.querySelector('form')).not.toBeNull();
    expect(container.querySelector('input')).not.toBeNull();
    expect(editor.isDirty()).toBe(false);
    expect(editor.getChange()).toBeNull();
    editor.dispose();
  });

  it('锚点与地址完整时发布 replace 变更并标记 dirty', () => {
    const container = document.createElement('div');
    const editor = renderEditor(createBasecard({}), container);
    const { changes, dirties } = collectEvents(editor);

    setFieldValue(container, '薯片生态官网');
    expect(editor.getChange()).toBeNull();

    const inputs = container.querySelectorAll<HTMLInputElement>('input');
    expect(inputs.length).toBeGreaterThanOrEqual(2);
    const urlInput = inputs[1]!;
    writeInputValue(urlInput, 'https://chips.example.com');
    urlInput.dispatchEvent(new Event('input', { bubbles: true }));

    const change = editor.getChange();
    expect(change).not.toBeNull();
    expect(change!.kind).toBe('replace');
    const content = change!.kind === 'replace' ? change!.content : {};
    expect(content['card_type']).toBe('base.hyperlink');
    expect(validateConfig(content['config'])).toBe(true);
    expect((content['config'] as Record<string, unknown>)['anchor_text']).toBe('薯片生态官网');
    expect(editor.isDirty()).toBe(true);
    expect(changes.length).toBe(1);
    expect(dirties).toEqual([{ isDirty: true }]);
    editor.dispose();
  });

  it('markCommitted 以新 revision 清除待提交变更', () => {
    const container = document.createElement('div');
    const editor = renderEditor(createBasecard({}), container);
    setFieldValue(container, '薯片生态官网');
    const urlInput = container.querySelectorAll<HTMLInputElement>('input')[1]!;
    writeInputValue(urlInput, 'https://chips.example.com');
    urlInput.dispatchEvent(new Event('input', { bubbles: true }));
    expect(editor.isDirty()).toBe(true);

    editor.markCommitted(2);
    expect(editor.isDirty()).toBe(false);
    expect(editor.getChange()).toBeNull();
    editor.markCommitted(1);
    editor.dispose();
  });

  it('dispose 后丢弃待提交变更且不再发布事件', () => {
    const container = document.createElement('div');
    const editor = renderEditor(createBasecard(FULL_CONFIG), container);
    const { changes } = collectEvents(editor);
    const input = container.querySelector<HTMLInputElement>('input');
    expect(input).not.toBeNull();
    editor.dispose();
    expect(editor.state).toBe('disposed');
    writeInputValue(input!, '再改一次');
    input!.dispatchEvent(new Event('input', { bubbles: true }));
    expect(editor.getChange()).toBeNull();
    expect(changes.length).toBe(0);
    editor.dispose();
  });

  it('dispose 后同一容器可重新挂载编辑器，不并存两个编辑器', () => {
    const container = document.createElement('div');
    const first = renderEditor(createBasecard(FULL_CONFIG), container);
    first.dispose();
    const second = renderEditor(createBasecard(FULL_CONFIG), container);
    expect(second).not.toBe(first);
    expect(container.querySelectorAll('form').length).toBe(1);
    second.dispose();
  });
});

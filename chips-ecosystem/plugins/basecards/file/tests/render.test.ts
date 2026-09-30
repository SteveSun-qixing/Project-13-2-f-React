import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BaseCardView, IBaseCardEditorEventMap } from '@chips/sdk';
import { FILE_CATEGORY_COVER_URLS } from '../src/shared/default-covers';
import { CARD_TYPE_ID, DEFAULT_CONFIG, buildContent, readConfig, validateConfig } from '../src/config';
import { renderEditor, renderView } from '../src/render';

/**
 * 经 HTMLInputElement 原生 value setter 写值：React 受控输入在实例上覆盖了 value 属性，
 * 直接赋值会被变更追踪去重；必须经原型原生 setter 携带接收器写入才能触发 onChange。
 */
function writeInputValue(input: HTMLInputElement, value: string): void {
  // Object.getOwnPropertyDescriptor 是 lib 静态方法引用（不消费 this），
  // 提取原生 setter 的唯一正规入口，此处 unbound-method 属误报，定向豁免。
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
}

function createBasecard(
  config: Record<string, unknown>,
  overrides: Partial<BaseCardView> = {}
): BaseCardView {
  return {
    kind: 'basecard',
    node_id: 'a1B2c3D4e5',
    card_type: 'base.file',
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
  file_file: 'docs/季度报告.pdf',
  file_name: '季度报告',
  file_extension: 'pdf',
  cover_image: 'covers/季度报告.png',
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('renderView', () => {
  it('呈现文件名、后缀徽标与自定义封面，同步提交首帧', () => {
    const container = document.createElement('div');
    const dispose = renderView(createBasecard(FULL_CONFIG), container);
    expect(typeof dispose).toBe('function');
    expect(container.querySelector(`[data-card-type="${CARD_TYPE_ID}"]`)).not.toBeNull();
    expect(container.textContent).toContain('季度报告');
    expect(container.textContent).toContain('PDF');
    expect(container.querySelector('button')).not.toBeNull();
    const cover = container.querySelector('img[data-role="file-cover"]');
    expect(cover).not.toBeNull();
    expect((cover as HTMLImageElement).getAttribute('src')).toBe('covers/季度报告.png');
  });

  it('未配置自定义封面时按后缀解析类别使用内置默认封面', () => {
    const container = document.createElement('div');
    renderView(createBasecard({ file_file: 'docs/季度报告.pdf' }), container);
    const cover = container.querySelector('img[data-role="file-cover"]');
    expect(cover).not.toBeNull();
    expect((cover as HTMLImageElement).getAttribute('src')).toBe(
      FILE_CATEGORY_COVER_URLS['document']
    );
  });

  it('全部类别封面向量非空（9 类别逐一回退可达）', () => {
    const samples: Array<[string, keyof typeof FILE_CATEGORY_COVER_URLS]> = [
      ['docx', 'document'],
      ['xlsx', 'spreadsheet'],
      ['pptx', 'presentation'],
      ['zip', 'archive'],
      ['mp3', 'audio'],
      ['mp4', 'video'],
      ['png', 'image'],
      ['txt', 'text'],
      ['tsx', 'code'],
    ];
    for (const [extension, category] of samples) {
      const container = document.createElement('div');
      renderView(createBasecard({ file_file: `f.${extension}` }), container);
      const cover = container.querySelector('img[data-role="file-cover"]');
      expect((cover as HTMLImageElement).getAttribute('src')).toBe(
        FILE_CATEGORY_COVER_URLS[category]
      );
    }
  });

  it('后缀未登记任何类别时回退为带后缀文字的文件图标占位', () => {
    const container = document.createElement('div');
    renderView(createBasecard({ file_file: 'data/x.unknownext' }), container);
    expect(container.querySelector('img[data-role="file-cover"]')).toBeNull();
    const fallback = container.querySelector('svg[data-role="file-cover-fallback"]');
    expect(fallback).not.toBeNull();
    // 徽标展示截断到 4 字符（formatExtensionBadge 口径）。
    expect(fallback?.textContent).toContain('UNKN');
    expect(container.textContent).toContain('UNKN');
  });

  it('未配置文件时呈现空态且不提供打开按钮', () => {
    const container = document.createElement('div');
    renderView(createBasecard({}), container);
    expect(container.querySelector('button')).toBeNull();
    expect(container.textContent).toContain('未命名文件');
    expect(container.textContent).toContain('上传文件后，这里会显示文件基础卡片。');
  });

  it('点击整卡经 SDK chips 客户端真调用 resource:open 且不传业务载荷（01 §6.9）', async () => {
    const request = vi.fn().mockResolvedValue({ mode: 'app' });
    vi.stubGlobal('chips', { request, subscribe: vi.fn(), resource: vi.fn() });
    const container = document.createElement('div');
    renderView(createBasecard(FULL_CONFIG), container);
    const button = container.querySelector<HTMLButtonElement>('button[data-role="file-open"]');
    expect(button).not.toBeNull();
    button!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await vi.waitFor(() => {
      expect(request).toHaveBeenCalledTimes(1);
    });
    await Promise.resolve();
    await Promise.resolve();
    const [capabilityId, input] = request.mock.calls[0] as [string, Record<string, unknown>];
    expect(capabilityId).toBe('resource:open');
    expect(input['intent']).toBe('view');
    const resource = input['resource'] as Record<string, unknown>;
    expect(resource['uri']).toBe('docs/季度报告.pdf');
    expect(resource['mimeType']).toBe('application/pdf');
    expect(resource['fileName']).toBe('季度报告.pdf');
    expect(resource['title']).toBe('季度报告');
    expect(resource && 'payload' in resource).toBe(false);
    expect(container.querySelector('[role="status"]')).toBeNull();
  });

  it('打开被拒绝时呈现行内错误提示，不伪造成功', async () => {
    const request = vi.fn().mockRejectedValue(new Error('handler missing'));
    vi.stubGlobal('chips', { request, subscribe: vi.fn(), resource: vi.fn() });
    const container = document.createElement('div');
    renderView(createBasecard(FULL_CONFIG), container);
    container
      .querySelector<HTMLButtonElement>('button[data-role="file-open"]')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await vi.waitFor(() => {
      expect(container.querySelector('[role="status"]')?.textContent).toContain('暂时无法打开');
    });
  });

  it('文件引用非法时归一为空并呈现空态，不提供打开按钮（08 §7.1 规则 2）', () => {
    const container = document.createElement('div');
    renderView(createBasecard({ file_file: 'docs/../escape.pdf' }), container);
    expect(container.querySelector('button')).toBeNull();
    expect(container.textContent).toContain('未命名文件');
    expect(container.textContent).toContain('上传文件后，这里会显示文件基础卡片。');
  });

  it('更新调用覆盖旧内容且释放句柄幂等', () => {
    const container = document.createElement('div');
    const dispose = renderView(createBasecard(FULL_CONFIG), container);
    renderView(
      createBasecard({ ...FULL_CONFIG, file_name: '更新后的文件名' }, { revision: 2 }),
      container
    );
    expect(container.textContent).toContain('更新后的文件名');
    expect(container.textContent).not.toContain('季度报告');
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

  function writeField(container: HTMLElement, role: string, value: string): void {
    const input = container.querySelector<HTMLInputElement>(`input[data-role="${role}"]`);
    expect(input).not.toBeNull();
    writeInputValue(input!, value);
    input!.dispatchEvent(new Event('input', { bubbles: true }));
  }

  it('挂载后容器内呈现编辑表单，getChange 初始为 null', () => {
    const container = document.createElement('div');
    const editor = renderEditor(createBasecard(FULL_CONFIG), container);
    expect(container.querySelector('input[data-role="file-path-input"]')).not.toBeNull();
    expect(container.querySelector('input[data-role="cover-path-input"]')).not.toBeNull();
    expect(editor.isDirty()).toBe(false);
    expect(editor.getChange()).toBeNull();
    editor.dispose();
  });

  it('文件路径完整即可发布 replace 变更，文件名与后缀自动识别（01 §6.9）', () => {
    const container = document.createElement('div');
    const editor = renderEditor(createBasecard({}), container);
    const { changes, dirties } = collectEvents(editor);

    writeField(container, 'file-path-input', 'docs/demo.pdf');

    const change = editor.getChange();
    expect(change).not.toBeNull();
    expect(change!.kind).toBe('replace');
    const content = change!.kind === 'replace' ? change!.content : {};
    expect(content['card_type']).toBe('base.file');
    expect(validateConfig(content['config'])).toBe(true);
    const config = content['config'] as Record<string, unknown>;
    expect(config['file_file']).toBe('docs/demo.pdf');
    expect(config['file_name']).toBe('demo');
    expect(config['file_extension']).toBe('pdf');
    expect(editor.isDirty()).toBe(true);
    expect(changes.length).toBe(1);
    expect(dirties).toEqual([{ isDirty: true }]);
    editor.dispose();
  });

  it('文件路径非法时不发布变更', () => {
    const container = document.createElement('div');
    const editor = renderEditor(createBasecard({}), container);
    const { changes } = collectEvents(editor);

    writeField(container, 'file-path-input', '../escape.pdf');
    expect(editor.getChange()).toBeNull();
    expect(changes.length).toBe(0);
    editor.dispose();
  });

  it('派生的文件名与后缀以只读展示呈现，不提供手工编辑字段', () => {
    const container = document.createElement('div');
    const editor = renderEditor(createBasecard({}), container);
    writeField(container, 'file-path-input', 'docs/季度报告.pdf');
    expect(container.querySelector('[data-role="derived-file-name"]')?.textContent).toBe('季度报告');
    expect(container.querySelector('[data-role="derived-file-extension"]')?.textContent).toBe('pdf');
    expect(container.querySelectorAll('input').length).toBe(2);
    editor.dispose();
  });

  it('封面路径经归一后进入变更：非法引用归一为空串（08 §7.1 规则 2）', () => {
    const container = document.createElement('div');
    const editor = renderEditor(createBasecard(FULL_CONFIG), container);
    const { changes } = collectEvents(editor);

    writeField(container, 'cover-path-input', '../escape.png');
    const normalized = editor.getChange()!;
    expect((normalized.kind === 'replace'
      ? (normalized.content['config'] as Record<string, unknown>)['cover_image']
      : undefined)).toBe('');

    writeField(container, 'cover-path-input', 'covers/new.png');
    const change = editor.getChange()!;
    const config = change.kind === 'replace'
      ? (change.content['config'] as Record<string, unknown>)
      : {};
    expect(config['cover_image']).toBe('covers/new.png');
    expect(changes.length).toBe(2);
    editor.dispose();
  });

  it('markCommitted 以新 revision 清除待提交变更', () => {
    const container = document.createElement('div');
    const editor = renderEditor(createBasecard({}), container);
    writeField(container, 'file-path-input', 'docs/demo.pdf');
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
    second.dispose();
  });

  it('查看态与编辑态共用同一配置口径（readConfig 往返一致）', () => {
    const container = document.createElement('div');
    const editor = renderEditor(createBasecard(FULL_CONFIG), container);
    writeField(container, 'file-path-input', 'docs/季度报告-v2.pdf');
    const change = editor.getChange()!;
    const config = readConfig(
      change.kind === 'replace' ? change.content['config'] : undefined
    );
    expect(config).toEqual(readConfig({ ...FULL_CONFIG, file_file: 'docs/季度报告-v2.pdf' }));
    editor.dispose();
  });
});

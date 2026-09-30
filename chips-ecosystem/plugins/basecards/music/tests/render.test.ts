import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BaseCardView } from '@chips/sdk';
import { DEFAULT_MUSIC_COVER_URL } from '../src/shared/default-cover';
import { DEFAULT_CONFIG, buildContent, validateConfig } from '../src/config';
import { renderEditor, renderView } from '../src/render';
import type { IBaseCardEditorEventMap } from '@chips/sdk';

/**
 * 经 HTMLInputElement/HTMLTextAreaElement 原生的 value setter 写值：
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

function writeTextAreaValue(textarea: HTMLTextAreaElement, value: string): void {
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')
    ?.set;
  setter?.call(textarea, value);
}

function createBasecard(
  config: Record<string, unknown>,
  overrides: Partial<BaseCardView> = {}
): BaseCardView {
  return {
    kind: 'basecard',
    node_id: 'a1B2c3D4e5',
    card_type: 'base.music',
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
  audio_file: 'tracks/midnight-echo.mp3',
  music_name: 'Midnight Echo',
  album_cover: 'covers/midnight-echo.jpg',
  lyrics_file: 'lyrics/midnight-echo.lrc',
  production_team: [{ id: 'team-a1b2c3', role: '歌手', people: ['Alice'] }],
  release_date: '2026-04-18',
  album_name: 'Northern Lights',
  language: '日语',
  genre: '流行',
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('renderView', () => {
  it('呈现封面、标题、歌手与元信息，同步提交首帧', () => {
    const container = document.createElement('div');
    const dispose = renderView(createBasecard(FULL_CONFIG), container);
    expect(typeof dispose).toBe('function');
    expect(container.querySelector('[data-card-type="base.music"]')).not.toBeNull();
    expect(container.textContent).toContain('Midnight Echo');
    expect(container.textContent).toContain('Alice');
    expect(container.textContent).toContain('专辑 · Northern Lights');
    expect(container.textContent).toContain('语种 · 日语');
    expect(container.textContent).toContain('流派 · 流行');
    expect(container.textContent).toContain('发行 · 2026-04-18');
    expect(container.querySelector('img')).not.toBeNull();
    expect(container.querySelector('button')).not.toBeNull();
  });

  it('未配置音频时呈现空态且不提供播放按钮', () => {
    const container = document.createElement('div');
    renderView(createBasecard({}), container);
    expect(container.querySelector('button')).toBeNull();
    expect(container.textContent).toContain('未命名歌曲');
    expect(container.textContent).toContain('上传音频文件后，这里会显示音乐基础卡片。');
  });

  it('歌曲名缺失时从音频文件名派生标题，歌手缺失时呈现兜底文案', () => {
    const container = document.createElement('div');
    renderView(createBasecard({ audio_file: 'tracks/midnight-echo.mp3' }), container);
    expect(container.textContent).toContain('midnight-echo');
    expect(container.textContent).toContain('未填写歌手');
  });

  it('呈现已配置的封面引用', () => {
    const container = document.createElement('div');
    renderView(createBasecard(FULL_CONFIG), container);
    const cover = container.querySelector('img[data-role="music-cover"]');
    expect(cover).not.toBeNull();
    expect((cover as HTMLImageElement).getAttribute('src')).toBe(
      'covers/midnight-echo.jpg'
    );
  });

  it('封面未配置时默认占位封面非空且稳定', () => {
    expect(DEFAULT_MUSIC_COVER_URL.length).toBeGreaterThan(0);
    const container = document.createElement('div');
    renderView(createBasecard({ audio_file: 'a.mp3' }), container);
    const cover = container.querySelector('img[data-role="music-cover"]');
    expect((cover as HTMLImageElement).getAttribute('src')).toBe(DEFAULT_MUSIC_COVER_URL);
  });

  it('点击播放经 SDK chips 客户端真调用 resource:open 并携带音乐卡片载荷', async () => {
    const request = vi.fn().mockResolvedValue({ mode: 'app' });
    vi.stubGlobal('chips', { request, subscribe: vi.fn(), resource: vi.fn() });
    const container = document.createElement('div');
    renderView(createBasecard(FULL_CONFIG), container);
    const button = container.querySelector<HTMLButtonElement>('button[data-role="music-open"]');
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
    expect(resource['uri']).toBe('tracks/midnight-echo.mp3');
    expect(resource['title']).toBe('Midnight Echo');
    const payload = resource['payload'] as Record<string, unknown>;
    expect(payload['kind']).toBe('chips.music-card');
    expect(payload['cardType']).toBe('base.music');
    expect(container.querySelector('[role="status"]')).toBeNull();
  });

  it('打开被拒绝时呈现行内错误提示，不伪造成功', async () => {
    const request = vi.fn().mockRejectedValue(new Error('handler missing'));
    vi.stubGlobal('chips', { request, subscribe: vi.fn(), resource: vi.fn() });
    const container = document.createElement('div');
    renderView(createBasecard(FULL_CONFIG), container);
    container
      .querySelector<HTMLButtonElement>('button[data-role="music-open"]')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await vi.waitFor(() => {
      expect(container.querySelector('[role="status"]')?.textContent).toContain('暂时无法打开');
    });
  });

  it('更新调用覆盖旧内容且释放句柄幂等', () => {
    const container = document.createElement('div');
    const dispose = renderView(createBasecard(FULL_CONFIG), container);
    renderView(
      createBasecard({ ...FULL_CONFIG, music_name: '更新后的歌名' }, { revision: 2 }),
      container
    );
    expect(container.textContent).toContain('更新后的歌名');
    expect(container.textContent).not.toContain('Midnight Echo');
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
    expect(container.querySelector('input[data-role="audio-path-input"]')).not.toBeNull();
    expect(container.querySelector('input[data-role="music-name-input"]')).not.toBeNull();
    expect(editor.isDirty()).toBe(false);
    expect(editor.getChange()).toBeNull();
    editor.dispose();
  });

  it('音频路径完整即可发布 replace 变更并标记 dirty', () => {
    const container = document.createElement('div');
    const editor = renderEditor(createBasecard({}), container);
    const { changes, dirties } = collectEvents(editor);

    writeField(container, 'audio-path-input', 'tracks/demo.mp3');

    const change = editor.getChange();
    expect(change).not.toBeNull();
    expect(change!.kind).toBe('replace');
    const content = change!.kind === 'replace' ? change!.content : {};
    expect(content['card_type']).toBe('base.music');
    expect(validateConfig(content['config'])).toBe(true);
    expect((content['config'] as Record<string, unknown>)['audio_file']).toBe('tracks/demo.mp3');
    expect(editor.isDirty()).toBe(true);
    expect(changes.length).toBe(1);
    expect(dirties).toEqual([{ isDirty: true }]);
    editor.dispose();
  });

  it('音频路径非法时不发布变更', () => {
    const container = document.createElement('div');
    const editor = renderEditor(createBasecard({}), container);
    const { changes } = collectEvents(editor);

    writeField(container, 'audio-path-input', '../escape.mp3');
    expect(editor.getChange()).toBeNull();
    expect(changes.length).toBe(0);
    editor.dispose();
  });

  it('发行日期非法时呈现行内错误且不发布，修正后恢复发布', () => {
    const container = document.createElement('div');
    const editor = renderEditor(createBasecard(FULL_CONFIG), container);
    const { changes } = collectEvents(editor);

    writeField(container, 'release-date-input', '2026-4-18');
    expect(editor.getChange()).toBeNull();
    expect(container.textContent).toContain('发行日期必须使用 YYYY-MM-DD');

    writeField(container, 'release-date-input', '2026-04-19');
    expect(editor.getChange()).not.toBeNull();
    expect(changes.length).toBe(1);
    editor.dispose();
  });

  it('制作团队可添加身份并随成员编辑进入变更', () => {
    const container = document.createElement('div');
    const editor = renderEditor(createBasecard(FULL_CONFIG), container);
    collectEvents(editor);

    container
      .querySelector<HTMLButtonElement>('button[data-role="add-team-role"]')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(editor.getChange()).not.toBeNull();
    const addedChange = editor.getChange()!;
    const added = (addedChange.kind === 'replace'
      ? (addedChange.content['config'] as Record<string, unknown>)['production_team']
      : []) as Array<Record<string, unknown>>;
    expect(added.length).toBe(2);

    const textareas = container.querySelectorAll<HTMLTextAreaElement>(
      'textarea[data-role^="team-people-input-"]'
    );
    expect(textareas.length).toBeGreaterThan(0);
    const textarea = textareas[textareas.length - 1]!;
    writeTextAreaValue(textarea, '林夕\n黄伟文');
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    const latest = editor.getChange()!;
    const team = (latest.kind === 'replace'
      ? (latest.content['config'] as Record<string, unknown>)['production_team']
      : []) as Array<Record<string, unknown>>;
    expect(team[team.length - 1]!['people']).toEqual(['林夕', '黄伟文']);
    editor.dispose();
  });

  it('markCommitted 以新 revision 清除待提交变更', () => {
    const container = document.createElement('div');
    const editor = renderEditor(createBasecard({}), container);
    writeField(container, 'audio-path-input', 'tracks/demo.mp3');
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
});

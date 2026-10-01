import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BaseCardView, IBaseCardEditorEventMap } from '@chips/sdk';
import { DEFAULT_CONFIG, buildContent, readConfig, validateConfig } from '../src/config';
import { renderEditor, renderView } from '../src/render';

/**
 * 经 HTMLInputElement 原生的 value setter 写值：React 受控输入在实例上覆盖了 value 属性，
 * 直接赋值会被变更追踪去重；必须经原型原生 setter 携带接收器写入才能触发 onChange
 * （模拟真实用户输入，母型 music 判例）。
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
    card_type: 'base.video',
    content: buildContent({ ...DEFAULT_CONFIG, ...config }),
    revision: 1,
    card: {
      card_id: 'z9Y8x7W6v5',
      name: '示例卡片',
      chip_standards_version: '1.0.0',
      cover_ratio: '16:9',
      tags: [],
    },
    ...overrides,
  };
}

const FULL_CONFIG = {
  video_file: 'videos/tokyo-travel.mp4',
  cover_image: 'covers/tokyo-travel.jpg',
  subtitles: [
    {
      id: 'zh-cn',
      label: '简体中文',
      language: 'zh-CN',
      kind: 'subtitles',
      file_path: 'subtitles/tokyo-travel.zh.vtt',
      default: true,
    },
    {
      id: 'en',
      label: 'English',
      language: 'en-US',
      kind: 'captions',
      file_path: 'subtitles/tokyo-travel.en.vtt',
      default: false,
    },
  ],
  playback: { autoplay: true, loop: true, muted: false, playback_rate: 1.5, start_time: 12 },
  video_title: '东京旅行记录',
  publish_time: '2026-04-18',
  creator: '薯片工作室',
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('renderView', () => {
  it('呈现封面、标题、元信息与播放信息徽标，同步提交首帧', () => {
    const container = document.createElement('div');
    const dispose = renderView(createBasecard(FULL_CONFIG), container);
    expect(typeof dispose).toBe('function');
    expect(container.querySelector('[data-card-type="base.video"]')).not.toBeNull();
    expect(container.textContent).toContain('东京旅行记录');
    expect(container.textContent).toContain('薯片工作室 · 2026-04-18');
    expect(container.textContent).toContain('2 条字幕');
    expect(container.textContent).toContain('循环');
    expect(container.textContent).toContain('自动播放');
    expect(container.textContent).toContain('倍速 1.5x');
    expect(container.textContent).toContain('起始 12 秒');
    expect(container.querySelector('img')).not.toBeNull();
    expect(container.querySelector('button')).not.toBeNull();
  });

  it('未配置视频时呈现空态且不提供打开按钮', () => {
    const container = document.createElement('div');
    renderView(createBasecard({}), container);
    expect(container.querySelector('button')).toBeNull();
    expect(container.textContent).toContain('还没有视频内容');
  });

  it('封面未配置时以视频首帧回退呈现，回退面无播放控件', () => {
    const container = document.createElement('div');
    renderView(createBasecard({ video_file: 'videos/demo.mp4' }), container);
    const fallback = container.querySelector<HTMLVideoElement>('video[data-role="video-fallback"]');
    expect(fallback).not.toBeNull();
    expect(fallback!.muted).toBe(true);
    expect(fallback!.controls).toBe(false);
    expect(fallback!.getAttribute('preload')).toBe('metadata');
    expect(fallback!.getAttribute('tabindex')).toBeNull();
  });

  it('呈现已配置的封面引用', () => {
    const container = document.createElement('div');
    renderView(createBasecard(FULL_CONFIG), container);
    const cover = container.querySelector('img[data-role="video-cover"]');
    expect(cover).not.toBeNull();
    expect((cover as HTMLImageElement).getAttribute('src')).toBe('covers/tokyo-travel.jpg');
  });

  it('倍速与起始秒数为默认值时不呈现播放参数徽标', () => {
    const container = document.createElement('div');
    renderView(createBasecard({ video_file: 'videos/demo.mp4' }), container);
    expect(container.textContent).not.toContain('倍速');
    expect(container.textContent).not.toContain('起始');
  });

  it('点击整面经 SDK chips 客户端真调用 resource:open 并携带视频卡片载荷', async () => {
    const request = vi.fn().mockResolvedValue({ mode: 'app' });
    vi.stubGlobal('chips', { request, subscribe: vi.fn(), resource: vi.fn() });
    const container = document.createElement('div');
    renderView(createBasecard(FULL_CONFIG), container);
    const button = container.querySelector<HTMLButtonElement>('button[data-role="video-open"]');
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
    expect(resource['uri']).toBe('videos/tokyo-travel.mp4');
    expect(resource['title']).toBe('东京旅行记录');
    const payload = resource['payload'] as Record<string, unknown>;
    expect(payload['kind']).toBe('chips.video-card');
    expect(payload['cardType']).toBe('base.video');
    const payloadResources = payload['resources'] as Record<string, unknown>;
    expect((payloadResources['subtitles'] as unknown[]).length).toBe(2);
    expect(container.querySelector('[role="status"]')).toBeNull();
  });

  it('打开被拒绝时呈现行内错误提示，不伪造成功', async () => {
    const request = vi.fn().mockRejectedValue(new Error('handler missing'));
    vi.stubGlobal('chips', { request, subscribe: vi.fn(), resource: vi.fn() });
    const container = document.createElement('div');
    renderView(createBasecard(FULL_CONFIG), container);
    container
      .querySelector<HTMLButtonElement>('button[data-role="video-open"]')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await vi.waitFor(() => {
      expect(container.querySelector('[role="status"]')?.textContent).toContain('暂时无法打开');
    });
  });

  it('更新调用覆盖旧内容且释放句柄幂等', () => {
    const container = document.createElement('div');
    const dispose = renderView(createBasecard(FULL_CONFIG), container);
    renderView(
      createBasecard({ ...FULL_CONFIG, video_title: '更新后的标题' }, { revision: 2 }),
      container
    );
    expect(container.textContent).toContain('更新后的标题');
    expect(container.textContent).not.toContain('东京旅行记录');
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

  /**
   * InputNumber 交互：聚焦后经原生 setter 写值再失焦——rc-input-number 在失焦时
   * 才把输入按 min/max 归一并回调 onChange（jsdom 下合成 input 事件不保证触发）。
   */
  function writeNumberField(container: HTMLElement, role: string, value: string): void {
    const input = container.querySelector<HTMLInputElement>(`input[data-role="${role}"]`);
    expect(input).not.toBeNull();
    input!.focus();
    writeInputValue(input!, value);
    input!.dispatchEvent(new Event('input', { bubbles: true }));
    input!.blur();
  }

  function clickSwitch(container: HTMLElement, role: string): void {
    const target =
      container.querySelector<HTMLElement>(`[data-role="${role}"]`) ??
      container.querySelector<HTMLElement>(`button[aria-label="${role}"]`);
    expect(target).not.toBeNull();
    target!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  }

  function publishedConfig(editor: ReturnType<typeof renderEditor>): Record<string, unknown> {
    const change = editor.getChange();
    expect(change).not.toBeNull();
    expect(change!.kind).toBe('replace');
    return (change!.kind === 'replace' ? change!.content['config'] : {}) as Record<
      string,
      unknown
    >;
  }

  it('挂载后容器内呈现编辑表单，getChange 初始为 null', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const editor = renderEditor(createBasecard(FULL_CONFIG), container);
    expect(container.querySelector('input[data-role="video-path-input"]')).not.toBeNull();
    expect(container.querySelector('input[data-role="video-title-input"]')).not.toBeNull();
    expect(container.querySelector('input[data-role="playback-rate-input"]')).not.toBeNull();
    expect(editor.isDirty()).toBe(false);
    expect(editor.getChange()).toBeNull();
    editor.dispose();
  });

  it('资源导入通道缺位以行内提示如实呈现（工单071），不伪造导入入口', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const editor = renderEditor(createBasecard({}), container);
    expect(container.textContent).toContain('编辑器资源导入通道');
    expect(container.querySelector('input[type="file"]')).toBeNull();
    editor.dispose();
  });

  it('视频路径完整即可发布 replace 变更并标记 dirty', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const editor = renderEditor(createBasecard({}), container);
    const { changes, dirties } = collectEvents(editor);

    writeField(container, 'video-path-input', 'videos/demo.mp4');

    const config = publishedConfig(editor);
    expect(config['video_file']).toBe('videos/demo.mp4');
    expect(validateConfig(config)).toBe(true);
    expect(editor.isDirty()).toBe(true);
    expect(changes.length).toBe(1);
    expect(dirties).toEqual([{ isDirty: true }]);
    editor.dispose();
  });

  it('视频路径非法时不发布变更', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const editor = renderEditor(createBasecard({}), container);
    const { changes } = collectEvents(editor);

    writeField(container, 'video-path-input', '../escape.mp4');
    expect(editor.getChange()).toBeNull();
    expect(changes.length).toBe(0);
    editor.dispose();
  });

  it('播放开关与数值参数进入变更（旧族播放参数语义）', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const editor = renderEditor(createBasecard({ video_file: 'videos/demo.mp4' }), container);
    collectEvents(editor);

    clickSwitch(container, 'loop-switch');
    expect((publishedConfig(editor)['playback'] as Record<string, unknown>)['loop']).toBe(true);

    writeNumberField(container, 'playback-rate-input', '2');
    expect((publishedConfig(editor)['playback'] as Record<string, unknown>)['playback_rate']).toBe(
      2
    );

    writeNumberField(container, 'start-time-input', '30');
    const playback = publishedConfig(editor)['playback'] as Record<string, unknown>;
    expect(playback['start_time']).toBe(30);
    expect(playback['loop']).toBe(true);
    expect(playback['playback_rate']).toBe(2);
    editor.dispose();
  });

  it('倍速钳制 0.25~4、起始秒数钳制非负（旧族归一语义）', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const editor = renderEditor(createBasecard({ video_file: 'videos/demo.mp4' }), container);
    collectEvents(editor);

    writeNumberField(container, 'playback-rate-input', '9');
    expect((publishedConfig(editor)['playback'] as Record<string, unknown>)['playback_rate']).toBe(
      4
    );

    writeNumberField(container, 'playback-rate-input', '0.1');
    expect((publishedConfig(editor)['playback'] as Record<string, unknown>)['playback_rate']).toBe(
      0.25
    );

    writeNumberField(container, 'start-time-input', '-8');
    expect((publishedConfig(editor)['playback'] as Record<string, unknown>)['start_time']).toBe(0);
    editor.dispose();
  });

  it('字幕可添加，路径补齐前阻断发布，补齐后进入变更', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const editor = renderEditor(createBasecard({ video_file: 'videos/demo.mp4' }), container);
    collectEvents(editor);

    container
      .querySelector<HTMLButtonElement>('button[data-role="add-subtitle"]')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(editor.getChange()).toBeNull();

    const pathInputs = await vi.waitFor(() => {
      const rows = container.querySelectorAll<HTMLInputElement>(
        'input[data-role^="subtitle-path-input-"]'
      );
      expect(rows.length).toBe(1);
      return rows;
    });
    writeInputValue(pathInputs[0]!, 'subtitles/new.vtt');
    pathInputs[0]!.dispatchEvent(new Event('input', { bubbles: true }));

    const config = publishedConfig(editor);
    const subtitles = config['subtitles'] as Array<Record<string, unknown>>;
    expect(subtitles.length).toBe(1);
    expect(subtitles[0]!['file_path']).toBe('subtitles/new.vtt');
    expect(subtitles[0]!['kind']).toBe('subtitles');
    expect(validateConfig(config)).toBe(true);
    editor.dispose();
  });

  it('默认字幕开关全表唯一，开启新轨即关闭旧默认轨', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const editor = renderEditor(createBasecard(FULL_CONFIG), container);
    collectEvents(editor);

    const switches = container.querySelectorAll<HTMLButtonElement>(
      'button[data-role^="subtitle-default-switch-"]'
    );
    expect(switches.length).toBe(2);
    switches[switches.length - 1]!.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const subtitles = publishedConfig(editor)['subtitles'] as Array<Record<string, unknown>>;
    expect(subtitles.map((track) => track['default'])).toEqual([false, true]);
    editor.dispose();
  });

  it('信息字段与封面路径进入变更', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const editor = renderEditor(createBasecard({ video_file: 'videos/demo.mp4' }), container);
    collectEvents(editor);

    writeField(container, 'video-title-input', '东京旅行记录');
    writeField(container, 'creator-input', '薯片工作室');
    writeField(container, 'publish-time-input', '2026-04-18');
    writeField(container, 'cover-path-input', 'covers/tokyo-travel.jpg');

    const config = publishedConfig(editor);
    expect(config['video_title']).toBe('东京旅行记录');
    expect(config['creator']).toBe('薯片工作室');
    expect(config['publish_time']).toBe('2026-04-18');
    expect(config['cover_image']).toBe('covers/tokyo-travel.jpg');
    editor.dispose();
  });

  it('markCommitted 以新 revision 清除待提交变更', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const editor = renderEditor(createBasecard({}), container);
    writeField(container, 'video-path-input', 'videos/demo.mp4');
    expect(editor.isDirty()).toBe(true);

    editor.markCommitted(2);
    expect(editor.isDirty()).toBe(false);
    expect(editor.getChange()).toBeNull();
    editor.markCommitted(1);
    editor.dispose();
  });

  it('dispose 后丢弃待提交变更且不再发布事件', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const editor = renderEditor(createBasecard(FULL_CONFIG), container);
    const { changes } = collectEvents(editor);
    const input = container.querySelector<HTMLInputElement>('input[data-role="video-path-input"]');
    expect(input).not.toBeNull();
    editor.dispose();
    expect(editor.state).toBe('disposed');
    writeInputValue(input!, 'videos/changed.mp4');
    input!.dispatchEvent(new Event('input', { bubbles: true }));
    expect(editor.getChange()).toBeNull();
    expect(changes.length).toBe(0);
    editor.dispose();
  });

  it('dispose 后同一容器可重新挂载编辑器，不并存两个编辑器', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const first = renderEditor(createBasecard(FULL_CONFIG), container);
    first.dispose();
    const second = renderEditor(createBasecard(FULL_CONFIG), container);
    expect(second).not.toBe(first);
    expect(readConfig(JSON.parse(JSON.stringify(FULL_CONFIG))).video_file).toBe(
      'videos/tokyo-travel.mp4'
    );
    second.dispose();
  });
});

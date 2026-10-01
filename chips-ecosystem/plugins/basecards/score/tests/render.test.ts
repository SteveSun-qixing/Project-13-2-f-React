import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BaseCardView, IBaseCardEditorEventMap } from '@chips/sdk';
import { buildContent, DEFAULT_CONFIG, validateConfig } from '../src/config';
import type { IScoreConfig } from '../src/config';
import { renderEditor, renderView } from '../src/render';

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
  config: Partial<IScoreConfig>,
  overrides: Partial<BaseCardView> = {}
): BaseCardView {
  return {
    kind: 'basecard',
    node_id: 'a1B2c3D4e5',
    card_type: 'base.score',
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

function selectStyleOption(container: HTMLElement, label: string): void {
  const items = Array.from(container.querySelectorAll('.ant-segmented-item'));
  const index = items.findIndex((item) => item.textContent?.trim() === label);
  expect(index, `找不到样式选项：${label}`).toBeGreaterThanOrEqual(0);
  const inputs = container.querySelectorAll<HTMLInputElement>('.ant-segmented-item input');
  inputs[index]!.click();
}

function writeNumberField(container: HTMLElement, index: number, value: string): void {
  const inputs = container.querySelectorAll<HTMLInputElement>('.ant-input-number input');
  expect(inputs.length).toBe(2);
  const input = inputs[index]!;
  writeInputValue(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function currentConfig(editor: ReturnType<typeof renderEditor>): IScoreConfig {
  const change = editor.getChange();
  expect(change).not.toBeNull();
  expect(change!.kind).toBe('replace');
  const content = change!.kind === 'replace' ? change!.content : {};
  return content['config'] as IScoreConfig;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('renderView', () => {
  it('星星样式：五颗星、三颗点亮、无障碍标签同步提交首帧', () => {
    const container = document.createElement('div');
    const dispose = renderView(createBasecard({ style: 'stars', score: 3 }), container);
    expect(typeof dispose).toBe('function');
    expect(container.querySelector('[data-card-type="base.score"]')).not.toBeNull();
    expect(container.querySelector('[data-score-style="stars"]')).not.toBeNull();
    expect(container.querySelector('.ant-rate')).not.toBeNull();
    expect(container.querySelectorAll('.ant-rate-star')).toHaveLength(5);
    expect(container.querySelectorAll('.ant-rate-star-full')).toHaveLength(3);
    expect(container.querySelectorAll('.ant-rate-star div[role="radio"]')).toHaveLength(5);
    expect(container.querySelector('.chips-score-card__sr-only')?.textContent).toBe('3 / 5 分');
    dispose();
    dispose();
  });

  it('爱心样式：心形符号与五分制只读评分', () => {
    const container = document.createElement('div');
    renderView(createBasecard({ style: 'hearts', score: 2 }), container);
    expect(container.querySelectorAll('.ant-rate-star')).toHaveLength(5);
    expect(container.querySelectorAll('.ant-rate-star-full')).toHaveLength(2);
    expect(
      container.querySelectorAll('.ant-rate [data-icon="heart"]').length
    ).toBeGreaterThan(0);
    expect(container.querySelector('.chips-score-card__sr-only')?.textContent).toBe('2 / 5 分');
  });

  it('分数样式：大数字分数对与紧凑阈值', () => {
    const container = document.createElement('div');
    renderView(createBasecard({ style: 'score', score: 88.5, total_score: 100 }), container);
    const numeric = container.querySelector('[role="img"]');
    expect(numeric).not.toBeNull();
    expect(numeric!.getAttribute('aria-label')).toBe('88.5 / 100 分');
    expect(numeric!.textContent).toContain('88.5');
    expect(numeric!.textContent).toContain('100');
    expect(numeric!.className).not.toContain('chips-score-card__numeric--compact');

    const compact = document.createElement('div');
    renderView(
      createBasecard({ style: 'score', score: 87654.3, total_score: 100000 }),
      compact
    );
    expect(
      compact.querySelector('.chips-score-card__numeric')!.className
    ).toContain('chips-score-card__numeric--compact');
  });

  it('进度条样式：进度本体、分数元信息与百分比', () => {
    const container = document.createElement('div');
    renderView(createBasecard({ style: 'progress', score: 3, total_score: 5 }), container);
    expect(container.querySelector('.ant-progress')).not.toBeNull();
    expect(container.querySelector('.chips-score-card__progress-score')?.textContent).toBe(
      '3 / 5'
    );
    expect(container.querySelector('.chips-score-card__progress-percent')?.textContent).toBe(
      '60%'
    );
  });

  it('更新调用覆盖旧内容且释放句柄幂等', () => {
    const container = document.createElement('div');
    renderView(createBasecard({ style: 'stars', score: 3 }), container);
    renderView(
      createBasecard({ style: 'score', score: 4, total_score: 8 }, { revision: 2 }),
      container
    );
    expect(container.querySelector('[data-score-style="score"]')).not.toBeNull();
    expect(container.querySelector('.ant-rate')).toBeNull();
    expect(container.textContent).toContain('4');
    const dispose = renderView(createBasecard({ style: 'stars', score: 1 }), container);
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

  it('挂载后呈现样式分段与五分制评分，数值样式缺省无数字输入', () => {
    const container = document.createElement('div');
    const editor = renderEditor(createBasecard({}), container);
    expect(container.querySelector('.ant-segmented')).not.toBeNull();
    expect(container.textContent).toContain('星星');
    expect(container.textContent).toContain('爱心');
    expect(container.textContent).toContain('分数');
    expect(container.textContent).toContain('进度条');
    expect(container.querySelector('.ant-rate')).not.toBeNull();
    expect(container.querySelector('.ant-input-number')).toBeNull();
    expect(editor.isDirty()).toBe(false);
    expect(editor.getChange()).toBeNull();
    editor.dispose();
  });

  it('切换到分数样式出现总分与获得分数两个数字输入，回流合法 replace 变更', () => {
    const container = document.createElement('div');
    const editor = renderEditor(createBasecard({}), container);
    const { changes, dirties } = collectEvents(editor);

    selectStyleOption(container, '分数');
    expect(container.querySelectorAll('.ant-input-number')).toHaveLength(2);
    writeNumberField(container, 0, '200');
    writeNumberField(container, 1, '150');

    const config = currentConfig(editor);
    expect(config).toEqual({ style: 'score', score: 150, total_score: 200 });
    expect(validateConfig(config)).toBe(true);
    expect(editor.isDirty()).toBe(true);
    expect(changes.length).toBeGreaterThan(0);
    expect(dirties).toEqual([{ isDirty: true }]);
    editor.dispose();
  });

  it('数值样式切换到星星时总分强制五分制且分数钳制取整', () => {
    const container = document.createElement('div');
    const editor = renderEditor(
      createBasecard({ style: 'score', score: 80, total_score: 100 }),
      container
    );
    editor.getChange();
    selectStyleOption(container, '星星');
    expect(currentConfig(editor)).toEqual({
      style: 'stars',
      score: 5,
      total_score: 5,
    });
    editor.dispose();
  });

  it('编辑面板星级点击按旧族语义回流五分制整数分', () => {
    const container = document.createElement('div');
    const editor = renderEditor(createBasecard({}), container);
    const radios = container.querySelectorAll<HTMLElement>(
      '.ant-rate-star div[role="radio"]'
    );
    expect(radios).toHaveLength(5);
    radios[3]!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(currentConfig(editor)).toEqual({ style: 'stars', score: 4, total_score: 5 });
    editor.dispose();
  });

  it('Home/End 键盘语义：Home 归一分、End 满分', () => {
    const container = document.createElement('div');
    const editor = renderEditor(createBasecard({}), container);
    const rating = container.querySelector('.ant-rate') as HTMLElement;
    rating.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Home', bubbles: true })
    );
    expect(currentConfig(editor)).toEqual({ style: 'stars', score: 1, total_score: 5 });
    rating.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(currentConfig(editor)).toEqual({ style: 'stars', score: 5, total_score: 5 });
    editor.dispose();
  });

  it('进度条样式在编辑面板呈现实时进度预览', () => {
    const container = document.createElement('div');
    const editor = renderEditor(
      createBasecard({ style: 'progress', score: 3, total_score: 5 }),
      container
    );
    editor.getChange();
    expect(container.querySelector('.ant-progress')).not.toBeNull();
    editor.dispose();
  });

  it('markCommitted 以新 revision 清除待提交变更', () => {
    const container = document.createElement('div');
    const editor = renderEditor(createBasecard({}), container);
    selectStyleOption(container, '进度条');
    expect(editor.isDirty()).toBe(true);
    editor.markCommitted(2);
    expect(editor.isDirty()).toBe(false);
    expect(editor.getChange()).toBeNull();
    editor.markCommitted(1);
    editor.dispose();
  });

  it('dispose 后丢弃待提交变更且不再发布事件，同一容器可重新挂载', () => {
    const container = document.createElement('div');
    const editor = renderEditor(createBasecard({}), container);
    const { changes } = collectEvents(editor);
    selectStyleOption(container, '爱心');
    expect(editor.isDirty()).toBe(true);
    editor.dispose();
    expect(editor.state).toBe('disposed');
    expect(editor.getChange()).toBeNull();
    expect(changes.length).toBe(1);

    const second = renderEditor(createBasecard({}), container);
    expect(second).not.toBe(editor);
    expect(container.querySelectorAll('.ant-segmented').length).toBe(1);
    second.dispose();
  });

  it('focus 聚焦数值样式首个数字输入，符号样式退化为可调用', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const editor = renderEditor(createBasecard({}), container);
    editor.focus();
    editor.dispose();

    const numeric = document.createElement('div');
    document.body.appendChild(numeric);
    const numericEditor = renderEditor(
      createBasecard({ style: 'score', score: 4, total_score: 10 }),
      numeric
    );
    numericEditor.focus();
    expect(document.activeElement?.tagName).toBe('INPUT');
    numericEditor.dispose();
    container.remove();
    numeric.remove();
  });
});

import { afterEach, describe, expect, it } from 'vitest';

import {
  detectPlatform,
  formatAccelerator,
  isEditableContext,
  isValidAccelerator,
  matchesAccelerator,
  normalizeAccelerator,
} from './accelerator';

interface KeyEventInit extends KeyboardEventInit {
  readonly isComposingFlag?: boolean;
}

function makeKeyEvent(init: KeyEventInit): KeyboardEvent {
  const { isComposingFlag, ...keyInit } = init;
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...keyInit });
  if (isComposingFlag === true) {
    Object.defineProperty(event, 'isComposing', { value: true });
  }
  return event;
}

const originalPlatform = Object.getOwnPropertyDescriptor(window.navigator, 'platform');

function stubNavigatorPlatform(platform: string): void {
  Object.defineProperty(window.navigator, 'platform', { value: platform, configurable: true });
}

afterEach(() => {
  if (originalPlatform === undefined) {
    delete (window.navigator as { platform?: string }).platform;
    return;
  }
  Object.defineProperty(window.navigator, 'platform', originalPlatform);
});

describe('detectPlatform', () => {
  it('识别 macOS 平台', () => {
    stubNavigatorPlatform('MacIntel');
    expect(detectPlatform()).toBe('mac');
  });

  it('非 Mac 平台按 other 收口', () => {
    stubNavigatorPlatform('Win32');
    expect(detectPlatform()).toBe('other');
  });
});

describe('isValidAccelerator（契约 §2.6 文法）', () => {
  it('接受修饰符与主键的合法组合', () => {
    expect(isValidAccelerator('CommandOrControl+P')).toBe(true);
    expect(isValidAccelerator('Command+Shift+O')).toBe(true);
    expect(isValidAccelerator('space')).toBe(true);
    expect(isValidAccelerator('F13')).toBe(true);
    expect(isValidAccelerator('CommandOrControl+BracketLeft')).toBe(true);
    expect(isValidAccelerator('Option+Delete')).toBe(true);
  });

  it('拒绝未登记的修饰符与主键', () => {
    expect(isValidAccelerator('Mod+P')).toBe(false);
    expect(isValidAccelerator('Ctrl+P')).toBe(false);
    expect(isValidAccelerator('CommandOrControl')).toBe(false);
    expect(isValidAccelerator('CommandOrControl+')).toBe(false);
    expect(isValidAccelerator('CommandOrControl+ArrowLeft')).toBe(false);
    expect(isValidAccelerator('CommandOrControl+KeyP')).toBe(false);
    expect(isValidAccelerator('CommandOrControl+F25')).toBe(false);
    expect(isValidAccelerator('CommandOrControl+回车')).toBe(false);
  });
});

describe('normalizeAccelerator', () => {
  it('大小写不敏感并固定修饰符顺序', () => {
    expect(normalizeAccelerator('shift+commandorcontrol+p', 'mac')).toBe(
      'CommandOrControl+Shift+P'
    );
    expect(normalizeAccelerator('Shift+CommandOrControl+p', 'mac')).toBe(
      'CommandOrControl+Shift+P'
    );
  });

  it('Option 归一为 Alt，重复修饰符去重', () => {
    expect(normalizeAccelerator('option+a', 'mac')).toBe('Alt+A');
    expect(normalizeAccelerator('Control+control+P', 'other')).toBe('Control+P');
  });

  it('Command / Super / Meta 按平台归一', () => {
    expect(normalizeAccelerator('Command+A', 'mac')).toBe('Command+A');
    expect(normalizeAccelerator('Super+A', 'mac')).toBe('Command+A');
    expect(normalizeAccelerator('Meta+A', 'mac')).toBe('Command+A');
    expect(normalizeAccelerator('Command+A', 'other')).toBe('Meta+A');
    expect(normalizeAccelerator('Super+A', 'other')).toBe('Meta+A');
  });

  it('CommandOrControl 保留平台别名（匹配时解析）', () => {
    expect(normalizeAccelerator('CommandOrControl+K', 'mac')).toBe('CommandOrControl+K');
    expect(normalizeAccelerator('CommandOrControl+K', 'other')).toBe('CommandOrControl+K');
  });

  it('文法非法返回 null', () => {
    expect(normalizeAccelerator('Mod+P', 'mac')).toBeNull();
    expect(normalizeAccelerator('CommandOrControl+', 'mac')).toBeNull();
  });
});

describe('formatAccelerator', () => {
  it('macOS 使用系统符号并去掉分隔符', () => {
    expect(formatAccelerator('CommandOrControl+Shift+P', 'mac')).toBe('⌘⇧P');
    expect(formatAccelerator('Control+Alt+Delete', 'mac')).toBe('⌃⌥Delete');
    expect(formatAccelerator('Space', 'mac')).toBe('Space');
  });

  it('Windows / Linux 使用缩写并用 + 连接', () => {
    expect(formatAccelerator('CommandOrControl+Shift+P', 'other')).toBe('Ctrl+Shift+P');
    expect(formatAccelerator('Meta+K', 'other')).toBe('Meta+K');
    expect(formatAccelerator('Command+K', 'other')).toBe('Cmd+K');
    expect(formatAccelerator('Alt+Space', 'other')).toBe('Alt+Space');
  });

  it('文法非法时原样返回', () => {
    expect(formatAccelerator('Mod+P', 'mac')).toBe('Mod+P');
  });
});

describe('matchesAccelerator（窗口内按键匹配）', () => {
  it('macOS：CommandOrControl 映射为 Command', () => {
    const commandP = makeKeyEvent({ key: 'p', code: 'KeyP', metaKey: true });
    expect(matchesAccelerator(commandP, 'CommandOrControl+P', 'mac')).toBe(true);
    expect(
      matchesAccelerator(
        makeKeyEvent({ key: 'p', code: 'KeyP', ctrlKey: true }),
        'CommandOrControl+P',
        'mac'
      )
    ).toBe(false);
  });

  it('Windows / Linux：CommandOrControl 映射为 Control', () => {
    const ctrlP = makeKeyEvent({ key: 'p', code: 'KeyP', ctrlKey: true });
    expect(matchesAccelerator(ctrlP, 'CommandOrControl+P', 'other')).toBe(true);
    expect(
      matchesAccelerator(
        makeKeyEvent({ key: 'p', code: 'KeyP', metaKey: true }),
        'CommandOrControl+P',
        'other'
      )
    ).toBe(false);
  });

  it('修饰符必须完全一致（多余或缺失都不匹配）', () => {
    expect(
      matchesAccelerator(
        makeKeyEvent({ key: 'p', code: 'KeyP', metaKey: true, shiftKey: true }),
        'CommandOrControl+P',
        'mac'
      )
    ).toBe(false);
    expect(
      matchesAccelerator(makeKeyEvent({ key: 'p', code: 'KeyP' }), 'CommandOrControl+P', 'mac')
    ).toBe(false);
    expect(
      matchesAccelerator(
        makeKeyEvent({ key: 'P', code: 'KeyP', metaKey: true, shiftKey: true }),
        'CommandOrControl+Shift+P',
        'mac'
      )
    ).toBe(true);
  });

  it('数字、功能键与具名键', () => {
    expect(
      matchesAccelerator(
        makeKeyEvent({ key: '1', code: 'Digit1', ctrlKey: true }),
        'CommandOrControl+1',
        'other'
      )
    ).toBe(true);
    expect(matchesAccelerator(makeKeyEvent({ key: 'F5', code: 'F5' }), 'F5', 'other')).toBe(true);
    expect(matchesAccelerator(makeKeyEvent({ key: ' ', code: 'Space' }), 'Space', 'other')).toBe(
      true
    );
    expect(matchesAccelerator(makeKeyEvent({ key: 'Tab', code: 'Tab' }), 'Tab', 'other')).toBe(
      true
    );
  });

  it('符号键：Shift+= 与数字键盘 + 映射为 Plus', () => {
    expect(
      matchesAccelerator(
        makeKeyEvent({ key: '+', code: 'Equal', shiftKey: true, metaKey: true }),
        'CommandOrControl+Plus',
        'mac'
      )
    ).toBe(true);
    expect(matchesAccelerator(makeKeyEvent({ key: '+', code: 'NumpadAdd' }), 'Plus', 'other')).toBe(
      true
    );
    expect(matchesAccelerator(makeKeyEvent({ key: '=', code: 'Equal' }), 'Equal', 'other')).toBe(
      true
    );
    expect(matchesAccelerator(makeKeyEvent({ key: '-', code: 'Minus' }), 'Minus', 'other')).toBe(
      true
    );
  });

  it('方向键使用契约主键名（ArrowLeft → Left）', () => {
    expect(
      matchesAccelerator(makeKeyEvent({ key: 'ArrowLeft', code: 'ArrowLeft' }), 'Left', 'other')
    ).toBe(true);
    expect(
      matchesAccelerator(
        makeKeyEvent({ key: 'ArrowLeft', code: 'ArrowLeft' }),
        'ArrowLeft',
        'other'
      )
    ).toBe(false);
  });

  it('无 code 的事件按 key 回落', () => {
    expect(matchesAccelerator(makeKeyEvent({ key: 'p' }), 'P', 'other')).toBe(true);
    expect(matchesAccelerator(makeKeyEvent({ key: ' ' }), 'Space', 'other')).toBe(true);
    expect(matchesAccelerator(makeKeyEvent({ key: '未识别键' }), 'Space', 'other')).toBe(false);
  });

  it('IME 组合输入与非法 accelerator 一律不匹配', () => {
    expect(
      matchesAccelerator(
        makeKeyEvent({ key: 'p', code: 'KeyP', metaKey: true, isComposingFlag: true }),
        'CommandOrControl+P',
        'mac'
      )
    ).toBe(false);
    expect(matchesAccelerator(makeKeyEvent({ key: 'p', code: 'KeyP' }), 'Mod+P', 'mac')).toBe(
      false
    );
  });
});

describe('isEditableContext（契约 §5.5 可编辑上下文保护）', () => {
  it('输入类元素与富文本上下文视为可编辑', () => {
    const input = document.createElement('input');
    const textarea = document.createElement('textarea');
    const select = document.createElement('select');
    const editable = document.createElement('div');
    editable.setAttribute('contenteditable', 'true');
    const nested = document.createElement('span');
    editable.appendChild(nested);
    document.body.append(input, textarea, select, editable);

    expect(isEditableContext(input)).toBe(true);
    expect(isEditableContext(textarea)).toBe(true);
    expect(isEditableContext(select)).toBe(true);
    expect(isEditableContext(nested)).toBe(true);

    input.remove();
    textarea.remove();
    select.remove();
    editable.remove();
  });

  it('普通元素、显式关闭 contenteditable 与非元素目标不算可编辑', () => {
    const plain = document.createElement('div');
    const disabledEditable = document.createElement('div');
    disabledEditable.setAttribute('contenteditable', 'false');
    document.body.append(plain, disabledEditable);

    expect(isEditableContext(plain)).toBe(false);
    expect(isEditableContext(disabledEditable)).toBe(false);
    expect(isEditableContext(null)).toBe(false);
    expect(isEditableContext(document)).toBe(false);

    plain.remove();
    disabledEditable.remove();
  });
});

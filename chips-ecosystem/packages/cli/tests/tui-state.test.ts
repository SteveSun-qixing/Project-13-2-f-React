/**
 * TUI 状态机与渲染（[CLI 完整参考] §3.1.1「TUI 契约」）：候选前缀匹配、键位归约、
 * 参数控件驱动与三段式帧渲染。全部为纯函数断言，不触碰真实终端。
 */

import { describe, expect, it } from 'vitest';

import type { IParameterDeclaration } from '../src/args/types.js';
import { renderFrame } from '../src/tui/render.js';
import {
  buildTokens,
  computeCandidates,
  createFields,
  initialState,
  reduceKey,
  splitTokens,
  type ITuiEnvironment,
  type ITuiState,
  type ITuiTarget,
} from '../src/tui/state.js';
import type { ITuiKey } from '../src/tui/terminal.js';

const COMMAND_PATHS = [
  'help',
  'status',
  'plugin list',
  'plugin pack',
  'plugin validate',
  'config set',
];

const LIST_TARGET: ITuiTarget = {
  commandPath: ['plugin', 'list'],
  argumentsList: [],
  optionsList: [
    { name: 'role', type: 'enum', choices: ['app', 'service', 'basecard'], ui: { control: 'select' } },
    { name: 'enabled', type: 'boolean' },
  ],
};

const PACK_TARGET: ITuiTarget = {
  commandPath: ['plugin', 'pack'],
  argumentsList: [
    { name: 'dir', type: 'path', required: true, position: 0, path: { kind: 'directory', role: 'input' } },
    { name: 'count', type: 'integer', default: 3, ui: { control: 'stepper', step: 2 } },
  ],
  optionsList: [
    { name: 'tags', type: 'stringList', ui: { control: 'multiSelect', choices: ['beta', 'signed'] } },
    { name: 'note', type: 'text' },
  ],
};

const EMPTY_TARGET: ITuiTarget = { commandPath: ['status'], argumentsList: [], optionsList: [] };

function environment(overrides: Partial<ITuiEnvironment> = {}): ITuiEnvironment {
  return {
    commandPaths: COMMAND_PATHS,
    resolveTarget: (tokens) => {
      const key = tokens.join(' ');
      if (key === 'plugin list') {
        return LIST_TARGET;
      }
      if (key === 'plugin pack') {
        return PACK_TARGET;
      }
      if (key === 'status') {
        return EMPTY_TARGET;
      }
      return undefined;
    },
    ...overrides,
  };
}

const key = (name: ITuiKey['name'], char?: string): ITuiKey => (char === undefined ? { name } : { name, char });

function composeWith(buffer: string): ITuiState {
  const state: ITuiState = { ...initialState(), candidates: computeCandidates(buffer, COMMAND_PATHS) };
  return { ...state, buffer, cursor: buffer.length };
}

function formOf(target: ITuiTarget): ITuiState {
  return {
    ...initialState(),
    panel: 'form',
    commandPath: target.commandPath.join(' '),
    buffer: target.commandPath.join(' '),
    fields: createFields(target),
    fieldIndex: 0,
  };
}

/**
 * 与 `formOf` 同形，但整体不写 `commandPath` 键。
 *
 * `ITuiState.commandPath?: string` 在 `exactOptionalPropertyTypes` 下以「键缺席」表达无命令路径
 * （`initialState()` 与 `src/tui/run.ts` 的 compose 态同此），显式赋 `undefined` 不是合法构造。
 */
function formOfWithoutCommandPath(target: ITuiTarget): ITuiState {
  return {
    ...initialState(),
    panel: 'form',
    buffer: target.commandPath.join(' '),
    fields: createFields(target),
    fieldIndex: 0,
  };
}

function fieldOf(state: ITuiState, name: string): { value: string; choiceIndex: number } {
  const field = state.fields.find((item) => item.declaration.name === name);
  if (field === undefined) {
    throw new Error(`字段不存在：${name}`);
  }
  return { value: field.value, choiceIndex: field.choiceIndex };
}

describe('候选计算（§3.1.1 动态交互区）', () => {
  it('空缓冲给出全部顶层段并按字典序去重', () => {
    expect(computeCandidates('', COMMAND_PATHS)).toEqual(['config', 'help', 'plugin', 'status']);
  });

  it('当前段按前缀过滤、大小写不敏感', () => {
    expect(computeCandidates('pl', COMMAND_PATHS)).toEqual(['plugin']);
    expect(computeCandidates('PLUGIN ', COMMAND_PATHS)).toEqual(['list', 'pack', 'validate']);
    expect(computeCandidates('plugin v', COMMAND_PATHS)).toEqual(['validate']);
  });

  it('已完整到叶子段后无候选', () => {
    expect(computeCandidates('status ', COMMAND_PATHS)).toEqual([]);
    expect(computeCandidates('help x', COMMAND_PATHS)).toEqual([]);
  });

  it('重复段去重并保持排序', () => {
    expect(computeCandidates('', ['plugin list', 'plugin pack', 'plugin list'])).toEqual(['plugin']);
  });

  it('splitTokens 按任意空白切分并丢弃空串', () => {
    expect(splitTokens('  chips   plugin\tlist ')).toEqual(['chips', 'plugin', 'list']);
    expect(splitTokens('')).toEqual([]);
  });
});

describe('compose 面板键位归约', () => {
  it('字符键在光标处插入并刷新候选', () => {
    const state = reduceKey(initialState(), key('char', 'p'), environment());
    expect(state.buffer).toBe('p');
    expect(state.cursor).toBe(1);
    expect(state.candidates).toEqual(['plugin']);
    expect(state.candidateIndex).toBe(0);
  });

  it('Space 键写入分隔空格', () => {
    let state = reduceKey(composeWith('plugin'), key('space'), environment());
    state = reduceKey(state, key('char', 'l'), environment());
    expect(state.buffer).toBe('plugin l');
    expect(state.cursor).toBe(8);
    expect(state.candidates).toEqual(['list']);
  });

  it('光标定位键不改动缓冲内容', () => {
    const start = composeWith('plugin');
    expect(reduceKey(start, key('left'), environment()).cursor).toBe(5);
    expect(reduceKey(start, key('right'), environment()).cursor).toBe(6);
    expect(reduceKey(start, key('left'), environment()).buffer).toBe('plugin');
  });

  it('Backspace 在光标为 0 时保持原状态', () => {
    const start = { ...composeWith('plugin'), cursor: 0 };
    expect(reduceKey(start, key('backspace'), environment())).toBe(start);
    const deleted = reduceKey(composeWith('plugi'), key('char', 'n'), environment());
    expect(reduceKey(deleted, key('backspace'), environment()).buffer).toBe('plugi');
  });

  it('上下键在候选间环绕，无候选时索引恒为 0', () => {
    const start = composeWith('');
    expect(reduceKey(start, key('up'), environment()).candidateIndex).toBe(3);
    expect(reduceKey(start, key('down'), environment()).candidateIndex).toBe(1);
    const empty = { ...initialState(), candidates: [] };
    expect(reduceKey(empty, key('up'), environment()).candidateIndex).toBe(0);
    expect(reduceKey(empty, key('down'), environment()).candidateIndex).toBe(0);
  });

  it('Enter 用当前候选补全命令段', () => {
    const next = reduceKey(composeWith('plugin '), key('enter'), environment());
    expect(next.buffer).toBe('plugin list');
    expect(next.panel).toBe('compose');
  });

  it('Enter 在候选索引上取对应候选补全', () => {
    const state = { ...composeWith('plugin '), candidateIndex: 2 };
    expect(reduceKey(state, key('enter'), environment()).buffer).toBe('plugin validate');
  });

  it('Enter 命中完整命令路径时进入参数面板', () => {
    const next = reduceKey(composeWith('plugin list'), key('enter'), environment());
    expect(next.panel).toBe('form');
    expect(next.commandPath).toBe('plugin list');
    expect(next.fields.map((item) => item.declaration.name)).toEqual(['role', 'enabled']);
    expect(next.fieldIndex).toBe(0);
  });

  it('Enter 在无参数命令上仍进入表单（零字段）', () => {
    const next = reduceKey(composeWith('status'), key('enter'), environment());
    expect(next.panel).toBe('form');
    expect(next.fields).toEqual([]);
    expect(next.commandPath).toBe('status');
  });

  it('Enter 对空缓冲与不可解析命令保持原状态', () => {
    const start = composeWith('');
    expect(reduceKey(start, key('enter'), environment())).toBe(start);
    const unknown = composeWith('nothing here');
    expect(reduceKey(unknown, key('enter'), environment())).toBe(unknown);
  });

  it('Ctrl+C 清空命令并给出提示', () => {
    const next = reduceKey(composeWith('plugin list'), key('ctrl-c'), environment());
    expect(next.panel).toBe('compose');
    expect(next.buffer).toBe('');
    expect(next.candidates).toEqual([]);
    expect(next.notice).toBe('已清空命令');
  });

  it('Escape、Ctrl+\\ 与未映射键在 compose 面板为无操作', () => {
    const start = composeWith('plugin');
    expect(reduceKey(start, key('escape'), environment())).toBe(start);
    expect(reduceKey(start, key('ctrl-backslash'), environment())).toBe(start);
    expect(reduceKey(start, key('unknown'), environment())).toBe(start);
  });
});

describe('form 面板与参数控件', () => {
  it('createFields 按声明生成默认值：default、布尔、枚举首项、空串', () => {
    const declarations: IParameterDeclaration[] = [
      { name: 'withDefault', type: 'string', default: 'x' },
      { name: 'numberDefault', type: 'integer', default: 3 },
      { name: 'flag', type: 'boolean' },
      { name: 'choice', type: 'enum', choices: ['a', 'b'] },
      { name: 'plain', type: 'string' },
      { name: 'emptyEnum', type: 'enum', choices: [] },
    ];
    const fields = createFields({ commandPath: ['cmd'], argumentsList: declarations, optionsList: [] });
    expect(fields.map((field) => field.value)).toEqual(['x', '3', 'false', 'a', '', '']);
    expect(fields.map((field) => field.kind)).toEqual(['argument', 'argument', 'argument', 'argument', 'argument', 'argument']);
    expect(createFields({ commandPath: ['cmd'], argumentsList: [], optionsList: declarations }).every((f) => f.kind === 'option')).toBe(true);
  });

  it('上下键移动字段指针并按边界收敛', () => {
    const state = formOf(PACK_TARGET);
    expect(state.fields.length).toBe(4);
    expect(reduceKey(state, key('up'), environment()).fieldIndex).toBe(0);
    expect(reduceKey(state, key('down'), environment()).fieldIndex).toBe(1);
    const last = { ...state, fieldIndex: 3 };
    expect(reduceKey(last, key('down'), environment()).fieldIndex).toBe(3);
  });

  it('左右键在 select/枚举控件上环绕切换取值', () => {
    const state = formOf(LIST_TARGET);
    const forward = reduceKey(state, key('right'), environment());
    expect(fieldOf(forward, 'role')).toEqual({ value: 'service', choiceIndex: 1 });
    const backward = reduceKey(state, key('left'), environment());
    expect(fieldOf(backward, 'role')).toEqual({ value: 'basecard', choiceIndex: 2 });
  });

  it('左右键按 ui.step 调节数值控件，空值以 0 为基准', () => {
    const state = formOf(PACK_TARGET);
    const countIndex = state.fields.findIndex((item) => item.declaration.name === 'count');
    const onCount = { ...state, fieldIndex: countIndex };
    expect(fieldOf(onCount, 'count').value).toBe('3');
    expect(fieldOf(reduceKey(onCount, key('right'), environment()), 'count').value).toBe('5');
    expect(fieldOf(reduceKey(onCount, key('left'), environment()), 'count').value).toBe('1');
    const blank = { ...onCount, fields: onCount.fields.map((item) => (item.declaration.name === 'count' ? { ...item, value: '' } : item)) };
    expect(fieldOf(reduceKey(blank, key('right'), environment()), 'count').value).toBe('2');
  });

  it('左右键对无候选枚举与文本字段为无操作', () => {
    const state = formOf({
      commandPath: ['cmd'],
      argumentsList: [{ name: 'text', type: 'string' }, { name: 'bare', type: 'enum', choices: [] }],
      optionsList: [],
    });
    expect(reduceKey({ ...state, fieldIndex: 0 }, key('right'), environment())).toEqual({ ...state, fieldIndex: 0 });
    expect(reduceKey({ ...state, fieldIndex: 1 }, key('right'), environment())).toEqual({ ...state, fieldIndex: 1 });
  });

  it('Space 在 multiSelect 上增删逗号连接项', () => {
    const state = formOf(PACK_TARGET);
    const tagsIndex = state.fields.findIndex((item) => item.declaration.name === 'tags');
    const onTags = { ...state, fieldIndex: tagsIndex };
    const first = reduceKey(onTags, key('space'), environment());
    expect(fieldOf(first, 'tags').value).toBe('beta');
    const second = reduceKey({ ...first, fields: first.fields.map((item) => (item.declaration.name === 'tags' ? { ...item, choiceIndex: 1 } : item)) }, key('space'), environment());
    expect(fieldOf(second, 'tags').value).toBe('beta,signed');
    const third = reduceKey(second, key('space'), environment());
    expect(fieldOf(third, 'tags').value).toBe('beta');
  });

  it('Space 切换布尔取值，toggle 控件按追加形态处理', () => {
    const state = formOf(LIST_TARGET);
    const flagIndex = state.fields.findIndex((item) => item.declaration.name === 'enabled');
    const onFlag = { ...state, fieldIndex: flagIndex };
    expect(fieldOf(reduceKey(onFlag, key('space'), environment()), 'enabled').value).toBe('true');
    expect(fieldOf(reduceKey(reduceKey(onFlag, key('space'), environment()), key('space'), environment()), 'enabled').value).toBe('false');
    const toggled = formOf({
      commandPath: ['cmd'],
      argumentsList: [{ name: 'switch', type: 'string', ui: { control: 'toggle' } }],
      optionsList: [],
    });
    expect(fieldOf(reduceKey(toggled, key('space'), environment()), 'switch').value).toBe('true');
    expect(fieldOf(reduceKey(reduceKey(toggled, key('space'), environment()), key('space'), environment()), 'switch').value).toBe('true,true');
  });

  it('Space 对无多选语义的字段为无操作', () => {
    const state = formOf({ commandPath: ['cmd'], argumentsList: [{ name: 'plain', type: 'string' }], optionsList: [] });
    expect(reduceKey(state, key('space'), environment())).toEqual(state);
  });

  it('字符键与 Backspace 编辑输入框，布尔与 select 拒收文本', () => {
    const state = formOf(PACK_TARGET);
    const noteIndex = state.fields.findIndex((item) => item.declaration.name === 'note');
    const onNote = { ...state, fieldIndex: noteIndex };
    const typed = reduceKey(reduceKey(onNote, key('char', 'a'), environment()), key('char', 'b'), environment());
    expect(fieldOf(typed, 'note').value).toBe('ab');
    expect(fieldOf(reduceKey(typed, key('backspace'), environment()), 'note').value).toBe('a');
    const dirIndex = state.fields.findIndex((item) => item.declaration.name === 'dir');
    expect(fieldOf(reduceKey({ ...state, fieldIndex: dirIndex }, key('char', 'z'), environment()), 'dir').value).toBe('z');
    const flagIndex = state.fields.findIndex((item) => item.declaration.name === 'enabled');
    const listState = formOf(LIST_TARGET);
    expect(reduceKey({ ...listState, fieldIndex: flagIndex }, key('char', 'z'), environment())).toEqual({
      ...listState,
      fieldIndex: flagIndex,
    });
    expect(reduceKey(listState, key('char', 'z'), environment())).toEqual(listState);
  });

  it('表单内 Enter 交由运行器执行，状态机不改动状态', () => {
    const state = formOf(LIST_TARGET);
    expect(reduceKey(state, key('enter'), environment())).toBe(state);
  });

  it('Escape 与 Ctrl+C 退回 compose 面板并保留命令路径', () => {
    const state = formOf(LIST_TARGET);
    for (const name of ['escape', 'ctrl-c'] as const) {
      const next = reduceKey({ ...state, fieldIndex: 1 }, key(name), environment());
      expect(next.panel).toBe('compose');
      expect(next.buffer).toBe('plugin list');
      expect(next.cursor).toBe(11);
      expect(next.candidates).toEqual(['list']);
    }
  });

  it('Ctrl+\\ 与未映射键在 form 面板为无操作', () => {
    const state = formOf(LIST_TARGET);
    expect(reduceKey(state, key('ctrl-backslash'), environment())).toBe(state);
    expect(reduceKey(state, key('unknown'), environment())).toBe(state);
  });

  it('字段指针越界时编辑与调节键保持原状态', () => {
    const orphan = { ...formOf(LIST_TARGET), fieldIndex: 9 };
    const env = environment();
    expect(reduceKey(orphan, key('space'), env)).toBe(orphan);
    expect(reduceKey(orphan, key('left'), env)).toBe(orphan);
    expect(reduceKey(orphan, key('char', 'q'), env)).toBe(orphan);
  });
});

describe('running 与 result 面板', () => {
  it('执行中面板吞掉全部按键（取消由运行器处理）', () => {
    const state: ITuiState = { ...formOf(LIST_TARGET), panel: 'running' };
    const env = environment();
    for (const name of ['up', 'enter', 'char', 'ctrl-c'] as const) {
      expect(reduceKey(state, key(name, 'r'), env)).toBe(state);
    }
  });

  it('结果面板 Enter/Escape/Ctrl+C 回到 compose 初始态', () => {
    const state: ITuiState = {
      ...initialState(),
      panel: 'result',
      buffer: 'plugin list',
      result: { ok: true, exitCode: 0, durationMs: 5, output: '' },
    };
    const env = environment();
    for (const name of ['enter', 'escape', 'ctrl-c'] as const) {
      const next = reduceKey(state, key(name), env);
      expect(next.panel).toBe('compose');
      expect(next.buffer).toBe('');
      expect(next.result).toBeUndefined();
    }
    expect(reduceKey(state, key('char', 'x'), env)).toBe(state);
  });
});

describe('buildTokens：表单结果交回同一执行器', () => {
  it('命令路径段、位置参数与选项按执行顺序拼装', () => {
    const state = formOf(PACK_TARGET);
    const withValues: ITuiState = {
      ...state,
      fields: state.fields.map((field) => {
        if (field.declaration.name === 'dir') {
          return { ...field, value: '/work/pkg' };
        }
        if (field.declaration.name === 'tags') {
          return { ...field, value: 'beta,signed' };
        }
        return field;
      }),
    };
    expect(buildTokens(withValues)).toEqual([
      'plugin',
      'pack',
      '/work/pkg',
      '3',
      '--tags',
      'beta,signed',
    ]);
  });

  it('布尔字段仅在置真时输出开关，空值字段整体省略', () => {
    const state = formOf(LIST_TARGET);
    expect(buildTokens(state)).toEqual(['plugin', 'list', '--role', 'app']);
    const enabled: ITuiState = {
      ...state,
      fields: state.fields.map((field) =>
        field.declaration.name === 'enabled' ? { ...field, value: 'true' } : { ...field, value: '' },
      ),
    };
    expect(buildTokens(enabled)).toEqual(['plugin', 'list', '--enabled']);
  });

  it('缺少命令路径时只输出参数 token', () => {
    const withoutPath = formOfWithoutCommandPath(LIST_TARGET);
    expect(withoutPath.commandPath).toBeUndefined();
    expect(withoutPath.fields).toEqual(formOf(LIST_TARGET).fields);
    expect(buildTokens(withoutPath)).toEqual(['--role', 'app']);
  });
});

describe('renderFrame 三段式帧', () => {
  const hint = (frame: string): string[] => frame.split('\n');

  it('顶部命令框、分隔线与底部提示栏固定存在', () => {
    const frame = renderFrame(composeWith('plugin '), 120);
    const lines = hint(frame);
    expect(lines[0]).toBe('chips > plugin ');
    expect(lines[1]).toBe('─'.repeat(120));
    expect(lines.at(-2)).toBe('─'.repeat(120));
    expect(lines.at(-1)).toBe('↑/↓ 移动 · ←/→ 光标或调节 · Space 多选 · Enter 确认或执行 · Backspace 删除 · Ctrl+C 清空或取消 · Ctrl+\\ 退出');
  });

  it('列宽小于 40 时按最小宽度渲染，超长行被截断', () => {
    const frame = renderFrame(composeWith('x'.repeat(80)), 10);
    const lines = hint(frame);
    expect(lines[1]).toBe('─'.repeat(40));
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(40);
    }
  });

  it('compose 面板标记当前候选，无候选时给出占位', () => {
    const state = { ...composeWith(''), candidateIndex: 1 };
    const lines = hint(renderFrame(state, 60));
    expect(lines).toContain('命令输入：');
    expect(lines).toContain('  > help');
    expect(lines).toContain('    config');
    expect(hint(renderFrame({ ...initialState(), candidates: [] }, 60))).toContain('  （无候选）');
  });

  it('form 面板展示控件类型、必填标记与空值占位', () => {
    const lines = hint(renderFrame(formOf(PACK_TARGET), 80));
    expect(lines).toContain('参数：plugin pack');
    expect(lines.some((line) => line.includes('dir [path/必填]: （空）'))).toBe(true);
    expect(lines.some((line) => line.includes('count [stepper/可选]: 3'))).toBe(true);
    expect(lines.some((line) => line.includes('tags [multiSelect/可选]'))).toBe(true);
    const empty = hint(renderFrame({ ...formOf(EMPTY_TARGET), fields: [] }, 80));
    expect(empty).toContain('  （无参数，按 Enter 执行）');
  });

  it('running 面板展示执行中的命令路径', () => {
    expect(hint(renderFrame({ ...formOf(LIST_TARGET), panel: 'running' }, 60))).toContain('执行中：plugin list');
  });

  it('result 面板展示退出码、耗时、错误摘要与输出前 12 行', () => {
    const output = Array.from({ length: 20 }, (_, index) => `第 ${index} 行`).join('\n');
    const failed: ITuiState = {
      ...initialState(),
      panel: 'result',
      result: {
        ok: false,
        exitCode: 5,
        durationMs: 12,
        output,
        errorCode: 'CLI_PLUGIN_FAILED',
        errorMessage: '插件返回失败',
      },
    };
    const lines = hint(renderFrame(failed, 90));
    expect(lines).toContain('失败');
    expect(lines).toContain('退出码: 5');
    expect(lines).toContain('耗时: 12 ms');
    expect(lines).toContain('错误码: CLI_PLUGIN_FAILED');
    expect(lines).toContain('错误信息: 插件返回失败');
    expect(lines).toContain('输出:');
    expect(lines).toContain('  第 0 行');
    expect(lines).toContain('  第 11 行');
    expect(lines.some((line) => line.includes('第 12 行'))).toBe(false);
    expect(lines).toContain('按 Enter 返回命令输入，按 R 重跑上一条');

    const succeeded: ITuiState = {
      ...initialState(),
      panel: 'result',
      result: { ok: true, exitCode: 0, durationMs: 1, output: '   \n' },
    };
    const okLines = hint(renderFrame(succeeded, 90));
    expect(okLines).toContain('成功');
    expect(okLines.some((line) => line.startsWith('错误码'))).toBe(false);
    expect(okLines.some((line) => line === '输出:')).toBe(false);
    expect(hint(renderFrame({ ...initialState(), panel: 'result' }, 60))).toContain('（无结果）');
  });
});

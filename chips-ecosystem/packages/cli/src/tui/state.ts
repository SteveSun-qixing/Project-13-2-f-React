/**
 * TUI 状态机（纯函数，[CLI 完整参考] §3.1.2）。
 *
 * 键盘操作：`↑/↓` 移动，`←/→` 调节/移动光标，`Space` 切换多选，`Enter` 确认或执行，
 * `Backspace` 删除片段或退回上级，`Ctrl+C` 清空命令或请求取消当前执行，`Ctrl+\` 退出。
 * 参数控件由声明的 `ui.control` 驱动（select / multiSelect / toggle / stepper / slider /
 * pathInput / pasteBox / textarea）。
 */

import type { IParameterDeclaration } from '../args/types.js';
import type { ITuiKey } from './terminal.js';

/** 面板。 */
export type TuiPanel = 'compose' | 'form' | 'running' | 'result';

/** 表单字段。 */
export interface ITuiField {
  readonly declaration: IParameterDeclaration;
  readonly kind: 'argument' | 'option';
  readonly value: string;
  readonly choiceIndex: number;
}

/** 执行结果面板数据。 */
export interface ITuiResult {
  readonly ok: boolean;
  readonly exitCode: number;
  readonly durationMs: number;
  readonly output: string;
  readonly errorCode?: string;
  readonly errorMessage?: string;
}

/** 状态。 */
export interface ITuiState {
  readonly panel: TuiPanel;
  readonly buffer: string;
  readonly cursor: number;
  readonly candidates: readonly string[];
  readonly candidateIndex: number;
  readonly fields: readonly ITuiField[];
  readonly fieldIndex: number;
  readonly result?: ITuiResult;
  readonly notice?: string;
  readonly commandPath?: string;
}

/** 解析目标：命令路径 → 参数声明。 */
export interface ITuiTarget {
  readonly commandPath: readonly string[];
  readonly argumentsList: readonly IParameterDeclaration[];
  readonly optionsList: readonly IParameterDeclaration[];
}

/** 状态机环境（由外层提供查找与候选；状态本身保持可序列化）。 */
export interface ITuiEnvironment {
  readonly commandPaths: readonly string[];
  readonly resolveTarget: (tokens: readonly string[]) => ITuiTarget | undefined;
}

/** 初始状态。 */
export function initialState(): ITuiState {
  return {
    panel: 'compose',
    buffer: '',
    cursor: 0,
    candidates: [],
    candidateIndex: 0,
    fields: [],
    fieldIndex: 0,
  };
}

/** 计算当前段的候选（前缀匹配，大小写不敏感）。 */
export function computeCandidates(buffer: string, paths: readonly string[]): readonly string[] {
  const tokens = splitTokens(buffer);
  const endsWithSpace = buffer.endsWith(' ');
  const current = endsWithSpace ? '' : (tokens[tokens.length - 1] ?? '');
  const preceding = (endsWithSpace ? tokens : tokens.slice(0, -1)).map((token) => token.toLowerCase());
  const candidates = new Set<string>();
  for (const path of paths) {
    const segments = path.split(' ');
    if (segments.length <= preceding.length) {
      continue;
    }
    // 已输入的段必须与路径对应段一致（大小写不敏感），与 §3.9 `__complete` 同语义。
    const matches = preceding.every((token, index) => (segments[index] ?? '').toLowerCase() === token);
    if (!matches) {
      continue;
    }
    const segment = segments[preceding.length];
    if (segment === undefined) {
      continue;
    }
    if (current.length === 0 || segment.toLowerCase().startsWith(current.toLowerCase())) {
      candidates.add(segment);
    }
  }
  return [...candidates].sort((left, right) => left.localeCompare(right, 'en'));
}

/** 按空白切分命令缓冲。 */
export function splitTokens(buffer: string): readonly string[] {
  return buffer.split(/\s+/).filter((token) => token.length > 0);
}

/** 应用按键到状态（纯函数）。 */
export function reduceKey(state: ITuiState, key: ITuiKey, env: ITuiEnvironment): ITuiState {
  switch (state.panel) {
    case 'compose':
      return reduceCompose(state, key, env);
    case 'form':
      return reduceForm(state, key, env);
    case 'running':
      return state;
    case 'result':
      return reduceResult(state, key);
  }
}

function reduceCompose(state: ITuiState, key: ITuiKey, env: ITuiEnvironment): ITuiState {
  switch (key.name) {
    case 'char': {
      const buffer = insertAt(state.buffer, state.cursor, key.char ?? '');
      return withBuffer(state, buffer, state.cursor + (key.char?.length ?? 0), env);
    }
    case 'space': {
      const buffer = insertAt(state.buffer, state.cursor, ' ');
      return withBuffer(state, buffer, state.cursor + 1, env);
    }
    case 'backspace': {
      if (state.cursor === 0) {
        return state;
      }
      const buffer = state.buffer.slice(0, state.cursor - 1) + state.buffer.slice(state.cursor);
      return withBuffer(state, buffer, state.cursor - 1, env);
    }
    case 'left':
      return { ...state, cursor: Math.max(0, state.cursor - 1) };
    case 'right':
      return { ...state, cursor: Math.min(state.buffer.length, state.cursor + 1) };
    case 'up':
      return {
        ...state,
        candidateIndex:
          state.candidates.length === 0
            ? 0
            : (state.candidateIndex - 1 + state.candidates.length) % state.candidates.length,
      };
    case 'down':
      return {
        ...state,
        candidateIndex: state.candidates.length === 0 ? 0 : (state.candidateIndex + 1) % state.candidates.length,
      };
    case 'enter':
      return enterCompose(state, env);
    case 'ctrl-c':
      return { ...initialState(), notice: '已清空命令' };
    case 'escape':
      return state;
    case 'ctrl-backslash':
      return state;
    default:
      return state;
  }
}

function enterCompose(state: ITuiState, env: ITuiEnvironment): ITuiState {
  const tokens = splitTokens(state.buffer);
  if (tokens.length === 0) {
    return state;
  }
  const target = env.resolveTarget(tokens);
  const endsWithSpace = state.buffer.endsWith(' ');
  const currentSegment = endsWithSpace ? '' : (tokens[tokens.length - 1] ?? '');
  const segmentMatchesPath =
    target !== undefined && target.commandPath.length === tokens.length && currentSegment.length > 0;

  if (target === undefined && state.candidates.length > 0) {
    const candidate = state.candidates[state.candidateIndex] ?? state.candidates[0];
    if (candidate !== undefined) {
      const base = endsWithSpace ? state.buffer : state.buffer.slice(0, state.buffer.length - currentSegment.length);
      const buffer = `${base}${candidate}`;
      return withBuffer(state, buffer, buffer.length, env);
    }
    return state;
  }
  if (!segmentMatchesPath && state.candidates.length > 0 && target !== undefined) {
    const candidate = state.candidates[state.candidateIndex] ?? state.candidates[0];
    if (candidate !== undefined) {
      const base = endsWithSpace ? state.buffer : state.buffer.slice(0, state.buffer.length - currentSegment.length);
      const buffer = `${base}${candidate}`;
      return withBuffer(state, buffer, buffer.length, env);
    }
    return state;
  }
  if (target === undefined) {
    return state;
  }
  const fields = createFields(target);
  if (fields.length === 0) {
    return { ...state, panel: 'form', commandPath: target.commandPath.join(' '), fields: [], fieldIndex: 0 };
  }
  return { ...state, panel: 'form', commandPath: target.commandPath.join(' '), fields, fieldIndex: 0 };
}

function reduceForm(state: ITuiState, key: ITuiKey, env: ITuiEnvironment): ITuiState {
  switch (key.name) {
    case 'up':
      return { ...state, fieldIndex: Math.max(0, state.fieldIndex - 1) };
    case 'down':
      return { ...state, fieldIndex: Math.min(state.fields.length - 1, state.fieldIndex + 1) };
    case 'left':
      return adjustChoice(state, -1);
    case 'right':
      return adjustChoice(state, 1);
    case 'space':
      return toggleField(state);
    case 'backspace':
      return editField(state, (value) => value.slice(0, -1));
    case 'char':
      return editField(state, (value) => value + (key.char ?? ''));
    case 'enter':
      return state;
    case 'escape':
    case 'ctrl-c':
      return { ...withBuffer(state, state.commandPath ?? state.buffer, (state.commandPath ?? state.buffer).length, env), panel: 'compose' };
    case 'ctrl-backslash':
      return state;
    default:
      return state;
  }
}

function reduceResult(state: ITuiState, key: ITuiKey): ITuiState {
  switch (key.name) {
    case 'enter':
      return { ...initialState() };
    case 'escape':
    case 'ctrl-c':
      return { ...initialState() };
    default:
      return state;
  }
}

/** 由声明构造表单字段。 */
export function createFields(target: ITuiTarget): readonly ITuiField[] {
  const fields: ITuiField[] = [];
  for (const declaration of target.argumentsList) {
    fields.push({ declaration, kind: 'argument', value: defaultValue(declaration), choiceIndex: 0 });
  }
  for (const declaration of target.optionsList) {
    fields.push({ declaration, kind: 'option', value: defaultValue(declaration), choiceIndex: 0 });
  }
  return fields;
}

function defaultValue(declaration: IParameterDeclaration): string {
  if (declaration.default !== undefined) {
    return typeof declaration.default === 'string' ? declaration.default : JSON.stringify(declaration.default);
  }
  if (declaration.type === 'boolean') {
    return 'false';
  }
  if (declaration.type === 'enum' && declaration.choices !== undefined && declaration.choices.length > 0) {
    return String(declaration.choices[0]);
  }
  return '';
}

function withBuffer(state: ITuiState, buffer: string, cursor: number, env: ITuiEnvironment): ITuiState {
  return {
    ...state,
    buffer,
    cursor,
    candidates: computeCandidates(buffer, env.commandPaths),
    candidateIndex: 0,
  };
}

function insertAt(text: string, index: number, insert: string): string {
  return text.slice(0, index) + insert + text.slice(index);
}

function currentField(state: ITuiState): ITuiField | undefined {
  return state.fields[state.fieldIndex];
}

function updateField(state: ITuiState, index: number, field: ITuiField): ITuiState {
  const fields = state.fields.map((item, itemIndex) => (itemIndex === index ? field : item));
  return { ...state, fields };
}

function adjustChoice(state: ITuiState, delta: number): ITuiState {
  const index = state.fieldIndex;
  const field = currentField(state);
  if (field === undefined) {
    return state;
  }
  const control = field.declaration.ui?.control;
  const choices = field.declaration.choices ?? [];
  if (control === 'select' || field.declaration.type === 'enum') {
    if (choices.length === 0) {
      return state;
    }
    const next = (field.choiceIndex + delta + choices.length) % choices.length;
    return updateField(state, index, { ...field, choiceIndex: next, value: String(choices[next]) });
  }
  if (control === 'stepper' || control === 'slider' || field.declaration.type === 'number' || field.declaration.type === 'integer') {
    const step = field.declaration.ui?.step ?? 1;
    const numeric = Number(field.value.length === 0 ? '0' : field.value);
    const base = Number.isFinite(numeric) ? numeric : 0;
    const next = base + delta * step;
    return updateField(state, index, { ...field, value: String(next) });
  }
  return state;
}

function toggleField(state: ITuiState): ITuiState {
  const index = state.fieldIndex;
  const field = currentField(state);
  if (field === undefined) {
    return state;
  }
  const control = field.declaration.ui?.control;
  if (control === 'multiSelect') {
    const choices = field.declaration.ui?.choices ?? field.declaration.choices ?? [];
    const selected = new Set(field.value.split(',').filter((item) => item.length > 0));
    const candidate = String(choices[field.choiceIndex % Math.max(1, choices.length)] ?? '');
    if (selected.has(candidate)) {
      selected.delete(candidate);
    } else if (candidate.length > 0) {
      selected.add(candidate);
    }
    return updateField(state, index, { ...field, value: [...selected].join(',') });
  }
  if (field.declaration.type === 'boolean') {
    return updateField(state, index, { ...field, value: field.value === 'true' ? 'false' : 'true' });
  }
  if (control === 'toggle' || field.declaration.type === 'stringList') {
    return updateField(state, index, { ...field, value: field.value === '' ? 'true' : `${field.value},true` });
  }
  return state;
}

function editField(state: ITuiState, edit: (value: string) => string): ITuiState {
  const index = state.fieldIndex;
  const field = currentField(state);
  if (field === undefined) {
    return state;
  }
  if (field.declaration.type === 'boolean' || field.declaration.ui?.control === 'select') {
    return state;
  }
  return updateField(state, index, { ...field, value: edit(field.value) });
}

/** 由表单字段构造执行 token（交回同一 CLI 执行器）。 */
export function buildTokens(state: ITuiState): readonly string[] {
  const commandPath = state.commandPath ?? '';
  const tokens: string[] = [...splitTokens(commandPath)];
  for (const field of state.fields) {
    if (field.declaration.type === 'boolean') {
      if (field.value === 'true') {
        tokens.push(`--${field.declaration.name}`);
      }
      continue;
    }
    if (field.value.length === 0) {
      continue;
    }
    if (field.kind === 'argument') {
      tokens.push(field.value);
      continue;
    }
    tokens.push(`--${field.declaration.name}`, field.value);
  }
  return tokens;
}

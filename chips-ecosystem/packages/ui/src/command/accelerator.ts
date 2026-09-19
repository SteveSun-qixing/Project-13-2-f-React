/**
 * 窗口内快捷键（accelerator）文法实现：解析、归一化、展示格式化与按键匹配。
 *
 * 权威：《薯片生态文档库/05-接口与契约/13-命令系统契约》§2.6（文法与归一化规则）、
 * §5.5（派发与可编辑上下文保护）。窗口内命令快捷键由平台派发；本模块只服务界面本地行为
 * （命令面板打开快捷键）与展示文本格式化，不构成第二套命令快捷键注册表。
 */

import { detectPlatform } from './platform';
import type { PlatformKind } from './platform';

type CanonicalModifier =
  'CommandOrControl' | 'Command' | 'Control' | 'Alt' | 'Shift' | 'Super' | 'Meta';

/** 归一化排序用的固定修饰符顺序（契约 §2.6）。 */
const MODIFIER_ORDER: readonly CanonicalModifier[] = [
  'CommandOrControl',
  'Command',
  'Control',
  'Alt',
  'Shift',
  'Super',
  'Meta',
];

/** 允许的修饰符拼写（大小写不敏感）。 */
const MODIFIER_ALIASES: ReadonlyMap<string, CanonicalModifier> = new Map([
  ['commandorcontrol', 'CommandOrControl'],
  ['command', 'Command'],
  ['control', 'Control'],
  ['alt', 'Alt'],
  ['option', 'Alt'],
  ['shift', 'Shift'],
  ['super', 'Super'],
  ['meta', 'Meta'],
]);

/** 允许的主键拼写（大小写不敏感）。 */
const NAMED_KEYS: readonly string[] = [
  'Space',
  'Tab',
  'Escape',
  'Enter',
  'Backspace',
  'Delete',
  'Insert',
  'Home',
  'End',
  'PageUp',
  'PageDown',
  'Up',
  'Down',
  'Left',
  'Right',
  'Plus',
  'Comma',
  'Period',
  'Slash',
  'Backslash',
  'Minus',
  'Equal',
  'BracketLeft',
  'BracketRight',
  'Semicolon',
  'Quote',
  'Backquote',
];

const NAMED_KEY_LOOKUP: ReadonlyMap<string, string> = new Map(
  NAMED_KEYS.map((key) => [key.toLowerCase(), key])
);

/** 归一化后的主键：单个字母 / 数字 / F1-F24 / 具名键。 */
function normalizeKey(raw: string): string | null {
  if (/^[a-z]$/i.test(raw)) {
    return raw.toUpperCase();
  }
  if (/^[0-9]$/.test(raw)) {
    return raw;
  }
  if (/^f([1-9]|1[0-9]|2[0-4])$/i.test(raw)) {
    return raw.toUpperCase();
  }
  return NAMED_KEY_LOOKUP.get(raw.toLowerCase()) ?? null;
}

/** 解析结果：归一化前的修饰符集合与归一化主键。 */
interface ParsedAccelerator {
  readonly modifiers: readonly CanonicalModifier[];
  readonly key: string;
}

/** 解析 accelerator；文法非法返回 `null`。 */
function parseAccelerator(accelerator: string): ParsedAccelerator | null {
  const parts = accelerator.split('+');
  const keyPart = parts[parts.length - 1];
  if (keyPart === undefined || parts.length === 0) {
    return null;
  }
  const key = normalizeKey(keyPart.trim());
  if (key === null) {
    return null;
  }

  const modifiers: CanonicalModifier[] = [];
  for (const rawModifier of parts.slice(0, -1)) {
    const modifier = MODIFIER_ALIASES.get(rawModifier.trim().toLowerCase());
    if (modifier === undefined) {
      return null;
    }
    if (!modifiers.includes(modifier)) {
      modifiers.push(modifier);
    }
  }
  return { modifiers, key };
}

/**
 * 归一化修饰符拼写（`Option` 已在解析期归一为 `Alt`）。
 *
 * 契约 §2.6：归一化输出保留 `CommandOrControl` 这一平台别名（因此它仍在固定顺序表中），
 * 只有 `Command` / `Super` / `Meta` 按平台归一；平台别名在按键匹配时解析。
 */
function normalizeModifier(modifier: CanonicalModifier, platform: PlatformKind): CanonicalModifier {
  if (modifier === 'Command' || modifier === 'Super' || modifier === 'Meta') {
    return platform === 'mac' ? 'Command' : 'Meta';
  }
  return modifier;
}

/** 匹配时解析修饰符：`CommandOrControl` 在 macOS 为 Command、其他平台为 Control。 */
function resolveModifier(modifier: CanonicalModifier, platform: PlatformKind): string {
  if (modifier === 'CommandOrControl') {
    return platform === 'mac' ? 'Command' : 'Control';
  }
  return normalizeModifier(modifier, platform);
}

/**
 * 校验 accelerator 文法。
 *
 * @param accelerator 加速键文本（如 `CommandOrControl+P`）
 * @returns 文法是否合法
 */
export function isValidAccelerator(accelerator: string): boolean {
  return parseAccelerator(accelerator) !== null;
}

/**
 * 归一化 accelerator：修饰符名称大小写不敏感、`Option` → `Alt`、按平台归一、去重并按固定顺序排列。
 *
 * @param accelerator 加速键文本
 * @param platform 目标平台；缺省按当前运行环境判定
 * @returns 归一化文本；文法非法返回 `null`
 */
export function normalizeAccelerator(
  accelerator: string,
  platform: PlatformKind = detectPlatform()
): string | null {
  const parsed = parseAccelerator(accelerator);
  if (parsed === null) {
    return null;
  }
  const normalized = new Set(
    parsed.modifiers.map((modifier) => normalizeModifier(modifier, platform))
  );
  const ordered = MODIFIER_ORDER.filter((modifier) => normalized.has(modifier));
  return [...ordered, parsed.key].join('+');
}

/** 展示用修饰符符号（macOS 使用系统符号，其他平台使用缩写）。 */
function displayModifier(modifier: CanonicalModifier, platform: PlatformKind): string {
  if (platform === 'mac') {
    switch (modifier) {
      case 'CommandOrControl':
      case 'Command':
      case 'Super':
      case 'Meta':
        return '⌘';
      case 'Control':
        return '⌃';
      case 'Alt':
        return '⌥';
      case 'Shift':
        return '⇧';
      default:
        return '';
    }
  }
  switch (modifier) {
    case 'CommandOrControl':
    case 'Control':
      return 'Ctrl';
    case 'Command':
      return 'Cmd';
    case 'Alt':
      return 'Alt';
    case 'Shift':
      return 'Shift';
    case 'Super':
      return 'Super';
    case 'Meta':
      return 'Meta';
    default:
      return '';
  }
}

/**
 * 把 accelerator 格式化为展示文本。
 *
 * @param accelerator 加速键文本
 * @param platform 目标平台；缺省按当前运行环境判定
 * @returns macOS 输出 `⌘⇧P` 形态，Windows / Linux 输出 `Ctrl+Shift+P` 形态；文法非法时原样返回
 */
export function formatAccelerator(
  accelerator: string,
  platform: PlatformKind = detectPlatform()
): string {
  const parsed = parseAccelerator(accelerator);
  if (parsed === null) {
    return accelerator;
  }
  const symbols = parsed.modifiers.map((modifier) => displayModifier(modifier, platform));
  if (platform === 'mac') {
    return `${symbols.join('')}${parsed.key}`;
  }
  return [...symbols, parsed.key].join('+');
}

/** 键盘 `code` 与契约主键名的差异映射。 */
const CODE_KEY_ALIASES: ReadonlyMap<string, string> = new Map([
  ['arrowup', 'Up'],
  ['arrowdown', 'Down'],
  ['arrowleft', 'Left'],
  ['arrowright', 'Right'],
]);

/** 键盘事件解析结果：主键与「Shift 是否已被主键消耗」。 */
interface ResolvedKey {
  readonly key: string;
  /**
   * 主键由 Shift 组合输入产生（美式布局 `Shift+=` 即 `Plus`）：
   * 此时 Shift 属于主键本身，不计入修饰符集合，`CommandOrControl+Plus` 才能匹配。
   */
  readonly consumesShift: boolean;
}

/** 键盘事件 → 归一化主键；无法映射返回 `null`。 */
function keyFromKeyboardEvent(event: KeyboardEvent): ResolvedKey | null {
  const code = event.code;
  if (/^Key[A-Z]$/.test(code)) {
    return { key: code.slice(3), consumesShift: false };
  }
  if (/^Digit[0-9]$/.test(code)) {
    return { key: code.slice(5), consumesShift: false };
  }
  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(code)) {
    return { key: code, consumesShift: false };
  }
  if (code === 'NumpadAdd') {
    return { key: 'Plus', consumesShift: false };
  }
  if (code === 'NumpadSubtract') {
    return { key: 'Minus', consumesShift: false };
  }
  if (code === 'Equal') {
    return { key: event.shiftKey ? 'Plus' : 'Equal', consumesShift: event.shiftKey };
  }
  const codeAlias = CODE_KEY_ALIASES.get(code.toLowerCase());
  if (codeAlias !== undefined) {
    return { key: codeAlias, consumesShift: false };
  }
  const codeKey = code === '' ? undefined : NAMED_KEY_LOOKUP.get(code.toLowerCase());
  if (codeKey !== undefined) {
    return { key: codeKey, consumesShift: false };
  }

  const key = event.key;
  if (key === ' ') {
    return { key: 'Space', consumesShift: false };
  }
  const keyAlias = CODE_KEY_ALIASES.get(key.toLowerCase());
  if (keyAlias !== undefined) {
    return { key: keyAlias, consumesShift: false };
  }
  const normalized = normalizeKey(key);
  return normalized === null
    ? null
    : { key: normalized, consumesShift: event.shiftKey && key === '+' };
}

/** 键盘事件的修饰符集合（按平台归一）。 */
function modifiersFromKeyboardEvent(event: KeyboardEvent, platform: PlatformKind): Set<string> {
  const modifiers = new Set<string>();
  if (event.metaKey) {
    modifiers.add(platform === 'mac' ? 'Command' : 'Meta');
  }
  if (event.ctrlKey) {
    modifiers.add('Control');
  }
  if (event.altKey) {
    modifiers.add('Alt');
  }
  if (event.shiftKey) {
    modifiers.add('Shift');
  }
  return modifiers;
}

/**
 * 判断键盘事件是否匹配 accelerator。
 *
 * 匹配使用按平台归一后的主键与修饰符集合，要求两者完全一致（不允许多余修饰符）。
 *
 * @param event 键盘事件
 * @param accelerator 加速键文本
 * @param platform 目标平台；缺省按当前运行环境判定
 * @returns 是否匹配
 */
export function matchesAccelerator(
  event: KeyboardEvent,
  accelerator: string,
  platform: PlatformKind = detectPlatform()
): boolean {
  if (event.isComposing) {
    return false;
  }
  const parsed = parseAccelerator(accelerator);
  if (parsed === null) {
    return false;
  }
  const resolvedKey = keyFromKeyboardEvent(event);
  if (resolvedKey === null || resolvedKey.key !== parsed.key) {
    return false;
  }
  const expected = new Set(parsed.modifiers.map((modifier) => resolveModifier(modifier, platform)));
  const actual = modifiersFromKeyboardEvent(event, platform);
  if (resolvedKey.consumesShift) {
    actual.delete('Shift');
  }
  if (expected.size !== actual.size) {
    return false;
  }
  for (const modifier of expected) {
    if (!actual.has(modifier)) {
      return false;
    }
  }
  return true;
}

/**
 * 判断事件目标是否处于可编辑上下文（输入框、文本域、下拉、富文本与任意 `contenteditable`）。
 *
 * 契约 §5.5：可编辑上下文中默认不派发命令快捷键；命令面板等界面本地快捷键同样不与其竞争按键。
 *
 * @param target 事件目标
 * @returns 是否处于可编辑上下文
 */
export function isEditableContext(target: EventTarget | null): boolean {
  if (typeof Element === 'undefined' || !(target instanceof Element)) {
    return false;
  }
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    return true;
  }
  if (target instanceof HTMLSelectElement) {
    return true;
  }
  const editable = target.closest('[contenteditable]');
  return editable !== null && editable.getAttribute('contenteditable') !== 'false';
}

export { detectPlatform } from './platform';
export type { PlatformKind } from './platform';

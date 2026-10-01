/**
 * 无障碍与键盘导航纯工具（矩阵裁决件：迁移自旧仓 Chips-EditingEngine `src/utils/a11y.ts:1-314`，
 * 零 Host 零 UI 纯函数，编辑器主体（卡片/箱子窗口、编辑面板、布局切换器）重写时消费）。
 *
 * 迁移适配（逐字迁移 + 类型面适配，逻辑零语义差）：
 * 1. 引号统一为工作区 prettier 单引号口径；
 * 2. `RovingTabIndex.activeId` 与 `RovingEntry.id` 索引访问补 `?? null` / `?? String(index)`
 *    收敛——工作区 tsconfig 启用 `noUncheckedIndexedAccess`（`String(index)` 即旧件
 *    `getRovingItemId` 的同名回退语义，可达路径取值不变）；
 * 3. `RovingTabIndexProps['aria-disabled']` 显式补 `| undefined`——工作区启用
 *    `exactOptionalPropertyTypes`，旧件运行时本就显式置 undefined；
 * 4. 删除旧件内声明即未使用的私有接口 `RovingItem`（工作区启用 `noUnusedLocals`）；
 * 5. `String(record.id/value)` 豁免 `no-base-to-string` 两处（源值契约上为 string，
 *    String() 兜底任意原始值与旧仓 Object 默认串化语义，逐字迁移不改写）；
 * 6. 超宽类型签名按 printWidth 换行（纯排版差异）。
 *
 * 若未来需升共享层（@chips/ui 导出面），按《矩阵 §六.2》走导出面 RFC，本包不重复登记。
 */

export interface KeyboardEventLike {
  key: string;
  shiftKey?: boolean;
}

const KEYBOARD_KEY_ALIASES: Record<string, string> = Object.freeze({
  Esc: 'Escape',
  Spacebar: ' ',
  Space: ' ',
  Up: 'ArrowUp',
  Down: 'ArrowDown',
  Left: 'ArrowLeft',
  Right: 'ArrowRight',
});

export function normalizeKeyboardKey(eventOrKey: KeyboardEventLike | string): string {
  const source =
    eventOrKey && typeof eventOrKey === 'object' && 'key' in eventOrKey
      ? eventOrKey.key
      : eventOrKey;
  const key = typeof source === 'string' ? source : '';
  return KEYBOARD_KEY_ALIASES[key] ?? key;
}

export interface KeyboardMap {
  actions: Record<string, readonly string[]>;
  getAction(eventOrKey: KeyboardEventLike | string): string | null;
  hasAction(action: string): boolean;
  hasKey(eventOrKey: KeyboardEventLike | string): boolean;
  entries(): Array<{ action: string; key: string }>;
}

export function createKeyboardMap(definition: Record<string, string | string[]> = {}): KeyboardMap {
  const actionToKeys: Record<string, string[]> = {};
  const keyToAction = new Map<string, string>();

  for (const [action, keys] of Object.entries(definition)) {
    const normalizedKeys: string[] = [];
    const sourceKeys = Array.isArray(keys) ? keys : [keys];

    for (const key of sourceKeys) {
      const normalizedKey = normalizeKeyboardKey(key);
      if (normalizedKey.length === 0 || normalizedKeys.includes(normalizedKey)) {
        continue;
      }
      normalizedKeys.push(normalizedKey);
      keyToAction.set(normalizedKey, action);
    }

    actionToKeys[action] = Object.freeze(normalizedKeys) as string[];
  }

  const frozenActions: Record<string, readonly string[]> = Object.freeze(actionToKeys);

  return Object.freeze({
    actions: frozenActions,
    getAction(eventOrKey: KeyboardEventLike | string): string | null {
      return keyToAction.get(normalizeKeyboardKey(eventOrKey)) ?? null;
    },
    hasAction(action: string): boolean {
      return Object.prototype.hasOwnProperty.call(actionToKeys, action);
    },
    hasKey(eventOrKey: KeyboardEventLike | string): boolean {
      return keyToAction.has(normalizeKeyboardKey(eventOrKey));
    },
    entries(): Array<{ action: string; key: string }> {
      return Object.entries(frozenActions).flatMap(([action, keys]) =>
        keys.map((key) => ({ action, key })),
      );
    },
  });
}

export const DEFAULT_KEYBOARD_MAP: KeyboardMap = createKeyboardMap({
  activate: ['Enter', ' '],
  dismiss: 'Escape',
  navigate: 'Tab',
  next: ['ArrowDown', 'ArrowRight'],
  previous: ['ArrowUp', 'ArrowLeft'],
  first: 'Home',
  last: 'End',
});

export const VERTICAL_ROVING_KEYBOARD_MAP: KeyboardMap = createKeyboardMap({
  next: 'ArrowDown',
  previous: 'ArrowUp',
  first: 'Home',
  last: 'End',
});

export const HORIZONTAL_ROVING_KEYBOARD_MAP: KeyboardMap = createKeyboardMap({
  next: 'ArrowRight',
  previous: 'ArrowLeft',
  first: 'Home',
  last: 'End',
});

export function getKeyboardAction(
  eventOrKey: KeyboardEventLike | string,
  keyboardMap: KeyboardMap | Map<string, string> = DEFAULT_KEYBOARD_MAP,
): string | null {
  if (keyboardMap && typeof (keyboardMap as KeyboardMap).getAction === 'function') {
    return (keyboardMap as KeyboardMap).getAction(eventOrKey);
  }

  if (keyboardMap instanceof Map) {
    return keyboardMap.get(normalizeKeyboardKey(eventOrKey)) ?? null;
  }

  return DEFAULT_KEYBOARD_MAP.getAction(eventOrKey);
}

interface RovingOptions {
  activeIndex?: number;
  activeId?: string | null;
  selectedId?: string | null;
  disabledKey?: string;
  loop?: boolean;
  orientation?: 'horizontal' | 'vertical';
  keyboardMap?: KeyboardMap;
}

interface RovingEntry<T> {
  item: T;
  id: string;
  index: number;
  disabled: boolean;
  active: boolean;
  tabIndex: number;
}

export interface RovingTabIndex<T> {
  activeIndex: number;
  activeId: string | null;
  items: ReadonlyArray<RovingEntry<T>>;
  getNextIndex(
    direction?: 'next' | 'previous' | 'prev',
    moveOptions?: { fromIndex?: number; loop?: boolean },
  ): number;
  getIndexByKey(eventOrKey: KeyboardEventLike | string, keyOptions?: RovingOptions): number;
}

function getRovingItemId(item: unknown, index: number): string {
  if (item && typeof item === 'object') {
    const record = item as Record<string, unknown>;
    // 源值契约上为 string；String() 兜底其余原始值并沿用旧仓 Object 默认串化语义（逐字迁移不改写）。
    if (record.id !== undefined && record.id !== null) {
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      return String(record.id);
    }
    if (record.value !== undefined && record.value !== null) {
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      return String(record.value);
    }
  }
  return String(index);
}

function isRovingItemDisabled(item: unknown, disabledKey = 'disabled'): boolean {
  return Boolean(
    item && typeof item === 'object' && (item as Record<string, unknown>)[disabledKey] === true,
  );
}

function getNextEnabledRovingIndex(
  items: unknown[],
  startIndex: number,
  direction: 'next' | 'previous' | 'prev' = 'next',
  loop = true,
  disabledKey = 'disabled',
): number {
  if (!Array.isArray(items) || items.length === 0) {
    return -1;
  }

  const step = direction === 'previous' || direction === 'prev' ? -1 : 1;
  let index = startIndex;

  for (let count = 0; count < items.length; count += 1) {
    index += step;

    if (loop) {
      if (index >= items.length) {
        index = 0;
      }
      if (index < 0) {
        index = items.length - 1;
      }
    } else if (index < 0 || index >= items.length) {
      return -1;
    }

    if (!isRovingItemDisabled(items[index], disabledKey)) {
      return index;
    }
  }

  return -1;
}

export function getRovingIndexByKey(
  items: unknown[],
  currentIndex: number,
  eventOrKey: KeyboardEventLike | string,
  options: RovingOptions = {},
): number {
  const orientation = options.orientation === 'vertical' ? 'vertical' : 'horizontal';
  const keyboardMap =
    options.keyboardMap ??
    (orientation === 'vertical' ? VERTICAL_ROVING_KEYBOARD_MAP : HORIZONTAL_ROVING_KEYBOARD_MAP);
  const action = getKeyboardAction(eventOrKey, keyboardMap);
  const disabledKey = options.disabledKey ?? 'disabled';

  if (action === 'first') {
    return getNextEnabledRovingIndex(items, -1, 'next', true, disabledKey);
  }

  if (action === 'last') {
    return getNextEnabledRovingIndex(items, 0, 'prev', true, disabledKey);
  }

  if (action === 'next' || action === 'previous') {
    return getNextEnabledRovingIndex(
      items,
      currentIndex,
      action,
      options.loop !== false,
      disabledKey,
    );
  }

  return -1;
}

export interface RovingTabIndexProps {
  tabIndex: number;
  'data-active': string;
  'aria-disabled'?: string | undefined;
}

export function getRovingTabIndexProps(
  rovingItem: { disabled?: boolean; active?: boolean } | null | undefined,
  options: { includeAriaDisabled?: boolean } = {},
): RovingTabIndexProps {
  const disabled = rovingItem?.disabled === true;
  const active = rovingItem?.active === true;
  return {
    tabIndex: disabled ? -1 : active ? 0 : -1,
    'data-active': String(active),
    'aria-disabled': disabled && options.includeAriaDisabled !== false ? 'true' : undefined,
  };
}

export function createRovingTabIndex<T>(
  items: T[] = [],
  options: RovingOptions = {},
): RovingTabIndex<T> {
  const sourceItems = Array.isArray(items) ? items : [];
  const disabledKey = options.disabledKey ?? 'disabled';
  const ids = sourceItems.map((item, index) => getRovingItemId(item, index));
  const preferredId = options.activeId ?? options.selectedId;
  let activeIndex =
    typeof options.activeIndex === 'number'
      ? options.activeIndex
      : preferredId !== undefined && preferredId !== null
        ? ids.indexOf(String(preferredId))
        : -1;

  if (
    activeIndex < 0 ||
    activeIndex >= sourceItems.length ||
    isRovingItemDisabled(sourceItems[activeIndex], disabledKey)
  ) {
    activeIndex = getNextEnabledRovingIndex(sourceItems, -1, 'next', true, disabledKey);
  }

  const rovingItems = sourceItems.map((item, index) => {
    const disabled = isRovingItemDisabled(item, disabledKey);
    const active = index === activeIndex && !disabled;
    return {
      item,
      id: ids[index] ?? String(index),
      index,
      disabled,
      active,
      tabIndex: disabled ? -1 : active ? 0 : -1,
    };
  });

  return Object.freeze({
    activeIndex,
    activeId: activeIndex >= 0 ? (ids[activeIndex] ?? null) : null,
    items: Object.freeze(rovingItems),
    getNextIndex(
      direction: 'next' | 'previous' | 'prev' = 'next',
      moveOptions: { fromIndex?: number; loop?: boolean } = {},
    ): number {
      return getNextEnabledRovingIndex(
        sourceItems,
        moveOptions.fromIndex ?? activeIndex,
        direction,
        moveOptions.loop ?? options.loop ?? true,
        disabledKey,
      );
    },
    getIndexByKey(eventOrKey: KeyboardEvent | string, keyOptions: RovingOptions = {}): number {
      return getRovingIndexByKey(sourceItems, activeIndex, eventOrKey, {
        ...options,
        ...keyOptions,
      });
    },
  });
}

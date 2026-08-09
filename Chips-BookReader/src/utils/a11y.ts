export type KeyboardAction = string;
export type RovingDirection = "next" | "previous" | "prev";

export interface KeyboardMap {
  readonly actions: Readonly<Record<string, readonly string[]>>;
  getAction(eventOrKey: unknown): string | null;
}

const KEYBOARD_KEY_ALIASES: Record<string, string> = {
  Esc: "Escape",
  Spacebar: " ",
  Space: " ",
  Up: "ArrowUp",
  Down: "ArrowDown",
  Left: "ArrowLeft",
  Right: "ArrowRight",
};

export function normalizeKeyboardKey(eventOrKey: unknown): string {
  const source =
    eventOrKey && typeof eventOrKey === "object" && "key" in eventOrKey
      ? (eventOrKey as { key: unknown }).key
      : eventOrKey;
  const key = typeof source === "string" ? source : "";
  return KEYBOARD_KEY_ALIASES[key] ?? key;
}

export function createKeyboardMap(definition: Record<string, string | string[]> = {}): KeyboardMap {
  const actionToKeys: Record<string, readonly string[]> = {};
  const keyToAction = new Map<string, string>();

  for (const [action, keys] of Object.entries(definition)) {
    const sourceKeys = Array.isArray(keys) ? keys : [keys];
    const normalizedKeys: string[] = [];
    for (const key of sourceKeys) {
      const normalizedKey = normalizeKeyboardKey(key);
      if (normalizedKey.length === 0 || normalizedKeys.includes(normalizedKey)) {
        continue;
      }
      normalizedKeys.push(normalizedKey);
      keyToAction.set(normalizedKey, action);
    }
    actionToKeys[action] = Object.freeze(normalizedKeys);
  }

  return Object.freeze({
    actions: Object.freeze(actionToKeys),
    getAction(eventOrKey: unknown): string | null {
      return keyToAction.get(normalizeKeyboardKey(eventOrKey)) ?? null;
    },
  });
}

export function getKeyboardAction(eventOrKey: unknown, keyboardMap?: KeyboardMap): string | null {
  if (keyboardMap && typeof keyboardMap.getAction === "function") {
    return keyboardMap.getAction(eventOrKey);
  }
  return null;
}

export interface RovingOptions {
  activeId?: string | number | null;
  selectedId?: string | number | null;
  orientation?: "horizontal" | "vertical";
  loop?: boolean;
  disabledKey?: string;
  keyboardMap?: KeyboardMap;
}

export interface RovingItem<T = unknown> {
  item: T;
  id: string;
  index: number;
  disabled: boolean;
  active: boolean;
  tabIndex: number;
}

export interface RovingTabIndexModel<T = unknown> {
  readonly activeIndex: number;
  readonly activeId: string | null;
  readonly items: readonly RovingItem<T>[];
  getIndexByKey(eventOrKey: unknown, options?: RovingOptions): number;
}

function getRovingItemId(item: unknown, index: number): string {
  if (item && typeof item === "object") {
    const record = item as { id?: unknown; value?: unknown };
    if (record.id !== undefined && record.id !== null) {
      return String(record.id);
    }
    if (record.value !== undefined && record.value !== null) {
      return String(record.value);
    }
  }
  return String(index);
}

function isRovingItemDisabled(item: unknown, disabledKey: string): boolean {
  return Boolean(
    item && typeof item === "object" && (item as Record<string, unknown>)[disabledKey] === true,
  );
}

function getNextEnabledRovingIndex<T>(
  items: T[],
  startIndex: number,
  direction: RovingDirection,
  loop: boolean,
  disabledKey: string,
): number {
  if (items.length === 0) {
    return -1;
  }

  const step = direction === "previous" || direction === "prev" ? -1 : 1;
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

function getRovingIndexByKey<T>(
  items: T[],
  currentIndex: number,
  eventOrKey: unknown,
  options: RovingOptions,
): number {
  const orientation = options.orientation === "vertical" ? "vertical" : "horizontal";
  const keyboardMap =
    options.keyboardMap ??
    createKeyboardMap(
      orientation === "vertical"
        ? { next: "ArrowDown", previous: "ArrowUp", first: "Home", last: "End" }
        : { next: "ArrowRight", previous: "ArrowLeft", first: "Home", last: "End" },
    );
  const action = getKeyboardAction(eventOrKey, keyboardMap);
  const disabledKey = options.disabledKey ?? "disabled";
  const loop = options.loop !== false;

  if (action === "first") {
    return getNextEnabledRovingIndex(items, -1, "next", true, disabledKey);
  }
  if (action === "last") {
    return getNextEnabledRovingIndex(items, 0, "prev", true, disabledKey);
  }
  if (action === "next" || action === "previous") {
    return getNextEnabledRovingIndex(items, currentIndex, action, loop, disabledKey);
  }
  return -1;
}

export function createRovingTabIndex<T = unknown>(
  items: T[] = [],
  options: RovingOptions = {},
): RovingTabIndexModel<T> {
  const sourceItems = Array.isArray(items) ? items : [];
  const disabledKey = options.disabledKey ?? "disabled";
  const ids = sourceItems.map((item, index) => getRovingItemId(item, index));
  const preferredId = options.activeId ?? options.selectedId;
  let activeIndex =
    preferredId !== undefined && preferredId !== null ? ids.indexOf(String(preferredId)) : -1;

  if (
    activeIndex < 0 ||
    activeIndex >= sourceItems.length ||
    isRovingItemDisabled(sourceItems[activeIndex], disabledKey)
  ) {
    activeIndex = getNextEnabledRovingIndex(sourceItems, -1, "next", true, disabledKey);
  }

  const rovingItems = sourceItems.map((item, index) => {
    const disabled = isRovingItemDisabled(item, disabledKey);
    const active = index === activeIndex && !disabled;
    return Object.freeze({
      item,
      id: ids[index],
      index,
      disabled,
      active,
      tabIndex: disabled ? -1 : active ? 0 : -1,
    });
  });

  return Object.freeze({
    activeIndex,
    activeId: activeIndex >= 0 ? ids[activeIndex] : null,
    items: Object.freeze(rovingItems),
    getIndexByKey(eventOrKey: unknown, keyOptions: RovingOptions = {}): number {
      return getRovingIndexByKey(sourceItems, activeIndex, eventOrKey, {
        ...options,
        ...keyOptions,
      });
    },
  });
}

export function getRovingTabIndexProps(
  rovingItem?: Partial<RovingItem> | null,
  options: { includeAriaDisabled?: boolean } = {},
): { tabIndex: number; "data-active": string; "aria-disabled"?: "true" } {
  const disabled = rovingItem?.disabled === true;
  const active = rovingItem?.active === true;
  return {
    tabIndex: disabled ? -1 : active ? 0 : -1,
    "data-active": String(active),
    "aria-disabled": disabled && options.includeAriaDisabled !== false ? "true" : undefined,
  };
}

export interface FocusRestorePoint {
  readonly element: Element | null;
  restore(options?: FocusRestoreOptions): Element | null;
}

export interface FocusRestoreOptions {
  fallback?: Element | Element[] | null;
}

export interface FocusScope {
  readonly root: Element;
  readonly restorePoint: FocusRestorePoint;
  focusFirst(): Element | null;
  restore(options?: FocusRestoreOptions): Element | null;
  handleKeyDown(event: KeyboardEvent, options?: { trap?: boolean }): boolean;
}

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button",
  "input",
  "select",
  "textarea",
  "summary",
  "details",
  "[tabindex]",
  "[contenteditable='true']",
].join(",");

function isFocusableElement(element: Element, includeNegativeTabIndex: boolean): boolean {
  const tagName = element.tagName.toLowerCase();
  const tabIndexAttr = element.getAttribute("tabindex");
  const tabIndex = tabIndexAttr !== null ? Number(tabIndexAttr) : 0;
  const hasExplicitNegativeTabIndex = Number.isFinite(tabIndex) && tabIndex < 0;
  if (hasExplicitNegativeTabIndex && !includeNegativeTabIndex) {
    return false;
  }
  if (tagName === "button" || tagName === "input" || tagName === "select" || tagName === "textarea") {
    return !(element as HTMLButtonElement | HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).disabled;
  }
  return element.getAttribute("aria-disabled") !== "true";
}

function getFocusableElements(root: Element, includeNegativeTabIndex: boolean): Element[] {
  const candidates = [root, ...Array.from(root.querySelectorAll(FOCUSABLE_SELECTOR))];
  return candidates.filter((element) => isFocusableElement(element, includeNegativeTabIndex));
}

function getOwnerDocument(root: Element): Document {
  return root.ownerDocument;
}

export function createFocusScope(
  root: Element,
  options: { restorePoint?: FocusRestorePoint; fallback?: Element; trap?: boolean } = {},
): FocusScope {
  const restorePoint =
    options.restorePoint ?? {
      element: getOwnerDocument(root).activeElement,
      restore(restoreOptions?: FocusRestoreOptions): Element | null {
        return restoreFocus(restorePoint.element, restoreOptions);
      },
    };

  const focusAt = (direction: "first" | "last"): Element | null => {
    const elements = getFocusableElements(root, false);
    const target = direction === "last" ? elements[elements.length - 1] : elements[0];
    return restoreFocus(target, { fallback: options.fallback });
  };

  return Object.freeze({
    root,
    restorePoint,
    focusFirst(): Element | null {
      return focusAt("first");
    },
    restore(restoreOptions?: FocusRestoreOptions): Element | null {
      return restorePoint.restore(restoreOptions);
    },
    handleKeyDown(event: KeyboardEvent, trapOptions: { trap?: boolean } = {}): boolean {
      if (options.trap === false && trapOptions.trap !== true) {
        return false;
      }
      if (normalizeKeyboardKey(event) !== "Tab") {
        return false;
      }
      const elements = getFocusableElements(root, true);
      if (elements.length === 0) {
        return false;
      }
      const current = getOwnerDocument(root).activeElement;
      const currentIndex = current !== null ? elements.indexOf(current) : -1;
      const isShiftTab = event.shiftKey === true;
      let target: Element | null = null;

      if (currentIndex < 0 || !root.contains(current)) {
        target = isShiftTab ? elements[elements.length - 1] : elements[0];
      } else if (isShiftTab && currentIndex === 0) {
        target = elements[elements.length - 1];
      } else if (!isShiftTab && currentIndex === elements.length - 1) {
        target = elements[0];
      }

      if (!target) {
        return false;
      }

      event.preventDefault();
      (target as HTMLElement).focus();
      return true;
    },
  });
}

export function restoreFocus(target: unknown, options: FocusRestoreOptions = {}): Element | null {
  const candidates = [target, options.fallback].flat().filter((item) => item instanceof Element) as Element[];

  for (const candidate of candidates) {
    if (!candidate.isConnected) {
      continue;
    }
    if (isFocusableElement(candidate, true)) {
      (candidate as HTMLElement).focus();
      return candidate;
    }
  }

  return null;
}

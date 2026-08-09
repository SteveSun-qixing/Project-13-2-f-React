export type KeyboardIntent = "activate" | "dismiss" | "navigate" | "unknown";
export type KeyboardAction = string;
export type RovingDirection = "next" | "previous" | "prev";

export interface AriaIssue {
  code: string;
  message: string;
  prop?: string;
}

export interface AriaRules {
  requireLabel?: boolean;
  role?: string | string[];
  requiredProps?: string[];
  requireControlsWhenExpanded?: boolean;
  requireActiveDescendantWhenExpanded?: boolean;
  requireSelected?: boolean;
  requireChecked?: boolean;
}

export interface KeyboardMap {
  readonly actions: Readonly<Record<string, readonly string[]>>;
  getAction(eventOrKey: unknown): string | null;
  hasAction(action: string): boolean;
  hasKey(eventOrKey: unknown): boolean;
  entries(): Array<{ action: string; key: string }>;
}

export interface FocusLikeElement {
  disabled?: boolean;
  hidden?: boolean;
  inert?: boolean;
  tabIndex?: number;
  isConnected?: boolean;
  ownerDocument?: Document;
  style?: { display?: string; visibility?: string };
  focus(options?: FocusOptions): void;
  getAttribute?(name: string): string | null;
  querySelectorAll?(selectors: string): Iterable<FocusLikeElement>;
  children?: FocusLikeElement[];
}

export interface FocusRestorePoint {
  readonly element: FocusLikeElement | Element | null;
  restore(options?: FocusRestoreOptions): FocusLikeElement | Element | null;
}

export interface FocusRestoreOptions {
  fallback?: FocusLikeElement | Element | Array<FocusLikeElement | Element | null | undefined> | null;
  focusOptions?: FocusOptions;
}

export interface FocusScope {
  readonly root: FocusLikeElement | Element | Array<FocusLikeElement | Element>;
  readonly restorePoint: FocusRestorePoint;
  getElements(options?: GetFocusableOptions): Array<FocusLikeElement | Element>;
  focusFirst(): FocusLikeElement | Element | null;
  focusLast(): FocusLikeElement | Element | null;
  move(options?: MoveFocusOptions & { current?: FocusLikeElement | Element | null }): number;
  trap(event: KeyboardEvent | { key?: string; shiftKey?: boolean; preventDefault?(): void }, options?: TrapFocusOptions): boolean;
  restore(options?: FocusRestoreOptions): FocusLikeElement | Element | null;
  handleKeyDown(event: KeyboardEvent | { key?: string; shiftKey?: boolean; preventDefault?(): void }, options?: TrapFocusOptions): boolean;
}

export interface GetFocusableOptions {
  includeRoot?: boolean;
  includeNegativeTabIndex?: boolean;
  tabbable?: boolean;
}

export interface MoveFocusOptions {
  fromIndex?: number;
  direction?: "next" | "prev";
  loop?: boolean;
}

export interface TrapFocusOptions {
  current?: FocusLikeElement | Element | null;
  event?: KeyboardEvent | { target?: unknown; shiftKey?: boolean };
  direction?: "next" | "prev";
  focusOptions?: FocusOptions;
}

export interface RovingOptions {
  activeId?: string | number | null;
  selectedId?: string | number | null;
  activeIndex?: number;
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
  getNextIndex(direction?: RovingDirection, options?: { fromIndex?: number; loop?: boolean }): number;
  getIndexByKey(eventOrKey: unknown, options?: RovingOptions): number;
}

export function normalizeKeyboardKey(eventOrKey: unknown): string;
export function isKeyboardActivationKey(key: unknown): boolean;
export function isKeyboardNavigationKey(key: unknown): boolean;
export function getKeyboardIntent(key: unknown): KeyboardIntent;
export function createKeyboardMap(definition?: Record<string, string | string[]>): KeyboardMap;
export const DEFAULT_KEYBOARD_MAP: KeyboardMap;
export const VERTICAL_ROVING_KEYBOARD_MAP: KeyboardMap;
export const HORIZONTAL_ROVING_KEYBOARD_MAP: KeyboardMap;
export function getKeyboardAction(eventOrKey: unknown, keyboardMap?: KeyboardMap | Map<string, string>): string | null;

export function createAriaStatusProps(options?: { live?: "off" | "polite" | "assertive"; atomic?: boolean }): {
  "aria-live": string;
  "aria-atomic": string;
  role: "status";
};
export function buildAriaDescribedBy(ids: unknown): string;
export function validateAriaProps(props?: Record<string, unknown>, rules?: AriaRules): AriaIssue[];
export function assertAriaProps(props?: Record<string, unknown>, rules?: AriaRules): true;

export function isFocusableElement(node: unknown, options?: { includeNegativeTabIndex?: boolean }): boolean;
export function isTabbableElement(node: unknown): boolean;
export function getFocusableElements(root: unknown, options?: GetFocusableOptions): Array<FocusLikeElement | Element>;
export function moveFocus(elements: unknown[], options?: MoveFocusOptions): number;
export function createFocusRestorePoint(rootOrDocument?: FocusLikeElement | Document | null): FocusRestorePoint;
export function restoreFocus(target: unknown, options?: FocusRestoreOptions): FocusLikeElement | Element | null;
export function getFocusTrapTarget(root: unknown, options?: TrapFocusOptions): FocusLikeElement | Element | null;
export function trapFocus(event: KeyboardEvent | { key?: string; shiftKey?: boolean; preventDefault?(): void }, root: unknown, options?: TrapFocusOptions): boolean;
export function createFocusScope(root: unknown, options?: { restorePoint?: FocusRestorePoint; fallback?: FocusLikeElement | Element; focusOptions?: FocusOptions; trap?: boolean }): FocusScope;

export function getRovingIndexByKey<T = unknown>(items: T[], currentIndex: number, eventOrKey: unknown, options?: RovingOptions): number;
export function createRovingTabIndex<T = unknown>(items?: T[], options?: RovingOptions): RovingTabIndexModel<T>;
export function getRovingTabIndexProps(rovingItem?: Partial<RovingItem> | null, options?: { includeAriaDisabled?: boolean }): {
  tabIndex: number;
  "data-active": string;
  "aria-disabled"?: "true";
};

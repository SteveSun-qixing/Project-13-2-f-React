export function isKeyboardActivationKey(key) {
  const normalizedKey = normalizeKeyboardKey(key);
  return normalizedKey === "Enter" || normalizedKey === " ";
}

export function isKeyboardNavigationKey(key) {
  const normalizedKey = normalizeKeyboardKey(key);
  return normalizedKey === "ArrowUp" || normalizedKey === "ArrowDown" || normalizedKey === "ArrowLeft" || normalizedKey === "ArrowRight" || normalizedKey === "Home" || normalizedKey === "End";
}

export function getKeyboardIntent(key) {
  const normalizedKey = normalizeKeyboardKey(key);

  if (isKeyboardActivationKey(normalizedKey)) {
    return "activate";
  }

  if (normalizedKey === "Escape") {
    return "dismiss";
  }

  if (normalizedKey === "Tab" || isKeyboardNavigationKey(normalizedKey)) {
    return "navigate";
  }

  return "unknown";
}

const KEYBOARD_KEY_ALIASES = Object.freeze({
  Esc: "Escape",
  Spacebar: " ",
  Space: " ",
  Up: "ArrowUp",
  Down: "ArrowDown",
  Left: "ArrowLeft",
  Right: "ArrowRight"
});

export function normalizeKeyboardKey(eventOrKey) {
  const source = eventOrKey && typeof eventOrKey === "object" && "key" in eventOrKey
    ? eventOrKey.key
    : eventOrKey;
  const key = typeof source === "string" ? source : "";
  return KEYBOARD_KEY_ALIASES[key] || key;
}

export function createKeyboardMap(definition = {}) {
  const actionToKeys = {};
  const keyToAction = new Map();

  for (const [action, keys] of Object.entries(definition)) {
    const normalizedKeys = [];
    const sourceKeys = Array.isArray(keys) ? keys : [keys];

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
    getAction(eventOrKey) {
      return keyToAction.get(normalizeKeyboardKey(eventOrKey)) || null;
    },
    hasAction(action) {
      return Object.hasOwn(actionToKeys, action);
    },
    hasKey(eventOrKey) {
      return keyToAction.has(normalizeKeyboardKey(eventOrKey));
    },
    entries() {
      return Object.entries(actionToKeys).flatMap(([action, keys]) =>
        keys.map((key) => ({ action, key }))
      );
    }
  });
}

export const DEFAULT_KEYBOARD_MAP = createKeyboardMap({
  activate: ["Enter", " "],
  dismiss: "Escape",
  navigate: "Tab",
  next: ["ArrowDown", "ArrowRight"],
  previous: ["ArrowUp", "ArrowLeft"],
  first: "Home",
  last: "End"
});

export const VERTICAL_ROVING_KEYBOARD_MAP = createKeyboardMap({
  next: "ArrowDown",
  previous: "ArrowUp",
  first: "Home",
  last: "End"
});

export const HORIZONTAL_ROVING_KEYBOARD_MAP = createKeyboardMap({
  next: "ArrowRight",
  previous: "ArrowLeft",
  first: "Home",
  last: "End"
});

export function getKeyboardAction(eventOrKey, keyboardMap = DEFAULT_KEYBOARD_MAP) {
  if (keyboardMap && typeof keyboardMap.getAction === "function") {
    return keyboardMap.getAction(eventOrKey);
  }

  if (keyboardMap instanceof Map) {
    return keyboardMap.get(normalizeKeyboardKey(eventOrKey)) || null;
  }

  return DEFAULT_KEYBOARD_MAP.getAction(eventOrKey);
}

export function createAriaStatusProps(options = {}) {
  const {
    live = "polite",
    atomic = true
  } = options;

  return {
    "aria-live": live,
    "aria-atomic": atomic ? "true" : "false",
    role: "status"
  };
}

export function buildAriaDescribedBy(ids) {
  if (!Array.isArray(ids)) {
    return "";
  }

  const filtered = [];
  const seen = new Set();

  for (const id of ids) {
    if (typeof id !== "string" || id.length === 0 || seen.has(id)) {
      continue;
    }
    seen.add(id);
    filtered.push(id);
  }

  return filtered.join(" ");
}

export function validateAriaProps(props = {}, rules = {}) {
  const issues = [];

  if (rules.requireLabel === true) {
    const hasLabel = typeof props["aria-label"] === "string" && props["aria-label"].trim().length > 0;
    const hasLabelledBy = typeof props["aria-labelledby"] === "string" && props["aria-labelledby"].trim().length > 0;
    if (!hasLabel && !hasLabelledBy) {
      issues.push({
        code: "A11Y_LABEL_MISSING",
        message: "Either aria-label or aria-labelledby is required."
      });
    }
  }

  if (typeof rules.role === "string") {
    if (props.role !== rules.role) {
      issues.push({
        code: "A11Y_ROLE_INVALID",
        message: `Expected role ${rules.role}.`
      });
    }
  }

  if (Array.isArray(rules.role)) {
    if (!rules.role.includes(props.role)) {
      issues.push({
        code: "A11Y_ROLE_INVALID",
        message: `Expected one of roles ${rules.role.join(", ")}.`
      });
    }
  }

  if (Array.isArray(rules.requiredProps)) {
    for (const key of rules.requiredProps) {
      const value = props[key];
      if (value === undefined || value === null || (typeof value === "string" && value.trim().length === 0)) {
        issues.push({
          code: "A11Y_PROP_MISSING",
          message: `${key} is required.`,
          prop: key
        });
      }
    }
  }

  if (rules.requireControlsWhenExpanded === true && props["aria-expanded"] === "true") {
    if (typeof props["aria-controls"] !== "string" || props["aria-controls"].length === 0) {
      issues.push({
        code: "A11Y_ARIA_CONTROLS_MISSING",
        message: "aria-controls is required when aria-expanded is true."
      });
    }
  }

  if (rules.requireActiveDescendantWhenExpanded === true && props["aria-expanded"] === "true") {
    if (typeof props["aria-activedescendant"] !== "string" || props["aria-activedescendant"].trim().length === 0) {
      issues.push({
        code: "A11Y_ACTIVE_DESCENDANT_MISSING",
        message: "aria-activedescendant is required when the active option is managed virtually."
      });
    }
  }

  if (rules.requireSelected === true && props["aria-selected"] !== "true" && props["aria-selected"] !== "false") {
    issues.push({
      code: "A11Y_SELECTED_STATE_MISSING",
      message: "aria-selected must be true or false."
    });
  }

  if (rules.requireChecked === true && props["aria-checked"] !== "true" && props["aria-checked"] !== "false") {
    issues.push({
      code: "A11Y_CHECKED_STATE_MISSING",
      message: "aria-checked must be true or false."
    });
  }

  return issues;
}

export function assertAriaProps(props, rules) {
  const issues = validateAriaProps(props, rules);
  if (issues.length > 0) {
    const first = issues[0];
    const error = new Error(first.message);
    error.code = first.code;
    error.details = issues;
    throw error;
  }
  return true;
}

export function isFocusableElement(node) {
  const options = arguments.length > 1 && arguments[1] && typeof arguments[1] === "object"
    ? arguments[1]
    : {};

  if (!node || typeof node !== "object") {
    return false;
  }

  if (isUnavailableForFocus(node)) {
    return false;
  }

  if (getElementTabIndex(node) < 0 && options.includeNegativeTabIndex !== true) {
    return false;
  }

  if (typeof node.focus !== "function") {
    return false;
  }

  return true;
}

function getNodeAttribute(node, name) {
  if (!node || typeof node !== "object") {
    return undefined;
  }
  if (typeof node.getAttribute === "function") {
    const value = node.getAttribute(name);
    return value === null ? undefined : value;
  }
  return node[name];
}

function getElementTabIndex(node) {
  if (typeof node?.tabIndex === "number") {
    return node.tabIndex;
  }

  const tabIndexAttr = getNodeAttribute(node, "tabindex");
  if (typeof tabIndexAttr === "string" && tabIndexAttr.length > 0) {
    const parsed = Number(tabIndexAttr);
    return Number.isFinite(parsed) ? parsed : -1;
  }

  return 0;
}

function isUnavailableForFocus(node) {
  if (node.disabled === true || node.hidden === true || node.inert === true) {
    return true;
  }

  if (getNodeAttribute(node, "aria-disabled") === "true" || getNodeAttribute(node, "aria-hidden") === "true") {
    return true;
  }

  if (node.style && (node.style.display === "none" || node.style.visibility === "hidden")) {
    return true;
  }

  return false;
}

export function isTabbableElement(node) {
  return isFocusableElement(node) && getElementTabIndex(node) >= 0;
}

const DEFAULT_FOCUSABLE_SELECTOR = [
  "a[href]",
  "button",
  "input",
  "select",
  "textarea",
  "summary",
  "details",
  "[tabindex]",
  "[contenteditable='true']"
].join(",");

export function getFocusableElements(root, options = {}) {
  if (!root) {
    return [];
  }

  const predicate = (item) =>
    isFocusableElement(item, {
      includeNegativeTabIndex: options.includeNegativeTabIndex === true || options.tabbable === false
    }) && (options.tabbable === false || getElementTabIndex(item) >= 0);

  if (Array.isArray(root)) {
    return root.filter((item) => predicate(item));
  }

  if (typeof root.querySelectorAll === "function") {
    const descendants = [...root.querySelectorAll(DEFAULT_FOCUSABLE_SELECTOR)];
    const candidates = options.includeRoot === true
      ? [root, ...descendants]
      : descendants;
    return candidates.filter((item) => predicate(item));
  }

  if (Array.isArray(root.children)) {
    return root.children.filter((item) => predicate(item));
  }

  return [];
}

export function moveFocus(elements, options = {}) {
  const {
    fromIndex = -1,
    direction = "next",
    loop = true
  } = options;

  if (!Array.isArray(elements) || elements.length === 0) {
    return -1;
  }

  const total = elements.length;
  const step = direction === "prev" ? -1 : 1;
  let index = fromIndex;

  for (let count = 0; count < total; count += 1) {
    index += step;

    if (loop) {
      if (index >= total) {
        index = 0;
      }
      if (index < 0) {
        index = total - 1;
      }
    } else if (index < 0 || index >= total) {
      return -1;
    }

    const target = elements[index];
    if (isFocusableElement(target)) {
      target.focus();
      return index;
    }
  }

  return -1;
}

function getOwnerDocument(root) {
  if (root?.ownerDocument) {
    return root.ownerDocument;
  }
  if (typeof document !== "undefined") {
    return document;
  }
  return null;
}

export function createFocusRestorePoint(rootOrDocument) {
  const ownerDocument = rootOrDocument?.activeElement
    ? rootOrDocument
    : getOwnerDocument(rootOrDocument);
  const element = rootOrDocument && !rootOrDocument.activeElement && isFocusableElement(rootOrDocument, { includeNegativeTabIndex: true })
    ? rootOrDocument
    : ownerDocument?.activeElement || null;

  return Object.freeze({
    element,
    restore(options = {}) {
      return restoreFocus(element, options);
    }
  });
}

export function restoreFocus(target, options = {}) {
  const candidates = [target, options.fallback].flat().filter(Boolean);

  for (const candidate of candidates) {
    if (candidate.isConnected === false) {
      continue;
    }
    if (isFocusableElement(candidate, { includeNegativeTabIndex: true })) {
      candidate.focus(options.focusOptions);
      return candidate;
    }
  }

  return null;
}

export function getFocusTrapTarget(root, options = {}) {
  const elements = getFocusableElements(root);
  const ownerDocument = getOwnerDocument(root);
  const current = options.current
    || options.event?.target
    || ownerDocument?.activeElement
    || null;
  const direction = options.direction || (options.event?.shiftKey === true ? "prev" : "next");

  if (elements.length === 0) {
    return isFocusableElement(root, { includeNegativeTabIndex: true }) ? root : null;
  }

  const currentIndex = elements.indexOf(current);

  if (currentIndex < 0) {
    return direction === "prev" ? elements[elements.length - 1] : elements[0];
  }

  if (elements.length === 1) {
    return elements[0];
  }

  if (direction === "prev" && currentIndex === 0) {
    return elements[elements.length - 1];
  }

  if (direction !== "prev" && currentIndex === elements.length - 1) {
    return elements[0];
  }

  return null;
}

export function trapFocus(event, root, options = {}) {
  if (normalizeKeyboardKey(event) !== "Tab") {
    return false;
  }

  const target = getFocusTrapTarget(root, {
    event,
    direction: event?.shiftKey === true ? "prev" : "next",
    ...options
  });

  if (!target) {
    return false;
  }

  event?.preventDefault?.();
  target.focus(options.focusOptions);
  return true;
}

export function createFocusScope(root, options = {}) {
  const restorePoint = options.restorePoint || createFocusRestorePoint(root);

  const focusAt = (direction) => {
    const elements = getFocusableElements(root);
    const target = direction === "last" ? elements[elements.length - 1] : elements[0];
    return restoreFocus(target, {
      fallback: options.fallback,
      focusOptions: options.focusOptions
    });
  };

  return Object.freeze({
    root,
    restorePoint,
    getElements(focusOptions = {}) {
      return getFocusableElements(root, focusOptions);
    },
    focusFirst() {
      return focusAt("first");
    },
    focusLast() {
      return focusAt("last");
    },
    move(moveOptions = {}) {
      const elements = getFocusableElements(root);
      const ownerDocument = getOwnerDocument(root);
      const current = moveOptions.current || ownerDocument?.activeElement || null;
      const fromIndex = elements.indexOf(current);
      return moveFocus(elements, {
        fromIndex,
        direction: moveOptions.direction || "next",
        loop: moveOptions.loop !== false
      });
    },
    trap(event, trapOptions = {}) {
      return trapFocus(event, root, trapOptions);
    },
    restore(restoreOptions = {}) {
      return restorePoint.restore(restoreOptions);
    },
    handleKeyDown(event, trapOptions = {}) {
      if (options.trap === false) {
        return false;
      }
      return trapFocus(event, root, trapOptions);
    }
  });
}

function getRovingItemId(item, index) {
  if (item && typeof item === "object") {
    if (item.id !== undefined && item.id !== null) {
      return String(item.id);
    }
    if (item.value !== undefined && item.value !== null) {
      return String(item.value);
    }
  }
  return String(index);
}

function isRovingItemDisabled(item, disabledKey = "disabled") {
  return Boolean(item && typeof item === "object" && item[disabledKey] === true);
}

function getNextEnabledRovingIndex(items, startIndex, direction = "next", loop = true, disabledKey = "disabled") {
  if (!Array.isArray(items) || items.length === 0) {
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

export function getRovingIndexByKey(items, currentIndex, eventOrKey, options = {}) {
  const orientation = options.orientation === "vertical" ? "vertical" : "horizontal";
  const keyboardMap = options.keyboardMap
    || (orientation === "vertical" ? VERTICAL_ROVING_KEYBOARD_MAP : HORIZONTAL_ROVING_KEYBOARD_MAP);
  const action = getKeyboardAction(eventOrKey, keyboardMap);
  const disabledKey = options.disabledKey || "disabled";

  if (action === "first") {
    return getNextEnabledRovingIndex(items, -1, "next", true, disabledKey);
  }

  if (action === "last") {
    return getNextEnabledRovingIndex(items, 0, "prev", true, disabledKey);
  }

  if (action === "next" || action === "previous") {
    return getNextEnabledRovingIndex(items, currentIndex, action, options.loop !== false, disabledKey);
  }

  return -1;
}

export function createRovingTabIndex(items = [], options = {}) {
  const sourceItems = Array.isArray(items) ? items : [];
  const disabledKey = options.disabledKey || "disabled";
  const ids = sourceItems.map((item, index) => getRovingItemId(item, index));
  const preferredId = options.activeId ?? options.selectedId;
  let activeIndex = typeof options.activeIndex === "number"
    ? options.activeIndex
    : preferredId !== undefined && preferredId !== null
      ? ids.indexOf(String(preferredId))
      : -1;

  if (activeIndex < 0 || activeIndex >= sourceItems.length || isRovingItemDisabled(sourceItems[activeIndex], disabledKey)) {
    activeIndex = getNextEnabledRovingIndex(sourceItems, -1, "next", true, disabledKey);
  }

  const rovingItems = sourceItems.map((item, index) => {
    const disabled = isRovingItemDisabled(item, disabledKey);
    const active = index === activeIndex && !disabled;
    return {
      item,
      id: ids[index],
      index,
      disabled,
      active,
      tabIndex: disabled ? -1 : active ? 0 : -1
    };
  });

  return Object.freeze({
    activeIndex,
    activeId: activeIndex >= 0 ? ids[activeIndex] : null,
    items: Object.freeze(rovingItems),
    getNextIndex(direction = "next", moveOptions = {}) {
      return getNextEnabledRovingIndex(
        sourceItems,
        moveOptions.fromIndex ?? activeIndex,
        direction,
        moveOptions.loop ?? options.loop ?? true,
        disabledKey
      );
    },
    getIndexByKey(eventOrKey, keyOptions = {}) {
      return getRovingIndexByKey(sourceItems, activeIndex, eventOrKey, {
        ...options,
        ...keyOptions
      });
    }
  });
}

export function getRovingTabIndexProps(rovingItem, options = {}) {
  const disabled = rovingItem?.disabled === true;
  const active = rovingItem?.active === true;
  return {
    tabIndex: disabled ? -1 : active ? 0 : -1,
    "data-active": String(active),
    "aria-disabled": disabled && options.includeAriaDisabled !== false ? "true" : undefined
  };
}

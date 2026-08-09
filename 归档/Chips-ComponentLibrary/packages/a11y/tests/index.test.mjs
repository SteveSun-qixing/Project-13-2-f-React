import test from "node:test";
import assert from "node:assert/strict";
import {
  assertAriaProps,
  buildAriaDescribedBy,
  createFocusRestorePoint,
  createFocusScope,
  createAriaStatusProps,
  createKeyboardMap,
  createRovingTabIndex,
  getFocusTrapTarget,
  getFocusableElements,
  getKeyboardAction,
  getKeyboardIntent,
  getRovingIndexByKey,
  getRovingTabIndexProps,
  isFocusableElement,
  isKeyboardActivationKey,
  isKeyboardNavigationKey,
  normalizeKeyboardKey,
  moveFocus,
  restoreFocus,
  trapFocus,
  validateAriaProps
} from "../src/index.js";

test("isKeyboardActivationKey supports Enter and Space", () => {
  assert.equal(isKeyboardActivationKey("Enter"), true);
  assert.equal(isKeyboardActivationKey(" "), true);
  assert.equal(isKeyboardActivationKey("Escape"), false);
});

test("createAriaStatusProps returns aria-live polite", () => {
  const props = createAriaStatusProps();
  assert.equal(props["aria-live"], "polite");
  assert.equal(props["aria-atomic"], "true");
});

test("keyboard intent maps activation, navigation and dismiss", () => {
  assert.equal(getKeyboardIntent("Enter"), "activate");
  assert.equal(getKeyboardIntent("ArrowUp"), "navigate");
  assert.equal(getKeyboardIntent("Escape"), "dismiss");
  assert.equal(getKeyboardIntent("a"), "unknown");
  assert.equal(isKeyboardNavigationKey("ArrowDown"), true);
});

test("keyboard maps normalize aliases and resolve actions", () => {
  const map = createKeyboardMap({
    submit: ["Enter", "Spacebar"],
    cancel: "Esc"
  });

  assert.equal(normalizeKeyboardKey("Spacebar"), " ");
  assert.equal(map.getAction(" "), "submit");
  assert.equal(getKeyboardAction({ key: "Escape" }, map), "cancel");
  assert.deepEqual(map.entries(), [
    { action: "submit", key: "Enter" },
    { action: "submit", key: " " },
    { action: "cancel", key: "Escape" }
  ]);
});

test("buildAriaDescribedBy removes duplicates and empties", () => {
  assert.equal(buildAriaDescribedBy(["a", "", "b", "a"]), "a b");
});

test("validateAriaProps and assertAriaProps enforce rules", () => {
  const issues = validateAriaProps(
    {
      role: "button",
      "aria-expanded": "true"
    },
    {
      requireLabel: true,
      role: "button",
      requireControlsWhenExpanded: true
    }
  );

  assert.equal(issues.length, 2);
  assert.throws(
    () =>
      assertAriaProps(
        {
          role: "button",
          "aria-expanded": "true"
        },
        {
          requireLabel: true,
          role: "button",
          requireControlsWhenExpanded: true
        }
      ),
    (error) => error.code === "A11Y_LABEL_MISSING"
  );
});

test("isFocusableElement filters disabled and hidden nodes", () => {
  const focusable = {
    tabIndex: 0,
    focus() {}
  };
  const disabled = {
    tabIndex: 0,
    disabled: true,
    focus() {}
  };

  assert.equal(isFocusableElement(focusable), true);
  assert.equal(isFocusableElement(disabled), false);
});

test("getFocusableElements and moveFocus navigate focus list", () => {
  const focused = [];
  const makeNode = (id) => ({
    tabIndex: 0,
    focus() {
      focused.push(id);
    }
  });

  const nodes = [makeNode("a"), makeNode("b"), makeNode("c")];
  const focusables = getFocusableElements(nodes);
  assert.equal(focusables.length, 3);

  const nextIndex = moveFocus(focusables, {
    fromIndex: 0,
    direction: "next"
  });
  assert.equal(nextIndex, 1);

  const prevIndex = moveFocus(focusables, {
    fromIndex: 1,
    direction: "prev"
  });
  assert.equal(prevIndex, 0);
  assert.deepEqual(focused, ["b", "a"]);
});

test("focus restore returns focus to the captured active element", () => {
  const focused = [];
  const trigger = {
    tabIndex: 0,
    isConnected: true,
    focus() {
      focused.push("trigger");
    }
  };
  const fallback = {
    tabIndex: 0,
    isConnected: true,
    focus() {
      focused.push("fallback");
    }
  };
  const ownerDocument = { activeElement: trigger };
  const restorePoint = createFocusRestorePoint(ownerDocument);

  assert.equal(restorePoint.element, trigger);
  assert.equal(restoreFocus(restorePoint.element), trigger);
  trigger.isConnected = false;
  assert.equal(restoreFocus(restorePoint.element, { fallback }), fallback);
  assert.deepEqual(focused, ["trigger", "fallback"]);
});

test("focus trap wraps from first and last tabbable elements", () => {
  const focused = [];
  const first = {
    tabIndex: 0,
    focus() {
      focused.push("first");
    }
  };
  const last = {
    tabIndex: 0,
    focus() {
      focused.push("last");
    }
  };
  const root = [first, last];
  const wrapToFirst = getFocusTrapTarget(root, {
    current: last,
    direction: "next"
  });
  const wrapToLast = getFocusTrapTarget(root, {
    current: first,
    direction: "prev"
  });

  assert.equal(wrapToFirst, first);
  assert.equal(wrapToLast, last);

  const event = {
    key: "Tab",
    shiftKey: true,
    preventDefaultCalled: false,
    preventDefault() {
      this.preventDefaultCalled = true;
    }
  };
  assert.equal(trapFocus(event, root, { current: first }), true);
  assert.equal(event.preventDefaultCalled, true);
  assert.deepEqual(focused, ["last"]);
});

test("createFocusScope exposes focus movement trap and restore helpers", () => {
  const focused = [];
  const trigger = {
    tabIndex: 0,
    isConnected: true,
    focus() {
      focused.push("trigger");
    }
  };
  const first = {
    tabIndex: 0,
    focus() {
      focused.push("first");
    }
  };
  const second = {
    tabIndex: 0,
    focus() {
      focused.push("second");
    }
  };
  const scope = createFocusScope([first, second], {
    restorePoint: createFocusRestorePoint({ activeElement: trigger })
  });

  assert.equal(scope.getElements().length, 2);
  assert.equal(scope.focusFirst(), first);
  assert.equal(scope.move({ current: first, direction: "next" }), 1);
  assert.equal(scope.handleKeyDown({ key: "Escape" }), false);
  assert.equal(scope.restore(), trigger);
  assert.deepEqual(focused, ["first", "second", "trigger"]);
});

test("roving tabindex skips disabled items and maps navigation keys", () => {
  const model = createRovingTabIndex(
    [
      { id: "a" },
      { id: "b", disabled: true },
      { id: "c" }
    ],
    {
      activeId: "a",
      orientation: "horizontal"
    }
  );

  assert.equal(model.activeId, "a");
  assert.deepEqual(model.items.map((item) => item.tabIndex), [0, -1, -1]);
  assert.equal(model.getIndexByKey("ArrowRight"), 2);
  assert.equal(getRovingIndexByKey(model.items, 0, "End"), 2);
  assert.deepEqual(getRovingTabIndexProps(model.items[2]), {
    tabIndex: -1,
    "data-active": "false",
    "aria-disabled": undefined
  });
});

test("validateAriaProps supports role lists required props and selected state", () => {
  const issues = validateAriaProps(
    {
      role: "option",
      "aria-expanded": "true"
    },
    {
      role: ["option", "menuitem"],
      requiredProps: ["aria-controls"],
      requireSelected: true,
      requireActiveDescendantWhenExpanded: true
    }
  );

  assert.deepEqual(
    issues.map((issue) => issue.code),
    ["A11Y_PROP_MISSING", "A11Y_ACTIVE_DESCENDANT_MISSING", "A11Y_SELECTED_STATE_MISSING"]
  );
});

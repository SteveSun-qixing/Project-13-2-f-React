import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import {
  ChipsDataGrid,
  ChipsDialog,
  ChipsMenu,
  ChipsSelect,
  ChipsTabs
} from "../src/index.js";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function setupDom() {
  const dom = new JSDOM("<!doctype html><html><body><div id=\"root\"></div></body></html>", {
    pretendToBeVisual: true
  });
  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    HTMLElement: globalThis.HTMLElement,
    Node: globalThis.Node,
    Event: globalThis.Event,
    KeyboardEvent: globalThis.KeyboardEvent,
    MouseEvent: globalThis.MouseEvent
  };

  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  globalThis.Event = dom.window.Event;
  globalThis.KeyboardEvent = dom.window.KeyboardEvent;
  globalThis.MouseEvent = dom.window.MouseEvent;

  const container = dom.window.document.querySelector("#root");
  const root = createRoot(container);

  return {
    dom,
    container,
    render(element) {
      act(() => {
        root.render(element);
      });
    },
    cleanup() {
      act(() => {
        root.unmount();
      });
      dom.window.close();
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) {
          delete globalThis[key];
        } else {
          globalThis[key] = value;
        }
      }
    }
  };
}

function keyDown(target, key, options = {}) {
  const event = new window.KeyboardEvent("keydown", {
    bubbles: true,
    cancelable: true,
    key,
    shiftKey: options.shiftKey === true
  });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

function click(target) {
  act(() => {
    target.dispatchEvent(new window.MouseEvent("click", {
      bubbles: true,
      cancelable: true
    }));
  });
}

async function nextFrame() {
  await act(async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
  });
}

test("Dialog traps tab focus, closes on Escape and restores focus to trigger", async () => {
  const fixture = setupDom();
  try {
    const closeReasons = [];
    fixture.render(
      React.createElement(
        ChipsDialog.Root,
        {
          triggerContent: "Open dialog",
          title: "Settings",
          closeButtonLabel: "Close dialog",
          onCloseReason: (reason) => closeReasons.push(reason)
        },
        React.createElement("button", { type: "button", id: "dialog-action" }, "Action")
      )
    );

    const trigger = fixture.container.querySelector('[data-scope="dialog"][data-part="trigger"]');
    trigger.focus();
    click(trigger);
    await nextFrame();

    const content = fixture.container.querySelector('[data-scope="dialog"][data-part="content"]');
    const action = fixture.container.querySelector("#dialog-action");
    const close = fixture.container.querySelector('[data-scope="dialog"][data-part="close"]');

    assert.equal(content.getAttribute("role"), "dialog");
    assert.equal(content.getAttribute("aria-modal"), "true");
    assert.equal(document.activeElement, action);

    close.focus();
    const tabEvent = keyDown(content, "Tab");
    assert.equal(tabEvent.defaultPrevented, true);
    assert.equal(document.activeElement, action);

    const shiftTabEvent = keyDown(content, "Tab", { shiftKey: true });
    assert.equal(shiftTabEvent.defaultPrevented, true);
    assert.equal(document.activeElement, close);

    keyDown(content, "Escape");
    await nextFrame();
    assert.equal(fixture.container.querySelector('[data-scope="dialog"][data-part="content"]'), null);
    assert.equal(document.activeElement, trigger);
    assert.deepEqual(closeReasons, ["escape-key"]);
  } finally {
    fixture.cleanup();
  }
});

test("Menu opens from keyboard, roves over enabled items and restores focus after select", async () => {
  const fixture = setupDom();
  try {
    const selected = [];
    fixture.render(
      React.createElement(ChipsMenu.Root, {
        triggerContent: "Actions",
        items: [
          { value: "new", label: "New" },
          { value: "archived", label: "Archived", disabled: true },
          { value: "delete", label: "Delete" }
        ],
        onSelect: (value) => selected.push(value)
      })
    );

    const trigger = fixture.container.querySelector('[data-scope="menu"][data-part="trigger"]');
    trigger.focus();
    keyDown(trigger, "Enter");
    await nextFrame();

    const content = fixture.container.querySelector('[data-scope="menu"][data-part="content"]');
    assert.equal(content.getAttribute("role"), "menu");
    assert.equal(trigger.getAttribute("aria-expanded"), "true");

    const items = [...fixture.container.querySelectorAll('[data-scope="menu"][data-part="item"]')];
    assert.deepEqual(items.map((item) => item.tabIndex), [0, -1, -1]);
    keyDown(content, "ArrowDown");
    assert.deepEqual(items.map((item) => item.tabIndex), [-1, -1, 0]);

    keyDown(content, "Enter");
    await nextFrame();
    assert.deepEqual(selected, ["delete"]);
    assert.equal(fixture.container.querySelector('[data-scope="menu"][data-part="content"]'), null);
    assert.equal(document.activeElement, trigger);
  } finally {
    fixture.cleanup();
  }
});

test("Select content renders children and supports roving option selection", async () => {
  const fixture = setupDom();
  try {
    const values = [];
    fixture.render(
      React.createElement(ChipsSelect.Root, {
        placeholder: "Pick a card",
        options: [
          { value: "book", label: "Book" },
          { value: "music", label: "Music", disabled: true },
          { value: "image", label: "Image" }
        ],
        onValueChange: (value) => values.push(value)
      })
    );

    const trigger = fixture.container.querySelector('[data-scope="select"][data-part="trigger"]');
    trigger.focus();
    keyDown(trigger, "Enter");
    await nextFrame();

    const content = fixture.container.querySelector('[data-scope="select"][data-part="content"]');
    const options = [...fixture.container.querySelectorAll('[data-scope="select"][data-part="option"]')];
    assert.equal(content.getAttribute("role"), "listbox");
    assert.equal(content.getAttribute("data-placement"), "bottom-start");
    assert.equal(content.style.getPropertyValue("--chips-select-content-min-inline-size"), "100%");
    assert.equal(content.style.getPropertyValue("--chips-select-content-gutter"), "var(--chips-base-space-1, 4px)");
    assert.equal(content.style.getPropertyValue("--chips-select-content-max-block-size"), "min(280px, calc(100vh - 24px))");
    assert.equal(options.length, 3);
    assert.equal(options[0].textContent, "Book");
    assert.deepEqual(options.map((option) => option.tabIndex), [0, -1, -1]);

    keyDown(content, "ArrowDown");
    assert.deepEqual(options.map((option) => option.tabIndex), [-1, -1, 0]);
    assert.equal(document.activeElement, options[2]);

    keyDown(content, "Enter");
    await nextFrame();
    assert.deepEqual(values, ["image"]);
    assert.equal(trigger.textContent.includes("Image"), true);
    assert.equal(document.activeElement, trigger);
  } finally {
    fixture.cleanup();
  }
});

test("Select content accepts controlled overlay sizing variables", async () => {
  const fixture = setupDom();
  try {
    fixture.render(
      React.createElement(ChipsSelect.Root, {
        defaultOpen: true,
        options: [
          { value: "book", label: "Book" },
          { value: "image", label: "Image" }
        ]
      },
        React.createElement(ChipsSelect.Trigger, null, React.createElement(ChipsSelect.Value, null)),
        React.createElement(
          ChipsSelect.Content,
          {
            gutter: 10,
            maxBlockSize: "12rem",
            minInlineSize: "18rem"
          },
          React.createElement(ChipsSelect.Option, { value: "book" }, "Book"),
          React.createElement(ChipsSelect.Option, { value: "image" }, "Image")
        )
      )
    );

    const content = fixture.container.querySelector('[data-scope="select"][data-part="content"]');
    assert.equal(content.style.getPropertyValue("--chips-select-content-gutter"), "10px");
    assert.equal(content.style.getPropertyValue("--chips-select-content-max-block-size"), "12rem");
    assert.equal(content.style.getPropertyValue("--chips-select-content-min-inline-size"), "18rem");
  } finally {
    fixture.cleanup();
  }
});

test("Tabs publish roving tab focus and activate panels with arrow keys", async () => {
  const fixture = setupDom();
  try {
    fixture.render(
      React.createElement(ChipsTabs.Root, {
        items: [
          { value: "general", label: "General", content: "General panel" },
          { value: "advanced", label: "Advanced", disabled: true, content: "Advanced panel" },
          { value: "security", label: "Security", content: "Security panel" }
        ]
      })
    );

    const tabs = [...fixture.container.querySelectorAll('[data-scope="tabs"][data-part="trigger"]')];
    assert.deepEqual(tabs.map((tab) => tab.tabIndex), [0, -1, -1]);
    assert.equal(tabs[0].getAttribute("aria-selected"), "true");

    keyDown(tabs[0], "ArrowRight");
    assert.deepEqual(tabs.map((tab) => tab.tabIndex), [-1, -1, 0]);
    assert.equal(tabs[2].getAttribute("aria-selected"), "true");
    assert.equal(document.activeElement, tabs[2]);

    const selectedPanel = fixture.container.querySelector('[data-scope="tabs"][data-part="panel"]:not([hidden])');
    assert.equal(selectedPanel.textContent, "Security panel");
  } finally {
    fixture.cleanup();
  }
});

test("DataGrid keyboard navigation changes the active row and toggles selection", () => {
  const fixture = setupDom();
  try {
    const selectedRows = [];
    fixture.render(
      React.createElement(ChipsDataGrid.Root, {
        "aria-label": "Cards",
        columns: [
          { key: "name", label: "Name" }
        ],
        rows: [
          { id: "book", name: "Book" },
          { id: "music", name: "Music" }
        ],
        onSelectedRowIdsChange: (ids) => selectedRows.push(ids)
      })
    );

    const grid = fixture.container.querySelector('[role="grid"]');
    const rows = [...fixture.container.querySelectorAll('[data-scope="data-grid"][data-part="row"]')];
    assert.equal(grid.getAttribute("aria-label"), "Cards");
    assert.deepEqual(rows.map((row) => row.getAttribute("data-active")), ["true", "false"]);

    keyDown(grid, "ArrowDown");
    assert.deepEqual(rows.map((row) => row.getAttribute("data-active")), ["false", "true"]);

    keyDown(grid, " ");
    assert.deepEqual(selectedRows.at(-1), ["music"]);
    assert.equal(rows[1].getAttribute("aria-selected"), "true");
  } finally {
    fixture.cleanup();
  }
});

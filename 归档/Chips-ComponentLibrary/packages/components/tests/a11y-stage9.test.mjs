import test from "node:test";
import assert from "node:assert/strict";
import { validateComponentA11y } from "../src/index.js";

test("stage9 a11y gate validates all component rules", () => {
  const assertions = [
    validateComponentA11y("text", {}),
    validateComponentA11y("label", { htmlFor: "field-id" }),
    validateComponentA11y("icon", { "aria-hidden": "true" }),
    validateComponentA11y("icon-button", { "aria-label": "icon button" }),
    validateComponentA11y("toggle-button", { "aria-label": "toggle", "aria-pressed": "true" }),
    validateComponentA11y("badge", { "aria-label": "badge" }),
    validateComponentA11y("tag", { "aria-label": "tag" }),
    validateComponentA11y("avatar", { role: "img", "aria-label": "avatar" }),
    validateComponentA11y("spinner", { role: "status", "aria-label": "spinner" }),
    validateComponentA11y("progress", { role: "progressbar", "aria-label": "progress" }),
    validateComponentA11y("text-field", { "aria-label": "text field" }),
    validateComponentA11y("text-area", { "aria-label": "text area" }),
    validateComponentA11y("search-field", { role: "search", "aria-label": "search field" }),
    validateComponentA11y("secure-field", { "aria-label": "secure field", "aria-pressed": "false" }),
    validateComponentA11y("segmented-control", { role: "radiogroup", "aria-label": "segmented control" }),
    validateComponentA11y("combo-box", {
      role: "combobox",
      "aria-label": "combo box",
      "aria-expanded": "true",
      "aria-controls": "combo-list"
    }),
    validateComponentA11y("number-input", { role: "spinbutton", "aria-label": "number input" }),
    validateComponentA11y("stepper", { role: "group", "aria-label": "stepper" }),
    validateComponentA11y("slider", { role: "slider", "aria-label": "slider" }),
    validateComponentA11y("date-picker", {
      role: "combobox",
      "aria-label": "date picker",
      "aria-expanded": "true",
      "aria-controls": "date-calendar"
    }),
    validateComponentA11y("time-picker", {
      role: "combobox",
      "aria-label": "time picker",
      "aria-expanded": "true",
      "aria-controls": "time-list"
    }),
    validateComponentA11y("image", { role: "group", "aria-label": "image" }),
    validateComponentA11y("media", { role: "group", "aria-label": "media" }),
    validateComponentA11y("error-state", { role: "alert", "aria-label": "error state" }),
    validateComponentA11y("button", { role: "button", "aria-label": "button" }),
    validateComponentA11y("input", { "aria-label": "input" }),
    validateComponentA11y("checkbox", { role: "checkbox", "aria-label": "checkbox" }),
    validateComponentA11y("radio", { role: "radio", "aria-label": "radio" }),
    validateComponentA11y("switch", { role: "switch", "aria-label": "switch" }),
    validateComponentA11y("select", {
      role: "button",
      "aria-label": "select",
      "aria-expanded": "true",
      "aria-controls": "select-list"
    }),
    validateComponentA11y("dialog", {
      role: "button",
      "aria-label": "dialog",
      "aria-expanded": "true",
      "aria-controls": "dialog-content"
    }),
    validateComponentA11y("popover", {
      role: "button",
      "aria-label": "popover",
      "aria-expanded": "true",
      "aria-controls": "popover-content"
    }),
    validateComponentA11y("tabs", { role: "tab", "aria-label": "tabs" }),
    validateComponentA11y("menu", {
      role: "button",
      "aria-label": "menu",
      "aria-expanded": "true",
      "aria-controls": "menu-content"
    }),
    validateComponentA11y("tooltip", { role: "tooltip" }),
    validateComponentA11y("form", { "aria-label": "field" }),
    validateComponentA11y("virtual-list", { role: "list", "aria-label": "list" }),
    validateComponentA11y("data-grid", { part: "root", role: "group", "aria-label": "grid group" }),
    validateComponentA11y("data-grid", { role: "grid", "aria-label": "grid" }),
    validateComponentA11y("tree", { role: "tree", "aria-label": "tree" }),
    validateComponentA11y("date-time", { "aria-label": "date-time" }),
    validateComponentA11y("command-palette", {
      role: "combobox",
      "aria-label": "commands",
      "aria-expanded": "true",
      "aria-controls": "command-list"
    }),
    validateComponentA11y("navigation-split-view", { role: "group", "aria-label": "workspace navigation" }),
    validateComponentA11y("navigation-split-view", { part: "sidebar", role: "navigation", "aria-label": "sources" }),
    validateComponentA11y("navigation-split-view", { part: "content", role: "region", "aria-label": "items" }),
    validateComponentA11y("navigation-split-view", { part: "detail", role: "region", "aria-label": "detail" }),
    validateComponentA11y("split-pane", { role: "group", "aria-label": "split pane" }),
    validateComponentA11y("dock-panel", { role: "tablist", "aria-label": "dock panel" }),
    validateComponentA11y("inspector", { role: "complementary", "aria-label": "inspector" }),
    validateComponentA11y("panel-header", { role: "group", "aria-label": "panel header" }),
    validateComponentA11y("card-shell", { role: "article", "aria-label": "card shell" }),
    validateComponentA11y("tool-window", { role: "dialog", "aria-label": "tool window" }),
    validateComponentA11y("error-boundary", { "aria-label": "error boundary" }),
    validateComponentA11y("loading-boundary", { role: "region", "aria-label": "loading boundary" }),
    validateComponentA11y("notification", { role: "region", "aria-label": "notifications" }),
    validateComponentA11y("toast", { role: "status", "aria-label": "toasts" }),
    validateComponentA11y("empty-state", { role: "region", "aria-label": "empty state" }),
    validateComponentA11y("skeleton", { role: "status", "aria-label": "skeleton" }),
    validateComponentA11y("view", { role: "region", "aria-label": "view" }),
    validateComponentA11y("section", { role: "region", "aria-label": "section" }),
    validateComponentA11y("scroll-view", { role: "region", "aria-label": "scroll view" }),
    validateComponentA11y("split-view", { role: "group", "aria-label": "split view" }),
    validateComponentA11y("divider", { role: "separator" })
  ];

  assert.equal(assertions.every((item) => item === true), true);
});

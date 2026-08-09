import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const base = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../contracts/components");
const iframeComponents = new Set(["card-cover-frame", "composite-card-window"]);

function readContract(fileName) {
  return JSON.parse(fs.readFileSync(path.join(base, fileName), "utf8"));
}

function assertCommonShape(contract) {
  assert.equal(typeof contract.component, "string");
  assert.equal(typeof contract.scope, "string");
  assert.ok(Array.isArray(contract.parts));
  assert.ok(Array.isArray(contract.states));
  assert.ok(Array.isArray(contract.tokens));
}

function assertIframeShape(contract) {
  assertCommonShape(contract);
  assert.equal(contract.iframe.requiredSandbox, true);
}

test("card-cover-frame contract is complete", () => {
  const contract = readContract("card-cover-frame.contract.json");
  assertIframeShape(contract);
  assert.ok(contract.parts.includes("iframe"));
  assert.ok(contract.states.includes("error"));
});

test("composite-card-window contract includes degraded state", () => {
  const contract = readContract("composite-card-window.contract.json");
  assertIframeShape(contract);
  assert.ok(contract.states.includes("degraded"));
  assert.ok(contract.parts.includes("overlay"));
});

test("button contract contains interactive states", () => {
  const contract = readContract("button.contract.json");
  assertCommonShape(contract);
  assert.ok(contract.states.includes("active"));
  assert.ok(contract.tokens.includes("chips.comp.button.root.surface.idle"));
});

test("display primitive contracts contain text label and icon tokens", () => {
  const text = readContract("text.contract.json");
  const label = readContract("label.contract.json");
  const icon = readContract("icon.contract.json");

  assertCommonShape(text);
  assertCommonShape(label);
  assertCommonShape(icon);
  assert.deepEqual(text.parts, ["root"]);
  assert.ok(label.parts.includes("required-indicator"));
  assert.ok(label.parts.includes("status"));
  assert.ok(icon.parts.includes("root"));
  assert.ok(text.tokens.includes("chips.comp.text.root.color.default"));
  assert.ok(label.tokens.includes("chips.comp.label.required-indicator.color"));
  assert.ok(icon.tokens.includes("chips.comp.icon.root.opsz"));
  assert.ok(icon.tokens.includes("chips.comp.icon.root.color-accent"));
  assert.ok(icon.tokens.includes("chips.comp.icon.root.wght-strong"));
  assert.ok(icon.a11yConstraints.some((constraint) => constraint.type === "functional-icon-label"));
});

test("task015 base control contracts expose button display feedback and input scopes", () => {
  const iconButton = readContract("icon-button.contract.json");
  const toggleButton = readContract("toggle-button.contract.json");
  const badge = readContract("badge.contract.json");
  const tag = readContract("tag.contract.json");
  const avatar = readContract("avatar.contract.json");
  const spinner = readContract("spinner.contract.json");
  const progress = readContract("progress.contract.json");
  const rating = readContract("rating.contract.json");
  const textField = readContract("text-field.contract.json");
  const textArea = readContract("text-area.contract.json");
  const searchField = readContract("search-field.contract.json");
  const secureField = readContract("secure-field.contract.json");
  const segmentedControl = readContract("segmented-control.contract.json");
  const comboBox = readContract("combo-box.contract.json");
  const numberInput = readContract("number-input.contract.json");
  const stepper = readContract("stepper.contract.json");
  const slider = readContract("slider.contract.json");
  const datePicker = readContract("date-picker.contract.json");
  const timePicker = readContract("time-picker.contract.json");
  const image = readContract("image.contract.json");
  const media = readContract("media.contract.json");
  const errorState = readContract("error-state.contract.json");

  for (const contract of [
    iconButton,
    toggleButton,
    badge,
    tag,
    avatar,
    spinner,
    progress,
    rating,
    textField,
    textArea,
    searchField,
    secureField,
    segmentedControl,
    comboBox,
    numberInput,
    stepper,
    slider,
    datePicker,
    timePicker,
    image,
    media,
    errorState
  ]) {
    assertCommonShape(contract);
  }
  assert.ok(iconButton.parts.includes("icon"));
  assert.ok(iconButton.tokens.includes("chips.comp.icon-button.root.size"));
  assert.ok(iconButton.tokens.includes("chips.comp.icon-button.icon.color.hover"));
  assert.ok(iconButton.motionConstraints.some((constraint) => constraint.type === "state-transition"));
  assert.ok(toggleButton.parts.includes("label"));
  assert.ok(toggleButton.tokens.includes("chips.comp.toggle-button.root.surface.pressed"));
  assert.ok(badge.tokens.includes("chips.comp.badge.root.surface.warning"));
  assert.ok(tag.parts.includes("close"));
  assert.ok(tag.tokens.includes("chips.comp.tag.close.color.hover"));
  assert.ok(avatar.parts.includes("fallback"));
  assert.ok(avatar.tokens.includes("chips.comp.avatar.root.size"));
  assert.ok(spinner.parts.includes("indicator"));
  assert.ok(spinner.tokens.includes("chips.comp.spinner.motion.duration"));
  assert.ok(progress.parts.includes("range"));
  assert.ok(progress.tokens.includes("chips.comp.progress.range.surface.indeterminate"));
  assert.ok(progress.tokens.includes("chips.comp.progress.range.motion.duration"));
  assert.ok(rating.parts.includes("item"));
  assert.ok(rating.parts.includes("icon"));
  assert.ok(rating.tokens.includes("chips.comp.rating.icon.color.heart-active"));
  assert.ok(rating.a11yConstraints.some((constraint) => constraint.type === "radiogroup-label"));
  assert.ok(textField.parts.includes("control"));
  assert.ok(textField.tokens.includes("chips.comp.text-field.root.border.error"));
  assert.ok(textArea.parts.includes("description"));
  assert.ok(textArea.tokens.includes("chips.comp.text-area.control.color"));
  assert.ok(searchField.parts.includes("clear"));
  assert.ok(searchField.tokens.includes("chips.comp.search-field.clear.color.hover"));
  assert.ok(secureField.parts.includes("visibility-toggle"));
  assert.ok(secureField.tokens.includes("chips.comp.secure-field.toggle.color.idle"));
  assert.ok(segmentedControl.parts.includes("indicator"));
  assert.ok(segmentedControl.tokens.includes("chips.comp.segmented-control.item.surface.selected"));
  assert.ok(comboBox.parts.includes("list"));
  assert.ok(comboBox.parts.includes("option"));
  assert.ok(comboBox.tokens.includes("chips.comp.combo-box.option.surface.highlighted"));
  assert.ok(numberInput.parts.includes("control"));
  assert.ok(numberInput.parts.includes("increment"));
  assert.ok(numberInput.tokens.includes("chips.comp.number-input.root.border.error"));
  assert.ok(stepper.parts.includes("value"));
  assert.ok(stepper.parts.includes("increment"));
  assert.ok(stepper.tokens.includes("chips.comp.stepper.increment.surface.active"));
  assert.ok(slider.parts.includes("thumb"));
  assert.ok(slider.tokens.includes("chips.comp.slider.thumb.surface.active"));
  assert.ok(datePicker.parts.includes("calendar"));
  assert.ok(datePicker.tokens.includes("chips.comp.date-picker.cell.surface.selected"));
  assert.ok(timePicker.parts.includes("option"));
  assert.ok(timePicker.tokens.includes("chips.comp.time-picker.option.surface.selected"));
  assert.ok(image.parts.includes("media"));
  assert.ok(image.parts.includes("fallback"));
  assert.ok(image.tokens.includes("chips.comp.image.fallback.surface"));
  assert.ok(media.parts.includes("controls"));
  assert.ok(media.tokens.includes("chips.comp.media.control.surface.active"));
  assert.ok(media.motionConstraints.some((constraint) => constraint.type === "media-control-feedback"));
  assert.ok(errorState.parts.includes("details"));
  assert.ok(errorState.tokens.includes("chips.comp.error-state.root.border.error"));
});

test("only advanced iframe components expose iframe contract extension", () => {
  for (const fileName of fs.readdirSync(base).filter((item) => item.endsWith(".contract.json"))) {
    const contract = readContract(fileName);
    if (iframeComponents.has(contract.component)) {
      assert.equal(contract.iframe.requiredSandbox, true);
      continue;
    }
    assert.equal(contract.iframe, undefined, `${contract.component} must not declare iframe contract`);
  }
});

test("input contract contains focus and error tokens", () => {
  const contract = readContract("input.contract.json");
  assertCommonShape(contract);
  assert.ok(contract.states.includes("focus"));
  assert.ok(contract.tokens.includes("chips.comp.input.root.border.error"));
});

test("checkbox contract contains indicator part", () => {
  const contract = readContract("checkbox.contract.json");
  assertCommonShape(contract);
  assert.ok(contract.parts.includes("indicator"));
  assert.ok(contract.tokens.includes("chips.comp.checkbox.indicator.color.checked"));
});

test("radio contract contains item and control parts", () => {
  const contract = readContract("radio.contract.json");
  assertCommonShape(contract);
  assert.ok(contract.parts.includes("item"));
  assert.ok(contract.tokens.includes("chips.comp.radio.control.surface.checked"));
});

test("switch contract contains thumb part", () => {
  const contract = readContract("switch.contract.json");
  assertCommonShape(contract);
  assert.ok(contract.parts.includes("thumb"));
  assert.ok(contract.tokens.includes("chips.comp.switch.thumb.surface"));
});

test("select contract contains compound content and option parts", () => {
  const contract = readContract("select.contract.json");
  assertCommonShape(contract);
  assert.ok(contract.parts.includes("content"));
  assert.ok(contract.parts.includes("option"));
  assert.equal(contract.parts.includes("list"), false);
  assert.ok(contract.tokens.includes("chips.comp.select.content.surface"));
  assert.ok(contract.tokens.includes("chips.comp.select.option.surface.highlighted"));
  assert.ok(contract.tokens.includes("chips.comp.select.option.surface.selected"));
});

test("dialog contract contains compound content section and close parts", () => {
  const contract = readContract("dialog.contract.json");
  assertCommonShape(contract);
  assert.ok(contract.parts.includes("content"));
  assert.ok(contract.parts.includes("header"));
  assert.ok(contract.parts.includes("body"));
  assert.ok(contract.parts.includes("footer"));
  assert.ok(contract.parts.includes("actions"));
  assert.ok(contract.parts.includes("close"));
  assert.ok(contract.tokens.includes("chips.comp.dialog.content.surface"));
  assert.ok(contract.tokens.includes("chips.comp.dialog.header.color"));
  assert.ok(contract.motionConstraints.some((constraint) => constraint.type === "overlay-transition"));
});

test("popover contract contains public content and arrow parts", () => {
  const contract = readContract("popover.contract.json");
  assertCommonShape(contract);
  assert.equal(contract.parts.includes("positioner"), false);
  assert.ok(contract.parts.includes("content"));
  assert.ok(contract.parts.includes("arrow"));
  assert.ok(contract.tokens.includes("chips.comp.popover.content.border"));
  assert.ok(contract.motionConstraints.some((constraint) => constraint.type === "overlay-transition"));
});

test("tabs contract contains panel part and active token", () => {
  const contract = readContract("tabs.contract.json");
  assertCommonShape(contract);
  assert.ok(contract.parts.includes("panel"));
  assert.ok(contract.tokens.includes("chips.comp.tabs.trigger.surface.active"));
  assert.ok(contract.motionConstraints.some((constraint) => constraint.type === "scene-transition"));
});

test("menu contract contains menu item tokens", () => {
  const contract = readContract("menu.contract.json");
  assertCommonShape(contract);
  assert.ok(contract.parts.includes("item"));
  assert.ok(contract.parts.includes("group"));
  assert.ok(contract.parts.includes("group-label"));
  assert.ok(contract.parts.includes("separator"));
  assert.ok(contract.tokens.includes("chips.comp.menu.item.surface.active"));
  assert.ok(contract.tokens.includes("chips.comp.menu.group.label.color"));
  assert.ok(contract.tokens.includes("chips.comp.menu.separator.thickness"));
  assert.ok(contract.motionConstraints.some((constraint) => constraint.type === "menu-transition"));
});

test("tooltip contract contains content text token", () => {
  const contract = readContract("tooltip.contract.json");
  assertCommonShape(contract);
  assert.ok(contract.parts.includes("arrow"));
  assert.ok(contract.tokens.includes("chips.comp.tooltip.content.text.color"));
  assert.ok(contract.motionConstraints.some((constraint) => constraint.type === "overlay-transition"));
});

test("form contract contains compound field and hint parts", () => {
  const contract = readContract("form.contract.json");
  assertCommonShape(contract);
  assert.ok(contract.parts.includes("field"));
  assert.ok(contract.parts.includes("control"));
  assert.ok(contract.parts.includes("hint"));
  assert.ok(contract.parts.includes("error"));
  assert.equal(contract.parts.includes("helper"), false);
  assert.ok(contract.tokens.includes("chips.comp.form.control.border.error"));
  assert.ok(contract.tokens.includes("chips.comp.form.hint.color"));
});

test("virtual-list contract contains viewport and item tokens", () => {
  const contract = readContract("virtual-list.contract.json");
  assertCommonShape(contract);
  assert.ok(contract.parts.includes("viewport"));
  assert.ok(contract.tokens.includes("chips.comp.virtual-list.item.surface.active"));
});

test("data-grid contract contains header and cell tokens", () => {
  const contract = readContract("data-grid.contract.json");
  assertCommonShape(contract);
  assert.ok(contract.parts.includes("toolbar"));
  assert.ok(contract.parts.includes("header"));
  assert.ok(contract.parts.includes("cell"));
  assert.ok(contract.parts.includes("pagination"));
  assert.equal(contract.parts.includes("table"), false);
  assert.ok(contract.tokens.includes("chips.comp.data-grid.toolbar.surface"));
  assert.ok(contract.tokens.includes("chips.comp.data-grid.header.sort.color"));
  assert.ok(contract.tokens.includes("chips.comp.data-grid.pagination.gap"));
  assert.ok(contract.tokens.includes("chips.comp.data-grid.row.surface.selected"));
  assert.ok(contract.motionConstraints.some((constraint) => constraint.type === "list-reorder"));
});

test("tree contract contains compound item and disclosure parts", () => {
  const contract = readContract("tree.contract.json");
  assertCommonShape(contract);
  assert.ok(contract.parts.includes("item"));
  assert.ok(contract.parts.includes("branch"));
  assert.ok(contract.parts.includes("leaf"));
  assert.ok(contract.parts.includes("disclosure"));
  assert.ok(contract.parts.includes("group"));
  assert.equal(contract.parts.includes("node"), false);
  assert.equal(contract.parts.includes("toggle"), false);
  assert.equal(contract.parts.includes("children"), false);
  assert.ok(contract.tokens.includes("chips.comp.tree.item.surface.selected"));
  assert.ok(contract.tokens.includes("chips.comp.tree.disclosure.color"));
  assert.ok(contract.tokens.includes("chips.comp.tree.group.guide.color"));
  assert.ok(contract.motionConstraints.some((constraint) => constraint.type === "list-reorder"));
});

test("date-time contract contains input error token", () => {
  const contract = readContract("date-time.contract.json");
  assertCommonShape(contract);
  assert.ok(contract.parts.includes("input"));
  assert.ok(contract.tokens.includes("chips.comp.date-time.input.border.error"));
});

test("command-palette contract contains compound input item and group tokens", () => {
  const contract = readContract("command-palette.contract.json");
  assertCommonShape(contract);
  assert.ok(contract.parts.includes("input"));
  assert.ok(contract.parts.includes("list"));
  assert.ok(contract.parts.includes("group"));
  assert.ok(contract.parts.includes("group-label"));
  assert.ok(contract.parts.includes("item"));
  assert.equal(contract.parts.includes("search"), false);
  assert.ok(contract.tokens.includes("chips.comp.command-palette.input.surface.idle"));
  assert.ok(contract.tokens.includes("chips.comp.command-palette.item.surface.active"));
  assert.ok(contract.tokens.includes("chips.comp.command-palette.group.label.color"));
  assert.equal(contract.tokens.includes("chips.comp.command-palette.result.surface.active"), false);
});

test("navigation-split-view contract keeps navigation parts separate from split-view layout parts", () => {
  const contract = readContract("navigation-split-view.contract.json");
  assertCommonShape(contract);
  assert.ok(contract.parts.includes("sidebar"));
  assert.ok(contract.parts.includes("content"));
  assert.ok(contract.parts.includes("detail"));
  assert.ok(contract.parts.includes("divider"));
  assert.equal(contract.parts.includes("primary"), false);
  assert.equal(contract.parts.includes("secondary"), false);
  assert.ok(contract.tokens.includes("chips.comp.navigation-split-view.sidebar.surface"));
  assert.ok(contract.tokens.includes("chips.comp.navigation-split-view.detail.surface"));
  assert.ok(contract.tokens.includes("chips.comp.navigation-split-view.divider.color"));
  assert.ok(contract.motionConstraints.some((constraint) => constraint.type === "scene-transition"));
});

test("data-grid contract contains row selected token", () => {
  const contract = readContract("data-grid.contract.json");
  assertCommonShape(contract);
  assert.ok(contract.parts.includes("row"));
  assert.ok(contract.tokens.includes("chips.comp.data-grid.row.surface.selected"));
});

test("tree contract contains item selected token", () => {
  const contract = readContract("tree.contract.json");
  assertCommonShape(contract);
  assert.ok(contract.parts.includes("item"));
  assert.ok(contract.tokens.includes("chips.comp.tree.item.surface.selected"));
});

test("date-time contract contains input border error token", () => {
  const contract = readContract("date-time.contract.json");
  assertCommonShape(contract);
  assert.ok(contract.parts.includes("input"));
  assert.ok(contract.tokens.includes("chips.comp.date-time.input.border.error"));
});

test("date and time picker contracts contain picker structure tokens", () => {
  const datePicker = readContract("date-picker.contract.json");
  const timePicker = readContract("time-picker.contract.json");
  assertCommonShape(datePicker);
  assertCommonShape(timePicker);
  assert.ok(datePicker.parts.includes("calendar"));
  assert.ok(datePicker.parts.includes("cell"));
  assert.ok(datePicker.tokens.includes("chips.comp.date-picker.calendar.surface"));
  assert.ok(datePicker.tokens.includes("chips.comp.date-picker.cell.surface.selected"));
  assert.ok(timePicker.parts.includes("list"));
  assert.ok(timePicker.parts.includes("option"));
  assert.ok(timePicker.tokens.includes("chips.comp.time-picker.list.surface"));
  assert.ok(timePicker.tokens.includes("chips.comp.time-picker.option.surface.selected"));
});

test("command-palette contract contains shortcut token", () => {
  const contract = readContract("command-palette.contract.json");
  assertCommonShape(contract);
  assert.ok(contract.parts.includes("shortcut"));
  assert.ok(contract.tokens.includes("chips.comp.command-palette.shortcut.color"));
});

test("command consumer contracts expose command parts and tokens", () => {
  const toolbar = readContract("toolbar.contract.json");
  const menuBar = readContract("menu-bar.contract.json");
  const contextMenu = readContract("context-menu.contract.json");
  const shortcut = readContract("shortcut.contract.json");

  assertCommonShape(toolbar);
  assertCommonShape(menuBar);
  assertCommonShape(contextMenu);
  assertCommonShape(shortcut);
  assert.ok(toolbar.parts.includes("icon"));
  assert.ok(toolbar.tokens.includes("chips.comp.toolbar.item.icon.color"));
  assert.ok(toolbar.tokens.includes("chips.comp.toolbar.item.icon.size"));
  assert.ok(toolbar.motionConstraints.some((constraint) => constraint.type === "command-state-transition"));
  assert.ok(menuBar.parts.includes("icon"));
  assert.ok(menuBar.tokens.includes("chips.comp.menu-bar.item.icon.color"));
  assert.ok(menuBar.parts.includes("shortcut"));
  assert.ok(menuBar.tokens.includes("chips.comp.menu-bar.shortcut.color"));
  assert.ok(menuBar.motionConstraints.some((constraint) => constraint.type === "menu-transition"));
  assert.ok(contextMenu.parts.includes("group"));
  assert.ok(contextMenu.tokens.includes("chips.comp.context-menu.content.surface"));
  assert.ok(contextMenu.parts.includes("icon"));
  assert.ok(contextMenu.tokens.includes("chips.comp.context-menu.item.icon.color"));
  assert.ok(contextMenu.motionConstraints.some((constraint) => constraint.type === "menu-transition"));
  assert.ok(shortcut.parts.includes("key"));
  assert.ok(shortcut.tokens.includes("chips.comp.shortcut.key.text.color"));
});

test("split-pane contract contains resizer token", () => {
  const contract = readContract("split-pane.contract.json");
  assertCommonShape(contract);
  assert.ok(contract.parts.includes("resizer"));
  assert.ok(contract.tokens.includes("chips.comp.split-pane.handle.surface.active"));
});

test("dock-panel contract contains tab and content parts", () => {
  const contract = readContract("dock-panel.contract.json");
  assertCommonShape(contract);
  assert.ok(contract.parts.includes("tab"));
  assert.ok(contract.parts.includes("content"));
  assert.ok(contract.tokens.includes("chips.comp.dock-panel.tab.surface.active"));
});

test("inspector contract contains section header token", () => {
  const contract = readContract("inspector.contract.json");
  assertCommonShape(contract);
  assert.ok(contract.parts.includes("section"));
  assert.ok(contract.tokens.includes("chips.comp.inspector.section.header.surface.active"));
});

test("panel-header contract contains action token", () => {
  const contract = readContract("panel-header.contract.json");
  assertCommonShape(contract);
  assert.ok(contract.parts.includes("actions"));
  assert.ok(contract.tokens.includes("chips.comp.panel-header.action.surface.active"));
});

test("card-shell contract contains border token", () => {
  const contract = readContract("card-shell.contract.json");
  assertCommonShape(contract);
  assert.ok(contract.parts.includes("toolbar"));
  assert.ok(contract.tokens.includes("chips.comp.card-shell.border.color"));
});

test("tool-window contract contains control token", () => {
  const contract = readContract("tool-window.contract.json");
  assertCommonShape(contract);
  assert.ok(contract.parts.includes("controls"));
  assert.ok(contract.tokens.includes("chips.comp.tool-window.control.surface.active"));
});

test("error-boundary contract contains action token", () => {
  const contract = readContract("error-boundary.contract.json");
  assertCommonShape(contract);
  assert.ok(contract.parts.includes("action"));
  assert.ok(contract.tokens.includes("chips.comp.error-boundary.root.border.error"));
});

test("loading-boundary contract contains fallback token", () => {
  const contract = readContract("loading-boundary.contract.json");
  assertCommonShape(contract);
  assert.ok(contract.parts.includes("fallback"));
  assert.ok(contract.tokens.includes("chips.comp.loading-boundary.skeleton.surface.active"));
  assert.ok(contract.tokens.includes("chips.comp.loading-boundary.skeleton.motion.duration"));
  assert.ok(contract.motionConstraints.some((constraint) => constraint.type === "loading-feedback"));
});

test("notification contract contains list and close tokens", () => {
  const contract = readContract("notification.contract.json");
  assertCommonShape(contract);
  assert.ok(contract.parts.includes("list"));
  assert.ok(contract.tokens.includes("chips.comp.notification.close.color"));
});

test("toast contract contains close token", () => {
  const contract = readContract("toast.contract.json");
  assertCommonShape(contract);
  assert.ok(contract.parts.includes("close"));
  assert.ok(contract.tokens.includes("chips.comp.toast.close.color"));
});

test("empty-state contract contains title and action tokens", () => {
  const contract = readContract("empty-state.contract.json");
  assertCommonShape(contract);
  assert.ok(contract.parts.includes("title"));
  assert.ok(contract.tokens.includes("chips.comp.empty-state.action.surface.active"));
});

test("skeleton contract contains item token", () => {
  const contract = readContract("skeleton.contract.json");
  assertCommonShape(contract);
  assert.ok(contract.parts.includes("item"));
  assert.ok(contract.tokens.includes("chips.comp.skeleton.item.surface.active"));
  assert.ok(contract.tokens.includes("chips.comp.skeleton.item.motion.duration"));
  assert.ok(contract.motionConstraints.some((constraint) => constraint.type === "skeleton-feedback"));
});

test("layout primitive contracts do not require iframe contract", () => {
  const contract = readContract("view.contract.json");
  assertCommonShape(contract);
  assert.equal(contract.iframe, undefined);
  assert.ok(contract.parts.includes("content"));
  assert.ok(contract.tokens.includes("chips.comp.view.content.surface"));
});

test("layout primitive contract family contains expected semantic scopes", () => {
  const expectations = [
    ["box.contract.json", "box", "chips.comp.box.root.radius"],
    ["stack.contract.json", "stack", "chips.comp.stack.root.gap"],
    ["inline.contract.json", "inline", "chips.comp.inline.root.gap"],
    ["grid.contract.json", "grid", "chips.comp.grid.item.surface"],
    ["section.contract.json", "section", "chips.comp.section.divider.color"],
    ["scroll-view.contract.json", "scroll-view", "chips.comp.scroll-view.scrollbar.thumb"],
    ["spacer.contract.json", "spacer", "chips.comp.spacer.root.size"],
    ["divider.contract.json", "divider", "chips.comp.divider.root.thickness"],
    ["split-view.contract.json", "split-view", "chips.comp.split-view.detail.surface"]
  ];

  for (const [fileName, scope, token] of expectations) {
    const contract = readContract(fileName);
    assertCommonShape(contract);
    assert.equal(contract.scope, scope);
    assert.ok(contract.tokens.includes(token));
  }
});

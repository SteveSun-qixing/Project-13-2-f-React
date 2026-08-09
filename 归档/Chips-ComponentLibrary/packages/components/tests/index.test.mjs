import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import {
  buildComponentContract,
  buildLayoutComponentContract,
  ChipsButton,
  ChipsBox,
  ChipsCheckbox,
  ChipsCommandPalette,
  ChipsDatePicker,
  ChipsDataGrid,
  ChipsDateTime,
  ChipsDivider,
  ChipsDockPanel,
  ChipsDialog,
  ChipsEmptyState,
  ChipsErrorState,
  ChipsGrid,
  ChipsIcon,
  ChipsIconButton,
  ChipsImage,
  ChipsErrorBoundary,
  ChipsForm,
  ChipsInline,
  ChipsInput,
  ChipsInspector,
  ChipsLabel,
  ChipsLoadingBoundary,
  ChipsMedia,
  ChipsMenu,
  ChipsMenuBar,
  ChipsNavigationSplitView,
  ChipsNotification,
  ChipsPanelHeader,
  ChipsPopover,
  ChipsProgress,
  ChipsRating,
  ChipsRadioGroup,
  ChipsSearchField,
  ChipsSecureField,
  ChipsSegmentedControl,
  ChipsNumberInput,
  ChipsStepper,
  ChipsSlider,
  ChipsSpinner,
  ChipsSkeleton,
  ChipsSplitPane,
  ChipsSelect,
  ChipsScrollView,
  ChipsSection,
  ChipsSwitch,
  ChipsSpacer,
  ChipsSplitView,
  ChipsStack,
  ChipsTabs,
  ChipsText,
  ChipsTextArea,
  ChipsTextField,
  ChipsToggleButton,
  ChipsComboBox,
  ChipsTimePicker,
  ChipsToolbar,
  ChipsToolbarItem,
  ChipsContextMenu,
  ChipsShortcut,
  ChipsToast,
  ChipsToolWindow,
  ChipsTree,
  ChipsTooltip,
  ChipsAvatar,
  ChipsBadge,
  ChipsView,
  ChipsVirtualList,
  ChipsTag,
  ChipsCardShell,
  COMPONENT_TOKEN_MAP,
  clampSplitRatio,
  createObservationRecord,
  createCommandAdapter,
  dismissSystemMessage,
  applyDataGridSort,
  computeVirtualWindow,
  createComponentMeta,
  filterCommandPaletteItems,
  findTreeParentId,
  flattenTreeNodes,
  getNextEnabledIndex,
  InteractiveEventType,
  interactiveStateReducer,
  normalizeSystemMessageItems,
  parsePositiveInteger,
  P0_DISPLAY_COMPONENTS,
  TASK015_BASE_CONTROL_COMPONENTS,
  P0_BASE_INTERACTIVE_COMPONENTS,
  P0_DATA_FORM_COMPONENTS,
  resolveConfigValue,
  resolveCommandMenuGroups,
  resolveCommandPaletteItems,
  resolveCommandToolbarItems,
  resolveDockPanelStateMap,
  resolveDatePickerModel,
  resolveErrorStateModel,
  resolveI18nText,
  resolveImageModel,
  resolveMediaModel,
  resolveSystemMessageQueue,
  resolveInteractiveState,
  resolveNumericControlModel,
  resolveSliderModel,
  resolveTimePickerModel,
  resolveTextInputDescriptor,
  STAGE7_DATA_ADVANCED_COMPONENTS,
  STAGE7_WORKBENCH_COMPONENTS,
  STAGE8_SYSTEM_UX_COMPONENTS,
  toStandardError,
  toggleInspectorSection,
  validateComponentA11y
} from "../src/index.js";

test("createComponentMeta builds metadata", () => {
  const meta = createComponentMeta({
    name: "ChipsButton",
    scope: "button",
    parts: ["root"],
    states: ["idle"]
  });

  assert.equal(meta.scope, "button");
});

test("createComponentMeta validates parts", () => {
  assert.throws(
    () => createComponentMeta({ name: "X", scope: "x", parts: [], states: ["idle"] }),
    /COMPONENT_META_INVALID:parts/
  );
});

test("resolveInteractiveState follows priority order", () => {
  assert.equal(
    resolveInteractiveState({
      disabled: true,
      loading: true,
      error: { code: "X", message: "x" },
      interaction: { active: true, focused: true, hovered: true }
    }),
    "disabled"
  );

  assert.equal(
    resolveInteractiveState({
      disabled: false,
      loading: true,
      error: { code: "X", message: "x" },
      interaction: { active: true, focused: true, hovered: true }
    }),
    "loading"
  );

  assert.equal(
    resolveInteractiveState({
      disabled: false,
      loading: false,
      error: { code: "X", message: "x" },
      interaction: { active: true, focused: true, hovered: true }
    }),
    "error"
  );
});

test("interactiveStateReducer transitions states correctly", () => {
  let state = {
    hovered: false,
    focused: false,
    active: false
  };

  state = interactiveStateReducer(state, { type: InteractiveEventType.POINTER_ENTER });
  state = interactiveStateReducer(state, { type: InteractiveEventType.FOCUS });
  state = interactiveStateReducer(state, { type: InteractiveEventType.PRESS_START });

  assert.deepEqual(state, {
    hovered: true,
    focused: true,
    active: true
  });

  state = interactiveStateReducer(state, { type: InteractiveEventType.POINTER_LEAVE });
  assert.equal(state.hovered, false);
  assert.equal(state.active, false);
});

test("buildComponentContract returns predefined contract", () => {
  const contract = buildComponentContract("button");
  assert.equal(contract.scope, "button");
  assert.ok(contract.tokens.includes("chips.comp.button.root.radius"));
});

test("buildComponentContract validates component key", () => {
  assert.throws(
    () => buildComponentContract("unknown-component"),
    /COMPONENT_CONTRACT_TOKEN_MAP_MISSING/
  );
});

test("buildComponentContract returns icon component contract", () => {
  const contract = buildComponentContract("icon");
  assert.equal(contract.scope, "icon");
  assert.deepEqual(contract.parts, ["root"]);
  assert.ok(contract.tokens.includes("chips.comp.icon.root.color"));
});

test("buildComponentContract returns task015 base control component contracts", () => {
  const iconButton = buildComponentContract("icon-button");
  const toggleButton = buildComponentContract("toggle-button");
  const progress = buildComponentContract("progress");
  const textField = buildComponentContract("text-field");
  const textArea = buildComponentContract("text-area");
  const searchField = buildComponentContract("search-field");
  const secureField = buildComponentContract("secure-field");
  const segmentedControl = buildComponentContract("segmented-control");
  const comboBox = buildComponentContract("combo-box");
  const numberInput = buildComponentContract("number-input");
  const stepper = buildComponentContract("stepper");
  const slider = buildComponentContract("slider");
  const datePicker = buildComponentContract("date-picker");
  const timePicker = buildComponentContract("time-picker");
  const image = buildComponentContract("image");
  const media = buildComponentContract("media");
  const errorState = buildComponentContract("error-state");

  assert.equal(iconButton.scope, "icon-button");
  assert.ok(iconButton.parts.includes("icon"));
  assert.ok(iconButton.tokens.includes("chips.comp.icon-button.root.size"));
  assert.equal(toggleButton.scope, "toggle-button");
  assert.ok(toggleButton.parts.includes("label"));
  assert.ok(toggleButton.tokens.includes("chips.comp.toggle-button.root.surface.pressed"));
  assert.equal(progress.scope, "progress");
  assert.ok(progress.parts.includes("range"));
  assert.ok(progress.tokens.includes("chips.comp.progress.range.surface.indeterminate"));
  assert.equal(textField.scope, "text-field");
  assert.ok(textField.parts.includes("control"));
  assert.ok(textField.tokens.includes("chips.comp.text-field.root.border.error"));
  assert.equal(textArea.scope, "text-area");
  assert.ok(textArea.parts.includes("description"));
  assert.ok(textArea.tokens.includes("chips.comp.text-area.control.color"));
  assert.equal(searchField.scope, "search-field");
  assert.ok(searchField.parts.includes("clear"));
  assert.ok(searchField.tokens.includes("chips.comp.search-field.clear.color.hover"));
  assert.equal(secureField.scope, "secure-field");
  assert.ok(secureField.parts.includes("visibility-toggle"));
  assert.ok(secureField.tokens.includes("chips.comp.secure-field.toggle.color.idle"));
  assert.equal(segmentedControl.scope, "segmented-control");
  assert.ok(segmentedControl.parts.includes("indicator"));
  assert.ok(segmentedControl.tokens.includes("chips.comp.segmented-control.item.surface.selected"));
  assert.equal(comboBox.scope, "combo-box");
  assert.ok(comboBox.parts.includes("list"));
  assert.ok(comboBox.tokens.includes("chips.comp.combo-box.option.surface.highlighted"));
  assert.equal(numberInput.scope, "number-input");
  assert.ok(numberInput.parts.includes("control"));
  assert.ok(numberInput.tokens.includes("chips.comp.number-input.root.border.error"));
  assert.equal(stepper.scope, "stepper");
  assert.ok(stepper.parts.includes("value"));
  assert.ok(stepper.tokens.includes("chips.comp.stepper.increment.surface.active"));
  assert.equal(slider.scope, "slider");
  assert.ok(slider.parts.includes("thumb"));
  assert.ok(slider.tokens.includes("chips.comp.slider.thumb.surface.active"));
  assert.equal(datePicker.scope, "date-picker");
  assert.ok(datePicker.parts.includes("calendar"));
  assert.ok(datePicker.tokens.includes("chips.comp.date-picker.cell.surface.selected"));
  assert.equal(timePicker.scope, "time-picker");
  assert.ok(timePicker.parts.includes("option"));
  assert.ok(timePicker.tokens.includes("chips.comp.time-picker.option.surface.selected"));
  assert.equal(image.scope, "image");
  assert.ok(image.parts.includes("media"));
  assert.ok(image.tokens.includes("chips.comp.image.fallback.surface"));
  assert.equal(media.scope, "media");
  assert.ok(media.parts.includes("controls"));
  assert.ok(media.tokens.includes("chips.comp.media.control.surface.active"));
  assert.equal(errorState.scope, "error-state");
  assert.ok(errorState.parts.includes("details"));
  assert.ok(errorState.tokens.includes("chips.comp.error-state.root.border.error"));
});

test("layout primitive contracts are available through common contract builder", () => {
  const view = buildComponentContract("view");
  const splitView = buildLayoutComponentContract("split-view");

  assert.equal(view.scope, "view");
  assert.ok(view.tokens.includes("chips.comp.view.root.surface"));
  assert.equal(splitView.scope, "split-view");
  assert.ok(splitView.parts.includes("detail"));
});

test("component token map includes complete P0 base interactive keys", () => {
  assert.ok(Array.isArray(COMPONENT_TOKEN_MAP.view));
  assert.ok(Array.isArray(COMPONENT_TOKEN_MAP.box));
  assert.ok(Array.isArray(COMPONENT_TOKEN_MAP.stack));
  assert.ok(Array.isArray(COMPONENT_TOKEN_MAP.inline));
  assert.ok(Array.isArray(COMPONENT_TOKEN_MAP.grid));
  assert.ok(Array.isArray(COMPONENT_TOKEN_MAP.section));
  assert.ok(Array.isArray(COMPONENT_TOKEN_MAP["scroll-view"]));
  assert.ok(Array.isArray(COMPONENT_TOKEN_MAP.spacer));
  assert.ok(Array.isArray(COMPONENT_TOKEN_MAP.divider));
  assert.ok(Array.isArray(COMPONENT_TOKEN_MAP["split-view"]));
  assert.ok(Array.isArray(COMPONENT_TOKEN_MAP.text));
  assert.ok(Array.isArray(COMPONENT_TOKEN_MAP.label));
  assert.ok(Array.isArray(COMPONENT_TOKEN_MAP.icon));
  assert.ok(Array.isArray(COMPONENT_TOKEN_MAP["icon-button"]));
  assert.ok(Array.isArray(COMPONENT_TOKEN_MAP["toggle-button"]));
  assert.ok(Array.isArray(COMPONENT_TOKEN_MAP.badge));
  assert.ok(Array.isArray(COMPONENT_TOKEN_MAP.tag));
  assert.ok(Array.isArray(COMPONENT_TOKEN_MAP.avatar));
  assert.ok(Array.isArray(COMPONENT_TOKEN_MAP.spinner));
  assert.ok(Array.isArray(COMPONENT_TOKEN_MAP.progress));
  assert.ok(Array.isArray(COMPONENT_TOKEN_MAP["text-field"]));
  assert.ok(Array.isArray(COMPONENT_TOKEN_MAP["text-area"]));
  assert.ok(Array.isArray(COMPONENT_TOKEN_MAP["search-field"]));
  assert.ok(Array.isArray(COMPONENT_TOKEN_MAP["secure-field"]));
  assert.ok(Array.isArray(COMPONENT_TOKEN_MAP["segmented-control"]));
  assert.ok(Array.isArray(COMPONENT_TOKEN_MAP["combo-box"]));
  assert.ok(Array.isArray(COMPONENT_TOKEN_MAP["number-input"]));
  assert.ok(Array.isArray(COMPONENT_TOKEN_MAP.stepper));
  assert.ok(Array.isArray(COMPONENT_TOKEN_MAP.slider));
  assert.ok(Array.isArray(COMPONENT_TOKEN_MAP["date-picker"]));
  assert.ok(Array.isArray(COMPONENT_TOKEN_MAP["time-picker"]));
  assert.ok(Array.isArray(COMPONENT_TOKEN_MAP.image));
  assert.ok(Array.isArray(COMPONENT_TOKEN_MAP.media));
  assert.ok(Array.isArray(COMPONENT_TOKEN_MAP["error-state"]));
  assert.ok(Array.isArray(COMPONENT_TOKEN_MAP.button));
  assert.ok(Array.isArray(COMPONENT_TOKEN_MAP.input));
  assert.ok(Array.isArray(COMPONENT_TOKEN_MAP.checkbox));
  assert.ok(Array.isArray(COMPONENT_TOKEN_MAP.radio));
  assert.ok(Array.isArray(COMPONENT_TOKEN_MAP.select));
  assert.ok(Array.isArray(COMPONENT_TOKEN_MAP.switch));
  assert.ok(Array.isArray(COMPONENT_TOKEN_MAP.dialog));
  assert.ok(Array.isArray(COMPONENT_TOKEN_MAP.popover));
  assert.ok(Array.isArray(COMPONENT_TOKEN_MAP.tabs));
  assert.ok(Array.isArray(COMPONENT_TOKEN_MAP.menu));
  assert.ok(Array.isArray(COMPONENT_TOKEN_MAP.tooltip));
  assert.ok(Array.isArray(COMPONENT_TOKEN_MAP.form));
  assert.ok(Array.isArray(COMPONENT_TOKEN_MAP["virtual-list"]));
  assert.ok(Array.isArray(COMPONENT_TOKEN_MAP["data-grid"]));
  assert.ok(Array.isArray(COMPONENT_TOKEN_MAP.tree));
  assert.ok(Array.isArray(COMPONENT_TOKEN_MAP["date-time"]));
  assert.ok(Array.isArray(COMPONENT_TOKEN_MAP["command-palette"]));
  assert.ok(Array.isArray(COMPONENT_TOKEN_MAP["navigation-split-view"]));
  assert.ok(Array.isArray(COMPONENT_TOKEN_MAP["split-pane"]));
  assert.ok(Array.isArray(COMPONENT_TOKEN_MAP["dock-panel"]));
  assert.ok(Array.isArray(COMPONENT_TOKEN_MAP.inspector));
  assert.ok(Array.isArray(COMPONENT_TOKEN_MAP["panel-header"]));
  assert.ok(Array.isArray(COMPONENT_TOKEN_MAP["card-shell"]));
  assert.ok(Array.isArray(COMPONENT_TOKEN_MAP["tool-window"]));
  assert.ok(Array.isArray(COMPONENT_TOKEN_MAP["error-boundary"]));
  assert.ok(Array.isArray(COMPONENT_TOKEN_MAP["loading-boundary"]));
  assert.ok(Array.isArray(COMPONENT_TOKEN_MAP.notification));
  assert.ok(Array.isArray(COMPONENT_TOKEN_MAP.toast));
  assert.ok(Array.isArray(COMPONENT_TOKEN_MAP["empty-state"]));
  assert.ok(Array.isArray(COMPONENT_TOKEN_MAP.skeleton));
});

test("layout primitives render standard data attributes", () => {
  const view = ChipsView.render(
    {
      title: "Library",
      children: "Content"
    },
    null
  );
  const box = ChipsBox.render({ padding: "12px" }, null);
  const stack = ChipsStack.render({ direction: "horizontal", children: ["A", "B"] }, null);
  const inline = ChipsInline.render({ children: ["A", "B"] }, null);
  const grid = ChipsGrid.render({ columns: 2, children: ["A"] }, null);
  const section = ChipsSection.render({ title: "General", children: "Body" }, null);
  const scrollView = ChipsScrollView.render({ "aria-label": "Scrollable", children: "Body" }, null);
  const spacer = ChipsSpacer.render({ size: "1rem" }, null);
  const divider = ChipsDivider.render({ orientation: "vertical" }, null);
  const splitView = ChipsSplitView.render(
    {
      "aria-label": "Split",
      primary: "Navigation",
      detail: "Detail"
    },
    null
  );

  assert.equal(view.props["data-scope"], "view");
  assert.equal(box.props["data-scope"], "box");
  assert.equal(stack.props["data-direction"], "horizontal");
  assert.equal(inline.props["data-wrap"], "true");
  assert.equal(grid.props["data-columns"], "2");
  assert.equal(section.props["data-scope"], "section");
  assert.equal(scrollView.props["data-axis"], "vertical");
  assert.equal(ChipsBox.render({ loading: true }, null).props["data-state"], "loading");
  assert.equal(ChipsScrollView.render({ axis: "invalid", "aria-label": "Fallback" }, null).props["data-axis"], "vertical");
  assert.equal(spacer.props["aria-hidden"], "true");
  assert.equal(divider.props.role, "separator");
  assert.equal(splitView.props["data-variant"], "two-column");
});

test("validateComponentA11y validates known components and rejects missing rule", () => {
  assert.equal(
    validateComponentA11y("text", {}),
    true
  );

  assert.equal(
    validateComponentA11y("label", {
      htmlFor: "name"
    }),
    true
  );

  assert.equal(
    validateComponentA11y("icon", {
      "aria-hidden": "true"
    }),
    true
  );

  assert.equal(
    validateComponentA11y("icon-button", {
      "aria-label": "Refresh"
    }),
    true
  );

  assert.equal(
    validateComponentA11y("toggle-button", {
      "aria-label": "Pin",
      "aria-pressed": "false"
    }),
    true
  );

  assert.equal(
    validateComponentA11y("badge", {
      "aria-label": "3 unread"
    }),
    true
  );

  assert.equal(
    validateComponentA11y("tag", {
      "aria-label": "Project tag"
    }),
    true
  );

  assert.equal(
    validateComponentA11y("avatar", {
      role: "img",
      "aria-label": "Ada Lovelace"
    }),
    true
  );

  assert.equal(
    validateComponentA11y("spinner", {
      role: "status",
      "aria-label": "Loading"
    }),
    true
  );

  assert.equal(
    validateComponentA11y("progress", {
      role: "progressbar",
      "aria-label": "Upload progress"
    }),
    true
  );

  assert.equal(
    validateComponentA11y("text-field", {
      "aria-label": "card name"
    }),
    true
  );

  assert.equal(
    validateComponentA11y("text-area", {
      "aria-label": "description"
    }),
    true
  );

  assert.equal(
    validateComponentA11y("search-field", {
      role: "search",
      "aria-label": "search"
    }),
    true
  );

  assert.equal(
    validateComponentA11y("secure-field", {
      "aria-label": "password",
      "aria-pressed": "false"
    }),
    true
  );

  assert.equal(
    validateComponentA11y("segmented-control", {
      role: "radiogroup",
      "aria-label": "view mode"
    }),
    true
  );

  assert.equal(
    validateComponentA11y("combo-box", {
      role: "combobox",
      "aria-label": "choose card",
      "aria-expanded": "true",
      "aria-controls": "combo-list"
    }),
    true
  );

  assert.equal(
    validateComponentA11y("number-input", {
      role: "spinbutton",
      "aria-label": "quantity"
    }),
    true
  );

  assert.equal(
    validateComponentA11y("stepper", {
      role: "group",
      "aria-label": "quantity stepper"
    }),
    true
  );

  assert.equal(
    validateComponentA11y("slider", {
      role: "slider",
      "aria-label": "volume"
    }),
    true
  );

  assert.equal(
    validateComponentA11y("input", {
      "aria-label": "name"
    }),
    true
  );

  assert.equal(
    validateComponentA11y("switch", {
      role: "switch",
      "aria-label": "state"
    }),
    true
  );

  assert.equal(
    validateComponentA11y("select", {
      role: "button",
      "aria-label": "selector",
      "aria-expanded": "true",
      "aria-controls": "list-id"
    }),
    true
  );

  assert.equal(
    validateComponentA11y("dialog", {
      role: "button",
      "aria-label": "open dialog",
      "aria-expanded": "true",
      "aria-controls": "dialog-id"
    }),
    true
  );

  assert.equal(
    validateComponentA11y("tabs", {
      role: "tab",
      "aria-label": "general"
    }),
    true
  );

  assert.equal(
    validateComponentA11y("menu", {
      role: "button",
      "aria-label": "open menu",
      "aria-expanded": "true",
      "aria-controls": "menu-id"
    }),
    true
  );

  assert.equal(
    validateComponentA11y("tooltip", {
      role: "tooltip"
    }),
    true
  );

  assert.equal(
    validateComponentA11y("form", {
      "aria-label": "card name"
    }),
    true
  );

  assert.equal(
    validateComponentA11y("virtual-list", {
      role: "list",
      "aria-label": "result list"
    }),
    true
  );

  assert.equal(
    validateComponentA11y("data-grid", {
      part: "root",
      role: "group",
      "aria-label": "table group"
    }),
    true
  );

  assert.equal(
    validateComponentA11y("data-grid", {
      role: "grid",
      "aria-label": "table"
    }),
    true
  );

  assert.equal(
    validateComponentA11y("tree", {
      role: "tree",
      "aria-label": "tree"
    }),
    true
  );

  assert.equal(
    validateComponentA11y("date-time", {
      "aria-label": "time input"
    }),
    true
  );

  assert.equal(
    validateComponentA11y("command-palette", {
      role: "combobox",
      "aria-label": "search command",
      "aria-expanded": "true",
      "aria-controls": "palette-list"
    }),
    true
  );

  assert.equal(
    validateComponentA11y("navigation-split-view", {
      role: "group",
      "aria-label": "workspace navigation"
    }),
    true
  );

  assert.equal(
    validateComponentA11y("navigation-split-view", {
      part: "sidebar",
      role: "navigation",
      "aria-label": "sources"
    }),
    true
  );

  assert.equal(
    validateComponentA11y("navigation-split-view", {
      part: "detail",
      role: "region",
      "aria-label": "detail"
    }),
    true
  );

  assert.equal(
    validateComponentA11y("split-pane", {
      role: "group",
      "aria-label": "split layout"
    }),
    true
  );

  assert.equal(
    validateComponentA11y("dock-panel", {
      role: "tablist",
      "aria-label": "dock panel list"
    }),
    true
  );

  assert.equal(
    validateComponentA11y("inspector", {
      role: "complementary",
      "aria-label": "inspector"
    }),
    true
  );

  assert.equal(
    validateComponentA11y("panel-header", {
      role: "group",
      "aria-label": "panel header"
    }),
    true
  );

  assert.equal(
    validateComponentA11y("card-shell", {
      role: "article",
      "aria-label": "card shell"
    }),
    true
  );

  assert.equal(
    validateComponentA11y("tool-window", {
      role: "dialog",
      "aria-label": "tool window"
    }),
    true
  );

  assert.equal(
    validateComponentA11y("error-boundary", {
      role: "alert",
      "aria-label": "error boundary"
    }),
    true
  );

  assert.equal(
    validateComponentA11y("loading-boundary", {
      role: "region",
      "aria-label": "loading boundary"
    }),
    true
  );

  assert.equal(
    validateComponentA11y("notification", {
      role: "region",
      "aria-label": "notification center"
    }),
    true
  );

  assert.equal(
    validateComponentA11y("toast", {
      role: "status",
      "aria-label": "toast"
    }),
    true
  );

  assert.equal(
    validateComponentA11y("empty-state", {
      role: "region",
      "aria-label": "empty state"
    }),
    true
  );

  assert.equal(
    validateComponentA11y("skeleton", {
      role: "status",
      "aria-label": "loading placeholder"
    }),
    true
  );

  assert.equal(
    validateComponentA11y("view", {
      role: "region",
      "aria-label": "view"
    }),
    true
  );

  assert.equal(
    validateComponentA11y("section", {
      role: "region",
      "aria-label": "section"
    }),
    true
  );

  assert.equal(
    validateComponentA11y("scroll-view", {
      role: "region",
      "aria-label": "scroll view"
    }),
    true
  );

  assert.equal(
    validateComponentA11y("split-view", {
      role: "group",
      "aria-label": "split view"
    }),
    true
  );

  assert.equal(
    validateComponentA11y("divider", {
      role: "separator"
    }),
    true
  );

  assert.throws(
    () => validateComponentA11y("calendar", {}),
    /COMPONENT_A11Y_RULE_MISSING/
  );
});

test("ChipsText renders semantic text with state and i18n fallback", () => {
  const states = [];
  const diagnostics = [];
  const rendered = ChipsText.render(
    {
      as: "p",
      textKey: "profile.name",
      fallbackText: "Name",
      tone: "accent",
      emphasis: "strong",
      truncate: true,
      i18n: (key, params, fallback) => `${key}:${fallback}`,
      onStateChange: (state) => states.push(state),
      onDiagnostic: (event) => diagnostics.push(event)
    },
    null
  );

  assert.equal(rendered.type, "p");
  assert.equal(rendered.props["data-scope"], "text");
  assert.equal(rendered.props["data-part"], "root");
  assert.equal(rendered.props["data-tone"], "accent");
  assert.equal(rendered.props["data-emphasis"], "strong");
  assert.equal(rendered.props["data-truncate"], "true");
  assert.equal(rendered.props.children, "profile.name:Name");
  assert.deepEqual(states, []);
  assert.deepEqual(diagnostics, []);
});

test("ChipsText restricts unsupported element tags and exposes error state", () => {
  const rendered = ChipsText.render(
    {
      as: "h1",
      text: "Invalid tag falls back",
      error: "Text failed"
    },
    null
  );

  assert.equal(rendered.type, "span");
  assert.equal(rendered.props["data-state"], "error");
  assert.equal(rendered.props["data-tone"], "error");
  assert.equal(rendered.props["aria-invalid"], "true");
});

test("ChipsLabel renders required indicator and status semantics", () => {
  const rendered = ChipsLabel.render(
    {
      htmlFor: "card-name",
      label: "Card name",
      required: true,
      error: { message: "Required" }
    },
    null
  );

  assert.equal(rendered.type, "label");
  assert.equal(rendered.props["data-scope"], "label");
  assert.equal(rendered.props["data-state"], "error");
  assert.equal(rendered.props["aria-required"], "true");
  assert.equal(rendered.props.children[0], "Card name");
  assert.equal(rendered.props.children[1].props["data-part"], "required-indicator");
  assert.equal(rendered.props.children[2].props.role, "status");
  assert.equal(rendered.props.children[2].props.children, "Required");
});

test("display component metadata is complete", () => {
  assert.equal(P0_DISPLAY_COMPONENTS.length, 3);
  assert.deepEqual(
    P0_DISPLAY_COMPONENTS.map((item) => item.scope),
    ["text", "label", "icon"]
  );
});

test("ChipsIcon normalizes ligature name and axis variables", () => {
  const rendered = ChipsIcon.render(
    {
      descriptor: {
        name: "calendar-month",
        style: "rounded",
        tone: "accent",
        fill: 1,
        wght: 500,
        grad: 25,
        opsz: 20
      },
      size: 20,
      color: "rebeccapurple"
    },
    null
  );

  assert.equal(rendered.props["data-icon-name"], "calendar_month");
  assert.equal(rendered.props["data-icon-style"], "rounded");
  assert.equal(rendered.props["data-tone"], "accent");
  assert.equal(rendered.props.style["--chips-icon-fill"], "1");
  assert.equal(rendered.props.style["--chips-icon-wght"], "500");
  assert.equal(rendered.props.style["--chips-icon-grad"], "25");
  assert.equal(rendered.props.style["--chips-icon-opsz"], "20");
  assert.equal(rendered.props.style["--chips-icon-size"], "20px");
  assert.equal(rendered.props.children, "calendar_month");
});

test("ChipsIcon leaves theme axes in control when descriptor does not override them", () => {
  const rendered = ChipsIcon.render(
    {
      descriptor: {
        name: "warning"
      },
      tone: "danger"
    },
    null
  );

  assert.equal(rendered.props["data-tone"], "danger");
  assert.equal(rendered.props.style["--chips-icon-fill"], undefined);
  assert.equal(rendered.props.style["--chips-icon-wght"], undefined);
  assert.equal(rendered.props.style["--chips-icon-grad"], undefined);
  assert.equal(rendered.props.style["--chips-icon-opsz"], undefined);
});

test("ChipsIcon requires a label for non-decorative icons", () => {
  assert.throws(
    () =>
      ChipsIcon.render(
        {
          descriptor: {
            name: "warning",
            decorative: false
          }
        },
        null
      ),
    /ICON_A11Y_LABEL_REQUIRED/
  );
});

test("task015 base control metadata includes second through seventh batches", () => {
  assert.equal(TASK015_BASE_CONTROL_COMPONENTS.length, 22);
  assert.deepEqual(
    TASK015_BASE_CONTROL_COMPONENTS.map((item) => item.scope),
    [
      "icon-button",
      "toggle-button",
      "badge",
      "tag",
      "avatar",
      "spinner",
      "progress",
      "rating",
      "text-field",
      "text-area",
      "search-field",
      "secure-field",
      "segmented-control",
      "combo-box",
      "number-input",
      "stepper",
      "slider",
      "date-picker",
      "time-picker",
      "image",
      "media",
      "error-state"
    ]
  );
});

test("task015 base control component exports exist", () => {
  for (const component of [
    ChipsIconButton,
    ChipsToggleButton,
    ChipsBadge,
    ChipsTag,
    ChipsAvatar,
    ChipsSpinner,
    ChipsProgress,
    ChipsRating,
    ChipsTextField,
    ChipsTextArea,
    ChipsSearchField,
    ChipsSecureField,
    ChipsSegmentedControl,
    ChipsComboBox,
    ChipsNumberInput,
    ChipsStepper,
    ChipsSlider,
    ChipsDatePicker,
    ChipsTimePicker,
    ChipsImage,
    ChipsMedia,
    ChipsErrorState
  ]) {
    assert.equal(typeof component, "object");
    assert.equal(typeof component.render, "function");
  }
});

test("ChipsIconButton requires accessible name", () => {
  assert.throws(
    () =>
      ChipsIconButton.render(
        {
          descriptor: { name: "settings" }
        },
        null
      ),
    /ICON_BUTTON_A11Y_LABEL_REQUIRED/
  );
});

test("ChipsBadge renders count and decorative semantics", () => {
  const rendered = ChipsBadge.render(
    {
      count: 120,
      max: 99,
      tone: "warning",
      decorative: true
    },
    null
  );

  assert.equal(rendered.props["data-scope"], "badge");
  assert.equal(rendered.props["data-tone"], "warning");
  assert.equal(rendered.props["data-count"], "99+");
  assert.equal(rendered.props["aria-hidden"], "true");
  assert.equal(rendered.props.children[1].props.children, "99+");
});

test("ChipsAvatar resolves fallback initials and requires labels", () => {
  const rendered = ChipsAvatar.render(
    {
      name: "Ada Lovelace",
      error: "Image failed"
    },
    null
  );

  assert.equal(rendered.props["data-scope"], "avatar");
  assert.equal(rendered.props.role, "img");
  assert.equal(rendered.props["aria-label"], "Ada Lovelace");
  assert.equal(rendered.props.children[0].props["data-part"], "fallback");
  assert.equal(rendered.props.children[0].props.children, "AL");
  assert.throws(() => ChipsAvatar.render({}, null), /AVATAR_A11Y_LABEL_REQUIRED/);
});

test("ChipsSpinner exposes status semantics or decorative mode", () => {
  const rendered = ChipsSpinner.render(
    {
      label: "Loading library"
    },
    null
  );

  assert.equal(rendered.props["data-scope"], "spinner");
  assert.equal(rendered.props.role, "status");
  assert.equal(rendered.props["aria-label"], "Loading library");
  assert.equal(rendered.props.children[0].props["data-part"], "track");
  assert.equal(rendered.props.children[1].props["data-part"], "indicator");

  const decorative = ChipsSpinner.render({ decorative: true }, null);
  assert.equal(decorative.props["aria-hidden"], "true");
});

test("ChipsProgress clamps determinate value and separates indeterminate aria", () => {
  const determinate = ChipsProgress.render(
    {
      value: 150,
      min: 0,
      max: 100,
      label: "Upload",
      showValue: true
    },
    null
  );
  const indeterminate = ChipsProgress.render(
    {
      indeterminate: true,
      label: "Sync"
    },
    null
  );

  assert.equal(determinate.props["data-scope"], "progress");
  assert.equal(determinate.props["data-mode"], "determinate");
  assert.equal(determinate.props["aria-valuenow"], 100);
  assert.equal(determinate.props.style["--chips-progress-ratio"], 1);
  assert.equal(determinate.props.children[2].props.children, "100%");
  assert.equal(indeterminate.props["data-mode"], "indeterminate");
  assert.equal(indeterminate.props["aria-valuenow"], undefined);
  assert.throws(() => ChipsProgress.render({ value: 1 }, null), /PROGRESS_A11Y_LABEL_REQUIRED/);
});

test("ChipsRating renders radiogroup items with roving focus semantics", () => {
  const html = renderToStaticMarkup(
    React.createElement(ChipsRating, {
      value: 3,
      count: 5,
      shape: "heart",
      label: "Rating",
      getItemLabel: (value) => `Set ${value}`
    })
  );
  const document = new JSDOM(html).window.document;
  const root = document.querySelector('[data-scope="rating"][data-part="root"]');
  const items = [...document.querySelectorAll('[data-scope="rating"][data-part="item"]')];

  assert.equal(root?.getAttribute("role"), "radiogroup");
  assert.equal(root?.getAttribute("data-shape"), "heart");
  assert.equal(items.length, 5);
  assert.equal(items[2].getAttribute("aria-checked"), "true");
  assert.equal(items[2].getAttribute("tabindex"), "0");
  assert.equal(items[0].querySelector('[data-part="icon"]')?.getAttribute("data-active"), "true");
  assert.equal(items[4].querySelector('[data-part="icon"]')?.getAttribute("data-active"), "false");
  assert.equal(items[3].getAttribute("aria-label"), "Set 4");
  assert.throws(
    () => renderToStaticMarkup(React.createElement(ChipsRating, { value: 1 })),
    /RATING_A11Y_LABEL_REQUIRED/
  );
});

test("ChipsRating readOnly preserves selected visual state without making items disabled", () => {
  const html = renderToStaticMarkup(
    React.createElement(ChipsRating, {
      value: 4,
      count: 5,
      readOnly: true,
      ariaLabelledBy: "score-label"
    })
  );
  const document = new JSDOM(html).window.document;
  const root = document.querySelector('[data-scope="rating"][data-part="root"]');
  const items = [...document.querySelectorAll('[data-scope="rating"][data-part="item"]')];

  assert.equal(root?.getAttribute("aria-readonly"), "true");
  assert.equal(root?.getAttribute("aria-labelledby"), "score-label");
  assert.equal(items[3].getAttribute("data-state"), "active");
  assert.equal(items[3].getAttribute("data-active"), "true");
  assert.equal(items[3].hasAttribute("disabled"), false);
  assert.equal(items[3].getAttribute("aria-disabled"), null);
  assert.equal(items[3].getAttribute("tabindex"), "-1");
});

test("resolveTextInputDescriptor builds shared input a11y state", () => {
  const descriptor = resolveTextInputDescriptor({
    scope: "text-field",
    label: "Card name",
    description: "Shown in the library",
    error: "Required",
    required: true,
    readOnly: true,
    value: "Daily note"
  });

  assert.equal(descriptor.scope, "text-field");
  assert.equal(descriptor.state, "error");
  assert.equal(descriptor.ariaLabel, "Card name");
  assert.equal(descriptor.required, true);
  assert.equal(descriptor.readOnly, true);
  assert.equal(descriptor.controlValueProps.value, "Daily note");
  assert.equal(descriptor.normalizedError.message, "Required");
  assert.equal(descriptor.describedBy, "text-field-description text-field-status");
  assert.equal(descriptor.hasAccessibleName, true);
});

test("resolveTextInputDescriptor supports labelledby and i18n labels", () => {
  const descriptor = resolveTextInputDescriptor({
    scope: "search-field",
    ariaLabelKey: "search.label",
    fallbackAriaLabel: "Search",
    ariaDescribedBy: "external-hint",
    description: "Find cards",
    i18n: (key, _params, fallback) => `${fallback}:${key}`
  });

  assert.equal(descriptor.ariaLabel, "Search:search.label");
  assert.equal(descriptor.describedBy, "external-hint search-field-description");
});

test("task015 third batch components require accessible names", () => {
  assert.throws(() => ChipsTextField.render({}, null), /TEXT_FIELD_A11Y_LABEL_REQUIRED/);
  assert.throws(() => ChipsTextArea.render({}, null), /TEXT_AREA_A11Y_LABEL_REQUIRED/);
  assert.throws(() => ChipsSearchField.render({}, null), /SEARCH_FIELD_A11Y_LABEL_REQUIRED/);
  assert.throws(() => ChipsSecureField.render({}, null), /SECURE_FIELD_A11Y_LABEL_REQUIRED/);
});

test("task015 fourth batch selection controls publish contract and a11y semantics", () => {
  const segmentedControl = buildComponentContract("segmented-control");
  const comboBox = buildComponentContract("combo-box");

  assert.deepEqual(segmentedControl.parts, ["root", "item", "indicator", "label", "status"]);
  assert.ok(segmentedControl.tokens.includes("chips.comp.segmented-control.focus.outline"));
  assert.ok(segmentedControl.states.includes("focus"));
  assert.deepEqual(comboBox.parts, ["root", "label", "control", "trigger", "list", "option", "description", "status"]);
  assert.ok(comboBox.tokens.includes("chips.comp.combo-box.trigger.color.hover"));
  assert.ok(comboBox.states.includes("active"));
  assert.equal(
    validateComponentA11y("segmented-control", {
      role: "radiogroup",
      "aria-label": "Mode"
    }),
    true
  );
  assert.equal(
    validateComponentA11y("combo-box", {
      role: "combobox",
      "aria-label": "Card type",
      "aria-expanded": "true",
      "aria-controls": "card-type-list"
    }),
    true
  );
});

test("task015 fourth batch selection controls reject missing a11y semantics", () => {
  assert.throws(
    () => validateComponentA11y("segmented-control", { role: "radiogroup" }),
    /Either aria-label or aria-labelledby is required/
  );
  assert.throws(
    () =>
      validateComponentA11y("combo-box", {
        role: "combobox",
        "aria-label": "Card type",
        "aria-expanded": "true"
      }),
    /aria-controls is required when aria-expanded is true/
  );
});

test("resolveNumericControlModel normalizes range step and text states", () => {
  const decimal = resolveNumericControlModel({
    min: 0,
    max: 1,
    step: 0.1,
    value: 0.26
  });
  const empty = resolveNumericControlModel({
    text: "",
    required: false
  });
  const invalid = resolveNumericControlModel({
    text: "not-a-number"
  });

  assert.equal(decimal.value, 0.3);
  assert.equal(decimal.atMin, false);
  assert.equal(decimal.atMax, false);
  assert.equal(empty.value, null);
  assert.equal(empty.empty, true);
  assert.equal(empty.invalid, false);
  assert.equal(invalid.value, null);
  assert.equal(invalid.invalid, true);
});

test("task015 fifth batch numeric controls publish contract and a11y semantics", () => {
  const numberInput = buildComponentContract("number-input");
  const stepper = buildComponentContract("stepper");
  const slider = buildComponentContract("slider");

  assert.deepEqual(numberInput.parts, ["root", "label", "control", "decrement", "increment", "description", "status"]);
  assert.ok(numberInput.tokens.includes("chips.comp.number-input.decrement.color.hover"));
  assert.ok(numberInput.states.includes("focus"));
  assert.deepEqual(stepper.parts, ["root", "label", "decrement", "value", "increment", "status"]);
  assert.ok(stepper.tokens.includes("chips.comp.stepper.root.gap"));
  assert.ok(stepper.states.includes("active"));
  assert.deepEqual(slider.parts, ["root", "label", "track", "range", "thumb", "value", "status"]);
  assert.ok(slider.tokens.includes("chips.comp.slider.thumb.surface.active"));
  assert.ok(slider.states.includes("focus"));
  assert.equal(
    validateComponentA11y("number-input", {
      role: "spinbutton",
      "aria-label": "Quantity"
    }),
    true
  );
  assert.equal(
    validateComponentA11y("stepper", {
      role: "group",
      "aria-label": "Quantity"
    }),
    true
  );
  assert.equal(
    validateComponentA11y("slider", {
      role: "slider",
      "aria-label": "Volume"
    }),
    true
  );
  assert.equal(
    validateComponentA11y("rating", {
      role: "radiogroup",
      "aria-label": "Rating"
    }),
    true
  );
});

test("task015 fifth batch numeric controls reject missing a11y semantics", () => {
  assert.throws(
    () => validateComponentA11y("number-input", { role: "spinbutton" }),
    /Either aria-label or aria-labelledby is required/
  );
  assert.throws(
    () => validateComponentA11y("stepper", { role: "group" }),
    /Either aria-label or aria-labelledby is required/
  );
  assert.throws(
    () => validateComponentA11y("slider", { role: "slider" }),
    /Either aria-label or aria-labelledby is required/
  );
});

test("ChipsRating contract exposes reusable rating parts and tokens", () => {
  const rating = buildComponentContract("rating");

  assert.deepEqual(rating.parts, ["root", "label", "item", "icon", "status"]);
  assert.ok(rating.states.includes("focus"));
  assert.ok(rating.tokens.includes("chips.comp.rating.item.surface.hover"));
  assert.ok(rating.tokens.includes("chips.comp.rating.icon.color.heart-active"));
  assert.throws(
    () => validateComponentA11y("rating", { role: "radiogroup" }),
    /Either aria-label or aria-labelledby is required/
  );
});

test("resolveSliderModel clamps value and computes orientation ratio", () => {
  const horizontal = resolveSliderModel({
    value: 72,
    min: 0,
    max: 100,
    step: 5
  });
  const vertical = resolveSliderModel({
    value: -10,
    min: 0,
    max: 100,
    orientation: "vertical"
  });

  assert.equal(horizontal.value, 70);
  assert.equal(horizontal.ratio, 0.7);
  assert.equal(horizontal.orientation, "horizontal");
  assert.equal(horizontal.valueText, "70");
  assert.equal(vertical.value, 0);
  assert.equal(vertical.ratio, 0);
  assert.equal(vertical.orientation, "vertical");
});

test("task015 sixth batch date and time picker models normalize calendar and time options", () => {
  const dateModel = resolveDatePickerModel({
    value: "2026-05-24",
    month: "2026-02-01",
    min: "2026-02-03",
    max: "2026-02-20",
    weekStartsOn: 1
  });
  const invalidDate = resolveDatePickerModel({
    text: "2026-02-31"
  });
  const timeModel = resolveTimePickerModel({
    value: "09:29",
    min: "09:00",
    max: "10:00",
    step: 60,
    optionStep: 900
  });
  const invalidTime = resolveTimePickerModel({
    text: "25:00"
  });

  assert.equal(dateModel.title, "February 2026");
  assert.equal(dateModel.cells.length, 42);
  assert.deepEqual(dateModel.weekDayLabels.slice(0, 2), ["Mon", "Tue"]);
  assert.equal(dateModel.cells.find((cell) => cell.value === "2026-02-02").disabled, true);
  assert.equal(dateModel.cells.find((cell) => cell.value === "2026-02-03").disabled, false);
  assert.equal(invalidDate.invalid, true);
  assert.equal(timeModel.value, "09:29");
  assert.deepEqual(
    timeModel.options.map((option) => option.value),
    ["09:00", "09:15", "09:30", "09:45", "10:00"]
  );
  assert.equal(invalidTime.invalid, true);
});

test("task015 sixth batch picker controls publish contract and a11y semantics", () => {
  const datePicker = buildComponentContract("date-picker");
  const timePicker = buildComponentContract("time-picker");

  assert.deepEqual(datePicker.parts, [
    "root",
    "label",
    "control",
    "input",
    "trigger",
    "calendar",
    "header",
    "previous",
    "next",
    "title",
    "grid",
    "week-header",
    "cell",
    "description",
    "status"
  ]);
  assert.ok(datePicker.tokens.includes("chips.comp.date-picker.cell.surface.selected"));
  assert.ok(datePicker.states.includes("focus"));
  assert.deepEqual(timePicker.parts, ["root", "label", "control", "input", "trigger", "list", "option", "description", "status"]);
  assert.ok(timePicker.tokens.includes("chips.comp.time-picker.option.surface.selected"));
  assert.ok(timePicker.states.includes("active"));
  assert.equal(
    validateComponentA11y("date-picker", {
      role: "combobox",
      "aria-label": "Due date",
      "aria-expanded": "true",
      "aria-controls": "due-date-calendar"
    }),
    true
  );
  assert.equal(
    validateComponentA11y("time-picker", {
      role: "combobox",
      "aria-label": "Start time",
      "aria-expanded": "true",
      "aria-controls": "start-time-list"
    }),
    true
  );
});

test("task015 sixth batch picker controls reject missing a11y relationships", () => {
  assert.throws(
    () => validateComponentA11y("date-picker", { role: "combobox", "aria-expanded": "true" }),
    /Either aria-label or aria-labelledby is required/
  );
  assert.throws(
    () => validateComponentA11y("time-picker", { role: "combobox", "aria-label": "Time", "aria-expanded": "true" }),
    /aria-controls is required when aria-expanded is true/
  );
});

test("ChipsDatePicker and ChipsTimePicker expose forwardRef render entries", () => {
  assert.equal(typeof ChipsDatePicker, "object");
  assert.equal(typeof ChipsDatePicker.render, "function");
  assert.equal(typeof ChipsTimePicker, "object");
  assert.equal(typeof ChipsTimePicker.render, "function");
  assert.throws(() => ChipsDatePicker.render({}, null), /DATE_PICKER_A11Y_LABEL_REQUIRED/);
  assert.throws(() => ChipsTimePicker.render({}, null), /TIME_PICKER_A11Y_LABEL_REQUIRED/);
});

test("task015 seventh batch media models normalize visual and error states", () => {
  const image = resolveImageModel({
    src: "  cover.png  ",
    alt: "Cover",
    fit: "contain",
    width: 320,
    height: "180cpx"
  });
  const decorative = resolveImageModel({
    src: "texture.png",
    alt: "Decorative texture",
    decorative: true
  });
  const media = resolveMediaModel({
    kind: "video",
    src: "clip.mp4",
    title: "Clip",
    controls: true,
    fit: "cover",
    poster: "clip.jpg"
  });
  const errorState = resolveErrorStateModel({
    error: { code: "TEST_ERROR", message: "Failed", retryable: true },
    showDetails: true
  });

  assert.equal(image.src, "cover.png");
  assert.equal(image.fit, "contain");
  assert.equal(image.width, 320);
  assert.equal(image.height, "180cpx");
  assert.equal(decorative.alt, "");
  assert.equal(media.kind, "video");
  assert.equal(media.controls, true);
  assert.equal(media.poster, "clip.jpg");
  assert.equal(errorState.error.code, "TEST_ERROR");
  assert.equal(errorState.retryable, true);
  assert.equal(errorState.showDetails, true);
});

test("task015 seventh batch image media and error state publish contract and a11y semantics", () => {
  const image = buildComponentContract("image");
  const media = buildComponentContract("media");
  const errorState = buildComponentContract("error-state");

  assert.deepEqual(image.parts, ["root", "media", "fallback", "caption", "status"]);
  assert.ok(image.tokens.includes("chips.comp.image.caption.color"));
  assert.deepEqual(media.parts, ["root", "content", "controls", "control", "caption", "status"]);
  assert.ok(media.tokens.includes("chips.comp.media.controls.surface"));
  assert.deepEqual(errorState.parts, ["root", "icon", "title", "description", "details", "action", "status"]);
  assert.ok(errorState.tokens.includes("chips.comp.error-state.action.text.color"));
  assert.equal(validateComponentA11y("image", { role: "group", "aria-label": "Cover image" }), true);
  assert.equal(validateComponentA11y("image", { "aria-hidden": "true" }), true);
  assert.equal(validateComponentA11y("media", { role: "group", "aria-label": "Preview media" }), true);
  assert.equal(validateComponentA11y("error-state", { role: "alert", "aria-label": "Failed to load" }), true);
});

test("task015 seventh batch controls enforce required accessible names", () => {
  assert.throws(() => ChipsImage.render({ src: "cover.png" }, null), /IMAGE_A11Y_ALT_REQUIRED/);
  assert.throws(() => ChipsMedia.render({ kind: "video", src: "clip.mp4" }, null), /MEDIA_A11Y_TITLE_REQUIRED/);
  assert.throws(() => validateComponentA11y("error-state", { role: "alert" }), /Either aria-label or aria-labelledby is required/);
});

test("ChipsImage ChipsMedia and ChipsErrorState expose forwardRef render entries", () => {
  assert.equal(typeof ChipsImage, "object");
  assert.equal(typeof ChipsImage.render, "function");
  assert.equal(typeof ChipsMedia, "object");
  assert.equal(typeof ChipsMedia.render, "function");
  assert.equal(typeof ChipsErrorState, "object");
  assert.equal(typeof ChipsErrorState.render, "function");

  const renderedImage = ChipsImage.render({ src: "cover.png", alt: "Cover", caption: "Cover art" }, null);
  const renderedMedia = ChipsMedia.render({ kind: "generic", title: "Media preview", children: "preview" }, null);
  const renderedError = ChipsErrorState.render({ message: "Failed", title: "Load failed", ariaLabel: "Load failed" }, null);

  assert.equal(renderedImage.props["data-scope"], "image");
  assert.equal(renderedMedia.props["data-scope"], "media");
  assert.equal(renderedError.props["data-scope"], "error-state");
  assert.equal(renderedError.props.role, "alert");
});

test("toStandardError normalizes object and primitive errors", () => {
  assert.deepEqual(toStandardError({ code: "X", message: "failed", retryable: true }), {
    code: "X",
    message: "failed",
    details: undefined,
    retryable: true
  });

  assert.equal(
    toStandardError("failed", "SYSTEM_ERROR").code,
    "SYSTEM_ERROR"
  );
});

test("resolveI18nText and resolveConfigValue apply fallback path", () => {
  const diagnostics = [];

  const text = resolveI18nText({
    i18n: null,
    key: "missing.key",
    fallback: "Fallback",
    onDiagnostic(event) {
      diagnostics.push(event);
    }
  });

  const value = resolveConfigValue({
    configSource: { systemUx: { loading: { delayMs: 200 } } },
    key: "systemUx.loading.delayMs",
    defaultValue: 120,
    parser: (source) => (Number.isInteger(source) ? source : undefined)
  });

  assert.equal(text, "Fallback");
  assert.equal(value, 200);
  assert.equal(diagnostics[0].code, "SYSTEM_UX_I18N_KEY_FALLBACK");
});

test("createObservationRecord includes standard fields", () => {
  const record = createObservationRecord({
    traceId: "trace-001",
    component: "toast",
    action: "dismiss",
    durationMs: 12
  });

  assert.equal(record.traceId, "trace-001");
  assert.equal(record.component, "toast");
  assert.equal(record.action, "dismiss");
  assert.equal(record.durationMs, 12);
});

test("parsePositiveInteger accepts positive integers only", () => {
  assert.equal(parsePositiveInteger(3), 3);
  assert.equal(parsePositiveInteger(0), undefined);
  assert.equal(parsePositiveInteger(-1), undefined);
  assert.equal(parsePositiveInteger(1.2), undefined);
});

test("normalizeSystemMessageItems normalizes tone id and duration", () => {
  const normalized = normalizeSystemMessageItems(
    [
      { title: "A", tone: "warning", durationMs: 1000 },
      { id: 2, title: "B", tone: "x", durationMs: -1 }
    ],
    "notification"
  );

  assert.equal(normalized[0].id, "notification-0");
  assert.equal(normalized[0].tone, "warning");
  assert.equal(normalized[1].id, "2");
  assert.equal(normalized[1].tone, "info");
  assert.equal(normalized[1].durationMs, null);
});

test("resolveSystemMessageQueue respects max and duration fallback", () => {
  const queue = resolveSystemMessageQueue({
    items: [
      { id: "a", message: "one", durationMs: null },
      { id: "b", message: "two", durationMs: 1500 },
      { id: "c", message: "three", durationMs: null }
    ],
    maxVisible: 2,
    defaultDurationMs: 3000
  });

  assert.equal(queue.length, 2);
  assert.equal(queue[0].effectiveDurationMs, 3000);
  assert.equal(queue[1].effectiveDurationMs, 1500);
});

test("dismissSystemMessage removes target item", () => {
  const next = dismissSystemMessage(
    [
      { id: "a", message: "one" },
      { id: "b", message: "two" }
    ],
    "a"
  );

  assert.deepEqual(next, [{ id: "b", message: "two" }]);
});

test("resolveI18nText supports function and object adapters", () => {
  const fromFunction = resolveI18nText({
    i18n: (key) => (key === "x" ? "X" : ""),
    key: "x",
    fallback: "fallback"
  });
  const fromObject = resolveI18nText({
    i18n: {
      translate({ key }) {
        return key === "y" ? "Y" : "";
      }
    },
    key: "y",
    fallback: "fallback"
  });

  assert.equal(fromFunction, "X");
  assert.equal(fromObject, "Y");
});

test("resolveI18nText passes fallback to function adapters", () => {
  const fromFunction = resolveI18nText({
    i18n: (key, params, fallback) => `${fallback}:${params.name}:${key}`,
    key: "demo.key",
    fallback: "Fallback",
    params: { name: "chips" }
  });

  assert.equal(fromFunction, "Fallback:chips:demo.key");
});

test("resolveI18nText falls back when adapter throws", () => {
  const diagnostics = [];
  const text = resolveI18nText({
    i18n() {
      throw new Error("i18n crashed");
    },
    key: "z",
    fallback: "[[z]]",
    onDiagnostic(event) {
      diagnostics.push(event);
    }
  });

  assert.equal(text, "[[z]]");
  assert.equal(diagnostics[0].code, "SYSTEM_UX_I18N_ADAPTER_ERROR");
});

test("resolveConfigValue supports function get and object source", () => {
  const fromFunction = resolveConfigValue({
    configSource(key) {
      return key === "a.b" ? 11 : undefined;
    },
    key: "a.b",
    defaultValue: 1
  });
  const fromGet = resolveConfigValue({
    configSource: {
      get(key) {
        return key === "x.y" ? 22 : undefined;
      }
    },
    key: "x.y",
    defaultValue: 1
  });
  const fromObject = resolveConfigValue({
    configSource: { c: { d: 33 } },
    key: "c.d",
    defaultValue: 1
  });

  assert.equal(fromFunction, 11);
  assert.equal(fromGet, 22);
  assert.equal(fromObject, 33);
});

test("resolveConfigValue falls back when source or parser throws", () => {
  const diagnostics = [];
  const fromSourceError = resolveConfigValue({
    configSource() {
      throw new Error("source error");
    },
    key: "a",
    defaultValue: 7,
    onDiagnostic(event) {
      diagnostics.push(event);
    }
  });
  const fromParserError = resolveConfigValue({
    configSource: { a: 3 },
    key: "a",
    defaultValue: 8,
    parser() {
      throw new Error("parser error");
    },
    onDiagnostic(event) {
      diagnostics.push(event);
    }
  });

  assert.equal(fromSourceError, 7);
  assert.equal(fromParserError, 8);
  assert.ok(diagnostics.some((item) => item.code === "SYSTEM_UX_CONFIG_SOURCE_ERROR"));
  assert.ok(diagnostics.some((item) => item.code === "SYSTEM_UX_CONFIG_PARSER_ERROR"));
});

test("P0 base interactive metadata is complete", () => {
  assert.equal(P0_BASE_INTERACTIVE_COMPONENTS.length, 15);
  assert.deepEqual(
    P0_BASE_INTERACTIVE_COMPONENTS.map((item) => item.scope),
    [
      "button",
      "input",
      "checkbox",
      "radio",
      "switch",
      "select",
      "dialog",
      "popover",
      "tabs",
      "menu",
      "toolbar",
      "menu-bar",
      "context-menu",
      "shortcut",
      "tooltip"
    ]
  );
});

test("all base interactive component exports exist", () => {
  for (const component of [
    ChipsButton,
    ChipsInput,
    ChipsCheckbox,
    ChipsRadioGroup,
    ChipsSwitch,
    ChipsSelect,
    ChipsDialog,
    ChipsPopover,
    ChipsTabs,
    ChipsMenu,
    ChipsToolbar,
    ChipsToolbarItem,
    ChipsMenuBar,
    ChipsContextMenu,
    ChipsShortcut,
    ChipsTooltip
  ]) {
    assert.equal(typeof component, "object");
    assert.equal(typeof component.render, "function");
  }
});

test("Dialog Popover and Tabs expose formal compound parts", () => {
  assert.equal(ChipsDialog.Root, ChipsDialog);
  assert.equal(typeof ChipsDialog.Trigger.render, "function");
  assert.equal(typeof ChipsDialog.Content.render, "function");
  assert.equal(typeof ChipsDialog.Header.render, "function");
  assert.equal(typeof ChipsDialog.Body.render, "function");
  assert.equal(typeof ChipsDialog.Footer.render, "function");
  assert.equal(typeof ChipsDialog.Actions.render, "function");
  assert.equal(typeof ChipsDialog.Close.render, "function");

  assert.equal(ChipsPopover.Root, ChipsPopover);
  assert.equal(typeof ChipsPopover.Trigger.render, "function");
  assert.equal(typeof ChipsPopover.Content.render, "function");
  assert.equal(typeof ChipsPopover.Arrow.render, "function");

  assert.equal(ChipsTabs.Root, ChipsTabs);
  assert.equal(typeof ChipsTabs.List.render, "function");
  assert.equal(typeof ChipsTabs.Trigger.render, "function");
  assert.equal(typeof ChipsTabs.Panel.render, "function");
});

test("Menu and Select expose formal compound parts", () => {
  assert.equal(ChipsMenu.Root, ChipsMenu);
  assert.equal(typeof ChipsMenu.Trigger.render, "function");
  assert.equal(typeof ChipsMenu.Content.render, "function");
  assert.equal(typeof ChipsMenu.Item.render, "function");
  assert.equal(typeof ChipsMenu.Group.render, "function");
  assert.equal(typeof ChipsMenu.Separator.render, "function");

  assert.equal(ChipsSelect.Root, ChipsSelect);
  assert.equal(typeof ChipsSelect.Trigger.render, "function");
  assert.equal(typeof ChipsSelect.Content.render, "function");
  assert.equal(typeof ChipsSelect.Option.render, "function");
  assert.equal(typeof ChipsSelect.Value.render, "function");
});

test("all stage-seven data-form component exports exist", () => {
  for (const component of [ChipsForm, ChipsVirtualList]) {
    assert.equal(typeof component, "object");
    assert.equal(typeof component.render, "function");
  }
});

test("Form exposes formal compound parts", () => {
  assert.equal(ChipsForm.Root, ChipsForm);
  assert.equal(typeof ChipsForm.Section.render, "function");
  assert.equal(typeof ChipsForm.Field.render, "function");
  assert.equal(typeof ChipsForm.Label.render, "function");
  assert.equal(typeof ChipsForm.Control.render, "function");
  assert.equal(typeof ChipsForm.Error.render, "function");
  assert.equal(typeof ChipsForm.Hint.render, "function");
});

test("all stage-seven advanced data component exports exist", () => {
  for (const component of [ChipsDataGrid, ChipsTree, ChipsDateTime, ChipsCommandPalette, ChipsNavigationSplitView]) {
    assert.equal(typeof component, "object");
    assert.equal(typeof component.render, "function");
  }
});

test("DataGrid exposes formal compound parts", () => {
  assert.equal(ChipsDataGrid.Root, ChipsDataGrid);
  assert.equal(typeof ChipsDataGrid.Toolbar.render, "function");
  assert.equal(typeof ChipsDataGrid.Header.render, "function");
  assert.equal(typeof ChipsDataGrid.Row.render, "function");
  assert.equal(typeof ChipsDataGrid.Cell.render, "function");
  assert.equal(typeof ChipsDataGrid.Pagination.render, "function");
});

test("DataGrid compound rendering does not warn for its internal grid container key", () => {
  const originalError = console.error;
  const errors = [];
  console.error = (...args) => {
    errors.push(args.map((arg) => String(arg)).join(" "));
  };

  try {
    renderToStaticMarkup(
      React.createElement(
        ChipsDataGrid.Root,
        { ariaLabel: "Governance list" },
        [
          React.createElement(
            ChipsDataGrid.Header,
            { key: "header" },
            React.createElement(
              ChipsDataGrid.Cell,
              { key: "name", header: true, columnKey: "name" },
              "Name"
            )
          ),
          React.createElement(
            "div",
            { key: "body", role: "rowgroup" },
            React.createElement(
              ChipsDataGrid.Row,
              { key: "plugin-1", rowId: "plugin-1" },
              React.createElement(
                ChipsDataGrid.Cell,
                { key: "plugin-1-name", columnKey: "name" },
                "Plugin"
              )
            )
          )
        ]
      )
    );
  } finally {
    console.error = originalError;
  }

  assert.equal(errors.some((message) => message.includes("Each child in a list should have a unique")), false);
});

test("Tree exposes formal compound parts", () => {
  assert.equal(ChipsTree.Root, ChipsTree);
  assert.equal(typeof ChipsTree.Item.render, "function");
  assert.equal(typeof ChipsTree.Branch.render, "function");
  assert.equal(typeof ChipsTree.Leaf.render, "function");
  assert.equal(typeof ChipsTree.Disclosure.render, "function");
});

test("CommandPalette exposes formal compound parts", () => {
  assert.equal(ChipsCommandPalette.Root, ChipsCommandPalette);
  assert.equal(typeof ChipsCommandPalette.Input.render, "function");
  assert.equal(typeof ChipsCommandPalette.List.render, "function");
  assert.equal(typeof ChipsCommandPalette.Item.render, "function");
  assert.equal(typeof ChipsCommandPalette.Group.render, "function");
});

test("NavigationSplitView exposes formal compound parts", () => {
  assert.equal(ChipsNavigationSplitView.Root, ChipsNavigationSplitView);
  assert.equal(typeof ChipsNavigationSplitView.Sidebar.render, "function");
  assert.equal(typeof ChipsNavigationSplitView.Content.render, "function");
  assert.equal(typeof ChipsNavigationSplitView.Detail.render, "function");
});

test("CommandPalette component metadata uses formal compound parts", () => {
  const commandPalette = STAGE7_DATA_ADVANCED_COMPONENTS.find(
    (component) => component.scope === "command-palette"
  );

  assert.deepEqual(commandPalette.parts, [
    "root",
    "input",
    "list",
    "group",
    "group-label",
    "item",
    "shortcut",
    "status"
  ]);
  assert.equal(commandPalette.parts.includes("trigger"), false);
  assert.equal(commandPalette.parts.includes("search"), false);
});

test("NavigationSplitView component metadata uses navigation semantic compound parts", () => {
  const navigationSplitView = STAGE7_DATA_ADVANCED_COMPONENTS.find(
    (component) => component.scope === "navigation-split-view"
  );

  assert.deepEqual(navigationSplitView.parts, [
    "root",
    "sidebar",
    "content",
    "detail",
    "divider",
    "status"
  ]);
  assert.equal(navigationSplitView.parts.includes("primary"), false);
  assert.equal(navigationSplitView.parts.includes("secondary"), false);
});

test("NavigationSplitView renders navigation regions and dividers with formal parts", () => {
  const rendered = ChipsNavigationSplitView.render(
    {
      "aria-label": "Workspace navigation",
      children: [
        React.createElement(ChipsNavigationSplitView.Sidebar, {
          key: "sidebar",
          "aria-label": "Sources"
        }, "Projects"),
        React.createElement(ChipsNavigationSplitView.Content, {
          key: "content",
          "aria-label": "Items"
        }, "Cards"),
        React.createElement(ChipsNavigationSplitView.Detail, {
          key: "detail",
          "aria-label": "Detail"
        }, "Card detail")
      ]
    },
    null
  );

  const root = rendered.props.children;
  const children = root.props.children[0];
  assert.equal(root.props["data-scope"], "navigation-split-view");
  assert.equal(root.props["data-part"], "root");
  assert.equal(root.props.role, "group");
  assert.equal(root.props["aria-label"], "Workspace navigation");
  assert.equal(children[0].type, ChipsNavigationSplitView.Sidebar);
  assert.equal(children[0].props["aria-label"], "Sources");
  assert.equal(children[1].props["data-part"], "divider");
  assert.equal(children[1].props["aria-hidden"], "true");
  assert.equal(children[2].type, ChipsNavigationSplitView.Content);
  assert.equal(children[3].props["data-part"], "divider");
  assert.equal(children[4].type, ChipsNavigationSplitView.Detail);
});

test("Tree data-driven rendering uses compound parts and aria tree metadata", () => {
  const flatOpen = flattenTreeNodes(
    [
      {
        id: "src",
        label: "Source",
        children: [
          { id: "index", label: "index.ts" },
          { id: "test", label: "index.test.ts", disabled: true }
        ]
      }
    ],
    ["src"]
  );

  assert.deepEqual(
    flatOpen.map((item) => ({
      id: item.id,
      level: item.level,
      setSize: item.setSize,
      posInSet: item.posInSet,
      parentId: item.parentId
    })),
    [
      { id: "src", level: 1, setSize: 1, posInSet: 1, parentId: null },
      { id: "index", level: 2, setSize: 2, posInSet: 1, parentId: "src" },
      { id: "test", level: 2, setSize: 2, posInSet: 2, parentId: "src" }
    ]
  );
});

test("all stage-seven workbench component exports exist", () => {
  for (const component of [
    ChipsSplitPane,
    ChipsDockPanel,
    ChipsInspector,
    ChipsPanelHeader,
    ChipsCardShell,
    ChipsToolWindow
  ]) {
    assert.equal(typeof component, "object");
    assert.equal(typeof component.render, "function");
  }
});

test("all stage-eight system ux component exports exist", () => {
  for (const component of [
    ChipsErrorBoundary,
    ChipsLoadingBoundary,
    ChipsNotification,
    ChipsToast,
    ChipsEmptyState,
    ChipsSkeleton
  ]) {
    assert.equal(typeof component, "object");
    assert.equal(typeof component.render, "function");
  }
});

test("buildComponentContract includes stage-six third batch components", () => {
  const dialog = buildComponentContract("dialog");
  const popover = buildComponentContract("popover");
  const tabs = buildComponentContract("tabs");
  const menu = buildComponentContract("menu");
  const select = buildComponentContract("select");
  const tooltip = buildComponentContract("tooltip");

  assert.ok(select.parts.includes("content"));
  assert.equal(select.parts.includes("list"), false);
  assert.ok(select.tokens.includes("chips.comp.select.content.surface"));
  assert.ok(select.tokens.includes("chips.comp.select.option.surface.highlighted"));
  assert.ok(dialog.tokens.includes("chips.comp.dialog.content.surface"));
  assert.ok(dialog.parts.includes("header"));
  assert.ok(dialog.parts.includes("body"));
  assert.ok(dialog.parts.includes("footer"));
  assert.ok(dialog.parts.includes("actions"));
  assert.ok(dialog.tokens.includes("chips.comp.dialog.header.color"));
  assert.ok(popover.tokens.includes("chips.comp.popover.content.border"));
  assert.equal(popover.parts.includes("positioner"), false);
  assert.ok(tabs.tokens.includes("chips.comp.tabs.panel.surface"));
  assert.ok(menu.parts.includes("group"));
  assert.ok(menu.parts.includes("group-label"));
  assert.ok(menu.parts.includes("separator"));
  assert.ok(menu.tokens.includes("chips.comp.menu.group.label.color"));
  assert.ok(menu.tokens.includes("chips.comp.menu.item.surface.active"));
  assert.ok(menu.tokens.includes("chips.comp.menu.separator.thickness"));
  assert.ok(tooltip.tokens.includes("chips.comp.tooltip.content.text.color"));
});

test("buildComponentContract includes stage-seven first batch components", () => {
  const form = buildComponentContract("form");
  const virtualList = buildComponentContract("virtual-list");

  assert.ok(form.parts.includes("field"));
  assert.ok(form.parts.includes("hint"));
  assert.equal(form.parts.includes("helper"), false);
  assert.ok(form.tokens.includes("chips.comp.form.control.border.error"));
  assert.ok(form.tokens.includes("chips.comp.form.hint.color"));
  assert.ok(virtualList.tokens.includes("chips.comp.virtual-list.item.surface.active"));
});

test("buildComponentContract includes stage-seven second batch components", () => {
  const dataGrid = buildComponentContract("data-grid");
  const tree = buildComponentContract("tree");
  const dateTime = buildComponentContract("date-time");
  const commandPalette = buildComponentContract("command-palette");
  const navigationSplitView = buildComponentContract("navigation-split-view");

  assert.ok(dataGrid.parts.includes("toolbar"));
  assert.ok(dataGrid.parts.includes("pagination"));
  assert.equal(dataGrid.parts.includes("table"), false);
  assert.ok(dataGrid.tokens.includes("chips.comp.data-grid.toolbar.surface"));
  assert.ok(dataGrid.tokens.includes("chips.comp.data-grid.pagination.gap"));
  assert.ok(dataGrid.tokens.includes("chips.comp.data-grid.row.surface.hover"));
  assert.ok(dataGrid.tokens.includes("chips.comp.data-grid.row.surface.selected"));
  assert.ok(tree.parts.includes("item"));
  assert.ok(tree.parts.includes("branch"));
  assert.ok(tree.parts.includes("leaf"));
  assert.ok(tree.parts.includes("disclosure"));
  assert.ok(tree.parts.includes("group"));
  assert.equal(tree.parts.includes("node"), false);
  assert.equal(tree.parts.includes("toggle"), false);
  assert.equal(tree.parts.includes("children"), false);
  assert.ok(tree.tokens.includes("chips.comp.tree.item.surface.selected"));
  assert.ok(tree.tokens.includes("chips.comp.tree.disclosure.color"));
  assert.ok(tree.tokens.includes("chips.comp.tree.group.guide.color"));
  assert.ok(dateTime.tokens.includes("chips.comp.date-time.input.border.error"));
  assert.ok(commandPalette.parts.includes("input"));
  assert.ok(commandPalette.parts.includes("group"));
  assert.ok(commandPalette.parts.includes("group-label"));
  assert.ok(commandPalette.parts.includes("item"));
  assert.equal(commandPalette.parts.includes("search"), false);
  assert.ok(commandPalette.tokens.includes("chips.comp.command-palette.input.surface.idle"));
  assert.ok(commandPalette.tokens.includes("chips.comp.command-palette.item.surface.active"));
  assert.ok(commandPalette.tokens.includes("chips.comp.command-palette.group.label.color"));
  assert.equal(commandPalette.tokens.includes("chips.comp.command-palette.result.surface.active"), false);
  assert.ok(navigationSplitView.parts.includes("sidebar"));
  assert.ok(navigationSplitView.parts.includes("content"));
  assert.ok(navigationSplitView.parts.includes("detail"));
  assert.ok(navigationSplitView.parts.includes("divider"));
  assert.equal(navigationSplitView.parts.includes("primary"), false);
  assert.equal(navigationSplitView.parts.includes("secondary"), false);
  assert.ok(navigationSplitView.tokens.includes("chips.comp.navigation-split-view.sidebar.surface"));
  assert.ok(navigationSplitView.tokens.includes("chips.comp.navigation-split-view.detail.surface"));
  assert.ok(navigationSplitView.tokens.includes("chips.comp.navigation-split-view.divider.color"));
});

test("buildComponentContract includes stage-seven workbench components", () => {
  const splitPane = buildComponentContract("split-pane");
  const dockPanel = buildComponentContract("dock-panel");
  const inspector = buildComponentContract("inspector");
  const panelHeader = buildComponentContract("panel-header");
  const cardShell = buildComponentContract("card-shell");
  const toolWindow = buildComponentContract("tool-window");

  assert.ok(splitPane.tokens.includes("chips.comp.split-pane.handle.surface.active"));
  assert.ok(dockPanel.tokens.includes("chips.comp.dock-panel.tab.surface.active"));
  assert.ok(inspector.tokens.includes("chips.comp.inspector.section.header.surface.active"));
  assert.ok(panelHeader.tokens.includes("chips.comp.panel-header.action.surface.active"));
  assert.ok(cardShell.tokens.includes("chips.comp.card-shell.border.color"));
  assert.ok(toolWindow.tokens.includes("chips.comp.tool-window.control.surface.active"));
});

test("buildComponentContract includes stage-eight system ux components", () => {
  const errorBoundary = buildComponentContract("error-boundary");
  const loadingBoundary = buildComponentContract("loading-boundary");
  const notification = buildComponentContract("notification");
  const toast = buildComponentContract("toast");
  const emptyState = buildComponentContract("empty-state");
  const skeleton = buildComponentContract("skeleton");

  assert.ok(errorBoundary.tokens.includes("chips.comp.error-boundary.root.border.error"));
  assert.ok(loadingBoundary.tokens.includes("chips.comp.loading-boundary.status.color.info"));
  assert.ok(notification.tokens.includes("chips.comp.notification.action.surface.active"));
  assert.ok(toast.tokens.includes("chips.comp.toast.close.color"));
  assert.ok(emptyState.tokens.includes("chips.comp.empty-state.description.color"));
  assert.ok(skeleton.tokens.includes("chips.comp.skeleton.item.surface.active"));
});

test("getNextEnabledIndex navigates and skips disabled options", () => {
  const items = [
    { value: "a", disabled: false },
    { value: "b", disabled: true },
    { value: "c", disabled: false }
  ];

  assert.equal(getNextEnabledIndex(items, 0, "next", true), 2);
  assert.equal(getNextEnabledIndex(items, 2, "next", true), 0);
  assert.equal(getNextEnabledIndex(items, 2, "prev", true), 0);
  assert.equal(getNextEnabledIndex(items, 0, "prev", false), -1);
});

test("computeVirtualWindow resolves visible range and paddings", () => {
  const windowed = computeVirtualWindow({
    itemCount: 100,
    itemHeight: 20,
    viewportHeight: 100,
    scrollTop: 200,
    overscan: 2
  });

  assert.equal(windowed.start, 8);
  assert.equal(windowed.end, 16);
  assert.equal(windowed.paddingStart, 160);
  assert.equal(windowed.paddingEnd, 1660);
});

test("computeVirtualWindow handles empty list", () => {
  const windowed = computeVirtualWindow({
    itemCount: 0,
    itemHeight: 20,
    viewportHeight: 100,
    scrollTop: 200,
    overscan: 2
  });

  assert.deepEqual(windowed, {
    start: 0,
    end: -1,
    paddingStart: 0,
    paddingEnd: 0
  });
});

test("P0 data-form metadata is complete", () => {
  assert.equal(P0_DATA_FORM_COMPONENTS.length, 2);
  assert.deepEqual(
    P0_DATA_FORM_COMPONENTS.map((item) => item.scope),
    ["form", "virtual-list"]
  );
});

test("stage-seven advanced data metadata is complete", () => {
  assert.equal(STAGE7_DATA_ADVANCED_COMPONENTS.length, 5);
  assert.deepEqual(
    STAGE7_DATA_ADVANCED_COMPONENTS.map((item) => item.scope),
    ["data-grid", "tree", "date-time", "command-palette", "navigation-split-view"]
  );
});

test("applyDataGridSort sorts by key and direction", () => {
  const rows = [
    { id: "a", order: 3 },
    { id: "b", order: 1 },
    { id: "c", order: 2 }
  ];

  const asc = applyDataGridSort(rows, { key: "order", direction: "asc" });
  const desc = applyDataGridSort(rows, { key: "order", direction: "desc" });

  assert.deepEqual(
    asc.map((item) => item.id),
    ["b", "c", "a"]
  );
  assert.deepEqual(
    desc.map((item) => item.id),
    ["a", "c", "b"]
  );
});

test("flattenTreeNodes and findTreeParentId return consistent structure", () => {
  const nodes = [
    {
      id: "root",
      label: "Root",
      children: [
        { id: "child-a", label: "Child A" },
        { id: "child-b", label: "Child B" }
      ]
    }
  ];

  const flatClosed = flattenTreeNodes(nodes, []);
  const flatOpen = flattenTreeNodes(nodes, ["root"]);

  assert.equal(flatClosed.length, 1);
  assert.equal(flatOpen.length, 3);
  assert.equal(findTreeParentId(nodes, "child-b"), "root");
  assert.equal(findTreeParentId(nodes, "root"), null);
});

test("filterCommandPaletteItems filters by label and shortcut", () => {
  const items = [
    { id: "1", label: "Open Card", shortcut: "Cmd+O", keywords: ["file"] },
    { id: "2", label: "Save Card", shortcut: "Cmd+S", keywords: ["file"] }
  ];

  const byLabel = filterCommandPaletteItems(items, "open");
  const byShortcut = filterCommandPaletteItems(items, "cmd+s");

  assert.equal(byLabel.length, 1);
  assert.equal(byLabel[0].id, "1");
  assert.equal(byShortcut.length, 1);
  assert.equal(byShortcut[0].id, "2");
});

test("command helpers resolve one command for toolbar menu and palette", () => {
  const commands = [
    {
      commandId: "chips.card.open",
      titleKey: "command.card.open",
      descriptionKey: "command.card.open.description",
      ariaLabelKey: "command.card.open.aria",
      icon: { name: "folder_open" },
      shortcut: { accelerator: "Mod+O" },
      menuPlacement: [{ menuId: "file", groupId: "primary", order: 10 }],
      toolbarPlacement: [{ toolbarId: "main", groupId: "file", order: 5 }],
      paletteKeywords: ["card", "file"],
      state: { enabled: true, visible: true }
    },
    {
      commandId: "chips.card.hidden",
      titleKey: "command.card.hidden",
      menuPlacement: [{ menuId: "file" }],
      toolbarPlacement: [{ toolbarId: "main" }],
      state: { visible: false }
    }
  ];
  const i18n = (key) => `t:${key}`;

  const toolbarItems = resolveCommandToolbarItems(commands, { toolbarId: "main", i18n });
  const menuGroups = resolveCommandMenuGroups(commands, { menuId: "file", i18n });
  const paletteItems = resolveCommandPaletteItems(commands, { i18n });

  assert.equal(toolbarItems.length, 1);
  assert.equal(toolbarItems[0].commandId, "chips.card.open");
  assert.equal(toolbarItems[0].label, "t:command.card.open");
  assert.equal(toolbarItems[0].shortcutLabel, "Mod+O");
  assert.equal(menuGroups.length, 1);
  assert.equal(menuGroups[0].groupId, "primary");
  assert.equal(menuGroups[0].items[0].commandId, "chips.card.open");
  assert.equal(paletteItems.length, 1);
  assert.equal(paletteItems[0].id, "chips.card.open");
  assert.equal(paletteItems[0].shortcut, "Mod+O");
});

test("createCommandAdapter wraps SDK command API", async () => {
  const calls = [];
  const adapter = createCommandAdapter({
    command: {
      list: async (query) => {
        calls.push(["list", query]);
        return [{ commandId: "chips.card.open", titleKey: "command.card.open" }];
      },
      invoke: async (commandId, payload, options) => {
        calls.push(["invoke", commandId, payload, options]);
        return { commandId, dispatched: true };
      },
      onChanged: (handler) => {
        calls.push(["subscribe", typeof handler]);
        return () => calls.push(["unsubscribe"]);
      }
    }
  });

  const listed = await adapter.listCommands({ source: "toolbar" });
  const invoked = await adapter.invokeCommand("chips.card.open", { id: "demo" }, { source: "toolbar" });
  const dispose = adapter.onCommandsChanged(() => {});
  dispose();

  assert.equal(listed.length, 1);
  assert.equal(invoked.dispatched, true);
  assert.deepEqual(calls[0], ["list", { source: "toolbar" }]);
  assert.deepEqual(calls[1], [
    "invoke",
    "chips.card.open",
    { id: "demo" },
    { source: "toolbar" }
  ]);
  assert.deepEqual(calls[2], ["subscribe", "function"]);
  assert.deepEqual(calls[3], ["unsubscribe"]);
});

test("clampSplitRatio returns ratio in defined range", () => {
  assert.equal(clampSplitRatio(-1), 0.1);
  assert.equal(clampSplitRatio(2), 0.9);
  assert.equal(clampSplitRatio(0.45), 0.45);
});

test("resolveDockPanelStateMap normalizes known panel states", () => {
  const map = resolveDockPanelStateMap(
    [{ id: "a" }, { id: "b" }],
    { a: "hidden", b: "x", c: "active" }
  );

  assert.deepEqual(map, {
    a: "hidden",
    b: "active"
  });
});

test("toggleInspectorSection toggles open state list", () => {
  assert.deepEqual(toggleInspectorSection(["a", "b"], "b"), ["a"]);
  assert.deepEqual(toggleInspectorSection(["a"], "c"), ["a", "c"]);
});

test("stage-seven workbench metadata is complete", () => {
  assert.equal(STAGE7_WORKBENCH_COMPONENTS.length, 6);
  assert.deepEqual(
    STAGE7_WORKBENCH_COMPONENTS.map((item) => item.scope),
    ["split-pane", "dock-panel", "inspector", "panel-header", "card-shell", "tool-window"]
  );
});

test("stage-eight system ux metadata is complete", () => {
  assert.equal(STAGE8_SYSTEM_UX_COMPONENTS.length, 6);
  assert.deepEqual(
    STAGE8_SYSTEM_UX_COMPONENTS.map((item) => item.scope),
    ["error-boundary", "loading-boundary", "notification", "toast", "empty-state", "skeleton"]
  );
});

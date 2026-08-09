const STANDARD_STATE_PRIORITY = Object.freeze([
  "disabled",
  "loading",
  "error",
  "active",
  "focus",
  "hover",
  "idle"
]);

const CARD_COVER_FRAME_STATE_PRIORITY = Object.freeze([
  "disabled",
  "empty",
  "error",
  "loading",
  "ready",
  "idle"
]);

const COMPOSITE_CARD_WINDOW_STATE_PRIORITY = Object.freeze([
  "disabled",
  "error",
  "degraded",
  "resolving",
  "rendering",
  "ready",
  "idle"
]);

function aria(attrs = {}, rules = {}) {
  return Object.freeze({
    attrs: Object.freeze({ ...attrs }),
    rules: Object.freeze({
      ...rules,
      requiredProps: Object.freeze([...(rules.requiredProps || [])])
    })
  });
}

function entry(component, options = {}) {
  return Object.freeze({
    component,
    packageName: options.packageName || "@chips/components",
    contractAttrs: Object.freeze({
      part: options.part || "root",
      state: options.state || "idle"
    }),
    statePriority: Object.freeze([...(options.statePriority || STANDARD_STATE_PRIORITY)]),
    a11yFixtures: Object.freeze([...(options.a11yFixtures || [aria()])]),
    perfSmokeScenarios: Object.freeze([...(options.perfSmokeScenarios || [])])
  });
}

const label = (name) => ({ "aria-label": name });
const expanded = (name, controls = `${name}-content`) => ({
  "aria-label": name,
  "aria-expanded": "true",
  "aria-controls": controls
});

export const CHIPS_COMPONENT_QUALITY_MATRIX = Object.freeze([
  entry("avatar", {
    a11yFixtures: [aria({ role: "img", ...label("avatar") }, { role: "img", requireLabel: true })]
  }),
  entry("badge", {
    a11yFixtures: [aria(label("badge"), { requireLabel: true })]
  }),
  entry("box"),
  entry("button", {
    a11yFixtures: [aria({ role: "button", ...label("button") }, { role: "button", requireLabel: true })]
  }),
  entry("card-cover-frame", {
    packageName: "@chips/card-runtime",
    statePriority: CARD_COVER_FRAME_STATE_PRIORITY,
    a11yFixtures: [
      aria(
        { "data-part": "iframe", title: "Card Cover", sandbox: "allow-scripts" },
        { requiredProps: ["title", "sandbox"] }
      )
    ]
  }),
  entry("card-shell", {
    a11yFixtures: [aria({ role: "article", ...label("card shell") }, { role: "article", requireLabel: true })]
  }),
  entry("checkbox", {
    a11yFixtures: [aria({ role: "checkbox", ...label("checkbox") }, { role: "checkbox", requireLabel: true })]
  }),
  entry("combo-box", {
    a11yFixtures: [
      aria(
        { role: "combobox", ...expanded("combo-box", "combo-box-list") },
        { role: "combobox", requireLabel: true, requireControlsWhenExpanded: true }
      )
    ]
  }),
  entry("command-palette", {
    a11yFixtures: [
      aria(
        { role: "combobox", ...expanded("command-palette", "command-palette-list") },
        { role: "combobox", requireLabel: true, requireControlsWhenExpanded: true }
      )
    ],
    perfSmokeScenarios: ["render-submit:command-filter"]
  }),
  entry("composite-card-window", {
    packageName: "@chips/card-runtime",
    statePriority: COMPOSITE_CARD_WINDOW_STATE_PRIORITY,
    a11yFixtures: [
      aria(
        { "data-part": "iframe", title: "composite-card:demo.card", sandbox: "allow-scripts allow-same-origin" },
        { requiredProps: ["title", "sandbox"] }
      )
    ]
  }),
  entry("context-menu", {
    a11yFixtures: [
      aria(
        { role: "button", ...expanded("context-menu", "context-menu-content") },
        { role: "button", requireLabel: true, requireControlsWhenExpanded: true }
      )
    ]
  }),
  entry("data-grid", {
    a11yFixtures: [aria({ part: "root", role: "group", ...label("data-grid") }, { role: "group", requireLabel: true })],
    perfSmokeScenarios: ["render-submit:data-grid-sort"]
  }),
  entry("date-picker", {
    a11yFixtures: [
      aria(
        { role: "combobox", ...expanded("date-picker", "date-picker-calendar") },
        { role: "combobox", requireLabel: true, requireControlsWhenExpanded: true }
      )
    ]
  }),
  entry("date-time", {
    a11yFixtures: [aria(label("date-time"), { requireLabel: true })]
  }),
  entry("dialog", {
    a11yFixtures: [
      aria(
        { role: "button", ...expanded("dialog", "dialog-content") },
        { role: "button", requireLabel: true, requireControlsWhenExpanded: true }
      )
    ]
  }),
  entry("divider", {
    a11yFixtures: [aria({ role: "separator" }, { role: "separator" })]
  }),
  entry("dock-panel", {
    a11yFixtures: [aria({ role: "tablist", ...label("dock-panel") }, { role: "tablist", requireLabel: true })]
  }),
  entry("empty-state", {
    a11yFixtures: [aria({ role: "region", ...label("empty-state") }, { role: "region", requireLabel: true })]
  }),
  entry("error-boundary", {
    a11yFixtures: [aria(label("error-boundary"), { requireLabel: true })]
  }),
  entry("error-state", {
    a11yFixtures: [aria({ role: "alert", ...label("error-state") }, { role: "alert", requireLabel: true })]
  }),
  entry("form", {
    a11yFixtures: [aria(label("form"), { requireLabel: true })]
  }),
  entry("grid"),
  entry("icon", {
    statePriority: ["idle"],
    a11yFixtures: [aria({ "aria-hidden": "true" }, { requiredProps: ["aria-hidden"] })]
  }),
  entry("icon-button", {
    a11yFixtures: [aria(label("icon-button"), { requireLabel: true })]
  }),
  entry("image", {
    a11yFixtures: [aria({ role: "group", ...label("image") }, { role: "group", requireLabel: true })]
  }),
  entry("inline"),
  entry("input", {
    a11yFixtures: [aria(label("input"), { requireLabel: true })]
  }),
  entry("inspector", {
    a11yFixtures: [
      aria({ role: "complementary", ...label("inspector") }, { role: "complementary", requireLabel: true })
    ]
  }),
  entry("label", {
    a11yFixtures: [aria({ htmlFor: "field-id" }, { requiredProps: ["htmlFor"] })]
  }),
  entry("loading-boundary", {
    a11yFixtures: [aria({ role: "region", ...label("loading-boundary") }, { role: "region", requireLabel: true })]
  }),
  entry("media", {
    a11yFixtures: [aria({ role: "group", ...label("media") }, { role: "group", requireLabel: true })]
  }),
  entry("menu", {
    a11yFixtures: [
      aria(
        { role: "button", ...expanded("menu", "menu-content") },
        { role: "button", requireLabel: true, requireControlsWhenExpanded: true }
      )
    ]
  }),
  entry("menu-bar", {
    a11yFixtures: [aria({ role: "menubar", ...label("menu-bar") }, { role: "menubar", requireLabel: true })]
  }),
  entry("navigation-split-view", {
    a11yFixtures: [
      aria({ role: "group", ...label("navigation-split-view") }, { role: "group", requireLabel: true })
    ]
  }),
  entry("notification", {
    a11yFixtures: [aria({ role: "region", ...label("notification") }, { role: "region", requireLabel: true })]
  }),
  entry("number-input", {
    a11yFixtures: [
      aria({ role: "spinbutton", ...label("number-input") }, { role: "spinbutton", requireLabel: true })
    ]
  }),
  entry("panel-header", {
    a11yFixtures: [aria({ role: "group", ...label("panel-header") }, { role: "group", requireLabel: true })]
  }),
  entry("popover", {
    a11yFixtures: [
      aria(
        { role: "button", ...expanded("popover", "popover-content") },
        { role: "button", requireLabel: true, requireControlsWhenExpanded: true }
      )
    ]
  }),
  entry("progress", {
    a11yFixtures: [
      aria({ role: "progressbar", ...label("progress") }, { role: "progressbar", requireLabel: true })
    ]
  }),
  entry("rating", {
    a11yFixtures: [
      aria({ role: "radiogroup", ...label("rating") }, { role: "radiogroup", requireLabel: true })
    ]
  }),
  entry("radio", {
    a11yFixtures: [aria({ role: "radio", ...label("radio") }, { role: "radio", requireLabel: true })]
  }),
  entry("scroll-view", {
    a11yFixtures: [aria({ role: "region", ...label("scroll-view") }, { role: "region", requireLabel: true })]
  }),
  entry("search-field", {
    a11yFixtures: [aria({ role: "search", ...label("search-field") }, { role: "search", requireLabel: true })]
  }),
  entry("section", {
    a11yFixtures: [aria({ role: "region", ...label("section") }, { role: "region", requireLabel: true })]
  }),
  entry("secure-field", {
    a11yFixtures: [
      aria({ ...label("secure-field"), "aria-pressed": "false" }, { requireLabel: true, requiredProps: ["aria-pressed"] })
    ]
  }),
  entry("segmented-control", {
    a11yFixtures: [
      aria(
        { role: "radiogroup", ...label("segmented-control") },
        { role: "radiogroup", requireLabel: true }
      )
    ]
  }),
  entry("select", {
    a11yFixtures: [
      aria(
        { role: "button", ...expanded("select", "select-content") },
        { role: "button", requireLabel: true, requireControlsWhenExpanded: true }
      )
    ]
  }),
  entry("shortcut", {
    a11yFixtures: [aria(label("shortcut"), { requireLabel: true })]
  }),
  entry("skeleton", {
    a11yFixtures: [aria({ role: "status", ...label("skeleton") }, { role: "status", requireLabel: true })]
  }),
  entry("slider", {
    a11yFixtures: [aria({ role: "slider", ...label("slider") }, { role: "slider", requireLabel: true })]
  }),
  entry("spacer", {
    statePriority: ["idle"],
    a11yFixtures: [aria({ "aria-hidden": "true" }, { requiredProps: ["aria-hidden"] })]
  }),
  entry("spinner", {
    a11yFixtures: [aria({ role: "status", ...label("spinner") }, { role: "status", requireLabel: true })]
  }),
  entry("split-pane", {
    a11yFixtures: [aria({ role: "group", ...label("split-pane") }, { role: "group", requireLabel: true })]
  }),
  entry("split-view", {
    a11yFixtures: [aria({ role: "group", ...label("split-view") }, { role: "group", requireLabel: true })]
  }),
  entry("stack"),
  entry("stepper", {
    a11yFixtures: [aria({ role: "group", ...label("stepper") }, { role: "group", requireLabel: true })]
  }),
  entry("switch", {
    a11yFixtures: [aria({ role: "switch", ...label("switch") }, { role: "switch", requireLabel: true })]
  }),
  entry("tabs", {
    a11yFixtures: [aria({ role: "tab", ...label("tabs") }, { role: "tab", requireLabel: true })]
  }),
  entry("tag", {
    a11yFixtures: [aria(label("tag"), { requireLabel: true })]
  }),
  entry("text", {
    statePriority: ["disabled", "error", "idle"],
    a11yFixtures: [aria()]
  }),
  entry("text-area", {
    a11yFixtures: [aria(label("text-area"), { requireLabel: true })]
  }),
  entry("text-field", {
    a11yFixtures: [aria(label("text-field"), { requireLabel: true })]
  }),
  entry("time-picker", {
    a11yFixtures: [
      aria(
        { role: "combobox", ...expanded("time-picker", "time-picker-list") },
        { role: "combobox", requireLabel: true, requireControlsWhenExpanded: true }
      )
    ]
  }),
  entry("toast", {
    a11yFixtures: [aria({ role: "status", ...label("toast") }, { role: "status", requireLabel: true })]
  }),
  entry("toggle-button", {
    a11yFixtures: [
      aria({ ...label("toggle-button"), "aria-pressed": "false" }, { requireLabel: true, requiredProps: ["aria-pressed"] })
    ]
  }),
  entry("tool-window", {
    a11yFixtures: [aria({ role: "dialog", ...label("tool-window") }, { role: "dialog", requireLabel: true })]
  }),
  entry("toolbar", {
    a11yFixtures: [aria({ role: "toolbar", ...label("toolbar") }, { role: "toolbar", requireLabel: true })]
  }),
  entry("tooltip", {
    a11yFixtures: [aria({ role: "tooltip" }, { role: "tooltip" })]
  }),
  entry("tree", {
    a11yFixtures: [aria({ role: "tree", ...label("tree") }, { role: "tree", requireLabel: true })]
  }),
  entry("view", {
    a11yFixtures: [aria({ role: "region", ...label("view") }, { role: "region", requireLabel: true })]
  }),
  entry("virtual-list", {
    a11yFixtures: [aria({ role: "list", ...label("virtual-list") }, { role: "list", requireLabel: true })],
    perfSmokeScenarios: ["render-submit:virtual-window"]
  })
]);

export function createComponentQualityMatrix(overrides = []) {
  const byComponent = new Map(CHIPS_COMPONENT_QUALITY_MATRIX.map((item) => [item.component, item]));
  for (const override of overrides) {
    if (!override || typeof override.component !== "string") {
      continue;
    }
    byComponent.set(override.component, Object.freeze({
      ...(byComponent.get(override.component) || {}),
      ...override
    }));
  }
  return [...byComponent.values()].sort((left, right) => left.component.localeCompare(right.component));
}

export function getComponentQualityMatrixEntry(component, matrix = CHIPS_COMPONENT_QUALITY_MATRIX) {
  return matrix.find((entryItem) => entryItem.component === component) || null;
}

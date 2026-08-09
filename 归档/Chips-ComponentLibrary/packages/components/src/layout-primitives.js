import React from "react";
import { createScopeAttributes } from "@chips/primitives";
import { assertAriaProps } from "@chips/a11y";

export const LAYOUT_INTERACTIVE_STATES = Object.freeze([
  "idle",
  "hover",
  "focus",
  "active",
  "disabled",
  "loading",
  "error"
]);

export const LAYOUT_COMPONENT_TOKEN_MAP = Object.freeze({
  view: [
    "chips.comp.view.root.surface",
    "chips.comp.view.root.text.color",
    "chips.comp.view.header.surface",
    "chips.comp.view.title.color",
    "chips.comp.view.content.surface",
    "chips.comp.view.footer.surface",
    "chips.comp.view.focus.outline"
  ],
  box: [
    "chips.comp.box.root.surface",
    "chips.comp.box.root.border.color",
    "chips.comp.box.root.radius",
    "chips.comp.box.focus.outline"
  ],
  stack: [
    "chips.comp.stack.root.gap",
    "chips.comp.stack.root.surface",
    "chips.comp.stack.focus.outline"
  ],
  inline: [
    "chips.comp.inline.root.gap",
    "chips.comp.inline.root.surface",
    "chips.comp.inline.focus.outline"
  ],
  grid: [
    "chips.comp.grid.root.gap",
    "chips.comp.grid.root.surface",
    "chips.comp.grid.item.surface",
    "chips.comp.grid.focus.outline"
  ],
  section: [
    "chips.comp.section.root.surface",
    "chips.comp.section.header.surface",
    "chips.comp.section.title.color",
    "chips.comp.section.description.color",
    "chips.comp.section.content.surface",
    "chips.comp.section.footer.surface",
    "chips.comp.section.divider.color",
    "chips.comp.section.focus.outline"
  ],
  "scroll-view": [
    "chips.comp.scroll-view.root.surface",
    "chips.comp.scroll-view.viewport.surface",
    "chips.comp.scroll-view.scrollbar.thumb",
    "chips.comp.scroll-view.focus.outline"
  ],
  spacer: [
    "chips.comp.spacer.root.size",
    "chips.comp.spacer.root.surface"
  ],
  divider: [
    "chips.comp.divider.root.color",
    "chips.comp.divider.root.thickness",
    "chips.comp.divider.label.color"
  ],
  "split-view": [
    "chips.comp.split-view.root.surface",
    "chips.comp.split-view.primary.surface",
    "chips.comp.split-view.secondary.surface",
    "chips.comp.split-view.detail.surface",
    "chips.comp.split-view.divider.color",
    "chips.comp.split-view.focus.outline"
  ]
});

const ELEMENT_TAGS = new Set([
  "article",
  "aside",
  "div",
  "footer",
  "header",
  "main",
  "nav",
  "section",
  "span"
]);

const ALIGN_ITEMS = new Set(["start", "center", "end", "stretch", "baseline"]);
const JUSTIFY_CONTENT = new Set(["start", "center", "end", "between", "around", "evenly"]);
const STACK_DIRECTION = new Set(["vertical", "horizontal"]);
const SCROLL_AXES = new Set(["vertical", "horizontal", "both", "auto", "scroll", "hidden"]);
const OVERFLOW_VALUES = new Set(["auto", "scroll", "hidden"]);
const ORIENTATIONS = new Set(["horizontal", "vertical"]);
const SPLIT_VARIANTS = new Set(["two-column", "three-column", "sidebar-detail"]);

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeElementTag(value, fallback = "div") {
  if (!isNonEmptyString(value)) {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  return ELEMENT_TAGS.has(normalized) ? normalized : fallback;
}

function normalizeEnum(value, allowed, fallback) {
  if (isNonEmptyString(value) && allowed.has(value)) {
    return value;
  }
  return fallback;
}

function normalizeState({ disabled, loading, error, active }) {
  if (disabled) {
    return "disabled";
  }
  if (loading) {
    return "loading";
  }
  if (error) {
    return "error";
  }
  if (active) {
    return "active";
  }
  return "idle";
}

function normalizeCssSize(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return `${value}px`;
  }
  return isNonEmptyString(value) ? value.trim() : undefined;
}

function withCssVar(style, key, value) {
  const normalized = normalizeCssSize(value);
  if (!normalized) {
    return style;
  }
  return {
    ...style,
    [key]: normalized
  };
}

function withDefinedStyle(base, extra) {
  const out = { ...base };
  for (const [key, value] of Object.entries(extra)) {
    if (value !== undefined && value !== null && value !== "") {
      out[key] = value;
    }
  }
  return out;
}

function resolveLayoutState({ disabled = false, loading = false, error = null, active = false } = {}) {
  return normalizeState({
    disabled,
    loading,
    error,
    active
  });
}

function createLayoutFocusHandlers({ onStateChange, state, onFocus, onBlur }) {
  return {
    onFocus(event) {
      if (typeof onStateChange === "function") {
        onStateChange("focus");
      }
      if (typeof onFocus === "function") {
        onFocus(event);
      }
    },
    onBlur(event) {
      if (typeof onStateChange === "function") {
        onStateChange(state);
      }
      if (typeof onBlur === "function") {
        onBlur(event);
      }
    }
  };
}

function createStatusNode(scope, state, error) {
  if (!error) {
    return null;
  }
  const message = typeof error === "object" && typeof error.message === "string"
    ? error.message
    : String(error);
  return React.createElement(
    "span",
    {
      ...createScopeAttributes(scope, "status", state),
      role: "status",
      "aria-live": "assertive"
    },
    message
  );
}

function resolveTitledRegionLabel({ ariaLabel, ariaLabelledBy, rest, title, titleId }) {
  const explicitAriaLabel = ariaLabel || rest["aria-label"];
  const explicitAriaLabelledBy = ariaLabelledBy || rest["aria-labelledby"];
  const rootId = rest.id;
  const resolvedTitleId = isNonEmptyString(titleId)
    ? titleId.trim()
    : isNonEmptyString(rootId) && title
      ? `${rootId.trim()}-title`
      : undefined;
  const titleText = typeof title === "string" && title.trim().length > 0
    ? title.trim()
    : typeof title === "number"
      ? String(title)
      : undefined;

  return {
    titleId: resolvedTitleId,
    ariaLabel: explicitAriaLabel || (!explicitAriaLabelledBy && !resolvedTitleId ? titleText : undefined),
    ariaLabelledBy: explicitAriaLabelledBy || (title ? resolvedTitleId : undefined)
  };
}

export function buildLayoutComponentContract(component) {
  if (!Object.hasOwn(LAYOUT_COMPONENT_TOKEN_MAP, component)) {
    throw new Error(`LAYOUT_COMPONENT_CONTRACT_TOKEN_MAP_MISSING:${component}`);
  }

  const contracts = {
    view: {
      component: "view",
      scope: "view",
      parts: ["root", "header", "title", "content", "footer", "status"],
      states: [...LAYOUT_INTERACTIVE_STATES]
    },
    box: {
      component: "box",
      scope: "box",
      parts: ["root", "status"],
      states: [...LAYOUT_INTERACTIVE_STATES]
    },
    stack: {
      component: "stack",
      scope: "stack",
      parts: ["root", "item", "status"],
      states: [...LAYOUT_INTERACTIVE_STATES]
    },
    inline: {
      component: "inline",
      scope: "inline",
      parts: ["root", "item", "status"],
      states: [...LAYOUT_INTERACTIVE_STATES]
    },
    grid: {
      component: "grid",
      scope: "grid",
      parts: ["root", "item", "status"],
      states: [...LAYOUT_INTERACTIVE_STATES]
    },
    section: {
      component: "section",
      scope: "section",
      parts: ["root", "header", "title", "description", "content", "footer", "status"],
      states: [...LAYOUT_INTERACTIVE_STATES]
    },
    "scroll-view": {
      component: "scroll-view",
      scope: "scroll-view",
      parts: ["root", "viewport", "content", "status"],
      states: [...LAYOUT_INTERACTIVE_STATES]
    },
    spacer: {
      component: "spacer",
      scope: "spacer",
      parts: ["root"],
      states: ["idle"]
    },
    divider: {
      component: "divider",
      scope: "divider",
      parts: ["root", "label"],
      states: ["idle"]
    },
    "split-view": {
      component: "split-view",
      scope: "split-view",
      parts: ["root", "primary", "secondary", "detail", "divider", "status"],
      states: [...LAYOUT_INTERACTIVE_STATES]
    }
  };

  return {
    ...contracts[component],
    tokens: LAYOUT_COMPONENT_TOKEN_MAP[component]
  };
}

export function validateLayoutComponentA11y(component, props) {
  if (component === "view") {
    assertAriaProps(props, {
      role: "region",
      requireLabel: true
    });
    return true;
  }

  if (component === "section") {
    assertAriaProps(props, {
      role: "region",
      requireLabel: true
    });
    return true;
  }

  if (component === "scroll-view") {
    assertAriaProps(props, {
      role: "region",
      requireLabel: true
    });
    return true;
  }

  if (component === "split-view") {
    assertAriaProps(props, {
      role: "group",
      requireLabel: true
    });
    return true;
  }

  if (component === "divider") {
    assertAriaProps(props, {
      role: "separator"
    });
    return true;
  }

  if (component === "box" || component === "stack" || component === "inline" || component === "grid" || component === "spacer") {
    return true;
  }

  throw new Error(`LAYOUT_COMPONENT_A11Y_RULE_MISSING:${component}`);
}

export const ChipsView = React.forwardRef((props, ref) => {
  const {
    as,
    title,
    titleKey,
    header,
    footer,
    children,
    titleId,
    disabled = false,
    loading = false,
    error = null,
    active = false,
    ariaLabel,
    ariaLabelledBy,
    onStateChange,
    style,
    ...rest
  } = props;

  const state = resolveLayoutState({
    disabled,
    loading,
    error,
    active
  });
  const focusHandlers = createLayoutFocusHandlers({
    onStateChange,
    state,
    onFocus: rest.onFocus,
    onBlur: rest.onBlur
  });
  const elementTag = normalizeElementTag(as, "section");
  const label = resolveTitledRegionLabel({
    ariaLabel,
    ariaLabelledBy,
    rest,
    title,
    titleId
  });

  return React.createElement(
    elementTag,
    {
      ...createScopeAttributes("view", "root", state),
      ...rest,
      ...focusHandlers,
      ref,
      role: rest.role || "region",
      "aria-label": label.ariaLabel,
      "aria-labelledby": label.ariaLabelledBy,
      "aria-disabled": disabled || loading ? "true" : undefined,
      "data-title-key": titleKey,
      style
    },
    header || title
      ? React.createElement(
          "header",
          createScopeAttributes("view", "header", state),
          header,
          title
            ? React.createElement(
                "h1",
                {
                  ...createScopeAttributes("view", "title", state),
                  id: label.titleId
                },
                title
              )
            : null
        )
      : null,
    React.createElement(
      "div",
      createScopeAttributes("view", "content", state),
      children
    ),
    footer
      ? React.createElement(
          "footer",
          createScopeAttributes("view", "footer", state),
          footer
        )
      : null,
    createStatusNode("view", state, error)
  );
});

ChipsView.displayName = "ChipsView";

export const ChipsBox = React.forwardRef((props, ref) => {
  const {
    as,
    children,
    disabled = false,
    loading = false,
    error = null,
    active = false,
    padding,
    radius,
    onStateChange,
    style,
    ...rest
  } = props;
  const state = resolveLayoutState({
    disabled,
    loading,
    error,
    active
  });
  const focusHandlers = createLayoutFocusHandlers({
    onStateChange,
    state,
    onFocus: rest.onFocus,
    onBlur: rest.onBlur
  });
  const elementTag = normalizeElementTag(as, "div");
  const rootStyle = withCssVar(
    withCssVar(style || {}, "--chips-box-padding", padding),
    "--chips-box-radius",
    radius
  );

  return React.createElement(
    elementTag,
    {
      ...createScopeAttributes("box", "root", state),
      ...rest,
      ...focusHandlers,
      ref,
      "aria-disabled": disabled || loading ? "true" : undefined,
      style: rootStyle
    },
    children,
    createStatusNode("box", state, error)
  );
});

ChipsBox.displayName = "ChipsBox";

function renderLayoutItems(scope, state, children) {
  return React.Children.map(children, (child, index) => {
    if (child === null || child === undefined || typeof child === "boolean") {
      return null;
    }
    return React.createElement(
      "div",
      {
        ...createScopeAttributes(scope, "item", state),
        key: child && typeof child === "object" && child.key != null ? child.key : index
      },
      child
    );
  });
}

export const ChipsStack = React.forwardRef((props, ref) => {
  const {
    as,
    children,
    direction = "vertical",
    gap,
    align,
    justify,
    wrap = false,
    disabled = false,
    loading = false,
    error = null,
    active = false,
    onStateChange,
    style,
    ...rest
  } = props;
  const state = resolveLayoutState({
    disabled,
    loading,
    error,
    active
  });
  const focusHandlers = createLayoutFocusHandlers({
    onStateChange,
    state,
    onFocus: rest.onFocus,
    onBlur: rest.onBlur
  });
  const elementTag = normalizeElementTag(as, "div");
  const rootStyle = withCssVar(style || {}, "--chips-stack-gap", gap);
  const resolvedDirection = normalizeEnum(direction, STACK_DIRECTION, "vertical");

  return React.createElement(
    elementTag,
    {
      ...createScopeAttributes("stack", "root", state),
      ...rest,
      ...focusHandlers,
      ref,
      "data-direction": resolvedDirection,
      "data-align": normalizeEnum(align, ALIGN_ITEMS, undefined),
      "data-justify": normalizeEnum(justify, JUSTIFY_CONTENT, undefined),
      "data-wrap": String(wrap === true),
      "aria-disabled": disabled || loading ? "true" : undefined,
      style: rootStyle
    },
    renderLayoutItems("stack", state, children),
    createStatusNode("stack", state, error)
  );
});

ChipsStack.displayName = "ChipsStack";

export const ChipsInline = React.forwardRef((props, ref) => {
  const {
    as,
    children,
    gap,
    align,
    justify,
    wrap = true,
    disabled = false,
    loading = false,
    error = null,
    active = false,
    onStateChange,
    style,
    ...rest
  } = props;
  const state = resolveLayoutState({
    disabled,
    loading,
    error,
    active
  });
  const focusHandlers = createLayoutFocusHandlers({
    onStateChange,
    state,
    onFocus: rest.onFocus,
    onBlur: rest.onBlur
  });
  const elementTag = normalizeElementTag(as, "div");
  const rootStyle = withCssVar(style || {}, "--chips-inline-gap", gap);

  return React.createElement(
    elementTag,
    {
      ...createScopeAttributes("inline", "root", state),
      ...rest,
      ...focusHandlers,
      ref,
      "data-align": normalizeEnum(align, ALIGN_ITEMS, undefined),
      "data-justify": normalizeEnum(justify, JUSTIFY_CONTENT, undefined),
      "data-wrap": String(wrap !== false),
      "aria-disabled": disabled || loading ? "true" : undefined,
      style: rootStyle
    },
    renderLayoutItems("inline", state, children),
    createStatusNode("inline", state, error)
  );
});

ChipsInline.displayName = "ChipsInline";

export const ChipsGrid = React.forwardRef((props, ref) => {
  const {
    as,
    children,
    columns,
    minItemSize,
    gap,
    disabled = false,
    loading = false,
    error = null,
    active = false,
    onStateChange,
    style,
    ...rest
  } = props;
  const state = resolveLayoutState({
    disabled,
    loading,
    error,
    active
  });
  const focusHandlers = createLayoutFocusHandlers({
    onStateChange,
    state,
    onFocus: rest.onFocus,
    onBlur: rest.onBlur
  });
  const elementTag = normalizeElementTag(as, "div");
  const rootStyle = withDefinedStyle(
    withCssVar(
      withCssVar(style || {}, "--chips-grid-gap", gap),
      "--chips-grid-min-item-size",
      minItemSize
    ),
    {
      "--chips-grid-columns": Number.isInteger(columns) && columns > 0 ? String(columns) : undefined
    }
  );

  return React.createElement(
    elementTag,
    {
      ...createScopeAttributes("grid", "root", state),
      ...rest,
      ...focusHandlers,
      ref,
      "data-columns": Number.isInteger(columns) && columns > 0 ? String(columns) : "auto",
      "aria-disabled": disabled || loading ? "true" : undefined,
      style: rootStyle
    },
    renderLayoutItems("grid", state, children),
    createStatusNode("grid", state, error)
  );
});

ChipsGrid.displayName = "ChipsGrid";

export const ChipsSection = React.forwardRef((props, ref) => {
  const {
    as,
    title,
    titleKey,
    description,
    footer,
    children,
    titleId,
    disabled = false,
    loading = false,
    error = null,
    active = false,
    ariaLabel,
    ariaLabelledBy,
    onStateChange,
    style,
    ...rest
  } = props;
  const state = resolveLayoutState({
    disabled,
    loading,
    error,
    active
  });
  const focusHandlers = createLayoutFocusHandlers({
    onStateChange,
    state,
    onFocus: rest.onFocus,
    onBlur: rest.onBlur
  });
  const elementTag = normalizeElementTag(as, "section");
  const label = resolveTitledRegionLabel({
    ariaLabel,
    ariaLabelledBy,
    rest,
    title,
    titleId
  });

  return React.createElement(
    elementTag,
    {
      ...createScopeAttributes("section", "root", state),
      ...rest,
      ...focusHandlers,
      ref,
      role: rest.role || "region",
      "aria-label": label.ariaLabel,
      "aria-labelledby": label.ariaLabelledBy,
      "aria-disabled": disabled || loading ? "true" : undefined,
      "data-title-key": titleKey,
      style
    },
    title || description
      ? React.createElement(
          "header",
          createScopeAttributes("section", "header", state),
          title
            ? React.createElement(
                "h2",
                {
                  ...createScopeAttributes("section", "title", state),
                  id: label.titleId
                },
                title
              )
            : null,
          description
            ? React.createElement(
                "p",
                createScopeAttributes("section", "description", state),
                description
              )
            : null
        )
      : null,
    React.createElement(
      "div",
      createScopeAttributes("section", "content", state),
      children
    ),
    footer
      ? React.createElement(
          "footer",
          createScopeAttributes("section", "footer", state),
          footer
        )
      : null,
    createStatusNode("section", state, error)
  );
});

ChipsSection.displayName = "ChipsSection";

export const ChipsScrollView = React.forwardRef((props, ref) => {
  const {
    as,
    children,
    axis = "vertical",
    maxBlockSize,
    disabled = false,
    loading = false,
    error = null,
    active = false,
    ariaLabel,
    ariaLabelledBy,
    onStateChange,
    style,
    ...rest
  } = props;
  const state = resolveLayoutState({
    disabled,
    loading,
    error,
    active
  });
  const focusHandlers = createLayoutFocusHandlers({
    onStateChange,
    state,
    onFocus: rest.onFocus,
    onBlur: rest.onBlur
  });
  const elementTag = normalizeElementTag(as, "div");
  const resolvedAxis = normalizeEnum(axis, SCROLL_AXES, "vertical");
  const overflow = normalizeEnum(resolvedAxis, OVERFLOW_VALUES, null)
    || (resolvedAxis === "both" ? "auto" : resolvedAxis === "horizontal" ? "auto" : "auto");
  const rootStyle = withCssVar(style || {}, "--chips-scroll-view-max-block-size", maxBlockSize);
  const resolvedAriaLabel = ariaLabel || rest["aria-label"];
  const resolvedAriaLabelledBy = ariaLabelledBy || rest["aria-labelledby"];

  return React.createElement(
    elementTag,
    {
      ...createScopeAttributes("scroll-view", "root", state),
      ...rest,
      ...focusHandlers,
      ref,
      role: rest.role || "region",
      "aria-label": resolvedAriaLabel,
      "aria-labelledby": resolvedAriaLabelledBy,
      "aria-disabled": disabled || loading ? "true" : undefined,
      "data-axis": resolvedAxis,
      style: rootStyle
    },
    React.createElement(
      "div",
      {
        ...createScopeAttributes("scroll-view", "viewport", state),
        "data-overflow": overflow
      },
      React.createElement(
        "div",
        createScopeAttributes("scroll-view", "content", state),
        children
      )
    ),
    createStatusNode("scroll-view", state, error)
  );
});

ChipsScrollView.displayName = "ChipsScrollView";

export const ChipsSpacer = React.forwardRef((props, ref) => {
  const {
    as,
    size,
    inline = false,
    style,
    ...rest
  } = props;
  const elementTag = normalizeElementTag(as, "div");
  const rootStyle = withCssVar(style || {}, "--chips-spacer-size", size);

  return React.createElement(elementTag, {
    ...createScopeAttributes("spacer", "root", "idle"),
    ...rest,
    ref,
    "aria-hidden": "true",
    "data-inline": String(inline === true),
    style: rootStyle
  });
});

ChipsSpacer.displayName = "ChipsSpacer";

export const ChipsDivider = React.forwardRef((props, ref) => {
  const {
    as,
    orientation = "horizontal",
    label,
    decorative = false,
    style,
    ...rest
  } = props;
  const elementTag = normalizeElementTag(as, "div");
  const resolvedOrientation = normalizeEnum(orientation, ORIENTATIONS, "horizontal");

  return React.createElement(
    elementTag,
    {
      ...createScopeAttributes("divider", "root", "idle"),
      ...rest,
      ref,
      role: decorative ? undefined : "separator",
      "aria-hidden": decorative ? "true" : undefined,
      "aria-orientation": decorative ? undefined : resolvedOrientation,
      "data-orientation": resolvedOrientation,
      style
    },
    label
      ? React.createElement(
          "span",
          createScopeAttributes("divider", "label", "idle"),
          label
        )
      : null
  );
});

ChipsDivider.displayName = "ChipsDivider";

export const ChipsSplitView = React.forwardRef((props, ref) => {
  const {
    primary,
    secondary,
    detail,
    children,
    variant = "two-column",
    disabled = false,
    loading = false,
    error = null,
    active = false,
    ariaLabel,
    ariaLabelledBy,
    onStateChange,
    style,
    ...rest
  } = props;
  const state = resolveLayoutState({
    disabled,
    loading,
    error,
    active
  });
  const focusHandlers = createLayoutFocusHandlers({
    onStateChange,
    state,
    onFocus: rest.onFocus,
    onBlur: rest.onBlur
  });
  const resolvedVariant = normalizeEnum(variant, SPLIT_VARIANTS, "two-column");
  const resolvedAriaLabel = ariaLabel || rest["aria-label"];
  const resolvedAriaLabelledBy = ariaLabelledBy || rest["aria-labelledby"];

  return React.createElement(
    "div",
    {
      ...createScopeAttributes("split-view", "root", state),
      ...rest,
      ...focusHandlers,
      ref,
      role: rest.role || "group",
      "aria-label": resolvedAriaLabel,
      "aria-labelledby": resolvedAriaLabelledBy,
      "aria-disabled": disabled || loading ? "true" : undefined,
      "data-variant": resolvedVariant,
      style
    },
    React.createElement(
      "div",
      createScopeAttributes("split-view", "primary", state),
      primary
    ),
    secondary !== undefined
      ? React.createElement(
          React.Fragment,
          null,
          React.createElement("div", {
            ...createScopeAttributes("split-view", "divider", state),
            "aria-hidden": "true"
          }),
          React.createElement(
            "div",
            createScopeAttributes("split-view", "secondary", state),
            secondary
          )
        )
      : null,
    React.createElement("div", {
      ...createScopeAttributes("split-view", "divider", state),
      "aria-hidden": "true"
    }),
    React.createElement(
      "div",
      createScopeAttributes("split-view", "detail", state),
      detail || children
    ),
    createStatusNode("split-view", state, error)
  );
});

ChipsSplitView.displayName = "ChipsSplitView";

export const LAYOUT_PRIMITIVE_COMPONENTS = [
  buildLayoutComponentContract("view"),
  buildLayoutComponentContract("box"),
  buildLayoutComponentContract("stack"),
  buildLayoutComponentContract("inline"),
  buildLayoutComponentContract("grid"),
  buildLayoutComponentContract("section"),
  buildLayoutComponentContract("scroll-view"),
  buildLayoutComponentContract("spacer"),
  buildLayoutComponentContract("divider"),
  buildLayoutComponentContract("split-view")
];

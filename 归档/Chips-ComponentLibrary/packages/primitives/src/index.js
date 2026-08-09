import React from "react";

const DEFAULT_STATE = "idle";

function isNonEmptyString(value) {
  return typeof value === "string" && value.length > 0;
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function createScopeAttributes(scope, part, state = DEFAULT_STATE) {
  if (!isNonEmptyString(scope) || !isNonEmptyString(part)) {
    throw new Error("PRIMITIVE_SCOPE_ATTR_INVALID");
  }

  const attributes = {
    "data-scope": scope,
    "data-part": part,
    "data-state": isNonEmptyString(state) ? state : DEFAULT_STATE
  };

  return attributes;
}

export function toPrimitiveEventPayload(params) {
  return {
    type: params.type,
    scope: params.scope,
    part: params.part,
    state: params.state,
    disabled: params.disabled === true,
    nativeEvent: params.nativeEvent || null
  };
}

function callHandler(handler, event, payload) {
  if (typeof handler === "function") {
    handler(event, payload);
  }
}

function isPressKey(key) {
  return key === "Enter" || key === " ";
}

function createPrimitiveHandlers({
  scope,
  part,
  state,
  disabled,
  onPress,
  onClick,
  onKeyDown,
  onPrimitiveEvent
}) {
  const handleClick = (event) => {
    const payload = toPrimitiveEventPayload({
      type: "click",
      scope,
      part,
      state,
      disabled,
      nativeEvent: event
    });

    if (disabled) {
      if (event && typeof event.preventDefault === "function") {
        event.preventDefault();
      }
      callHandler(onPrimitiveEvent, event, payload);
      return;
    }

    callHandler(onPress, event, payload);
    callHandler(onPrimitiveEvent, event, payload);
    callHandler(onClick, event, payload);
  };

  const handleKeyDown = (event) => {
    const payload = toPrimitiveEventPayload({
      type: "keydown",
      scope,
      part,
      state,
      disabled,
      nativeEvent: event
    });

    if (disabled) {
      if (event && typeof event.preventDefault === "function" && isPressKey(event.key)) {
        event.preventDefault();
      }
      callHandler(onPrimitiveEvent, event, payload);
      callHandler(onKeyDown, event, payload);
      return;
    }

    if (event && isPressKey(event.key) && typeof onPress === "function") {
      onPress(event, payload);
    }

    callHandler(onPrimitiveEvent, event, payload);
    callHandler(onKeyDown, event, payload);
  };

  return {
    onClick: handleClick,
    onKeyDown: handleKeyDown
  };
}

export function mapArkPrimitiveProps(props = {}, config = {}) {
  const {
    scope = "primitive",
    defaultPart = "root",
    defaultState = DEFAULT_STATE,
    defaultAs = "div"
  } = config;

  const {
    as,
    part = defaultPart,
    state = defaultState,
    disabled = false,
    onPress,
    onClick,
    onKeyDown,
    onPrimitiveEvent,
    ...rest
  } = props;

  const elementTag = isNonEmptyString(as) ? as : defaultAs;
  const resolvedState = isNonEmptyString(state) ? state : DEFAULT_STATE;
  const attributes = createScopeAttributes(scope, part, resolvedState);
  const handlers = createPrimitiveHandlers({
    scope,
    part,
    state: resolvedState,
    disabled,
    onPress,
    onClick,
    onKeyDown,
    onPrimitiveEvent
  });

  return {
    elementTag,
    scope,
    part,
    state: resolvedState,
    disabled,
    attributes,
    handlers,
    props: {
      ...rest,
      ...attributes,
      "aria-disabled": disabled ? "true" : undefined,
      onClick: handlers.onClick,
      onKeyDown: handlers.onKeyDown
    }
  };
}

export function createPrimitiveComponent(config = {}) {
  const {
    scope,
    displayName,
    defaultAs = "div",
    defaultPart = "root",
    defaultState = DEFAULT_STATE
  } = config;

  if (!isNonEmptyString(scope)) {
    throw new Error("PRIMITIVE_COMPONENT_SCOPE_INVALID");
  }

  const Primitive = React.forwardRef((props, ref) => {
    const mapped = mapArkPrimitiveProps(props, {
      scope,
      defaultAs,
      defaultPart,
      defaultState
    });

    return React.createElement(mapped.elementTag, {
      ...mapped.props,
      ref
    });
  });

  Primitive.displayName = isNonEmptyString(displayName) ? displayName : `Primitive(${scope})`;
  return Primitive;
}

export const Box = createPrimitiveComponent({
  scope: "box",
  displayName: "Box",
  defaultAs: "div"
});

export const Inline = createPrimitiveComponent({
  scope: "inline",
  displayName: "Inline",
  defaultAs: "div"
});

export const Stack = createPrimitiveComponent({
  scope: "stack",
  displayName: "Stack",
  defaultAs: "div"
});

export const Grid = createPrimitiveComponent({
  scope: "grid",
  displayName: "Grid",
  defaultAs: "div"
});

export const Text = createPrimitiveComponent({
  scope: "text",
  displayName: "Text",
  defaultAs: "span"
});

export const Label = createPrimitiveComponent({
  scope: "label",
  displayName: "Label",
  defaultAs: "label"
});

export const HelperText = React.forwardRef((props, ref) => {
  const {
    tone = "neutral",
    live,
    ...rest
  } = props || {};

  const mapped = mapArkPrimitiveProps(rest, {
    scope: "helper-text",
    defaultAs: "p",
    defaultPart: "root",
    defaultState: DEFAULT_STATE
  });

  const resolvedLive = isNonEmptyString(live) ? live : tone === "error" ? "assertive" : "polite";
  return React.createElement(mapped.elementTag, {
    ...mapped.props,
    "data-tone": tone,
    role: "status",
    "aria-live": resolvedLive,
    ref
  });
});

HelperText.displayName = "HelperText";

export function createControlledValueAdapter(options = {}) {
  const {
    value,
    defaultValue,
    onValueChange
  } = options;

  const controlled = value !== undefined;
  let internalValue = defaultValue;

  return {
    isControlled: controlled,
    getValue() {
      return controlled ? value : internalValue;
    },
    setValue(nextValue) {
      if (!controlled) {
        internalValue = nextValue;
      }
      if (typeof onValueChange === "function") {
        onValueChange(nextValue);
      }
    }
  };
}

export function validatePrimitiveProps(props, requiredKeys = []) {
  if (!isObject(props)) {
    throw new Error("PRIMITIVE_PROPS_INVALID");
  }

  for (const key of requiredKeys) {
    if (!Object.hasOwn(props, key)) {
      throw new Error(`PRIMITIVE_PROP_MISSING:${key}`);
    }
  }

  return true;
}

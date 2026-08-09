import test from "node:test";
import assert from "node:assert/strict";
import {
  Box,
  createControlledValueAdapter,
  createPrimitiveComponent,
  createScopeAttributes,
  HelperText,
  mapArkPrimitiveProps,
  validatePrimitiveProps
} from "../src/index.js";

test("createScopeAttributes returns contract fields", () => {
  const attrs = createScopeAttributes("button", "root", "idle");
  assert.equal(attrs["data-scope"], "button");
  assert.equal(attrs["data-part"], "root");
  assert.equal(attrs["data-state"], "idle");
});

test("createScopeAttributes validates scope and part", () => {
  assert.throws(() => createScopeAttributes("", "root"), /PRIMITIVE_SCOPE_ATTR_INVALID/);
});

test("mapArkPrimitiveProps returns mapped contract and handlers", () => {
  const called = [];
  const mapped = mapArkPrimitiveProps(
    {
      id: "a",
      onPress() {
        called.push("press");
      },
      onClick() {
        called.push("click");
      },
      onPrimitiveEvent() {
        called.push("primitive");
      }
    },
    {
      scope: "box",
      defaultAs: "div"
    }
  );

  mapped.handlers.onClick({
    preventDefault() {}
  });

  assert.equal(mapped.props["data-scope"], "box");
  assert.equal(mapped.props["data-part"], "root");
  assert.equal(mapped.props["data-state"], "idle");
  assert.deepEqual(called, ["press", "primitive", "click"]);
});

test("mapArkPrimitiveProps guards disabled click", () => {
  let pressed = false;
  const mapped = mapArkPrimitiveProps(
    {
      disabled: true,
      onPress() {
        pressed = true;
      }
    },
    {
      scope: "box"
    }
  );

  let prevented = false;
  mapped.handlers.onClick({
    preventDefault() {
      prevented = true;
    }
  });

  assert.equal(pressed, false);
  assert.equal(prevented, true);
});

test("createPrimitiveComponent validates scope", () => {
  assert.throws(
    () => createPrimitiveComponent({ scope: "" }),
    /PRIMITIVE_COMPONENT_SCOPE_INVALID/
  );
});

test("Box component render output contains contract attrs", () => {
  const element = Box.render(
    {
      as: "section",
      state: "active",
      "aria-label": "box"
    },
    null
  );

  assert.equal(element.type, "section");
  assert.equal(element.props["data-scope"], "box");
  assert.equal(element.props["data-state"], "active");
});

test("HelperText sets status semantics", () => {
  const element = HelperText.render(
    {
      tone: "error"
    },
    null
  );

  assert.equal(element.props.role, "status");
  assert.equal(element.props["aria-live"], "assertive");
  assert.equal(element.props["data-tone"], "error");
});

test("createControlledValueAdapter supports controlled and uncontrolled", () => {
  const uncontrolled = createControlledValueAdapter({
    defaultValue: "a"
  });
  assert.equal(uncontrolled.getValue(), "a");
  uncontrolled.setValue("b");
  assert.equal(uncontrolled.getValue(), "b");

  let changed = "";
  const controlled = createControlledValueAdapter({
    value: "x",
    onValueChange(nextValue) {
      changed = nextValue;
    }
  });
  controlled.setValue("y");
  assert.equal(controlled.getValue(), "x");
  assert.equal(changed, "y");
});

test("validatePrimitiveProps checks required keys", () => {
  assert.equal(validatePrimitiveProps({ a: 1 }, ["a"]), true);
  assert.throws(() => validatePrimitiveProps(null), /PRIMITIVE_PROPS_INVALID/);
  assert.throws(() => validatePrimitiveProps({ a: 1 }, ["b"]), /PRIMITIVE_PROP_MISSING:b/);
});

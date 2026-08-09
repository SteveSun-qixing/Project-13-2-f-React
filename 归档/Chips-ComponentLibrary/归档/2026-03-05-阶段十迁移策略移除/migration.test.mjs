import test from "node:test";
import assert from "node:assert/strict";
import { applyIdentifierMap, applyTokenMap } from "../src/index.js";

test("applyIdentifierMap replaces identifier with word boundary", () => {
  const source = "Button InputGroup Button";
  const result = applyIdentifierMap(source, [
    { from: "Button", to: "ChipsButton" }
  ]);

  assert.equal(result.total, 2);
  assert.equal(result.content, "ChipsButton InputGroup ChipsButton");
});

test("applyIdentifierMap skips invalid and self entries", () => {
  const source = "Button";
  const result = applyIdentifierMap(source, [
    { from: "", to: "ChipsButton" },
    { from: "Button", to: "Button" },
    null
  ]);

  assert.equal(result.total, 0);
  assert.equal(result.content, "Button");
});

test("applyTokenMap applies exact replacement before prefix", () => {
  const source = "chips.component.button.root.radius chips.component.dialog.root.surface";
  const result = applyTokenMap(source, {
    exact: {
      "chips.component.button.root.radius": "chips.comp.button.root.radius"
    },
    prefix: {
      "chips.component.": "chips.comp."
    }
  });

  assert.equal(result.total, 2);
  assert.equal(
    result.content,
    "chips.comp.button.root.radius chips.comp.dialog.root.surface"
  );
});

test("applyTokenMap supports css variable prefix migration", () => {
  const source = "var(--chips-component-button-root-radius)";
  const result = applyTokenMap(source, {
    exact: {},
    prefix: {
      "--chips-component-": "--chips-comp-"
    }
  });

  assert.equal(result.total, 1);
  assert.equal(result.content, "var(--chips-comp-button-root-radius)");
});

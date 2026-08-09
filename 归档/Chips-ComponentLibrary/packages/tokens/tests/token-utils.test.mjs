import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveTokenReferences,
  toTokenKeyDeclaration
} from "../src/token-utils.js";

test("resolveTokenReferences resolves nested references", () => {
  const resolved = resolveTokenReferences({
    "chips.ref.color.gray-0": "#ffffff",
    "chips.sys.color.surface": "{chips.ref.color.gray-0}",
    "chips.comp.sample.surface": "{chips.sys.color.surface}"
  });

  assert.equal(resolved["chips.comp.sample.surface"], "#ffffff");
});

test("resolveTokenReferences throws on cycles", () => {
  assert.throws(
    () =>
      resolveTokenReferences({
        "chips.a": "{chips.b}",
        "chips.b": "{chips.a}"
      }),
    /TOKEN_REFERENCE_CYCLE/
  );
});

test("toTokenKeyDeclaration emits valid union and empty fallback", () => {
  assert.equal(
    toTokenKeyDeclaration({
      "chips.a": 1,
      "chips.b": 2
    }),
    'export type ChipsTokenKey =\n  | "chips.a"\n  | "chips.b";\n'
  );

  assert.equal(
    toTokenKeyDeclaration({}),
    "export type ChipsTokenKey = never;\n"
  );
});

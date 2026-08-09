import test from "node:test";
import assert from "node:assert/strict";
import * as aggregate from "../index.js";
import { toStandardError as toComponentStandardError } from "@chips/components";
import { toStandardError as toCardRuntimeStandardError } from "@chips/card-runtime";

test("component-library aggregate exports the formal package surface", () => {
  assert.equal(typeof aggregate.ChipsThemeProvider, "function");
  assert.equal(typeof aggregate.ChipsEnvironmentProvider, "function");
  assert.equal(typeof aggregate.useChipsEnvironment, "function");
  assert.equal(typeof aggregate.useChipsClient, "function");
  assert.equal(typeof aggregate.useChipsTheme, "function");
  assert.equal(typeof aggregate.useChipsI18n, "function");
  assert.equal(typeof aggregate.createChipsI18nText, "function");
  assert.equal(typeof aggregate.useChipsI18nText, "function");
  assert.equal(typeof aggregate.useChipsSurface, "function");
  assert.equal(typeof aggregate.useChipsPermission, "function");
  assert.equal(typeof aggregate.useChipsCommand, "function");
  assert.equal(typeof aggregate.useChipsDiagnostics, "function");
  assert.equal(typeof aggregate.ChipsView, "object");
  assert.equal(typeof aggregate.ChipsStack, "object");
  assert.equal(typeof aggregate.ChipsSplitView, "object");
  assert.ok(aggregate.ChipsIcon);
  assert.ok(aggregate.ChipsButton);
  assert.equal(typeof aggregate.CardCoverFrame, "function");
  assert.equal(typeof aggregate.CompositeCardWindow, "function");
  assert.equal(typeof aggregate.loadCompositeWindowData, "function");
  assert.equal(typeof aggregate.validateCardDisplayAdapter, "function");
});

test("component-library aggregate resolves helper name collisions through explicit aliases", () => {
  assert.equal("toStandardError" in aggregate, false);
  assert.equal(aggregate.toComponentStandardError, toComponentStandardError);
  assert.equal(aggregate.toCardRuntimeStandardError, toCardRuntimeStandardError);
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  assertActiveDescendant,
  assertAriaRole,
  assertA11yFixtureCoverage,
  assertComponentContractCoverage,
  assertComponentStatePriorityCoverage,
  assertFocusRestored,
  assertHasContractAttrs,
  assertRovingTabIndex,
  createKeyboardEventFixture,
  assertStatePriority,
  CHIPS_COMPONENT_QUALITY_MATRIX,
  createComponentFixture,
  createComponentMatrixReport,
  createComponentQualityMatrix,
  createFocusTrapFixture,
  createMockChipsClient,
  createMockChipsEnvironment,
  createThemeFallbackFixture,
  getComponentQualityMatrixEntry,
  injectFault,
  runKeyboardSequence,
  assertContractAttrMatrixCoverage,
  assertThemeFallbackChain,
  resolveFallbackScopeValue
} from "../src/index.js";

test("assertHasContractAttrs validates required attrs", () => {
  assert.equal(
    assertHasContractAttrs({
      "data-scope": "x",
      "data-part": "root",
      "data-state": "idle"
    }),
    true
  );
});

test("assertHasContractAttrs throws on missing attr", () => {
  assert.throws(
    () => assertHasContractAttrs({ "data-scope": "x", "data-part": "root" }),
    /TEST_CONTRACT_ATTR_MISSING:data-state/
  );
});

test("createComponentFixture generates contract attrs", () => {
  const fixture = createComponentFixture({
    scope: "button",
    part: "root",
    state: "focus",
    role: "button",
    ariaLabel: "button fixture"
  });

  assert.equal(fixture["data-scope"], "button");
  assert.equal(fixture.role, "button");
});

test("assertAriaRole validates role", () => {
  assert.equal(assertAriaRole({ role: "alert" }, "alert"), true);
  assert.throws(() => assertAriaRole({ role: "status" }, "alert"), /TEST_ARIA_ROLE_MISMATCH/);
});

test("keyboard testing helpers create events and run sequences", () => {
  const handled = [];
  const target = {
    onKeyDown(event) {
      handled.push(event.key);
      if (event.key === "Escape") {
        event.preventDefault();
      }
    }
  };

  const event = createKeyboardEventFixture("Enter", { shiftKey: true });
  assert.equal(event.key, "Enter");
  assert.equal(event.shiftKey, true);

  const events = runKeyboardSequence(target, ["ArrowDown", "Escape"]);
  assert.deepEqual(handled, ["ArrowDown", "Escape"]);
  assert.equal(events[1].defaultPrevented, true);
});

test("focus and roving testing helpers assert common a11y states", () => {
  const trap = createFocusTrapFixture(["trigger", "item-a", "item-b"]);
  trap.first.focus();
  trap.last.focus();

  assertFocusRestored(trap.focusHistory, "item-b");
  assert.equal(assertRovingTabIndex([
    { id: "item-a", tabIndex: -1 },
    { id: "item-b", tabIndex: 0 },
    { id: "item-c", tabIndex: undefined, disabled: true }
  ], "item-b"), true);
  assert.equal(assertActiveDescendant({
    "aria-activedescendant": "item-b"
  }, "item-b"), true);
});

test("assertStatePriority validates known state", () => {
  const priority = ["disabled", "loading", "error", "active", "focus", "hover", "idle"];
  assert.equal(assertStatePriority("focus", priority), true);
  assert.throws(() => assertStatePriority("unknown", priority), /TEST_STATE_NOT_IN_PRIORITY/);
});

test("resolveFallbackScopeValue follows high-to-low chain", () => {
  const fixture = createThemeFallbackFixture({
    global: { "chips.sys.color.surface": "g" },
    app: { "chips.sys.color.surface": "a" },
    component: {}
  });

  const resolved = resolveFallbackScopeValue(fixture, "chips.sys.color.surface");
  assert.deepEqual(resolved, {
    scope: "app",
    value: "a"
  });
  assert.equal(assertThemeFallbackChain(fixture, {
    "chips.sys.color.surface": {
      scope: "app",
      value: "a"
    }
  }), true);
});

test("component quality matrix helpers validate contract attr, state and a11y coverage", () => {
  const contracts = [
    {
      component: "button",
      scope: "button",
      parts: ["root", "label"],
      states: ["idle", "focus", "disabled"],
      tokens: ["chips.comp.button.root.surface.idle"]
    },
    {
      component: "dialog",
      scope: "dialog",
      parts: ["root", "trigger", "content"],
      states: ["idle", "focus", "disabled"],
      tokens: ["chips.comp.dialog.content.surface"]
    }
  ];
  const matrix = [
    {
      component: "button",
      packageName: "@chips/components",
      contractAttrs: { part: "root", state: "idle" },
      statePriority: ["disabled", "focus", "idle"],
      a11yFixtures: [
        {
          attrs: { role: "button", "aria-label": "button" },
          rules: { role: "button", requireLabel: true }
        }
      ],
      perfSmokeScenarios: []
    },
    {
      component: "dialog",
      packageName: "@chips/components",
      contractAttrs: { part: "trigger", state: "idle" },
      statePriority: ["disabled", "focus", "idle"],
      a11yFixtures: [
        {
          attrs: {
            role: "button",
            "aria-label": "dialog",
            "aria-expanded": "true",
            "aria-controls": "dialog-content"
          },
          rules: {
            role: "button",
            requireLabel: true,
            requireControlsWhenExpanded: true
          }
        }
      ],
      perfSmokeScenarios: ["dialog-open"]
    }
  ];

  assert.equal(assertComponentContractCoverage(contracts, matrix), true);
  assert.equal(assertContractAttrMatrixCoverage(contracts, matrix), true);
  assert.equal(assertA11yFixtureCoverage(contracts, matrix), true);
  assert.equal(assertComponentStatePriorityCoverage(contracts, matrix), true);
  assert.equal(getComponentQualityMatrixEntry("dialog", matrix).component, "dialog");

  const report = createComponentMatrixReport(contracts, matrix, {
    generatedAt: "2026-05-24T00:00:00.000Z"
  });
  assert.equal(report.status, "passed");
  assert.equal(report.totals.contractComponentCount, 2);
  assert.equal(report.totals.a11yFixtureCount, 2);
  assert.equal(report.totals.perfSmokeScenarioCount, 1);
  assert.equal(createComponentQualityMatrix([{ component: "button", packageName: "override" }])
    .find((item) => item.component === "button").packageName, "override");
});

test("component quality matrix detects missing components", () => {
  assert.ok(CHIPS_COMPONENT_QUALITY_MATRIX.length >= 60);
  assert.throws(
    () => assertComponentContractCoverage([
      {
        component: "missing-widget",
        scope: "missing-widget",
        parts: ["root"],
        states: ["idle"],
        tokens: ["chips.comp.missing-widget.root.surface"]
      }
    ], CHIPS_COMPONENT_QUALITY_MATRIX),
    /TEST_COMPONENT_MATRIX_DRIFT/
  );
});

test("injectFault returns typed fault payload", () => {
  const fault = injectFault("token-missing", { key: "chips.comp.button.root.surface.idle" });
  assert.equal(fault.type, "token-missing");
  assert.equal(fault.payload.key, "chips.comp.button.root.surface.idle");
});

test("createMockChipsClient provides SDK-like environment APIs", async () => {
  const client = createMockChipsClient({
    permissions: ["theme.read"],
    translations: {
      "demo.title": "Demo"
    }
  });
  const changed = [];
  client.events.on("theme.changed", (payload) => changed.push(payload.themeId));

  assert.equal((await client.theme.getCurrent()).themeId, "chips-official.default-theme");
  assert.equal(await client.i18n.translate("demo.title"), "Demo");
  assert.equal(client.platform.getLaunchContext().surfaceContext.permissions.includes("theme.read"), true);

  await client.theme.apply("chips.dark");
  assert.equal(changed[0], "chips.dark");
  assert.equal(client.calls.some((call) => call.action === "theme.apply"), true);
});

test("createMockChipsEnvironment returns Provider-ready props", () => {
  const environment = createMockChipsEnvironment({
    permissions: ["surface.read"]
  });

  assert.equal(typeof environment.client.theme.getCurrent, "function");
  assert.equal(environment.initialSurface.surfaceId, "test-surface");
  assert.deepEqual(environment.initialPermissions, ["surface.read"]);
});

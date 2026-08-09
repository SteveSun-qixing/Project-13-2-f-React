import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildComponentContractView,
  buildThemeContractView,
  buildThemeInterfaceContract,
  buildThemeMinFunctionalSet,
  compareThemeInterfaceContract,
  compareThemeMinFunctionalSet,
  flattenTokens,
  loadComponentContracts,
  validateComponentContract
} from "../src/validator.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../tokens/tokens");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function merge(target, source) {
  for (const [key, value] of Object.entries(source)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      if (!target[key] || typeof target[key] !== "object") {
        target[key] = {};
      }
      merge(target[key], value);
    } else {
      target[key] = value;
    }
  }
  return target;
}

function buildTokenTree() {
  const tree = {};
  for (const fileName of ["ref.json", "sys.json", "motion.json", "layout.json"]) {
    merge(tree, readJson(path.join(root, fileName)));
  }
  for (const fileName of [
    "view.json",
    "box.json",
    "stack.json",
    "inline.json",
    "grid.json",
    "section.json",
    "scroll-view.json",
    "spacer.json",
    "divider.json",
    "split-view.json",
    "button.json",
    "input.json",
    "checkbox.json",
    "radio.json",
    "switch.json",
    "select.json",
    "dialog.json",
    "popover.json",
    "tabs.json",
    "menu.json",
    "tooltip.json",
    "form.json",
    "virtual-list.json",
    "data-grid.json",
    "tree.json",
    "date-time.json",
    "command-palette.json",
    "navigation-split-view.json",
    "split-pane.json",
    "dock-panel.json",
    "inspector.json",
    "panel-header.json",
    "card-shell.json",
    "tool-window.json",
    "error-boundary.json",
    "loading-boundary.json",
    "notification.json",
    "toast.json",
    "empty-state.json",
    "skeleton.json",
    "card-cover-frame.json",
    "composite-card-window.json"
  ]) {
    merge(tree, readJson(path.join(root, "comp", fileName)));
  }
  return tree;
}

test("validateComponentContract accepts valid contract", () => {
  const tokenTree = buildTokenTree();
  const flat = flattenTokens(tokenTree);
  const contract = {
    component: "card-cover-frame",
    scope: "card-cover-frame",
    parts: ["root", "iframe"],
    states: ["idle", "ready"],
    tokens: ["chips.comp.card-cover-frame.name.color"],
    iframe: {
      requiredSandbox: true
    }
  };

  assert.equal(validateComponentContract(contract, flat), true);
});

test("validateComponentContract accepts non-iframe component contract", () => {
  const tokenTree = buildTokenTree();
  const flat = flattenTokens(tokenTree);
  const contract = {
    component: "view",
    scope: "view",
    parts: ["root", "content"],
    states: ["idle"],
    tokens: ["chips.comp.view.root.surface"]
  };

  assert.equal(validateComponentContract(contract, flat), true);
});

test("validateComponentContract rejects unknown token", () => {
  const tokenTree = buildTokenTree();
  const flat = flattenTokens(tokenTree);
  const contract = {
    component: "card-cover-frame",
    scope: "card-cover-frame",
    parts: ["root"],
    states: ["idle"],
    tokens: ["chips.comp.card-cover-frame.missing.value"],
    iframe: {
      requiredSandbox: true
    }
  };

  assert.throws(
    () => validateComponentContract(contract, flat),
    /THEME_CONTRACT_TOKEN_MISSING/
  );
});

test("buildThemeContractView returns frozen diagnostics schema and coverage", () => {
  const tokenTree = buildTokenTree();
  const contract = {
    version: "1.0.0",
    components: [
      {
        component: "button",
        scope: "button",
        parts: ["root", "label"],
        states: ["idle"],
        tokens: [
          "chips.comp.button.root.surface.idle",
          "chips.comp.button.label.color.missing"
        ],
        optionalTokens: ["chips.comp.button.root.surface.hover"],
        a11yConstraints: [{ key: "button.accessible-name" }],
        motionConstraints: [
          {
            key: "button.focus-visible",
            tokenKeys: ["chips.motion.duration.fast"]
          }
        ]
      }
    ]
  };

  const view = buildThemeContractView(contract, tokenTree, {
    themeId: "chips.test.theme",
    themeVersion: "1.0.0"
  });

  assert.equal(view.schemaVersion, "1.0.0");
  assert.equal(view.themeId, "chips.test.theme");
  assert.equal(view.contractVersion, "1.0.0");
  assert.equal(view.components.length, 1);
  assert.deepEqual(view.components[0].requiredTokens, [
    "chips.comp.button.root.surface.idle",
    "chips.comp.button.label.color.missing",
    "chips.motion.duration.fast"
  ]);
  assert.deepEqual(view.components[0].optionalTokens, ["chips.comp.button.root.surface.hover"]);
  assert.equal(view.components[0].coverage.requiredTokenCount, 3);
  assert.equal(view.components[0].coverage.coveredRequiredTokenCount, 2);
  assert.equal(view.components[0].coverage.missingRequiredTokenCount, 1);
  assert.equal(view.summary.blocking, 1);
  assert.equal(view.summary.status, "blocked");
  assert.equal(view.components[0].diagnostics[0].code, "THEME_REQUIRED_TOKEN_MISSING");
  assert.equal(view.components[0].diagnostics[0].messageKey, "theme.diagnostics.requiredTokenMissing");
  assert.equal(view.components[0].diagnostics[0].component, "button");
  assert.equal(view.components[0].diagnostics[0].part, "label");
  assert.equal(view.components[0].diagnostics[0].state, undefined);
  assert.equal(view.components[0].diagnostics[0].blocking, true);
});

test("motion constraint token keys are enforced as required contract tokens", () => {
  const tokenTree = buildTokenTree();
  const flat = flattenTokens(tokenTree);
  const view = buildComponentContractView(
    {
      component: "dialog",
      scope: "dialog",
      parts: ["content"],
      states: ["idle"],
      requiredTokens: ["chips.comp.dialog.content.surface"],
      motionConstraints: [
        {
          type: "overlay-transition",
          tokenKeys: [
            "chips.motion.overlay.enter-duration",
            "chips.motion.overlay.missing-duration"
          ]
        }
      ]
    },
    flat,
    { themeId: "chips.test.theme" }
  );

  assert.deepEqual(view.requiredTokens, [
    "chips.comp.dialog.content.surface",
    "chips.motion.overlay.enter-duration",
    "chips.motion.overlay.missing-duration"
  ]);
  assert.equal(view.coverage.status, "blocked");
  assert.equal(view.diagnostics[0].tokenKey, "chips.motion.overlay.missing-duration");
  assert.equal(view.diagnostics[0].layer, "motion");
});

test("buildComponentContractView accepts requiredTokens alias", () => {
  const tokenTree = buildTokenTree();
  const flat = flattenTokens(tokenTree);
  const view = buildComponentContractView(
    {
      component: "button",
      scope: "button",
      parts: ["root"],
      states: ["idle"],
      requiredTokens: ["chips.comp.button.root.surface.idle"]
    },
    flat,
    { themeId: "chips.test.theme" }
  );

  assert.deepEqual(view.requiredTokens, ["chips.comp.button.root.surface.idle"]);
  assert.equal(view.coverage.status, "complete");
});

test("component-library contracts generate official theme artifacts", () => {
  const contractDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../contracts/components");
  const contracts = loadComponentContracts(contractDir);
  const interfaceContract = buildThemeInterfaceContract(contracts);
  const minFunctionalSet = buildThemeMinFunctionalSet(contracts);

  assert.equal(interfaceContract.schemaVersion, "1.0.0");
  assert.equal(interfaceContract.contractVersion, "1.0.0");
  assert.equal(interfaceContract.components.length, contracts.length);
  assert.deepEqual(
    interfaceContract.components.map((component) => component.component),
    contracts.map((component) => component.component).sort()
  );
  assert.equal(interfaceContract.components[0].tokens, undefined);
  assert.ok(interfaceContract.components.every((component) => Array.isArray(component.requiredTokens)));
  assert.equal(
    interfaceContract.components.find((component) => component.component === "card-cover-frame").iframe.requiredSandbox,
    true
  );
  assert.deepEqual(minFunctionalSet.requiredComponents, contracts.map((component) => component.component).sort());
});

test("official theme artifact comparators catch drift", () => {
  const contracts = [
    {
      component: "button",
      scope: "button",
      parts: ["root"],
      states: ["idle"],
      tokens: ["chips.comp.button.root.surface.idle"],
      iframe: {
        requiredSandbox: true
      }
    }
  ];
  const interfaceContract = buildThemeInterfaceContract(contracts);
  const minFunctionalSet = buildThemeMinFunctionalSet(contracts);

  assert.deepEqual(compareThemeInterfaceContract(interfaceContract, contracts), []);
  assert.deepEqual(compareThemeMinFunctionalSet(minFunctionalSet, contracts), []);

  const drifted = {
    ...interfaceContract,
    components: [
      {
        ...interfaceContract.components[0],
        parts: ["root", "ghost"],
        iframe: {
          requiredSandbox: false
        }
      }
    ]
  };
  const interfaceFailures = compareThemeInterfaceContract(drifted, contracts);
  const minFunctionalSetFailures = compareThemeMinFunctionalSet(
    { ...minFunctionalSet, schemaVersion: "0.9.0", contractVersion: "0.9.0", requiredComponents: ["button", "ghost"] },
    contracts
  );

  assert.equal(interfaceFailures[0].label, "button.parts");
  assert.deepEqual(interfaceFailures[0].extra, ["ghost"]);
  assert.equal(interfaceFailures[1].label, "button.iframe");
  assert.deepEqual(interfaceFailures[1].expected, { requiredSandbox: true });
  assert.deepEqual(interfaceFailures[1].actual, { requiredSandbox: false });
  assert.equal(minFunctionalSetFailures[0].label, "schemaVersion");
  assert.equal(minFunctionalSetFailures[0].actual, "0.9.0");
  assert.equal(minFunctionalSetFailures[1].label, "contractVersion");
  assert.equal(minFunctionalSetFailures[1].actual, "0.9.0");
  assert.equal(minFunctionalSetFailures[2].label, "requiredComponents");
  assert.deepEqual(minFunctionalSetFailures[2].extra, ["ghost"]);
});

test("official theme artifact comparators catch version drift", () => {
  const contracts = [
    {
      component: "button",
      scope: "button",
      parts: ["root"],
      states: ["idle"],
      requiredTokens: ["chips.comp.button.root.surface.idle"]
    }
  ];
  const interfaceContract = {
    ...buildThemeInterfaceContract(contracts),
    schemaVersion: "0.9.0",
    contractVersion: "0.9.0"
  };
  const failures = compareThemeInterfaceContract(interfaceContract, contracts);

  assert.equal(failures[0].label, "schemaVersion");
  assert.equal(failures[0].expected, "1.0.0");
  assert.equal(failures[0].actual, "0.9.0");
  assert.equal(failures[1].label, "contractVersion");
  assert.equal(failures[1].expected, "1.0.0");
  assert.equal(failures[1].actual, "0.9.0");
});

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import {
  buildComponentContract,
  buildLayoutComponentContract,
  ChipsBox,
  ChipsDivider,
  ChipsGrid,
  ChipsInline,
  ChipsScrollView,
  ChipsSection,
  ChipsSpacer,
  ChipsSplitView,
  ChipsStack,
  ChipsView,
  LAYOUT_COMPONENT_TOKEN_MAP,
  LAYOUT_PRIMITIVE_COMPONENTS,
  validateComponentA11y,
  validateLayoutComponentA11y
} from "../src/index.js";

const LAYOUT_SCOPES = [
  "view",
  "box",
  "stack",
  "inline",
  "grid",
  "section",
  "scroll-view",
  "spacer",
  "divider",
  "split-view"
];

const dirname = path.dirname(fileURLToPath(import.meta.url));
const contractRoot = path.resolve(dirname, "../../theme-contracts/contracts/components");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function collectScopedParts(node, out = []) {
  if (!React.isValidElement(node)) {
    return out;
  }

  const scope = node.props["data-scope"];
  const part = node.props["data-part"];
  if (typeof scope === "string" && typeof part === "string") {
    out.push({ scope, part, state: node.props["data-state"] });
  }

  for (const child of React.Children.toArray(node.props.children)) {
    collectScopedParts(child, out);
  }

  return out;
}

function partsFor(element, scope) {
  return collectScopedParts(element)
    .filter((item) => item.scope === scope)
    .map((item) => item.part);
}

test("task014 layout primitive contract matrix stays complete", () => {
  assert.deepEqual(
    LAYOUT_PRIMITIVE_COMPONENTS.map((component) => component.component),
    LAYOUT_SCOPES
  );

  for (const scope of LAYOUT_SCOPES) {
    const contract = buildLayoutComponentContract(scope);
    const commonContract = buildComponentContract(scope);

    assert.equal(contract.scope, scope);
    assert.deepEqual(commonContract, contract);
    assert.deepEqual(contract.tokens, LAYOUT_COMPONENT_TOKEN_MAP[scope]);
    assert.ok(contract.parts.includes("root"));
    assert.ok(contract.tokens.length > 0);
  }
});
test("layout primitive runtime contracts match frozen theme contract files", () => {
  for (const scope of LAYOUT_SCOPES) {
    const runtimeContract = buildLayoutComponentContract(scope);
    const themeContract = readJson(path.join(contractRoot, `${scope}.contract.json`));

    assert.equal(themeContract.component, runtimeContract.component);
    assert.equal(themeContract.scope, runtimeContract.scope);
    assert.deepEqual(themeContract.parts, runtimeContract.parts);
    assert.deepEqual(themeContract.states, runtimeContract.states);
    assert.deepEqual(themeContract.tokens, runtimeContract.tokens);
  }
});

test("layout primitives render all public data parts", () => {
  const rendered = {
    view: ChipsView.render({
      title: "Library",
      footer: "Footer",
      error: { message: "View failed" },
      children: "Content"
    }, null),
    box: ChipsBox.render({
      error: { message: "Box failed" },
      children: "Box"
    }, null),
    stack: ChipsStack.render({
      direction: "horizontal",
      children: ["A", "B"]
    }, null),
    inline: ChipsInline.render({
      children: ["A", "B"]
    }, null),
    grid: ChipsGrid.render({
      columns: 2,
      children: ["A", "B"]
    }, null),
    section: ChipsSection.render({
      title: "General",
      description: "Settings",
      footer: "Footer",
      error: { message: "Section failed" },
      children: "Body"
    }, null),
    "scroll-view": ChipsScrollView.render({
      "aria-label": "Scrollable",
      error: { message: "Scroll failed" },
      children: "Body"
    }, null),
    spacer: ChipsSpacer.render({ inline: true }, null),
    divider: ChipsDivider.render({
      label: "More",
      orientation: "vertical"
    }, null),
    "split-view": ChipsSplitView.render({
      "aria-label": "Split",
      primary: "Navigation",
      secondary: "Inspector",
      detail: "Detail",
      error: { message: "Split failed" },
      variant: "three-column"
    }, null)
  };

  assert.deepEqual(partsFor(rendered.view, "view"), ["root", "header", "title", "content", "footer", "status"]);
  assert.deepEqual(partsFor(rendered.box, "box"), ["root", "status"]);
  assert.deepEqual(partsFor(rendered.stack, "stack"), ["root", "item", "item"]);
  assert.deepEqual(partsFor(rendered.inline, "inline"), ["root", "item", "item"]);
  assert.deepEqual(partsFor(rendered.grid, "grid"), ["root", "item", "item"]);
  assert.deepEqual(
    partsFor(rendered.section, "section"),
    ["root", "header", "title", "description", "content", "footer", "status"]
  );
  assert.deepEqual(partsFor(rendered["scroll-view"], "scroll-view"), ["root", "viewport", "content", "status"]);
  assert.deepEqual(partsFor(rendered.spacer, "spacer"), ["root"]);
  assert.deepEqual(partsFor(rendered.divider, "divider"), ["root", "label"]);
  assert.deepEqual(
    partsFor(rendered["split-view"], "split-view"),
    ["root", "primary", "divider", "secondary", "divider", "detail", "status"]
  );
});

test("layout primitive a11y rules reject unlabeled landmarks", () => {
  for (const [scope, role] of [
    ["view", "region"],
    ["section", "region"],
    ["scroll-view", "region"],
    ["split-view", "group"]
  ]) {
    assert.throws(
      () => validateLayoutComponentA11y(scope, { role }),
      (error) => error.code === "A11Y_LABEL_MISSING"
    );
    assert.throws(
      () => validateComponentA11y(scope, { role }),
      (error) => error.code === "A11Y_LABEL_MISSING"
    );
  }
});

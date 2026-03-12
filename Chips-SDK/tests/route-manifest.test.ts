import { describe, it, expect } from "vitest";
import { assertKnownAction, listActionsByNamespace, type RouteManifest } from "../src/tooling/route-manifest";

const manifest: RouteManifest = {
  routes: {
    "file.read": { action: "file.read" },
    "file.write": { action: "file.write" },
    "card.getBaseCard": { action: "card.getBaseCard" },
    "card.render": { action: "card.render" },
    "card.renderBaseCardEditor": { action: "card.renderBaseCardEditor" },
    "card.updateBaseCard": { action: "card.updateBaseCard" },
  },
};

describe("route-manifest tooling", () => {
  it("assertKnownAction does not throw for known actions", () => {
    expect(() => assertKnownAction("file.read", manifest)).not.toThrow();
    expect(() => assertKnownAction("card.render", manifest)).not.toThrow();
  });

  it("assertKnownAction throws for unknown actions", () => {
    expect(() => assertKnownAction("theme.apply", manifest)).toThrow();
  });

  it("listActionsByNamespace filters by namespace", () => {
    const fileActions = listActionsByNamespace("file", manifest);
    expect(fileActions).toEqual(["file.read", "file.write"]);

    const cardActions = listActionsByNamespace("card", manifest);
    expect(cardActions).toEqual([
      "card.getBaseCard",
      "card.render",
      "card.renderBaseCardEditor",
      "card.updateBaseCard",
    ]);
  });
});

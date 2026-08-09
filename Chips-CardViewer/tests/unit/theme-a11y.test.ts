import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(path: string): string {
  return readFileSync(resolve(__dirname, "../../", path), "utf-8");
}

describe("CardViewer document surface and a11y contracts", () => {
  it("keeps document-flow surfaces on the unified light background", () => {
    const css = readSource("src/components/CardWindow.css");

    expect(css).toContain(".card-viewer-window--document-flow");
    expect(css).toContain("background: #ffffff");
  });

  it("announces loading and error overlays with semantic roles", () => {
    const cardWindow = readSource("src/components/CardWindow.tsx");
    const hostedDocumentWindow = readSource("src/components/HostedDocumentWindow.tsx");

    expect(cardWindow).toContain('role="status"');
    expect(cardWindow).toContain('aria-live="polite"');
    expect(cardWindow).toContain('role="alert"');
    expect(hostedDocumentWindow).toContain('role="status"');
    expect(hostedDocumentWindow).toContain('aria-live="polite"');
    expect(hostedDocumentWindow).toContain('role="alert"');
  });
});

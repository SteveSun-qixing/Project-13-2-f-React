import { describe, expect, it } from "vitest";
import { buildImageFrameHtml } from "../../src/shared/frame-region";

describe("buildImageFrameHtml", () => {
  it("renders the natural fit variant without object-fit cover", () => {
    const html = buildImageFrameHtml("chips-render://asset/top", "natural");
    expect(html).toContain("html, body { margin: 0; width: 100%; background: transparent; }");
    expect(html).not.toContain("height: 100%");
    expect(html).toContain("body { overflow: visible; }");
    expect(html).toContain("img { display: block; width: 100%; height: auto; }");
    expect(html).not.toContain("object-fit: cover");
  });

  it("keeps the cover fit variant as the default", () => {
    const html = buildImageFrameHtml("chips-render://asset/background");
    expect(html).toContain("object-fit: cover");
    expect(html).toContain("html, body { margin: 0; width: 100%; height: 100%; background: transparent; }");
    expect(html).toContain("body { overflow: hidden; }");
  });
});

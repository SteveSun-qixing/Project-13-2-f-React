import { describe, expect, it } from "vitest";
import { buildImageFrameHtml } from "../../src/shared/frame-region";

describe("frame region image rendering", () => {
  it("renders cover mode html for image regions", () => {
    const html = buildImageFrameHtml("file:///tmp/cover.png");

    expect(html).toContain("<img ");
    expect(html).toContain("object-fit: cover");
    expect(html).not.toContain("background-repeat: repeat-y");
  });

  it("renders natural mode html for auto-height image regions", () => {
    const html = buildImageFrameHtml("file:///tmp/banner.png", "natural");

    expect(html).toContain("img { display: block; width: 100%; height: auto; }");
    expect(html).toContain("body { overflow: visible; }");
    expect(html).toContain("background: transparent");
    expect(html).not.toContain("object-fit: cover");
    expect(html).not.toContain("height: 100%");
  });
});

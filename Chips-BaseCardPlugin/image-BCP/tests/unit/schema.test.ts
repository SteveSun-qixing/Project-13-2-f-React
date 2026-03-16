import { describe, expect, it } from "vitest";
import {
  normalizeBasecardConfig,
  validateBasecardConfig,
} from "../../src/schema/card-config";

describe("image basecard schema", () => {
  it("normalizes root-relative resource paths and layout defaults", () => {
    const normalized = normalizeBasecardConfig({
      card_type: "base.image",
      images: [
        {
          id: "image-1",
          source: "file",
          file_path: "./cover.png",
        },
      ],
      layout_type: "grid",
    });

    expect(normalized.images[0]?.file_path).toBe("cover.png");
    expect(normalized.layout_options?.grid_mode).toBe("2x2");
    expect(normalized.layout_options?.spacing_mode).toBe("comfortable");
  });

  it("coerces multi-image single layout requests to grid", () => {
    const normalized = normalizeBasecardConfig({
      card_type: "base.image",
      images: [
        {
          id: "image-1",
          source: "url",
          url: "https://example.com/1.png",
        },
        {
          id: "image-2",
          source: "url",
          url: "https://example.com/2.png",
        },
      ],
      layout_type: "single",
    });

    expect(normalized.layout_type).toBe("grid");
  });

  it("maps legacy zero-gap input to the zero-spacing mode", () => {
    const normalized = normalizeBasecardConfig({
      card_type: "base.image",
      images: [
        {
          id: "image-1",
          source: "url",
          url: "https://example.com/1.png",
        },
        {
          id: "image-2",
          source: "url",
          url: "https://example.com/2.png",
        },
      ],
      layout_type: "grid",
      layout_options: {
        gap: 0,
      },
    });

    expect(normalized.layout_options?.spacing_mode).toBe("none");
  });

  it("treats an empty image list as a valid initial draft", () => {
    const result = validateBasecardConfig(
      normalizeBasecardConfig({
        card_type: "base.image",
        images: [],
        layout_type: "single",
      }),
    );

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it("rejects invalid remote image URLs", () => {
    const result = validateBasecardConfig(
      normalizeBasecardConfig({
        card_type: "base.image",
        images: [
          {
            id: "image-1",
            source: "url",
            url: "javascript:alert(1)",
          },
        ],
        layout_type: "single",
      }),
    );

    expect(result.valid).toBe(false);
    expect(result.errors["images.0.url"]).toContain("URL");
  });
});

import { describe, it, expect } from "vitest";
import { mountBasecardView } from "../../src/render/runtime";
import type { BasecardConfig } from "../../src/schema/card-config";

function createConfig(overrides?: Partial<BasecardConfig>): BasecardConfig {
  return {
    card_type: "ScoreCard",
    style: "stars",
    score: 0,
    total_score: 5,
    locale: "zh-CN",
    theme: "",
    ...overrides,
  };
}

describe("mountBasecardView", () => {
  it("renders active and inactive stars through Rate without an outer shell", () => {
    const container = document.createElement("div");

    const dispose = mountBasecardView({
      container,
      config: createConfig({ score: 3 }),
    });
    const surface = container.querySelector(".chips-score-card__surface") as HTMLElement | null;
    const rating = container.querySelector(".chips-score-card__rating") as HTMLElement | null;
    const items = Array.from(container.querySelectorAll(".ant-rate-star"));
    const activeItems = container.querySelectorAll(".ant-rate-star-full");
    const checkedItems = container.querySelectorAll(
      '.ant-rate-star div[role="radio"][aria-checked="true"]',
    );

    expect(rating).not.toBeNull();
    expect(rating?.classList.contains("ant-rate-disabled")).toBe(true);
    expect(rating?.getAttribute("aria-labelledby")).toBeTruthy();
    expect(items).toHaveLength(5);
    expect(activeItems).toHaveLength(3);
    expect(checkedItems).toHaveLength(3);
    expect(surface).not.toBeNull();
    expect(surface?.classList.contains("chips-score-card__surface--symbols")).toBe(true);
    expect(container.querySelectorAll('.ant-rate-star div[role="radio"]')).toHaveLength(5);
    expect(surface?.style.backgroundColor).toBe("");
    expect(surface?.style.border).toBe("");

    dispose();
    expect(container.childElementCount).toBe(0);
  });

  it("renders hearts through Rate with the heart shape and the accessible label", () => {
    const container = document.createElement("div");

    const dispose = mountBasecardView({
      container,
      config: createConfig({ style: "hearts", score: 2 }),
    });
    const rating = container.querySelector(
      ".chips-score-card__rating--hearts",
    ) as HTMLElement | null;
    const checkedItems = container.querySelectorAll(
      '.ant-rate-star div[role="radio"][aria-checked="true"]',
    );

    expect(rating).not.toBeNull();
    expect(rating?.getAttribute("aria-labelledby")).toBeTruthy();
    expect(checkedItems).toHaveLength(2);
    expect(container.querySelectorAll('svg[data-icon="heart"]')).toHaveLength(10);
    expect(container.querySelector(".chips-score-card__sr-only")?.textContent).toBe("2 / 5 分");

    dispose();
  });

  it("renders score style as a number pair", () => {
    const container = document.createElement("div");

    const dispose = mountBasecardView({
      container,
      config: createConfig({
        style: "score",
        score: 7.5,
        total_score: 10,
      }),
    });
    const numeric = container.querySelector(".chips-score-card__numeric") as HTMLElement | null;

    expect(container.querySelector(".chips-score-card__numeric-score")?.textContent).toBe("7.5");
    expect(container.querySelector(".chips-score-card__numeric-total")?.textContent).toBe("10");
    expect(container.querySelector(".chips-score-card__numeric-separator")?.textContent).toBe("/");
    expect(numeric?.getAttribute("role")).toBe("img");
    expect(numeric?.getAttribute("aria-label")).toBe("7.5 / 10 分");

    dispose();
  });

  it("renders progress through Progress according to score ratio", () => {
    const container = document.createElement("div");

    const dispose = mountBasecardView({
      container,
      config: createConfig({
        style: "progress",
        score: 4,
        total_score: 8,
      }),
    });
    const progress = container.querySelector(
      ".chips-score-card__progress-control",
    ) as HTMLElement | null;
    const track = container.querySelector(
      ".chips-score-card__progress-control .ant-progress-track",
    ) as HTMLElement | null;

    expect(progress?.getAttribute("role")).toBe("progressbar");
    expect(progress?.getAttribute("aria-valuenow")).toBe("50");
    expect(progress?.getAttribute("aria-valuemin")).toBe("0");
    expect(progress?.getAttribute("aria-valuemax")).toBe("100");
    expect(progress?.getAttribute("aria-valuetext")).toBe("50%");
    expect(track?.style.width).toBe("50%");
    expect(container.querySelector(".chips-score-card__sr-only")?.textContent).toBe("4 / 8 分");
    expect(container.querySelector(".chips-score-card__progress-score")?.textContent).toBe("4 / 8");
    expect(container.querySelector(".chips-score-card__progress-percent")?.textContent).toBe("50%");

    dispose();
  });

  it("injects only plugin styles and removes the mounted view on cleanup", () => {
    const container = document.createElement("div");

    const dispose = mountBasecardView({
      container,
      config: createConfig({ score: 1 }),
    });
    const style = container.querySelector("style");

    expect(style?.textContent).toContain(".chips-score-card");
    expect(style?.textContent ?? "").not.toContain("--chips-");
    expect(container.querySelector('[data-chips-basecard-view-root="true"]')).not.toBeNull();

    dispose();

    expect(container.childElementCount).toBe(0);
  });
});

import { describe, it, expect } from "vitest";
import { mountBasecardEditor } from "../../src/editor/runtime";
import { createBasecardEditorRoot } from "../../src/editor/panel";
import type { BasecardConfig } from "../../src/schema/card-config";

function createConfig(overrides?: Partial<BasecardConfig>): BasecardConfig {
  return {
    card_type: "ScoreCard",
    style: "stars",
    score: 2,
    total_score: 5,
    locale: "zh-CN",
    theme: "",
    ...overrides,
  };
}

function setNumberInputValue(input: HTMLInputElement, value: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  );
  descriptor?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function clickRatingStar(root: HTMLElement, index: number): void {
  const star = root.querySelectorAll(
    ".ant-rate-star div[role='radio']",
  )[index] as HTMLElement | undefined;
  if (!star) {
    throw new Error(`找不到第 ${index + 1} 个评分项`);
  }
  star.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

function pressKey(target: Element, key: string, keyCode?: number): void {
  target.dispatchEvent(
    new KeyboardEvent("keydown", {
      bubbles: true,
      key,
      keyCode,
    }),
  );
}

async function pressKeyWithFlush(target: Element, key: string, keyCode?: number): Promise<void> {
  pressKey(target, key, keyCode);
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function findSegmentedItem(root: HTMLElement, label: string): HTMLElement | undefined {
  const item = Array.from(root.querySelectorAll(".ant-segmented-item")).find(
    (candidate) => candidate.querySelector(".ant-segmented-item-label")?.textContent === label,
  );
  return item instanceof HTMLElement ? item : undefined;
}

describe("createBasecardEditorRoot", () => {
  it("emits five-point symbol scores when a rating star is clicked", () => {
    let lastConfig: BasecardConfig | undefined;
    const root = createBasecardEditorRoot({
      initialConfig: createConfig(),
      onChange: (next) => {
        lastConfig = next;
      },
    });

    const rating = root.querySelector(".chips-score-editor__rating") as HTMLElement | null;

    expect(rating).not.toBeNull();
    expect(root.querySelectorAll(".ant-rate-star div[role='radio']")).toHaveLength(5);

    clickRatingStar(root, 4);

    expect(lastConfig?.score).toBe(5);
    expect(lastConfig?.total_score).toBe(5);
    expect(lastConfig?.card_type).toBe("ScoreCard");
  });

  it("shows numeric inputs for progress style and emits normalized values", () => {
    let lastConfig: BasecardConfig | undefined;
    const root = createBasecardEditorRoot({
      initialConfig: createConfig({
        style: "score",
        score: 6,
        total_score: 10,
      }),
      onChange: (next) => {
        lastConfig = next;
      },
    });

    const progressItem = findSegmentedItem(root, "进度条");
    const progressInput = progressItem?.querySelector(
      ".ant-segmented-item-input",
    ) as HTMLInputElement | undefined;
    if (!progressInput) {
      throw new Error("找不到进度条样式按钮");
    }

    progressInput.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    const numberInputs = Array.from(
      root.querySelectorAll(".chips-score-editor__number-input input"),
    ) as HTMLInputElement[];
    const totalInput = numberInputs[0];
    const scoreInput = numberInputs[1];
    if (!totalInput || !scoreInput) {
      throw new Error("找不到分数输入框");
    }

    setNumberInputValue(totalInput, "20");
    setNumberInputValue(scoreInput, "15");

    expect(lastConfig?.style).toBe("progress");
    expect(lastConfig?.total_score).toBe(20);
    expect(lastConfig?.score).toBe(15);

    const numberFields = Array.from(
      root.querySelectorAll(".chips-score-editor__number-field"),
    ) as HTMLElement[];
    for (const field of numberFields) {
      const label = field.querySelector("label");
      const input = field.querySelector("input");
      expect(label?.htmlFor).toBeTruthy();
      expect(label?.htmlFor).toBe(input?.id);
    }
  });

  it("shows a big numeric preview matching the view style for score style", () => {
    const root = createBasecardEditorRoot({
      initialConfig: createConfig({
        style: "score",
        score: 6,
        total_score: 10,
      }),
      onChange: () => {},
    });

    const preview = root.querySelector(
      ".chips-score-editor__preview-numeric",
    ) as HTMLElement | null;

    expect(preview).not.toBeNull();
    expect(preview?.getAttribute("role")).toBe("img");
    expect(preview?.getAttribute("aria-label")).toBe("6 / 10 分");
    expect(
      root.querySelector(".chips-score-editor__preview-numeric-score")?.textContent,
    ).toBe("6");
    expect(
      root.querySelector(".chips-score-editor__preview-numeric-total")?.textContent,
    ).toBe("10");
    expect(
      root.querySelector(".chips-score-editor__preview-numeric-separator")?.textContent,
    ).toBe("/");
  });

  it("supports Home and End keyboard jumps on the rating", async () => {
    let lastConfig: BasecardConfig | undefined;
    const root = createBasecardEditorRoot({
      initialConfig: createConfig({ score: 3 }),
      onChange: (next) => {
        lastConfig = next;
      },
    });

    const rating = root.querySelector(".chips-score-editor__rating") as HTMLElement | null;
    if (!rating) {
      throw new Error("找不到评分控件");
    }

    await pressKeyWithFlush(rating, "End", 35);

    expect(lastConfig?.score).toBe(5);
    expect(lastConfig?.total_score).toBe(5);

    await pressKeyWithFlush(rating, "Home", 36);

    expect(lastConfig?.score).toBe(1);
    expect(lastConfig?.total_score).toBe(5);
  });

  it("supports keyboard rating updates through Rate", async () => {
    let lastConfig: BasecardConfig | undefined;
    const root = createBasecardEditorRoot({
      initialConfig: createConfig({ score: 2 }),
      onChange: (next) => {
        lastConfig = next;
      },
    });

    const rating = root.querySelector(".chips-score-editor__rating") as HTMLElement | null;
    if (!rating) {
      throw new Error("找不到评分控件");
    }

    for (let index = 0; index < 3; index += 1) {
      await pressKeyWithFlush(rating, "ArrowRight", 39);
    }

    expect(lastConfig?.score).toBe(5);
    expect(lastConfig?.total_score).toBe(5);
  });

  it("supports keyboard style switching through Segmented", async () => {
    let lastConfig: BasecardConfig | undefined;
    const root = createBasecardEditorRoot({
      initialConfig: createConfig({ style: "stars", score: 2 }),
      onChange: (next) => {
        lastConfig = next;
      },
    });

    const segmentedInput = root.querySelector(
      ".ant-segmented-item-input",
    ) as HTMLInputElement | null;
    if (!segmentedInput) {
      throw new Error("找不到样式切换控件");
    }

    for (let index = 0; index < 3; index += 1) {
      await pressKeyWithFlush(segmentedInput, "ArrowRight");
    }

    expect(lastConfig?.style).toBe("progress");
    expect(lastConfig?.total_score).toBe(5);
  });

  it("restores host document styles and clears the editor root on cleanup", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    document.documentElement.style.height = "77px";
    document.body.style.overflow = "auto";
    container.style.display = "block";
    container.style.width = "33px";

    const dispose = mountBasecardEditor({
      container,
      initialConfig: createConfig(),
      onChange: () => {},
    });

    expect(container.querySelector('[data-chips-basecard-editor-root="true"]')).not.toBeNull();
    expect(document.documentElement.style.height).toBe("100%");
    expect(document.body.style.overflow).toBe("hidden");
    expect(container.style.display).toBe("flex");

    dispose();

    expect(container.childElementCount).toBe(0);
    expect(document.documentElement.style.height).toBe("77px");
    expect(document.body.style.overflow).toBe("auto");
    expect(container.style.display).toBe("block");
    expect(container.style.width).toBe("33px");

    document.body.removeChild(container);
    document.documentElement.removeAttribute("style");
    document.body.removeAttribute("style");
  });
});

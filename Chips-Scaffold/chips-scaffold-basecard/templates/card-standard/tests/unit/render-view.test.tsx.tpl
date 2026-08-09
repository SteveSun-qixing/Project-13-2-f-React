import { describe, it, expect, vi } from "vitest";
import { mountBasecardView } from "../../src/render/runtime";
import type { BasecardConfig } from "../../src/schema/card-config";

async function waitForEffects(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

async function waitForAssertion(assertion: () => void): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await waitForEffects();
    }
  }
  throw lastError;
}

function findButtonByText(root: ParentNode, text: string): HTMLButtonElement | null {
  return Array.from(root.querySelectorAll("button")).find((button) =>
    button.textContent?.includes(text),
  ) ?? null;
}

describe("mountBasecardView", () => {
  it("renders title, body and resource bridge actions through the React runtime", async () => {
    const container = document.createElement("div");
    const config: BasecardConfig = {
      card_type: "{{ CARD_TYPE }}",
      title: "Hello",
      body: "World",
      locale: "zh-CN",
      theme: "",
      resource_path: "assets/cover.png",
    };
    const resolveResourceUrl = vi.fn(async (resourcePath: string) => `blob:card/${resourcePath}`);
    const releaseResourceUrl = vi.fn();
    const openResource = vi.fn();

    const dispose = mountBasecardView({
      container,
      config,
      resolveResourceUrl,
      releaseResourceUrl,
      openResource,
    });
    await waitForEffects();

    const titleEl = container.querySelector(".chips-basecard__title");
    const bodyEl = container.querySelector(".chips-basecard__body");

    expect(titleEl?.textContent).toBe("Hello");
    expect(bodyEl?.textContent).toBe("World");
    expect(resolveResourceUrl).toHaveBeenCalledWith("assets/cover.png");
    await waitForAssertion(() => {
      expect(findButtonByText(container, "打开资源")).toBeTruthy();
    });
    const openButton = findButtonByText(container, "打开资源");
    expect(openButton).toBeTruthy();
    expect(container.querySelector(".chips-basecard__surface")).toBeNull();
    expect(container.querySelector('[data-chips-basecard-view-root="true"]')).toBeTruthy();
    expect(container.innerHTML).not.toContain("box-shadow");
    expect(container.innerHTML).not.toContain("radial-gradient");
    expect(container.innerHTML).not.toContain("rgba(");

    openButton?.click();
    expect(openResource).toHaveBeenCalledWith({
      resourceId: "assets/cover.png",
      title: "Hello",
      payload: {
        cardType: "{{ CARD_TYPE }}",
        resourcePath: "assets/cover.png",
      },
    });

    dispose();
    expect(releaseResourceUrl).toHaveBeenCalledWith("assets/cover.png");
  });

  it("cleans the previous React root before repeated mount", () => {
    const container = document.createElement("div");
    const firstConfig: BasecardConfig = {
      card_type: "{{ CARD_TYPE }}",
      title: "First",
      body: "Body",
      locale: "zh-CN",
      theme: "",
    };
    const secondConfig: BasecardConfig = {
      ...firstConfig,
      title: "Second",
    };

    const firstDispose = mountBasecardView({
      container,
      config: firstConfig,
    });
    const secondDispose = mountBasecardView({
      container,
      config: secondConfig,
    });

    firstDispose();
    expect(container.querySelectorAll("[data-chips-basecard-view-root]")).toHaveLength(1);
    expect(container.querySelector(".chips-basecard__title")?.textContent).toBe("Second");

    secondDispose();
    expect(container.childElementCount).toBe(0);
  });
});

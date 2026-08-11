import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import { createSrcDocDocument, type WebpageViewportPayload } from "../../src/shared/resource-loader";

function createViewportPayload(overrides?: Partial<WebpageViewportPayload>): WebpageViewportPayload {
  return {
    version: 1,
    displayMode: "free",
    fixedRatio: "7:16",
    width: 640,
    height: 720,
    baseHeight: 160,
    maxHeight: 12800,
    scrollMode: false,
    ...overrides,
  };
}

async function waitForLoad(dom: JSDOM): Promise<void> {
  if (dom.window.document.readyState === "complete") {
    await new Promise<void>((resolve) => {
      dom.window.setTimeout(() => resolve(), 0);
    });
    return;
  }

  await new Promise<void>((resolve) => {
    dom.window.addEventListener("load", () => {
      dom.window.setTimeout(() => resolve(), 0);
    }, { once: true });
  });
}

async function waitForVisualFrame(dom: JSDOM): Promise<void> {
  await new Promise<void>((resolve) => {
    if (typeof dom.window.requestAnimationFrame === "function") {
      dom.window.requestAnimationFrame(() => {
        dom.window.setTimeout(() => resolve(), 0);
      });
      return;
    }

    dom.window.setTimeout(() => resolve(), 0);
  });
}

describe("createSrcDocDocument", () => {
  it("stabilizes bundled viewport units and innerHeight reads for free mode pages", async () => {
    const html = `
      <!doctype html>
      <html>
        <head>
          <style>
            .hero {
              min-height: 100vh;
              height: calc(50vh - 12px);
            }
          </style>
        </head>
        <body>
          <main class="hero">bundle</main>
          <script>
            window.__CHIPS_TEST_INNER_HEIGHT__ = window.innerHeight;
          </script>
        </body>
      </html>
    `;

    const srcDoc = createSrcDocDocument(
      html,
      "file:///workspace/card/web-bundle/",
      createViewportPayload({ height: 720 }),
    );

    const dom = new JSDOM(srcDoc, {
      runScripts: "dangerously",
      resources: "usable",
      url: "file:///workspace/card/web-bundle/index.html",
      pretendToBeVisual: true,
    });

    await waitForLoad(dom);

    const styleRule = dom.window.document.styleSheets[0]?.cssRules[0] as CSSStyleRule | undefined;
    expect(styleRule?.style.minHeight).toContain("--chips-webpage-card-virtual-vh");
    expect(styleRule?.style.height).toContain("--chips-webpage-card-virtual-vh");
    expect(dom.window.document.documentElement.style.getPropertyValue("--chips-webpage-card-virtual-vh")).toBe("7.2px");
    expect((dom.window as typeof dom.window & { __CHIPS_TEST_INNER_HEIGHT__?: number }).__CHIPS_TEST_INNER_HEIGHT__).toBe(720);
    await waitForVisualFrame(dom);
    await waitForVisualFrame(dom);
  });
});

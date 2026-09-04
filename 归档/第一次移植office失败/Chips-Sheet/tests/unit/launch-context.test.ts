import { afterEach, describe, expect, it } from "vitest";
import {
  createMockChipsClient,
  createMockLaunchContext,
  createMockSurfaceContext,
  type MockChipsClient,
} from "chips-sdk/testing";
import { readLaunchContext } from "../../src/runtime/launch-context";

let client: MockChipsClient | null = null;

afterEach(() => {
  client?.restoreBridge();
  client = null;
});

describe("启动上下文归一化", () => {
  it("合并 surfaceContext.launchParams，并让顶层参数覆盖同名值", () => {
    const surfaceContext = createMockSurfaceContext({
      launchParams: {
        resourceOpen: { resourceId: "surface.xlsx" },
        source: "surface",
      },
    });
    client = createMockChipsClient({
      launchContext: createMockLaunchContext({
        surfaceContext,
        launchParams: {
          resourceOpen: { resourceId: "top-level.xlsx" },
          source: "top-level",
        },
      }),
    });

    const context = readLaunchContext(client);
    expect(context.launchParams).toEqual({
      resourceOpen: { resourceId: "top-level.xlsx" },
      source: "top-level",
    });
  });
});

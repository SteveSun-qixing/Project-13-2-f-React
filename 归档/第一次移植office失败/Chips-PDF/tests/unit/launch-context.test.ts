import { describe, expect, it, vi } from "vitest";
import type { Client } from "chips-sdk";
import { readLaunchContext } from "../../src/runtime/launch-context";

describe("readLaunchContext", () => {
  it("合并 surface 与 launch 参数，并让 launch 参数优先", () => {
    const client = {
      platform: {
        getLaunchContext: vi.fn(() => ({
          pluginId: "com.chips.pdf",
          launchParams: {
            resourceOpen: {
              resourceId: "chips-resource://pdf/launch",
            },
            source: "launch",
          },
          surfaceContext: {
            pluginId: "com.chips.pdf",
            sceneId: "start",
            kind: "window",
            launchParams: {
              resourceOpen: {
                resourceId: "chips-resource://pdf/surface",
              },
              surfaceOnly: true,
              source: "surface",
            },
          },
        })),
      },
    } as unknown as Client;

    const context = readLaunchContext(client);

    expect(context.launchParams).toEqual({
      resourceOpen: {
        resourceId: "chips-resource://pdf/launch",
      },
      surfaceOnly: true,
      source: "launch",
    });
  });
});

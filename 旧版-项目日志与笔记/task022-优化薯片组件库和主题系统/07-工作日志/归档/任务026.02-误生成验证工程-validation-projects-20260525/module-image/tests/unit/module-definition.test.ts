import { describe, expect, it, vi } from "vitest";
import moduleDefinition from "../../src";

describe("module definition", () => {
  it("exposes the configured image processing capability", async () => {
    expect(moduleDefinition.providers[0]?.capability).toBe("module.module.image");
    expect(moduleDefinition.providers[0]?.methods.process).toBeTypeOf("function");
  });

  it("reads image bytes through Host file actions", async () => {
    const reportProgress = vi.fn().mockResolvedValue(undefined);
    const hostInvoke = vi.fn(async (action: string) => {
      if (action === "file.stat") {
        return { meta: { isFile: true, size: 4 } };
      }
      if (action === "file.read") {
        return { content: [1, 2, 3, 4] };
      }
      throw new Error(`unexpected action: ${action}`);
    });

    const output = await moduleDefinition.providers[0]?.methods.process(
      {
        host: {
          invoke: hostInvoke,
        },
        job: {
          reportProgress,
        },
      },
      {
        imagePath: "/workspace/image.png",
      }
    );

    expect(hostInvoke).toHaveBeenCalledWith("file.read", {
      path: "/workspace/image.png",
      options: {
        encoding: "binary",
      },
    });
    expect(output).toEqual({
      imagePath: "/workspace/image.png",
      byteLength: 4,
      signature: expect.stringMatching(/^[0-9a-f]{8}$/),
      handledBy: "chips.module.module.image",
    });
  });
});

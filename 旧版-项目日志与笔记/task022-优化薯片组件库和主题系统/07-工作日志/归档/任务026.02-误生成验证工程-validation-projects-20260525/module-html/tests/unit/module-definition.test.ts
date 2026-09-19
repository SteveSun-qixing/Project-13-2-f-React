import { describe, expect, it, vi } from "vitest";
import moduleDefinition from "../../src";

describe("module definition", () => {
  it("exposes the configured html rendering capability", async () => {
    expect(moduleDefinition.providers[0]?.capability).toBe("module.module.html");
    expect(moduleDefinition.providers[0]?.methods.convert).toBeTypeOf("function");
  });

  it("routes image rendering through Host platform action", async () => {
    const reportProgress = vi.fn().mockResolvedValue(undefined);
    const hostInvoke = vi.fn(async (action: string, payload?: { path?: string }) => {
      if (action === "file.stat" && payload?.path === "/workspace/export") {
        return { meta: { isDirectory: true } };
      }
      if (action === "file.stat" && payload?.path === "/workspace/export/index.html") {
        return { meta: { isFile: true } };
      }
      if (action === "platform.renderHtmlToImage") {
        return { outputFile: "/workspace/output.png", format: "png" };
      }
      throw new Error(`unexpected action: ${action}`);
    });

    const output = await moduleDefinition.providers[0]?.methods.convert(
      {
        host: {
          invoke: hostInvoke,
        },
        job: {
          reportProgress,
        },
      },
      {
        htmlDir: "/workspace/export",
        outputFile: "/workspace/output.png",
        options: {
          target: "image",
          image: {
            format: "png",
          },
        },
      }
    );

    expect(hostInvoke).toHaveBeenCalledWith("platform.renderHtmlToImage", {
      htmlDir: "/workspace/export",
      entryFile: "index.html",
      outputFile: "/workspace/output.png",
      options: {
        format: "png",
      },
    });
    expect(reportProgress).toHaveBeenLastCalledWith({
      stage: "completed",
      percent: 100,
    });
    expect(output).toEqual({
      outputFile: "/workspace/output.png",
      target: "image",
      format: "png",
      handledBy: "chips.module.module.html",
      warnings: [],
    });
  });
});

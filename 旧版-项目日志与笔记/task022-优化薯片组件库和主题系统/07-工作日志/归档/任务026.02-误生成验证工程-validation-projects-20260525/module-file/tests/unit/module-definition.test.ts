import { describe, expect, it, vi } from "vitest";
import moduleDefinition from "../../src";

describe("module definition", () => {
  it("exposes the configured file conversion capability", async () => {
    expect(moduleDefinition.providers[0]?.capability).toBe("module.module.file");
    expect(moduleDefinition.providers[0]?.methods.convert).toBeTypeOf("function");
  });

  it("converts a source file through Host file actions", async () => {
    const reportProgress = vi.fn().mockResolvedValue(undefined);
    const hostInvoke = vi.fn(async (action: string, payload?: { path?: string }) => {
      if (action === "file.stat" && payload?.path === "/workspace/input.txt") {
        return { meta: { isFile: true, size: 12 } };
      }
      if (action === "file.stat" && payload?.path === "/workspace/output.json") {
        throw new Error("not found");
      }
      if (action === "file.write") {
        return { ack: true };
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
        sourceFile: "/workspace/input.txt",
        output: {
          path: "/workspace/output.json",
        },
      }
    );

    expect(hostInvoke).toHaveBeenCalledWith("file.write", {
      path: "/workspace/output.json",
      content: expect.stringContaining('"handledBy": "chips.module.module.file"'),
    });
    expect(reportProgress).toHaveBeenLastCalledWith({
      stage: "completed",
      percent: 100,
    });
    expect(output).toEqual({
      outputPath: "/workspace/output.json",
      artifacts: [
        {
          type: "conversion-report",
          path: "/workspace/output.json",
          mimeType: "application/json",
        },
      ],
      handledBy: "chips.module.module.file",
      warnings: [],
    });
  });
});

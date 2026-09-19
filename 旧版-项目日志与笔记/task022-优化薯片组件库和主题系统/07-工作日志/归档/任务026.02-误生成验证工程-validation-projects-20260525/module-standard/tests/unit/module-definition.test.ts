import { describe, expect, it, vi } from "vitest";
import moduleDefinition from "../../src";

describe("module definition", () => {
  it("exposes the configured capability and sync method", async () => {
    expect(moduleDefinition.providers[0]?.capability).toBe("module.module.standard");

    const output = await moduleDefinition.providers[0]?.methods.run(
      {},
      {
        sourceText: "hello",
        uppercase: true,
        prefix: "[demo] ",
      }
    );

    expect(output).toEqual({
      text: "[demo] HELLO",
      length: 12,
      handledBy: "chips.module.module.standard",
    });
  });

  it("reports progress for async job methods", async () => {
    const reportProgress = vi.fn().mockResolvedValue(undefined);

    const output = await moduleDefinition.providers[0]?.methods.runAsync(
      {
        job: {
          reportProgress,
        },
      },
      {
        sourceText: "async",
        delayMs: 1,
      }
    );

    expect(reportProgress).toHaveBeenCalledTimes(2);
    expect(reportProgress).toHaveBeenNthCalledWith(1, {
      stage: "started",
      percent: 10,
    });
    expect(reportProgress).toHaveBeenNthCalledWith(2, {
      stage: "completed",
      percent: 100,
    });
    expect(output).toEqual({
      text: "async",
      length: 5,
      handledBy: "chips.module.module.standard",
    });
  });
});

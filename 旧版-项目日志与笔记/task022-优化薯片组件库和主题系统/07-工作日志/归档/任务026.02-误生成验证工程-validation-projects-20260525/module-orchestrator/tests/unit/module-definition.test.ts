import { describe, expect, it, vi } from "vitest";
import moduleDefinition from "../../src";

describe("module definition", () => {
  it("exposes the configured orchestration capability", async () => {
    expect(moduleDefinition.providers[0]?.capability).toBe("module.module.orchestrator");
    expect(moduleDefinition.providers[0]?.methods.execute).toBeTypeOf("function");
  });

  it("invokes child module capabilities through ctx.module", async () => {
    const reportProgress = vi.fn().mockResolvedValue(undefined);
    const moduleInvoke = vi.fn().mockResolvedValue({
      mode: "sync",
      output: {
        ok: true,
      },
    });

    const output = await moduleDefinition.providers[0]?.methods.execute(
      {
        module: {
          invoke: moduleInvoke,
          job: {
            get: vi.fn(),
            cancel: vi.fn(),
          },
        },
        job: {
          reportProgress,
        },
      },
      {
        steps: [
          {
            capability: "module.example.step",
            method: "run",
            input: {
              value: "demo",
            },
          },
        ],
      }
    );

    expect(moduleInvoke).toHaveBeenCalledWith({
      capability: "module.example.step",
      method: "run",
      input: {
        value: "demo",
      },
    });
    expect(output).toEqual({
      results: [
        {
          capability: "module.example.step",
          method: "run",
          mode: "sync",
          output: {
            ok: true,
          },
        },
      ],
      handledBy: "chips.module.module.orchestrator",
    });
  });
});

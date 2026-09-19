import { describe, expect, it } from "vitest";
import moduleDefinition from "../../src";

describe("module definition", () => {
  it("exposes the configured capability and pure sync method", async () => {
    expect(moduleDefinition.providers[0]?.capability).toBe("module.module.pure");

    const output = await moduleDefinition.providers[0]?.methods.run(
      {},
      {
        value: " Hello ",
        caseMode: "upper",
      }
    );

    expect(output).toEqual({
      value: "HELLO",
      handledBy: "chips.module.module.pure",
    });
  });
});

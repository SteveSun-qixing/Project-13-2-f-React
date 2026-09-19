const sleep = async (ms: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, ms));
};

export interface RunInput {
  sourceText: string;
  uppercase?: boolean;
  prefix?: string;
}

export interface RunAsyncInput extends RunInput {
  delayMs?: number;
}

export interface RunOutput {
  text: string;
  length: number;
  handledBy: string;
}

const toOutput = (sourceText: string, uppercase?: boolean, prefix?: string): RunOutput => {
  const normalized = uppercase ? sourceText.toUpperCase() : sourceText;
  const text = `${prefix ?? ""}${normalized}`;
  return {
    text,
    length: text.length,
    handledBy: "chips.module.module.standard",
  };
};

const moduleDefinition = {
  providers: [
    {
      capability: "module.module.standard",
      methods: {
        async run(_ctx: unknown, input: RunInput): Promise<RunOutput> {
          return toOutput(input.sourceText, input.uppercase, input.prefix);
        },
        async runAsync(
          ctx: { job?: { reportProgress(payload: Record<string, unknown>): Promise<void> } },
          input: RunAsyncInput
        ): Promise<RunOutput> {
          await ctx.job?.reportProgress({
            stage: "started",
            percent: 10,
          });

          await sleep(typeof input.delayMs === "number" ? input.delayMs : 25);

          await ctx.job?.reportProgress({
            stage: "completed",
            percent: 100,
          });

          return toOutput(input.sourceText, input.uppercase, input.prefix);
        },
      },
    },
  ],
};

export default moduleDefinition;

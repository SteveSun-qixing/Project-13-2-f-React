export interface RunInput {
  value: string;
  trim?: boolean;
  caseMode?: "preserve" | "upper" | "lower";
}

export interface RunOutput {
  value: string;
  handledBy: string;
}

const normalizeValue = (input: RunInput): string => {
  const trimmed = input.trim === false ? input.value : input.value.trim();
  if (input.caseMode === "upper") {
    return trimmed.toUpperCase();
  }
  if (input.caseMode === "lower") {
    return trimmed.toLowerCase();
  }
  return trimmed;
};

const moduleDefinition = {
  providers: [
    {
      capability: "module.module.pure",
      methods: {
        async run(_ctx: unknown, input: RunInput): Promise<RunOutput> {
          return {
            value: normalizeValue(input),
            handledBy: "chips.module.module.pure",
          };
        },
      },
    },
  ],
};

export default moduleDefinition;

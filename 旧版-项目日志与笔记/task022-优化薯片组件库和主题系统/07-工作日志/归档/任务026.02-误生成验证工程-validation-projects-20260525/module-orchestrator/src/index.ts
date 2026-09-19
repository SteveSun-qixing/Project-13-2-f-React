export interface OrchestrationStep {
  capability: string;
  method: string;
  input: Record<string, unknown>;
}

export interface OrchestrationInput {
  steps: OrchestrationStep[];
}

export interface OrchestrationOutput {
  results: Array<{
    capability: string;
    method: string;
    mode: "sync" | "job";
    output?: unknown;
  }>;
  handledBy: string;
}

interface ModuleInvokeResult {
  mode: "sync" | "job";
  output?: unknown;
  jobId?: string;
}

interface JobSnapshot {
  job?: {
    status?: string;
    output?: unknown;
    error?: unknown;
  };
}

interface ModuleContext {
  module: {
    invoke(request: {
      capability: string;
      method: string;
      input: Record<string, unknown>;
    }): Promise<ModuleInvokeResult>;
    job: {
      get(jobId: string): Promise<JobSnapshot>;
      cancel(jobId: string): Promise<unknown>;
    };
  };
  job?: {
    reportProgress(payload: Record<string, unknown>): Promise<void>;
    isCancelled?(): boolean;
    signal?: { aborted?: boolean };
  };
}

class OrchestrationError extends Error {
  code: string;
  details?: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.name = "OrchestrationError";
    this.code = code;
    this.details = details;
  }
}

const sleep = async (ms: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, ms));
};

const requireSteps = (input: OrchestrationInput): OrchestrationStep[] => {
  if (!Array.isArray(input?.steps) || input.steps.length === 0) {
    throw new OrchestrationError("ORCHESTRATION_INPUT_INVALID", "steps must be a non-empty array.");
  }
  for (const [index, step] of input.steps.entries()) {
    if (
      !step ||
      typeof step.capability !== "string" ||
      step.capability.trim().length === 0 ||
      typeof step.method !== "string" ||
      step.method.trim().length === 0 ||
      !step.input ||
      typeof step.input !== "object" ||
      Array.isArray(step.input)
    ) {
      throw new OrchestrationError("ORCHESTRATION_INPUT_INVALID", "Each step must include capability, method and input.", {
        index,
      });
    }
  }
  return input.steps;
};

const throwIfCancelled = async (ctx: ModuleContext, jobId?: string): Promise<void> => {
  if (!ctx.job?.signal?.aborted && ctx.job?.isCancelled?.() !== true) {
    return;
  }
  if (jobId) {
    await ctx.module.job.cancel(jobId);
  }
  throw new OrchestrationError("ORCHESTRATION_JOB_CANCELLED", "Orchestration job was cancelled.");
};

const waitForJob = async (ctx: ModuleContext, step: OrchestrationStep, jobId: string): Promise<unknown> => {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    await throwIfCancelled(ctx, jobId);
    const snapshot = await ctx.module.job.get(jobId);
    const status = snapshot.job?.status;
    if (status === "completed") {
      return snapshot.job?.output;
    }
    if (status === "failed" || status === "cancelled") {
      throw new OrchestrationError("ORCHESTRATION_STEP_FAILED", `Child step failed: ${step.capability}`, {
        capability: step.capability,
        method: step.method,
        error: snapshot.job?.error,
      });
    }
    await sleep(25);
  }
  throw new OrchestrationError("ORCHESTRATION_STEP_TIMEOUT", `Child step timed out: ${step.capability}`, {
    capability: step.capability,
    method: step.method,
  });
};

const executePipeline = async (ctx: ModuleContext, input: OrchestrationInput): Promise<OrchestrationOutput> => {
  const steps = requireSteps(input);
  const results: OrchestrationOutput["results"] = [];

  for (const [index, step] of steps.entries()) {
    await throwIfCancelled(ctx);
    await ctx.job?.reportProgress({
      stage: "invoke-step",
      percent: Math.round((index / steps.length) * 90),
      capability: step.capability,
    });

    const invoked = await ctx.module.invoke({
      capability: step.capability,
      method: step.method,
      input: step.input,
    });

    if (invoked.mode === "sync") {
      results.push({
        capability: step.capability,
        method: step.method,
        mode: "sync",
        output: invoked.output,
      });
      continue;
    }

    if (invoked.mode === "job" && typeof invoked.jobId === "string") {
      const output = await waitForJob(ctx, step, invoked.jobId);
      results.push({
        capability: step.capability,
        method: step.method,
        mode: "job",
        output,
      });
      continue;
    }

    throw new OrchestrationError("ORCHESTRATION_STEP_FAILED", "Child step returned an invalid invoke result.", {
      step,
      invoked,
    });
  }

  await ctx.job?.reportProgress({
    stage: "completed",
    percent: 100,
  });

  return {
    results,
    handledBy: "chips.module.module.orchestrator",
  };
};

const moduleDefinition = {
  providers: [
    {
      capability: "module.module.orchestrator",
      methods: {
        async execute(ctx: ModuleContext, input: OrchestrationInput): Promise<OrchestrationOutput> {
          return executePipeline(ctx, input);
        },
      },
    },
  ],
};

export default moduleDefinition;

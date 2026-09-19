export interface FileConvertInput {
  sourceFile: string;
  output: {
    path: string;
    overwrite?: boolean;
  };
  options?: Record<string, unknown>;
}

export interface FileConvertOutput {
  outputPath: string;
  artifacts: Array<{
    type: string;
    path: string;
    mimeType?: string;
  }>;
  handledBy: string;
  warnings?: Array<{
    code: string;
    message: string;
    details?: unknown;
  }>;
}

interface HostFileStat {
  isFile?: boolean;
  isDirectory?: boolean;
  size?: number;
}

interface ModuleContext {
  host: {
    invoke<T = unknown>(action: string, payload?: unknown): Promise<T>;
  };
  job?: {
    reportProgress(payload: Record<string, unknown>): Promise<void>;
    isCancelled?(): boolean;
    signal?: { aborted?: boolean };
  };
}

class FileConversionError extends Error {
  code: string;
  details?: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.name = "FileConversionError";
    this.code = code;
    this.details = details;
  }
}

const toRecord = (value: unknown): Record<string, unknown> | undefined => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
};

const toFileStat = (value: unknown): HostFileStat | undefined => {
  const record = toRecord(value);
  if (!record) {
    return undefined;
  }
  return {
    isFile: typeof record.isFile === "boolean" ? record.isFile : undefined,
    isDirectory: typeof record.isDirectory === "boolean" ? record.isDirectory : undefined,
    size: typeof record.size === "number" ? record.size : undefined,
  };
};

const requireText = (value: unknown, field: string): string => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new FileConversionError("CONVERTER_INPUT_INVALID", `${field} must be a non-empty string.`, { field });
  }
  return value.trim();
};

const reportProgress = async (ctx: ModuleContext, stage: string, percent: number): Promise<void> => {
  await ctx.job?.reportProgress({
    stage,
    percent,
  });
};

const throwIfCancelled = (ctx: ModuleContext): void => {
  if (ctx.job?.signal?.aborted || ctx.job?.isCancelled?.() === true) {
    throw new FileConversionError("CONVERTER_JOB_CANCELLED", "File conversion job was cancelled.");
  }
};

const statPath = async (ctx: ModuleContext, filePath: string): Promise<HostFileStat | undefined> => {
  try {
    const result = await ctx.host.invoke<{ meta: unknown }>("file.stat", {
      path: filePath,
    });
    return toFileStat(result.meta);
  } catch {
    return undefined;
  }
};

const ensureSourceFile = async (ctx: ModuleContext, sourceFile: string): Promise<HostFileStat> => {
  const stat = await statPath(ctx, sourceFile);
  if (!stat?.isFile) {
    throw new FileConversionError("CONVERTER_INPUT_NOT_FOUND", `Source file does not exist: ${sourceFile}`, {
      sourceFile,
    });
  }
  return stat;
};

const ensureOutputPath = async (ctx: ModuleContext, outputPath: string, overwrite: boolean): Promise<void> => {
  const existing = await statPath(ctx, outputPath);
  if (!existing) {
    return;
  }

  if (!overwrite) {
    throw new FileConversionError("CONVERTER_OUTPUT_EXISTS", `Output already exists: ${outputPath}`, {
      outputPath,
    });
  }

  await ctx.host.invoke("file.delete", {
    path: outputPath,
    options: {
      recursive: true,
    },
  });
};

const convertFile = async (ctx: ModuleContext, input: FileConvertInput): Promise<FileConvertOutput> => {
  const sourceFile = requireText(input?.sourceFile, "sourceFile");
  const outputPath = requireText(input?.output?.path, "output.path");
  const overwrite = input.output.overwrite === true;

  await reportProgress(ctx, "prepare", 10);
  throwIfCancelled(ctx);

  const sourceStat = await ensureSourceFile(ctx, sourceFile);
  await ensureOutputPath(ctx, outputPath, overwrite);

  await reportProgress(ctx, "convert", 70);
  throwIfCancelled(ctx);

  const content = JSON.stringify(
    {
      sourceFile,
      sourceSize: sourceStat.size ?? null,
      convertedAt: new Date(0).toISOString(),
      handledBy: "chips.module.module.file",
      options: input.options ?? {},
    },
    null,
    2
  );

  await ctx.host.invoke("file.write", {
    path: outputPath,
    content,
  });

  await reportProgress(ctx, "completed", 100);

  return {
    outputPath,
    artifacts: [
      {
        type: "conversion-report",
        path: outputPath,
        mimeType: "application/json",
      },
    ],
    handledBy: "chips.module.module.file",
    warnings: [],
  };
};

const moduleDefinition = {
  providers: [
    {
      capability: "module.module.file",
      methods: {
        async convert(ctx: ModuleContext, input: FileConvertInput): Promise<FileConvertOutput> {
          return convertFile(ctx, input);
        },
      },
    },
  ],
};

export default moduleDefinition;

export interface HtmlRenderInput {
  htmlDir: string;
  entryFile?: string;
  outputFile: string;
  options: {
    target: "pdf" | "image";
    pdf?: Record<string, unknown>;
    image?: Record<string, unknown>;
  };
}

export interface HtmlRenderOutput {
  outputFile: string;
  target: "pdf" | "image";
  format?: string;
  pageCount?: number;
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

class HtmlRenderError extends Error {
  code: string;
  details?: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.name = "HtmlRenderError";
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
  };
};

const requireText = (value: unknown, field: string): string => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new HtmlRenderError("CONVERTER_INPUT_INVALID", `${field} must be a non-empty string.`, { field });
  }
  return value.trim();
};

const normalizeEntryFile = (entryFile: string | undefined): string => {
  const rawValue = (entryFile && entryFile.trim().length > 0 ? entryFile : "index.html").replace(/\\/g, "/");
  const parts: string[] = [];
  for (const segment of rawValue.split("/")) {
    if (!segment || segment === ".") {
      continue;
    }
    if (segment === "..") {
      if (parts.length === 0) {
        throw new HtmlRenderError("CONVERTER_INPUT_INVALID", "entryFile must stay inside htmlDir.", { entryFile });
      }
      parts.pop();
      continue;
    }
    parts.push(segment);
  }
  if (parts.length === 0 || rawValue.startsWith("/")) {
    throw new HtmlRenderError("CONVERTER_INPUT_INVALID", "entryFile must stay inside htmlDir.", { entryFile });
  }
  return parts.join("/");
};

const joinPath = (basePath: string, relativePath: string): string => {
  const separator = basePath.includes("\\") ? "\\" : "/";
  return `${basePath.replace(/[\\/]+$/, "")}${separator}${relativePath.replace(/\//g, separator)}`;
};

const reportProgress = async (ctx: ModuleContext, stage: string, percent: number): Promise<void> => {
  await ctx.job?.reportProgress({
    stage,
    percent,
  });
};

const throwIfCancelled = (ctx: ModuleContext): void => {
  if (ctx.job?.signal?.aborted || ctx.job?.isCancelled?.() === true) {
    throw new HtmlRenderError("CONVERTER_PIPELINE_CANCELLED", "HTML rendering job was cancelled.");
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

const normalizeOutput = (target: "pdf" | "image", hostResult: unknown, outputFile: string): HtmlRenderOutput => {
  const record = toRecord(hostResult);
  if (!record) {
    throw new HtmlRenderError("CONVERTER_RENDER_FAILED", "Host returned an invalid render result.", { hostResult });
  }

  const renderedOutputFile = typeof record.outputFile === "string" && record.outputFile.length > 0
    ? record.outputFile
    : outputFile;

  return {
    outputFile: renderedOutputFile,
    target,
    ...(typeof record.format === "string" ? { format: record.format } : {}),
    ...(typeof record.pageCount === "number" ? { pageCount: record.pageCount } : {}),
    handledBy: "chips.module.module.html",
    warnings: Array.isArray(record.warnings) ? record.warnings as HtmlRenderOutput["warnings"] : [],
  };
};

const renderHtml = async (ctx: ModuleContext, input: HtmlRenderInput): Promise<HtmlRenderOutput> => {
  const htmlDir = requireText(input?.htmlDir, "htmlDir");
  const outputFile = requireText(input?.outputFile, "outputFile");
  const entryFile = normalizeEntryFile(input.entryFile);
  const target = input.options?.target;
  if (target !== "pdf" && target !== "image") {
    throw new HtmlRenderError("CONVERTER_INPUT_INVALID", "options.target must be pdf or image.", {
      target,
    });
  }

  await reportProgress(ctx, "prepare", 10);
  throwIfCancelled(ctx);

  const htmlDirStat = await statPath(ctx, htmlDir);
  if (!htmlDirStat?.isDirectory) {
    throw new HtmlRenderError("CONVERTER_INPUT_NOT_FOUND", `htmlDir does not exist: ${htmlDir}`, { htmlDir });
  }
  const entryStat = await statPath(ctx, joinPath(htmlDir, entryFile));
  if (!entryStat?.isFile) {
    throw new HtmlRenderError("CONVERTER_INPUT_NOT_FOUND", `HTML entry file does not exist: ${entryFile}`, {
      htmlDir,
      entryFile,
    });
  }

  await reportProgress(ctx, target === "pdf" ? "render-pdf" : "render-image", 75);
  throwIfCancelled(ctx);

  const action = target === "pdf" ? "platform.renderHtmlToPdf" : "platform.renderHtmlToImage";
  const hostResult = await ctx.host.invoke(action, {
    htmlDir,
    entryFile,
    outputFile,
    options: target === "pdf" ? input.options.pdf ?? {} : input.options.image ?? {},
  });

  await reportProgress(ctx, "completed", 100);
  return normalizeOutput(target, hostResult, outputFile);
};

const moduleDefinition = {
  providers: [
    {
      capability: "module.module.html",
      methods: {
        async convert(ctx: ModuleContext, input: HtmlRenderInput): Promise<HtmlRenderOutput> {
          return renderHtml(ctx, input);
        },
      },
    },
  ],
};

export default moduleDefinition;

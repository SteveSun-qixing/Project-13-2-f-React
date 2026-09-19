export interface ImageProcessInput {
  imagePath: string;
  options?: {
    sampleSize?: number;
  };
}

export interface ImageProcessOutput {
  imagePath: string;
  byteLength: number;
  signature: string;
  handledBy: string;
}

interface HostFileStat {
  isFile?: boolean;
  size?: number;
}

interface ModuleContext {
  host: {
    invoke<T = unknown>(action: string, payload?: unknown): Promise<T>;
  };
  job?: {
    reportProgress(payload: Record<string, unknown>): Promise<void>;
  };
}

class ImageProcessingError extends Error {
  code: string;
  details?: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ImageProcessingError";
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
    size: typeof record.size === "number" ? record.size : undefined,
  };
};

const toBytes = (value: unknown): Uint8Array => {
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  if (Array.isArray(value) && value.every((item) => Number.isInteger(item) && item >= 0 && item <= 255)) {
    return Uint8Array.from(value);
  }
  const record = toRecord(value);
  if (record?.type === "Buffer" && Array.isArray(record.data)) {
    return Uint8Array.from(record.data as number[]);
  }
  if (record && "data" in record) {
    return toBytes(record.data);
  }
  if (typeof value === "string") {
    const bytes = new Uint8Array(value.length);
    for (let index = 0; index < value.length; index += 1) {
      bytes[index] = value.charCodeAt(index) & 0xff;
    }
    return bytes;
  }
  throw new ImageProcessingError("IMAGE_PROCESS_READ_FAILED", "Host file.read did not return binary content.");
};

const requireImagePath = (value: unknown): string => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ImageProcessingError("IMAGE_PROCESS_INPUT_INVALID", "imagePath is required.");
  }
  if (/^[a-zA-Z]+:\/\//.test(value.trim()) && !value.trim().startsWith("file://")) {
    throw new ImageProcessingError("IMAGE_PROCESS_INPUT_INVALID", "Only local paths or file:// URLs are supported.", {
      imagePath: value,
    });
  }
  return value.trim();
};

const buildSignature = (bytes: Uint8Array, sampleSize: number): string => {
  const limit = Math.min(bytes.length, sampleSize);
  let hash = 2166136261;
  for (let index = 0; index < limit; index += 1) {
    hash ^= bytes[index] ?? 0;
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
};

const processImage = async (ctx: ModuleContext, input: ImageProcessInput): Promise<ImageProcessOutput> => {
  const imagePath = requireImagePath(input?.imagePath);
  const sampleSize = typeof input.options?.sampleSize === "number"
    ? Math.max(16, Math.min(256, Math.round(input.options.sampleSize)))
    : 64;

  await ctx.job?.reportProgress({
    stage: "prepare",
    percent: 10,
  });

  const statResult = await ctx.host.invoke<{ meta: unknown }>("file.stat", {
    path: imagePath,
  });
  const stat = toFileStat(statResult.meta);
  if (!stat?.isFile) {
    throw new ImageProcessingError("IMAGE_PROCESS_INPUT_NOT_FOUND", `Image file does not exist: ${imagePath}`, {
      imagePath,
    });
  }

  const readResult = await ctx.host.invoke<{ content?: unknown }>("file.read", {
    path: imagePath,
    options: {
      encoding: "binary",
    },
  });
  const bytes = toBytes(readResult.content);

  await ctx.job?.reportProgress({
    stage: "completed",
    percent: 100,
  });

  return {
    imagePath,
    byteLength: stat.size ?? bytes.byteLength,
    signature: buildSignature(bytes, sampleSize),
    handledBy: "chips.module.module.image",
  };
};

const moduleDefinition = {
  providers: [
    {
      capability: "module.module.image",
      methods: {
        async process(ctx: ModuleContext, input: ImageProcessInput): Promise<ImageProcessOutput> {
          return processImage(ctx, input);
        },
      },
    },
  ],
};

export default moduleDefinition;

import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import moduleDefinition from "../../src";
import type { CommunityCardPublishContext } from "../../src/types";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const bytes = (value: string): number[] => Array.from(textEncoder.encode(value));

const createContext = (
  invokeImpl: (action: string, payload?: Record<string, unknown>) => Promise<unknown>,
  moduleImpl?: {
    invoke?: (request: {
      capability: string;
      method: string;
      input: Record<string, unknown>;
    }) => Promise<{ mode: "sync"; output: unknown } | { mode: "job"; jobId: string }>;
    job?: {
      get: (jobId: string) => Promise<unknown>;
      cancel?: (jobId: string) => Promise<void>;
    };
  },
): CommunityCardPublishContext => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  host: {
    invoke: vi.fn(async (action: string, payload?: Record<string, unknown>) => {
      return await invokeImpl(action, payload) as never;
    }) as unknown as CommunityCardPublishContext["host"]["invoke"],
  },
  ...(moduleImpl ? { module: moduleImpl } : {}),
  job: {
    id: "job-render-1",
    signal: new AbortController().signal,
    reportProgress: vi.fn().mockResolvedValue(undefined),
    isCancelled: vi.fn().mockReturnValue(false),
  },
});

const CARD_FILE = path.resolve("/tmp/demo.card");
const WORKSPACE = path.resolve("/tmp/render-upload-work");
const UNPACKED_DIR = path.join(WORKSPACE, "unpacked.card");
const VIEW_DIR = path.join(WORKSPACE, "render-artifacts", "view");
const COVER_DIR = path.join(WORKSPACE, "render-artifacts", "cover");

const CARD_METADATA = {
  name: "Demo Card",
  card_id: "AbCdEf1234",
  cover_ratio: "3:4",
};

const RENDERED_INDEX_HTML = "<!doctype html><html><head><title>Demo Card</title></head><body>rendered</body></html>";
const RENDERED_ASSET_JS = "console.log('render-asset');";
const CARD_COVER_HTML = "<!doctype html><html><body>cover</body></html>";
const COVER_ASSET_PNG = "fake-png-bytes";

interface MemoryFileSystem {
  [absolutePath: string]: number[];
}

interface UploadRecord {
  url: string;
  body: ArrayBuffer;
  headers?: Headers;
}

function createMemoryFs(initial: Record<string, number[]> = {}): MemoryFileSystem {
  return { ...initial };
}

function fsRead(fs: MemoryFileSystem, filePath: string): number[] {
  const normalized = path.normalize(filePath);
  const content = fs[normalized];
  if (content === undefined) {
    throw new Error(`file not found: ${filePath}`);
  }
  return content;
}

function fsWrite(fs: MemoryFileSystem, filePath: string, content: number[]): void {
  fs[path.normalize(filePath)] = content;
}

function fsList(fs: MemoryFileSystem, dir: string): Array<{ path: string; isFile: boolean; isDirectory: boolean }> {
  const normalizedRoot = path.normalize(dir).replace(/\/+$/, "");
  const entries: Array<{ path: string; isFile: boolean; isDirectory: boolean }> = [];
  for (const [filePath] of Object.entries(fs)) {
    if (filePath.startsWith(normalizedRoot + path.sep)) {
      entries.push({ path: filePath, isFile: true, isDirectory: false });
    }
  }
  return entries;
}

/** 构造 includeRenderArtifacts 上传的完整 host 模拟 */
function buildRenderUploadHostMock(fs: MemoryFileSystem) {
  return async (action: string, payload?: Record<string, unknown>): Promise<unknown> => {
    switch (action) {
      case "card.readInfo":
        return {
          info: {
            info: {
              metadata: CARD_METADATA,
            },
          },
        };
      case "zip.list":
        return {
          entries: [
            { path: ".card/metadata.yaml", size: 10, compressedSize: 10, offset: 0, isDirectory: false, compressionMethod: 0 },
            { path: "images/hero.png", size: 10, compressedSize: 10, offset: 1, isDirectory: false, compressionMethod: 0 },
          ],
        };
      case "card.unpack":
        return {};
      case "file.stat":
        return { meta: { size: 10, isFile: true, isDirectory: false } };
      case "file.list": {
        const dir = String(payload?.dir ?? "");
        return { entries: fsList(fs, dir) };
      }
      case "file.read": {
        const filePath = String(payload?.path ?? "");
        if (payload?.options?.encoding === "binary") {
          return { content: fsRead(fs, filePath) };
        }
        return { content: textDecoder.decode(new Uint8Array(fsRead(fs, filePath))) };
      }
      case "file.write": {
        const filePath = String(payload?.path ?? "");
        if (payload?.encoding === "binary") {
          fsWrite(fs, filePath, payload?.content as number[]);
        } else {
          fsWrite(fs, filePath, bytes(String(payload?.content ?? "")));
        }
        return {};
      }
      case "file.mkdir":
        return {};
      case "file.delete":
        return {};
      case "card.pack":
        if (payload?.outputPath) {
          fsWrite(fs, String(payload.outputPath), bytes("packed-card-bytes"));
        }
        return {};
      default:
        throw new Error(`unexpected host action: ${action}`);
    }
  };
}

function buildPresignAndUploadFetchMock(options: {
  uploads: UploadRecord[];
  completeBodies: Array<Record<string, unknown>>;
  sessionBodies: Array<Record<string, unknown>>;
  presignBodies: Array<Record<string, unknown>>;
}) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    const bodyText = String(init?.body ?? "");
    let body: Record<string, unknown> = {};
    if (bodyText.length > 0 && (bodyText.startsWith("{") || bodyText.startsWith("["))) {
      try {
        body = JSON.parse(bodyText) as Record<string, unknown>;
      } catch {
        body = {};
      }
    }

    if (url.endsWith("/api/v1/card-transfer/upload-sessions")) {
      options.sessionBodies.push(body);
      return new Response(
        JSON.stringify({
          data: {
            uploadId: "render-upload-1",
            cardId: "card-uuid-1",
            versionId: "render-version-1",
            expiresAt: "2026-08-06T01:00:00.000Z",
            resourcePrefix: "cards/card-uuid-1/versions/render-version-1/resources",
          },
        }),
        { status: 201, headers: { "content-type": "application/json" } },
      );
    }

    if (url.includes("/objects:presign")) {
      options.presignBodies.push(body);
      const objects = Array.isArray(body.objects) ? body.objects : [];
      return new Response(
        JSON.stringify({
          data: {
            objects: objects.map((object, index) => ({
              role: object?.role,
              relativePath: object?.relativePath ?? null,
              bucket: "chips-card-render-cache",
              objectKey: `card-uuid-1/render-version-1/${String(object?.relativePath ?? index)}`,
              publicUrl: `https://cdn.example/chips-card-render-cache/card-uuid-1/render-version-1/${String(object?.relativePath ?? index)}`,
              uploadUrl: `https://s3.example/put/${index}`,
              method: "PUT",
              headers: {},
            })),
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }

    if (url.includes("/complete")) {
      options.completeBodies.push(body);
      return new Response(
        JSON.stringify({
          data: {
            cardId: "card-uuid-1",
            versionId: "render-version-1",
            status: body.renderArtifacts ? "ready" : "pending",
            communityUrl: "https://personal.example/cards/card-uuid-1",
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }

    if (url.startsWith("https://s3.example/")) {
      options.uploads.push({
        url,
        body: await (init?.body as ArrayBuffer | undefined ?? new ArrayBuffer(0)),
        headers: init?.headers as Headers | undefined,
      });
      return new Response(null, { status: 200 });
    }

    throw new Error(`unexpected fetch url: ${url}`);
  });
}

describe("community uploader render artifacts mode", () => {
  it("renders and uploads view/cover artifacts when includeRenderArtifacts is enabled", async () => {
    const fs: MemoryFileSystem = {
      [path.join(UNPACKED_DIR, "content", "entry.yaml")]: bytes("content: []\n"),
      [path.join(UNPACKED_DIR, ".card", "cover.html")]: bytes(CARD_COVER_HTML),
      [path.join(UNPACKED_DIR, ".card", "cardcover", "cover-image.png")]: bytes(COVER_ASSET_PNG),
      // 模拟转换模块渲染输出的查看产物
      [path.join(VIEW_DIR, "index.html")]: bytes(RENDERED_INDEX_HTML),
      [path.join(VIEW_DIR, "assets", "app.js")]: bytes(RENDERED_ASSET_JS),
    };
    const uploads: UploadRecord[] = [];
    const completeBodies: Array<Record<string, unknown>> = [];
    const sessionBodies: Array<Record<string, unknown>> = [];
    const presignBodies: Array<Record<string, unknown>> = [];
    const moduleInvokeMock = vi.fn(async () => ({ mode: "job" as const, jobId: "render-job-1" }));
    const moduleJobGetMock = vi.fn(async () => ({ status: "completed", output: { outputPath: VIEW_DIR } }));
    const moduleInvokeCalls: Array<{ capability: string; method: string; input: Record<string, unknown> }> = [];

    const fetchMock = buildPresignAndUploadFetchMock({ uploads, completeBodies, sessionBodies, presignBodies });
    vi.stubGlobal("fetch", fetchMock);

    const ctx = createContext(
      buildRenderUploadHostMock(fs),
      {
        invoke: async (request: { capability: string; method: string; input: Record<string, unknown> }) => {
          moduleInvokeCalls.push(request);
          return moduleInvokeMock(request);
        },
        job: {
          get: moduleJobGetMock,
        },
      },
    );

    const provider = moduleDefinition.providers[0];
    const upload = provider?.methods.upload;
    expect(typeof upload).toBe("function");

    const result = await upload!(ctx, {
      cardFile: CARD_FILE,
      server: {
        baseUrl: "https://personal.example",
        accessToken: "token-1",
      },
      publish: {
        includeRenderArtifacts: true,
      },
      client: {
        name: "desktop-transfer",
        version: "1.0.0",
        platform: "desktop",
      },
      workspace: {
        tempDir: WORKSPACE,
      },
    });

    // 1. 会话创建带 includeRenderArtifacts
    expect(sessionBodies[0]).toMatchObject({
      includeRenderArtifacts: true,
    });

    // 2. 渲染模块被调用（converter.file.convert）
    expect(moduleInvokeCalls).toHaveLength(1);
    expect(moduleInvokeCalls[0]).toMatchObject({
      capability: "converter.file.convert",
      method: "convert",
      input: {
        source: { type: "card", path: CARD_FILE },
        target: { type: "html" },
        output: { path: VIEW_DIR, overwrite: true },
      },
    });
    expect(moduleJobGetMock).toHaveBeenCalledWith("render-job-1");

    // 3. 渲染产物（render-file）与封面产物（cover-file）参与预签名与上传
    expect(presignBodies.length).toBeGreaterThan(0);
    const renderPresign = presignBodies.find((body) =>
      Array.isArray(body.objects) && body.objects.some((object) => object?.role === "render-file"),
    );
    expect(renderPresign).toBeDefined();
    const renderObjects = renderPresign!.objects as Array<{ role: string; relativePath: string }>;
    expect(renderObjects.map((object) => `${object.role}:${object.relativePath}`)).toEqual(
      expect.arrayContaining(["render-file:index.html"]),
    );
    const coverObjects = presignBodies.flatMap((body) =>
      Array.isArray(body.objects) ? (body.objects as Array<{ role: string }>).filter((o) => o.role === "cover-file") : [],
    );
    expect(coverObjects.length).toBeGreaterThan(0);
    expect(uploads.length).toBeGreaterThan(0);

    // 4. complete 提交渲染产物摘要
    const complete = completeBodies[0];
    expect(complete?.renderArtifacts).toMatchObject({
      rendererVersion: expect.any(String),
      view: {
        entryRelativePath: "index.html",
        fileCount: 2,
      },
      cover: {
        entryRelativePath: "index.html",
        fileCount: 2,
      },
    });

    expect(result).toMatchObject({
      cardId: "card-uuid-1",
      status: "ready",
    });
  });

  it("does not render or submit artifacts when includeRenderArtifacts is disabled", async () => {
    const fs: MemoryFileSystem = {
      [path.join(UNPACKED_DIR, "content", "entry.yaml")]: bytes("content: []\n"),
    };
    const uploads: UploadRecord[] = [];
    const completeBodies: Array<Record<string, unknown>> = [];
    const sessionBodies: Array<Record<string, unknown>> = [];
    const presignBodies: Array<Record<string, unknown>> = [];
    const moduleInvokeMock = vi.fn();

    const fetchMock = buildPresignAndUploadFetchMock({ uploads, completeBodies, sessionBodies, presignBodies });
    vi.stubGlobal("fetch", fetchMock);

    const ctx = createContext(
      buildRenderUploadHostMock(fs),
      {
        invoke: moduleInvokeMock,
        job: {
          get: vi.fn(),
        },
      },
    );

    const provider = moduleDefinition.providers[0];
    const upload = provider?.methods.upload;

    await upload!(ctx, {
      cardFile: CARD_FILE,
      server: {
        baseUrl: "https://community.example",
        accessToken: "token-1",
      },
      client: {
        name: "desktop-transfer",
        version: "1.0.0",
      },
      workspace: {
        tempDir: WORKSPACE,
      },
    });

    expect(sessionBodies[0]).toMatchObject({
      includeRenderArtifacts: false,
    });
    expect(moduleInvokeMock).not.toHaveBeenCalled();
    expect(completeBodies[0]?.renderArtifacts).toBeUndefined();
    const hasRenderRole = presignBodies.some((body) =>
      Array.isArray(body.objects) && body.objects.some((object) => object?.role === "render-file"),
    );
    expect(hasRenderRole).toBe(false);
  });

  it("fails with a clear error when the conversion module is unavailable", async () => {
    const fs: MemoryFileSystem = {
      [path.join(UNPACKED_DIR, "content", "entry.yaml")]: bytes("content: []\n"),
    };
    const uploads: UploadRecord[] = [];
    const completeBodies: Array<Record<string, unknown>> = [];
    const sessionBodies: Array<Record<string, unknown>> = [];
    const presignBodies: Array<Record<string, unknown>> = [];

    const fetchMock = buildPresignAndUploadFetchMock({ uploads, completeBodies, sessionBodies, presignBodies });
    vi.stubGlobal("fetch", fetchMock);

    const ctx = createContext(buildRenderUploadHostMock(fs));

    const provider = moduleDefinition.providers[0];
    const upload = provider?.methods.upload;

    await expect(
      upload!(ctx, {
        cardFile: CARD_FILE,
        server: {
          baseUrl: "https://personal.example",
          accessToken: "token-1",
        },
        publish: {
          includeRenderArtifacts: true,
        },
        workspace: {
          tempDir: WORKSPACE,
        },
      }),
    ).rejects.toMatchObject({
      code: "COMMUNITY_TRANSFER_RENDER_UNAVAILABLE",
    });
  });
});

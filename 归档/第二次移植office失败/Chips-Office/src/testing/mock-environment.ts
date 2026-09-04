import {
  createMockChipsClient,
  createMockLaunchContext,
  createMockSurfaceContext,
  type MockActionHandler,
  type MockChipsClient,
  type MockChipsHostOptions,
} from "chips-sdk/testing";
import type { FileSessionDescriptor } from "chips-sdk";
import { appConfig } from "../../config/app-config";

export const appMockSurfaceContext = createMockSurfaceContext({
  pluginId: appConfig.appId,
  sceneId: appConfig.defaultSceneId,
  kind: "window",
  presentation: {
    title: "Chips Office",
    width: 1024,
    height: 720,
  },
});

export const appMockLaunchContext = createMockLaunchContext({
  pluginId: appConfig.appId,
  sceneId: appConfig.defaultSceneId,
  surfaceContext: appMockSurfaceContext,
});

/** Office 场景常用格式到 MIME 类型的映射（与生态万能文件处理契约保持一致）。 */
const MOCK_FILE_SESSION_MIME_TYPES: Record<string, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  pdf: "application/pdf",
};

interface MockFileSessionRecord {
  document: FileSessionDescriptor;
  bytes: Uint8Array;
}

export interface MockFileSessionOptions {
  /** 新建会话时写入的默认内容字节。 */
  bytes?: Uint8Array;
}

/**
 * 按 Chips-SDK `contracts/file.ts` 契约形状提供最小 `file.session.*` 能力，
 * 供应用场景冒烟测试在无 Host 环境下驱动文件会话链路。
 */
export function createMockFileSessionActions(
  options: MockFileSessionOptions = {},
): Record<string, MockActionHandler> {
  const sessions = new Map<string, MockFileSessionRecord>();
  let sessionSeed = 0;

  const defaultBytes = options.bytes ?? new Uint8Array();

  function toPayload(payload: unknown): Record<string, unknown> {
    return payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  }

  function nowIso(): string {
    return new Date().toISOString();
  }

  function extensionOf(filePath: string): string {
    const fileName = filePath.split(/[\\/]/).pop() ?? "";
    const dotIndex = fileName.lastIndexOf(".");
    return dotIndex >= 0 ? fileName.slice(dotIndex + 1).toLowerCase() : "";
  }

  function mimeTypeFor(format: string): string {
    return MOCK_FILE_SESSION_MIME_TYPES[format] ?? "application/octet-stream";
  }

  function requireRecord(sessionId: unknown): MockFileSessionRecord {
    const record = sessions.get(String(sessionId));
    if (!record) {
      throw new Error("FILE_SESSION_NOT_FOUND");
    }
    return record;
  }

  function createDescriptor(payload: Record<string, unknown>): MockFileSessionRecord {
    const filePath = String(payload.filePath ?? "");
    if (!filePath) {
      throw new Error("FILE_PATH_REQUIRED");
    }
    sessionSeed += 1;
    const fileName =
      filePath.split(/[\\/]/).pop() || `未命名文件`;
    const format = String(payload.format ?? extensionOf(filePath) ?? "bin");
    const bytes = Uint8Array.from(defaultBytes);
    const timestamp = nowIso();
    const document: FileSessionDescriptor = {
      sessionId: `mock-file-session-${sessionSeed}`,
      documentId: `mock-file-document-${sessionSeed}`,
      filePath,
      fileName,
      format,
      mimeType: mimeTypeFor(format),
      size: bytes.byteLength,
      revision: 1,
      status: "clean",
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const record: MockFileSessionRecord = { document, bytes };
    sessions.set(document.sessionId, record);
    return record;
  }

  return {
    "file.session.open": async (payload) => {
      const record = createDescriptor(toPayload(payload));
      return { document: record.document };
    },
    "file.session.create": async (payload) => {
      const record = createDescriptor(toPayload(payload));
      return { document: record.document };
    },
    "file.session.read": async (payload) => {
      const input = toPayload(payload);
      const record = requireRecord(input.sessionId);
      const offset = Number(input.offset ?? 0) || 0;
      const length = Number(input.length ?? 0) || 0;
      const slice = length > 0 ? record.bytes.subarray(offset, offset + length) : record.bytes.subarray(offset);
      return {
        document: record.document,
        bytes: Uint8Array.from(slice),
        offset,
        totalSize: record.bytes.byteLength,
      };
    },
    "file.session.write": async (payload) => {
      const input = toPayload(payload);
      const record = requireRecord(input.sessionId);
      const incoming = input.bytes;
      if (!(incoming instanceof Uint8Array)) {
        throw new Error("FILE_BYTES_INVALID");
      }
      record.bytes = Uint8Array.from(incoming);
      record.document = {
        ...record.document,
        size: record.bytes.byteLength,
        revision: record.document.revision + 1,
        status: "dirty",
        updatedAt: nowIso(),
      };
      return { document: record.document };
    },
    "file.session.get": async (payload) => {
      const record = requireRecord(toPayload(payload).sessionId);
      return { document: record.document };
    },
    "file.session.persist": async (payload) => {
      const record = requireRecord(toPayload(payload).sessionId);
      record.document = { ...record.document, status: "clean", updatedAt: nowIso() };
      return { document: record.document };
    },
    "file.session.close": async (payload) => {
      const record = requireRecord(toPayload(payload).sessionId);
      sessions.delete(record.document.sessionId);
      return { ack: true };
    },
  };
}

export interface CreateAppMockClientOptions {
  /**
   * 追加到 launch context / surface context 的启动参数，
   * 用于模拟 Host 通过 resourceOpen 等参数打开文件的场景。
   */
  launchParams?: Record<string, unknown>;
  /** mock 文件会话的默认内容（未提供时为空字节）。 */
  fileSession?: MockFileSessionOptions;
}

export function createAppMockClient(options: CreateAppMockClientOptions = {}): MockChipsClient {
  const { launchParams, fileSession } = options;

  let launchContext = appMockLaunchContext;
  let surfaceContext = appMockSurfaceContext;
  if (launchParams) {
    surfaceContext = createMockSurfaceContext({
      pluginId: appConfig.appId,
      sceneId: appConfig.defaultSceneId,
      kind: "window",
      presentation: {
        title: "Chips Office",
        width: 1024,
        height: 720,
      },
      launchParams,
    });
    launchContext = createMockLaunchContext({
      pluginId: appConfig.appId,
      sceneId: appConfig.defaultSceneId,
      surfaceContext,
      launchParams,
    });
  }

  const hostOptions: MockChipsHostOptions = {
    locale: "zh-CN",
    launchContext,
    surfaceContext,
    permissions: ["command.read", "command.write", "command.invoke"],
  };
  hostOptions.actions = { ...createMockFileSessionActions(fileSession) };

  return createMockChipsClient(hostOptions);
}

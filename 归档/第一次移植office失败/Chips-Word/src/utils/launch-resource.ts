/**
 * 启动目标解析：从 launchParams.resourceOpen（含 targetPath 兼容回退）解析出
 * 待打开的 .docx 目标；本地文档由运行时交给 Host Office 会话读取，
 * 此处保留非会话资源的 file/http(s)/resource.readBinary 读取回退。
 */
import type { Client, PlatformLaunchContext } from "chips-sdk";
import { normalizeBinaryContent, unwrapBinaryPayload } from "../lib/binary";

export interface LaunchDocumentTarget {
  /** 打开目标：resourceOpen.filePath ?? targetPath ?? resourceOpen.resourceId */
  sourceId: string;
  /** 可写回的本地路径（仅当目标是本地文件时有值） */
  filePath: string | null;
  fileName: string;
  mimeType: string | null;
  title: string | null;
}

function readNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function resolveFileName(rawPath: string): string {
  const normalized = rawPath.replace(/[\\/]+$/, "");
  const lastSegment = normalized.split(/[\\/]/).pop() ?? normalized;
  try {
    return decodeURIComponent(lastSegment);
  } catch {
    return lastSegment;
  }
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function isLikelyLocalPath(value: string): boolean {
  if (value.startsWith("file://")) {
    return true;
  }
  return /^([A-Za-z]:[\\/]|\/|\\\\)/.test(value);
}

function resolveLocalFilePath(sourceId: string): string | null {
  if (sourceId.startsWith("file://")) {
    try {
      return decodeURIComponent(new URL(sourceId).pathname);
    } catch {
      return null;
    }
  }
  return isLikelyLocalPath(sourceId) && !isHttpUrl(sourceId) ? sourceId : null;
}

export function resolveLaunchDocumentTarget(
  launchContext: PlatformLaunchContext,
): LaunchDocumentTarget | null {
  const launchParams = readRecord(launchContext.launchParams) ?? {};
  const resourceOpen = readRecord(launchParams.resourceOpen);
  const resourceFilePath = readNonEmptyString(resourceOpen?.filePath);
  const targetPath = readNonEmptyString(launchParams.targetPath);
  const resourceId = readNonEmptyString(resourceOpen?.resourceId);
  const sourceId = resourceFilePath ?? targetPath ?? resourceId;

  if (!sourceId) {
    return null;
  }

  const filePath = resourceFilePath ?? targetPath ?? resolveLocalFilePath(sourceId);

  return {
    sourceId,
    filePath,
    fileName:
      readNonEmptyString(resourceOpen?.fileName) ?? resolveFileName(filePath ?? sourceId),
    mimeType: readNonEmptyString(resourceOpen?.mimeType) ?? null,
    title: readNonEmptyString(resourceOpen?.title) ?? null,
  };
}

/** 读取非 Office 会话文档字节：本地文件、http(s) 与资源通道回退。 */
export async function readDocumentBytes(
  client: Client,
  target: LaunchDocumentTarget,
): Promise<Uint8Array> {
  const localPath = target.filePath ? resolveLocalFilePath(target.filePath) : null;
  if (localPath) {
    const fileContent = await client.file.read(localPath, { encoding: "binary" });
    return normalizeBinaryContent(unwrapBinaryPayload(fileContent));
  }

  if (isHttpUrl(target.sourceId)) {
    const response = await fetch(target.sourceId, {
      headers: {
        Accept:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document, application/octet-stream;q=0.9, */*;q=0.8",
      },
    });
    if (!response.ok) {
      throw new Error(`远程文档下载失败：${response.status} ${response.statusText}`);
    }
    return new Uint8Array(await response.arrayBuffer());
  }

  const resourceBinary = await client.resource.readBinary(target.sourceId);
  return normalizeBinaryContent(unwrapBinaryPayload(resourceBinary));
}

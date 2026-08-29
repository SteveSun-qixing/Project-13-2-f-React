import type { Client } from "chips-sdk";
import type { PreviewItem, PreviewSource } from "../viewer-engine";
import {
  fileUrlToPathLike,
  isHttpUrl,
  isLikelyLocalPath,
  resolveDeliveryKind,
} from "./file-kind";
import type { LaunchFileResource } from "./launch-resource";

export interface LoadedViewerFile {
  source: PreviewSource;
  fileName: string;
  mimeType?: string;
  /** 已知的本地文件路径（用于「另存为」直接复制）。 */
  filePath?: string;
  size?: number;
}

/**
 * 将启动/打开目标装载为引擎预览源：
 * - 音视频：解析为可流式播放的 URI（file:// 直连）；
 * - 本地路径 / file:// URL：读取字节构造 File；
 * - http(s)：交由引擎按 URL 直接加载；
 * - 其他正式资源 ID：走 Host resource.readBinary。
 */
export async function loadViewerFile(client: Client, resource: LaunchFileResource): Promise<LoadedViewerFile> {
  const fileName = resource.fileName?.trim() || resource.sourceId.split(/[\\/]/).pop() || "file";
  const mimeType = resource.mimeType?.trim() || undefined;
  const deliveryKind = resolveDeliveryKind(mimeType);

  if (deliveryKind === "uri") {
    let uri = resource.sourceId;
    try {
      const resolved = await client.resource.resolve(resource.sourceId);
      if (typeof resolved?.uri === "string" && resolved.uri.length > 0) {
        uri = resolved.uri;
      }
    } catch {
      // 解析失败时回退原始标识（file:// URL、本地路径可直接作为元素源）。
    }
    return {
      source: uri,
      fileName,
      mimeType,
      filePath: resource.filePath,
    };
  }

  if (isHttpUrl(resource.sourceId)) {
    return {
      source: resource.sourceId,
      fileName,
      mimeType,
    };
  }

  const bytes = await readLocalOrManagedBytes(client, resource);
  const blob = new Blob([toBlobPart(bytes)], { type: mimeType ?? "" });
  return {
    source: new File([blob], fileName, { type: blob.type }),
    fileName,
    mimeType,
    filePath: resource.filePath,
    size: blob.size,
  };
}

function toBlobPart(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function readLocalOrManagedBytes(client: Client, resource: LaunchFileResource): Promise<Uint8Array> {
  const localPath = resource.filePath ?? resource.sourceId;
  if (isLikelyLocalPath(localPath)) {
    const content = await client.file.read(fileUrlToPathLike(localPath), { encoding: "binary" });
    if (typeof content === "string") {
      throw new Error("file.read: binary encoding returned text content.");
    }
    return content;
  }
  const buffer = await client.resource.readBinary(resource.sourceId);
  return new Uint8Array(buffer);
}

export function toPreviewItems(files: LoadedViewerFile[]): PreviewItem[] {
  return files.map((file) => ({
    file: file.source,
    fileName: file.fileName,
    mimeType: file.mimeType,
  }));
}

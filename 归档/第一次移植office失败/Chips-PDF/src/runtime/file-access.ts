import type { Client } from "chips-sdk";
import { unwrapBinaryPayload } from "../utils/binary";
import type { LaunchPdfTarget } from "../utils/launch-resource";

export type HostKind = "desktop" | "web" | "mobile" | "headless";

/** 宿主平台类型；读取失败时按桌面处理 */
export async function resolveHostKind(client: Client | null): Promise<HostKind> {
  if (!client) {
    return "desktop";
  }
  try {
    const info = await client.platform.getInfo();
    return info.hostKind;
  } catch {
    return "desktop";
  }
}

/**
 * PDF 非会话读取回退：本地路径走 client.file.read，其余走 Host 资源通道；
 * PdfRuntimeProvider 对桌面本地文件优先使用 client.office 会话。
 */
export async function readPdfBytes(client: Client | null, target: LaunchPdfTarget): Promise<Uint8Array> {
  const sourceId = target.sourceId;
  if (target.filePath) {
    if (!client) {
      throw new Error("宿主客户端不可用。");
    }
    const content = await client.file.read(target.filePath, { encoding: "binary" });
    return unwrapBinaryPayload(content);
  }
  if (client) {
    // Host 负责托管资源、远端 URL 与 Web 文件令牌的解析，避免绕过 Bridge。
    const raw = await client.resource.readBinary(sourceId);
    return unwrapBinaryPayload(raw);
  }
  if (/^https?:\/\//i.test(sourceId)) {
    const response = await fetch(sourceId);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return new Uint8Array(await response.arrayBuffer());
  }
  throw new Error("宿主客户端不可用。");
}

/** 将字节写入目标路径；web 宿主退化为浏览器下载 */
export async function writePdfBytes(
  client: Client | null,
  hostKind: HostKind,
  path: string | null,
  fileName: string,
  bytes: Uint8Array,
): Promise<string> {
  if (hostKind === "web" || !path || !client) {
    const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.rel = "noreferrer";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 4_000);
    return fileName;
  }
  await client.file.write(path, bytes, { encoding: "binary" });
  return path;
}

/** 弹出系统打开对话框；返回 null 表示用户取消 */
export async function openPdfDialog(client: Client | null, title: string): Promise<string | null> {
  if (!client) {
    return null;
  }
  const selected = await client.platform.openFile({
    title,
    mode: "file",
    allowMultiple: false,
    mustExist: true,
    filters: [{ name: "PDF 文档", extensions: ["pdf"] }],
  });
  return selected && selected.length > 0 ? (selected[0] ?? null) : null;
}

/** 弹出系统另存为对话框；返回 null 表示用户取消 */
export async function savePdfDialog(
  client: Client | null,
  title: string,
  defaultPath?: string,
): Promise<string | null> {
  if (!client) {
    return null;
  }
  return client.platform.saveFile({ title, defaultPath });
}

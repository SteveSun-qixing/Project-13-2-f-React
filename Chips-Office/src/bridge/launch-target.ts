import type { Client } from "chips-sdk";
import { getSceneIdForDocumentType, type OfficeSceneId } from "../app/scene-registry";

/**
 * 启动文档目标解析：与 Chips-UniversalFileViewer 的 launch-resource 归一化口径一致，
 * 唯一读取入口为 `resourceOpen.filePath ?? targetPath ?? resourceOpen.resourceId`。
 */

export interface LaunchDocumentTarget {
  path: string;
  fileName?: string;
  mimeType?: string;
  title?: string;
}

interface ResourceOpenLaunchParams {
  resourceOpen?: {
    filePath?: string;
    resourceId?: string;
    fileName?: string;
    mimeType?: string;
    title?: string;
  } | null;
  targetPath?: string;
  subject?: string;
}

export function resolveLaunchDocumentTarget(
  launchParams: Record<string, unknown> | undefined | null,
): LaunchDocumentTarget | null {
  if (!launchParams) {
    return null;
  }
  const params = launchParams as ResourceOpenLaunchParams;
  const resourceOpen = params.resourceOpen ?? null;
  const path = resourceOpen?.filePath ?? params.targetPath ?? resourceOpen?.resourceId ?? null;
  if (!path || typeof path !== "string") {
    return null;
  }
  return {
    path,
    fileName: resourceOpen?.fileName,
    mimeType: resourceOpen?.mimeType,
    title: resourceOpen?.title,
  };
}

/** 检测文档类型并映射到场景；无法识别的类型返回 null（起始页负责提示）。 */
export async function resolveSceneForDocument(
  client: Client,
  target: LaunchDocumentTarget,
): Promise<OfficeSceneId | null> {
  const detected = await client.file.detectType(target.path);
  const sceneId = getSceneIdForDocumentType(detected.documentType);
  return sceneId === "office.scene.start" ? null : sceneId;
}

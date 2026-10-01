import { isPreviewSupported, type PreviewSource } from "../engine";
import { createViewerPlugins } from "./engine-plugins";

/**
 * 在装载资源前判断目标是否有可用的预览插件
 * （fallback 兜底不算可用预览路径，直接给出不支持反馈）。
 */
export async function isPreviewableTarget(
  source: PreviewSource,
  options: { fileName?: string; mimeType?: string } = {}
): Promise<boolean> {
  return isPreviewSupported(source, createViewerPlugins(), options);
}

/**
 * 资源路径公共工具（渲染进程侧 / SDK 侧实现）
 *
 * 生态统一工具（见工单154）：与 `chips-host` 主进程侧 `src/shared/resource-path.ts`
 * 保持同语义。主进程侧消费方使用 Host 实现，渲染进程侧消费方使用本模块。
 * 两侧实现必须保持一致，任何一侧变更须同步另一侧并更新对应契约测试。
 */

/** 将资源路径规范化为相对路径；非法输入（空、`..` 逃逸等）返回 null。 */
export function normalizeRelativeResourcePath(resourcePath: unknown): string | null {
  if (typeof resourcePath !== "string") {
    return null;
  }

  const normalized = resourcePath.replace(/\\/g, "/").trim();
  if (!normalized) {
    return null;
  }

  const segments = normalized
    .replace(/^\.?\//, "")
    .split("/")
    .filter((segment) => segment.length > 0 && segment !== ".");
  if (segments.length === 0 || segments.some((segment) => segment === "..")) {
    return null;
  }

  return segments.join("/");
}

/** 拼接路径片段并统一分隔符（不校验绝对/相对语义）。 */
export function joinResourcePath(...parts: string[]): string {
  return parts.filter(Boolean).join("/").replace(/\\/g, "/").replace(/\/+/g, "/");
}

/** 将本地文件路径编码为 file:// URL。 */
export function createFileUrl(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  if (/^[a-zA-Z]:\//.test(normalized)) {
    return encodeURI(`file:///${normalized}`);
  }

  const absolutePath = normalized.startsWith("/") ? normalized : `/${normalized}`;
  return encodeURI(`file://${absolutePath}`);
}

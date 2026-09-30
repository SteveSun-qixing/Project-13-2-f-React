/**
 * 资源解析 Hook（自旧族 book-BCP/src/shared/use-resolved-resources.ts 逐字迁移）：
 * 输入资源路径集合，归一去重后逐项经注入解析器解析为可展示 URL，
 * 卸载 / 路径变更时只释放已成功解析的项，取消中的解析不落映射。
 *
 * 消费点说明：新架构查看态经协议路径直接使用内容引用（08 §8.1），本 Hook 服务于
 * 编辑臂封面预览与导入臂资源写入回填的 URL 化场景——该通道归属资源写入链路
 * （工单064 登记缺位），通道就绪后在此接线，非占位实现。
 */

import { useEffect, useMemo, useState } from 'react';
import { normalizeRelativeCardResourcePath, resolveResourceUrlWithRetry } from './utils';

export function useResolvedResourceMap(
  resourcePaths: string[],
  resolveResourceUrl?: (resourcePath: string) => Promise<string>,
  releaseResourceUrl?: (resourcePath: string) => Promise<void> | void
): Map<string, string> {
  const [resolved, setResolved] = useState<Map<string, string>>(new Map());
  const resourceKey = resourcePaths.join('\n');
  const normalizedPaths = useMemo(
    () =>
      Array.from(
        new Set(
          resourcePaths
            .map((path) => normalizeRelativeCardResourcePath(path))
            .filter((path): path is string => Boolean(path))
        )
      ),
    [resourceKey]
  );

  useEffect(() => {
    let cancelled = false;
    const resolvedPaths: string[] = [];
    const next = new Map<string, string>();

    async function resolveAll(): Promise<void> {
      if (!resolveResourceUrl) {
        return;
      }

      for (const resourcePath of normalizedPaths) {
        if (cancelled) {
          return;
        }

        let resolvedUrl: string;
        try {
          resolvedUrl = await resolveResourceUrlWithRetry(resolveResourceUrl, resourcePath);
        } catch {
          continue;
        }

        next.set(resourcePath, resolvedUrl);
        if (cancelled) {
          void releaseResourceUrl?.(resourcePath);
        } else {
          resolvedPaths.push(resourcePath);
        }
      }

      if (!cancelled) {
        setResolved(next);
      }
    }

    void resolveAll();

    return () => {
      cancelled = true;
      if (releaseResourceUrl) {
        for (const resourcePath of resolvedPaths) {
          void releaseResourceUrl(resourcePath);
        }
      }
    };
  }, [normalizedPaths, releaseResourceUrl, resolveResourceUrl]);

  return resolved;
}

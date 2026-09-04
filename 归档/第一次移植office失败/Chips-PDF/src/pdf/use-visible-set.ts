import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

/**
 * 容器内处于（扩展）视口中的条目集合——页面/缩略图共享的懒渲染基础。
 * enabled 翻转时重建 observer（侧栏开合会卸载/重挂载 root）。
 */
export function useVisibleSet(
  rootRef: RefObject<HTMLElement | null>,
  count: number,
  rootMargin: string,
  enabled = true,
): { visible: Set<number>; setItemRef: (idx: number) => (el: HTMLElement | null) => void } {
  const [visible, setVisible] = useState<Set<number>>(new Set());
  const itemRefs = useRef<(HTMLElement | null)[]>([]);
  useEffect(() => {
    const root = rootRef.current;
    if (!enabled || !root || count === 0) return;
    const io = new IntersectionObserver(
      (entries) => {
        setVisible((prev) => {
          const next = new Set(prev);
          for (const e of entries) {
            const idx = Number((e.target as HTMLElement).dataset.idx);
            if (e.isIntersecting) next.add(idx);
            else next.delete(idx);
          }
          return next;
        });
      },
      { root, rootMargin },
    );
    for (const el of itemRefs.current) if (el) io.observe(el);
    return () => io.disconnect();
  }, [rootRef, count, rootMargin, enabled]);
  return {
    visible,
    setItemRef: (idx) => (el) => {
      itemRefs.current[idx] = el;
    },
  };
}

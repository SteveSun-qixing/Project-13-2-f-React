import { useEffect, useRef } from "react";
import type { ReactElement } from "react";
import { pdfRectToCss, quadToRect } from "../pdf/geometry";
import type { PageGeom } from "../pdf/geometry";
import type { LocalMarkup, MarkupType } from "../pdf/annotations";
import { applyElementBox, applyElementRgb } from "./geometry-style";

/** 单个标记块：绝对定位 div，几何与颜色经 CSS 变量写入（无内联样式） */
function MarkupBox({
  markup,
  quadIndex,
  geom,
  scale,
}: {
  markup: LocalMarkup;
  quadIndex: number;
  geom: PageGeom;
  scale: number;
}): ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const quad = markup.quads[quadIndex];
    if (!quad) return;
    applyElementBox(el, pdfRectToCss(geom, quadToRect(quad), scale));
    applyElementRgb(el, "--markup-rgb", markup.color);
  }, [geom, markup, quadIndex, scale]);
  return <div ref={ref} className={`pdf-markup pdf-markup-${markup.type}`} />;
}

/** 未保存 + 已保存标记的纯视觉覆盖层（pointer-events: none，保持下方文本可选） */
export function MarkupOverlay({
  markups,
  geom,
  scale,
}: {
  markups: LocalMarkup[];
  geom: PageGeom;
  scale: number;
}): ReactElement {
  return (
    <div className="pdf-markup-overlay">
      {markups.flatMap((m) =>
        m.quads.map((_, i) => (
          <MarkupBox key={`${m.id}-${i}`} markup={m} quadIndex={i} geom={geom} scale={scale} />
        )),
      )}
    </div>
  );
}

/** 搜索命中高亮（当前命中加重显示） */
export function SearchHighlightOverlay({
  rects,
  geom,
  scale,
  activeRects,
}: {
  rects: [number, number, number, number][];
  activeRects: [number, number, number, number][];
  geom: PageGeom;
  scale: number;
}): ReactElement | null {
  if (rects.length === 0 && activeRects.length === 0) return null;
  return (
    <div className="pdf-search-overlay">
      {rects.map((r, i) => (
        <SearchRect key={`s${i}`} rect={r} geom={geom} scale={scale} active={false} />
      ))}
      {activeRects.map((r, i) => (
        <SearchRect key={`a${i}`} rect={r} geom={geom} scale={scale} active={true} />
      ))}
    </div>
  );
}

function SearchRect({
  rect,
  geom,
  scale,
  active,
}: {
  rect: [number, number, number, number];
  geom: PageGeom;
  scale: number;
  active: boolean;
}): ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    applyElementBox(el, pdfRectToCss(geom, rect, scale));
  }, [geom, rect, scale]);
  return <div ref={ref} className={`pdf-search-rect${active ? " pdf-search-rect-active" : ""}`} />;
}

export type { MarkupType };

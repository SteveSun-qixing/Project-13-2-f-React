import { Fragment, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, ReactElement } from "react";
import { pdfToView, viewToPdf } from "../pdf/geometry";
import type { PageGeom } from "../pdf/geometry";
import type { DrawingInput, LocalDrawing } from "../pdf/drawings";
import { applyElementRgb } from "./geometry-style";

/** 显示像素盒子（已缩放） */
interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** SVG 形状路径的公共着色属性（颜色属文档数据，随批注输入变化；便签不参与绘制） */
type ShapeInput = Exclude<DrawingInput, { kind: "note" }>;

function strokeProps(d: ShapeInput, hit: boolean, scale: number): { stroke: string; width: number } {
  const rgb = d.color.map((v) => Math.round(v * 255));
  return {
    stroke: hit ? "transparent" : `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`,
    width: hit ? Math.max(16, d.width * scale * 4) : d.width * scale,
  };
}

function drawingShape(
  d: DrawingInput,
  geom: PageGeom,
  scale: number,
  hit = false,
): ReactElement | null {
  const toView = (x: number, y: number): [number, number] => {
    const [vx, vy] = pdfToView(geom, x, y);
    return [vx * scale, vy * scale];
  };
  if (d.kind === "note") return null;
  const { stroke, width } = strokeProps(d, hit, scale);
  if (d.kind === "ink") {
    return (
      <>
        {d.paths.map((path, i) => {
          const pts: string[] = [];
          for (let j = 0; j + 1 < path.length; j += 2) {
            const [vx, vy] = toView(path[j] ?? 0, path[j + 1] ?? 0);
            pts.push(`${vx},${vy}`);
          }
          return (
            <polyline
              key={i}
              points={pts.join(" ")}
              fill="none"
              stroke={stroke}
              strokeWidth={width}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        })}
      </>
    );
  }
  if (d.kind === "rect" || d.kind === "ellipse") {
    const [ax, ay] = toView(d.rect[0], d.rect[1]);
    const [bx, by] = toView(d.rect[2], d.rect[3]);
    const [x, y] = [Math.min(ax, bx), Math.min(ay, by)];
    const [rw, rh] = [Math.abs(bx - ax), Math.abs(by - ay)];
    return d.kind === "rect" ? (
      <rect x={x} y={y} width={rw} height={rh} fill="none" stroke={stroke} strokeWidth={width} />
    ) : (
      <ellipse cx={x + rw / 2} cy={y + rh / 2} rx={rw / 2} ry={rh / 2} fill="none" stroke={stroke} strokeWidth={width} />
    );
  }
  const [fx, fy] = toView(d.from[0], d.from[1]);
  const [tx, ty] = toView(d.to[0], d.to[1]);
  const head: ReactElement[] = [];
  if (d.kind === "arrow") {
    const ang = Math.atan2(ty - fy, tx - fx);
    const len = Math.max(9 * scale, width * 4.5);
    for (const [i, off] of [-0.45, 0.45].entries()) {
      head.push(
        <line
          key={i}
          x1={tx}
          y1={ty}
          x2={tx - len * Math.cos(ang + off)}
          y2={ty - len * Math.sin(ang + off)}
          stroke={stroke}
          strokeWidth={width}
          strokeLinecap="round"
        />,
      );
    }
  }
  return (
    <Fragment>
      <line x1={fx} y1={fy} x2={tx} y2={ty} stroke={stroke} strokeWidth={width} strokeLinecap="round" />
      {head}
    </Fragment>
  );
}

/** 便签定位钉：绝对定位按钮，几何与颜色经 CSS 变量写入 */
export function NotePin(props: {
  pinKey: string;
  at: [number, number];
  geom: PageGeom;
  scale: number;
  color: [number, number, number] | null;
  active: boolean;
  title: string;
  onOpen: (key: string) => void;
}): ReactElement {
  const ref = useRef<HTMLButtonElement>(null);
  const { at, geom, scale, color, active, pinKey, title, onOpen } = props;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const [vx, vy] = (() => {
      const [px, py] = pdfToView(geom, at[0], at[1]);
      return [px * scale, py * scale];
    })();
    el.style.setProperty("--pin-left", `${vx}px`);
    el.style.setProperty("--pin-top", `${vy - 20}px`);
    applyElementRgb(el, "--pin-color", color ?? [1, 0.78, 0.13]);
  }, [at, geom, scale, color]);
  return (
    <button
      ref={ref}
      type="button"
      className={`pdf-note-pin${active ? " pdf-note-pin-active" : ""}`}
      title={title}
      aria-label={title}
      onClick={() => onOpen(pinKey)}
    >
      <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M2.5 3.5h11v8h-6l-3 2.5V11.5h-2z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

/**
 * 绘图层：工具激活时接管指针事件在页面上绘制；否则仅渲染已有形状。
 * 便签在点击位置放置，内容经边栏草稿卡输入。
 */
export function DrawLayer({
  geom,
  scale,
  pageWidth,
  pageHeight,
  drawings,
  tool,
  color,
  strokeWidth,
  onCommit,
  onNoteAt,
}: {
  geom: PageGeom;
  scale: number;
  pageWidth: number;
  pageHeight: number;
  drawings: LocalDrawing[];
  tool: string | null;
  color: [number, number, number];
  strokeWidth: number;
  onCommit: (input: DrawingInput) => void;
  onNoteAt: (at: [number, number]) => void;
}): ReactElement {
  const [live, setLive] = useState<DrawingInput | null>(null);
  const startRef = useRef<[number, number] | null>(null);
  const inkRef = useRef<number[]>([]);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    applyElementRgb(svgRef.current, "--draw-color", color);
  }, [color]);

  const toPdf = (e: ReactPointerEvent): [number, number] => {
    const box = e.currentTarget.getBoundingClientRect();
    return viewToPdf(geom, (e.clientX - box.left) / scale, (e.clientY - box.top) / scale);
  };

  const onPointerDown = (e: ReactPointerEvent): void => {
    if (!tool || e.button !== 0) return;
    e.preventDefault();
    const at = toPdf(e);
    if (tool === "note") {
      onNoteAt(at);
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    startRef.current = at;
    if (tool === "ink") {
      inkRef.current = [at[0], at[1]];
      setLive({ kind: "ink", pageIndex: 0, color, width: strokeWidth, paths: [inkRef.current] });
    }
  };

  const onPointerMove = (e: ReactPointerEvent): void => {
    if (!tool || !startRef.current) return;
    const at = toPdf(e);
    if (tool === "ink") {
      inkRef.current = [...inkRef.current, at[0], at[1]];
      setLive({ kind: "ink", pageIndex: 0, color, width: strokeWidth, paths: [inkRef.current] });
    } else if (tool === "rect" || tool === "ellipse") {
      const [sx, sy] = startRef.current;
      setLive({
        kind: tool,
        pageIndex: 0,
        color,
        width: strokeWidth,
        rect: [Math.min(sx, at[0]), Math.min(sy, at[1]), Math.max(sx, at[0]), Math.max(sy, at[1])],
      });
    } else if (tool === "line" || tool === "arrow") {
      setLive({
        kind: tool,
        pageIndex: 0,
        color,
        width: strokeWidth,
        from: startRef.current,
        to: at,
      });
    }
  };

  const onPointerUp = (): void => {
    const pending = live;
    startRef.current = null;
    inkRef.current = [];
    setLive(null);
    if (!pending) return;
    if (pending.kind === "ink" && (pending.paths[0]?.length ?? 0) < 6) return;
    if (pending.kind === "rect" || pending.kind === "ellipse") {
      const [x1, y1, x2, y2] = pending.rect;
      if (x2 - x1 < 3 && y2 - y1 < 3) return;
    }
    if (pending.kind === "line" || pending.kind === "arrow") {
      if (Math.hypot(pending.to[0] - pending.from[0], pending.to[1] - pending.from[1]) < 4) return;
    }
    onCommit(pending);
  };

  return (
    <svg
      ref={svgRef}
      className={`pdf-draw-layer${tool ? " pdf-draw-layer-active" : ""}`}
      width={pageWidth * scale}
      height={pageHeight * scale}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {drawings.map((d) =>
        d.input.kind === "note" ? null : (
          <g key={d.id} className="pdf-draw-shape">
            {drawingShape(d.input, geom, scale, true)}
            {drawingShape(d.input, geom, scale)}
          </g>
        ),
      )}
      {live && tool !== "note" ? drawingShape(live, geom, scale) : null}
    </svg>
  );
}

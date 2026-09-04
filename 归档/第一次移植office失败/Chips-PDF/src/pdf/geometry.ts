/** 页面几何：未旋转的 PDF 页面尺寸 + 总显示旋转角（页面 /Rotate + 未保存增量） */
export interface PageGeom {
  pw: number;
  ph: number;
  rot: number;
}

export interface PageSize {
  width: number;
  height: number;
}

const normRot = (r: number): number => ((r % 360) + 360) % 360;

/** 显示尺寸（scale=1；旋转 90/270 时宽高互换） */
export function geomDispSize(g: PageGeom): PageSize {
  return normRot(g.rot) % 180 === 0
    ? { width: g.pw, height: g.ph }
    : { width: g.ph, height: g.pw };
}

/** 显示坐标（页面左上为原点，y 向下，scale=1）→ PDF 用户空间（y 向上） */
export function viewToPdf(g: PageGeom, vx: number, vy: number): [number, number] {
  switch (normRot(g.rot)) {
    case 90:
      return [vy, vx];
    case 180:
      return [g.pw - vx, vy];
    case 270:
      return [g.pw - vy, g.ph - vx];
    default:
      return [vx, g.ph - vy];
  }
}

/** PDF 用户空间 → 显示坐标（scale=1） */
export function pdfToView(g: PageGeom, x: number, y: number): [number, number] {
  switch (normRot(g.rot)) {
    case 90:
      return [y, x];
    case 180:
      return [g.pw - x, y];
    case 270:
      return [g.ph - y, g.pw - x];
    default:
      return [x, g.ph - y];
  }
}

/** PDF 空间矩形 [x1,y1,x2,y2] → 显示像素盒子（乘以缩放） */
export function pdfRectToCss(
  g: PageGeom,
  rect: readonly [number, number, number, number],
  scale: number,
): { left: number; top: number; width: number; height: number } {
  const [ax, ay] = pdfToView(g, rect[0], rect[1]);
  const [bx, by] = pdfToView(g, rect[2], rect[3]);
  return {
    left: Math.min(ax, bx) * scale,
    top: Math.min(ay, by) * scale,
    width: Math.abs(bx - ax) * scale,
    height: Math.abs(by - ay) * scale,
  };
}

/** 四点组（顶点任意顺序）→ PDF 空间包围矩形 */
export function quadToRect(q: readonly number[]): [number, number, number, number] {
  const xs = [q[0], q[2], q[4], q[6]];
  const ys = [q[1], q[3], q[5], q[7]];
  const clampedXs = xs.map((v) => v ?? 0);
  const clampedYs = ys.map((v) => v ?? 0);
  return [
    Math.min(...clampedXs),
    Math.min(...clampedYs),
    Math.max(...clampedXs),
    Math.max(...clampedYs),
  ];
}

/**
 * 四点组集合的容差相等比较（与顺序无关）。用于文本标记的视觉一致性判断：
 * 同一段文本在不同缩放下坐标略有差异，且 QuadPoints 保存后会经过 float32 往返。
 */
export function quadSetsMatch(a: number[][], b: number[][], tol = 2): boolean {
  if (a.length !== b.length) return false;
  const used = new Array<boolean>(b.length).fill(false);
  for (const qa of a) {
    const i = b.findIndex(
      (qb, j) =>
        !used[j] && qb.length === qa.length && qa.every((v, k) => Math.abs(v - (qb[k] ?? 0)) <= tol),
    );
    if (i < 0) return false;
    used[i] = true;
  }
  return true;
}

/**
 * 当前 DOM 选区 → PDF 坐标四点组，按可见页分组（y 向上；每组
 * [x1,yMax,x2,yMax,x1,yMin,x2,yMin]）。选区为空时返回 null。
 */
export function selectionQuadsByPage(
  scrollEl: HTMLElement,
  geoms: PageGeom[],
  scale: number,
): Map<number, number[][]> | null {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (!scrollEl.contains(range.commonAncestorContainer)) return null;

  const pageEls = [...scrollEl.querySelectorAll<HTMLElement>(".pdf-page")];
  const pageRects = pageEls.map((el) => el.getBoundingClientRect());

  // 选区矩形混合了元素级大盒与跨行 span 级小盒：丢弃包含其他盒子的，再按像素去重
  const raw = [...range.getClientRects()].filter((r) => r.width > 1 && r.height > 1);
  const rects = raw.filter(
    (r, i) =>
      !raw.some(
        (o, j) =>
          j !== i &&
          r.left <= o.left + 1 &&
          r.right >= o.right - 1 &&
          r.top <= o.top + 1 &&
          r.bottom >= o.bottom - 1 &&
          (o.width < r.width - 1 || o.height < r.height - 1),
      ),
  );

  const byPage = new Map<number, number[][]>();
  const seen = new Set<string>();
  for (const r of rects) {
    const cx = (r.left + r.right) / 2;
    const cy = (r.top + r.bottom) / 2;
    const idx = pageRects.findIndex((p) => cx >= p.left && cx <= p.right && cy >= p.top && cy <= p.bottom);
    if (idx < 0 || !geoms[idx]) continue;
    const p = pageRects[idx];
    const g = geoms[idx];
    if (!p || !g) continue;
    const [ax, ay] = viewToPdf(g, (r.left - p.left) / scale, (r.top - p.top) / scale);
    const [bx, by] = viewToPdf(g, (r.right - p.left) / scale, (r.bottom - p.top) / scale);
    const [x1, x2] = [Math.min(ax, bx), Math.max(ax, bx)];
    const [yMin, yMax] = [Math.min(ay, by), Math.max(ay, by)];
    const key = `${idx}:${Math.round(x1)}:${Math.round(x2)}:${Math.round(yMin)}:${Math.round(yMax)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const quad = [x1, yMax, x2, yMax, x1, yMin, x2, yMin];
    const list = byPage.get(idx);
    if (list) list.push(quad);
    else byPage.set(idx, [quad]);
  }
  return byPage.size > 0 ? byPage : null;
}

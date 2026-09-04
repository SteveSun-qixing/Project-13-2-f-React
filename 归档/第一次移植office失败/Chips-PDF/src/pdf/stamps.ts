/** 位图超采样倍率（相对 PDF pt），放大打印仍清晰 */
const SS = 4;

export interface WatermarkConfig {
  text: string;
  /** 逆时针角度 */
  angle: number;
  opacity: number;
  color: string;
  /** 字号占页宽比例 */
  sizeRatio: number;
}

export interface HeaderFooterConfig {
  headerLeft: string;
  headerCenter: string;
  headerRight: string;
  footerLeft: string;
  footerCenter: string;
  footerRight: string;
  /** 页脚居中自动页码（覆盖 footerCenter） */
  pageNumber: boolean;
  startAt: number;
  fontSize: number;
  color: string;
}

export const DEFAULT_WATERMARK: WatermarkConfig = {
  text: "",
  angle: 35,
  opacity: 0.18,
  color: "#d0342c",
  sizeRatio: 0.11,
};

export const DEFAULT_HEADER_FOOTER: HeaderFooterConfig = {
  headerLeft: "",
  headerCenter: "",
  headerRight: "",
  footerLeft: "",
  footerCenter: "",
  footerRight: "",
  pageNumber: true,
  startAt: 1,
  fontSize: 9,
  color: "#666666",
};

const FONT = (px: number, bold = false): string =>
  `${bold ? "600 " : ""}${px}px -apple-system, "PingFang SC", "Microsoft YaHei", "Segoe UI", sans-serif`;

/** 位图缓存（LRU）：预览随可见页滚动重算时命中，避免重复栅格化 */
const BITMAP_CACHE_MAX = 80;
const bitmapCache = new Map<string, string>();

function cachedBitmap(key: string, factory: () => string | null): string | null {
  const hit = bitmapCache.get(key);
  if (hit !== undefined) {
    bitmapCache.delete(key);
    bitmapCache.set(key, hit);
    return hit;
  }
  const value = factory();
  bitmapCache.set(key, value ?? "");
  if (bitmapCache.size > BITMAP_CACHE_MAX) {
    const oldest = bitmapCache.keys().next().value;
    if (oldest !== undefined) bitmapCache.delete(oldest);
  }
  return value;
}

function toBase64(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL("image/png").split(",")[1] ?? "";
}

/**
 * 水印位图：整页透明画布，文字绕中心旋转。
 * 使用位图是因为 pdf-lib 内置字体不含 CJK 字形，而嵌入字体会带来数 MB 体积。
 */
export function renderWatermark(cfg: WatermarkConfig, pw: number, ph: number): string | null {
  const text = cfg.text.trim();
  if (!text) return null;
  const key = `wm|${text}|${cfg.angle}|${cfg.opacity}|${cfg.color}|${cfg.sizeRatio}|${Math.round(pw)}x${Math.round(ph)}`;
  return cachedBitmap(key, () => renderWatermarkCanvas(cfg, pw, ph));
}

function renderWatermarkCanvas(cfg: WatermarkConfig, pw: number, ph: number): string | null {
  const text = cfg.text.trim();
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(pw * SS);
  canvas.height = Math.round(ph * SS);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((-cfg.angle * Math.PI) / 180);
  // 过长文本收缩到对角线以内，避免斜置端点被页边裁剪
  let size = pw * cfg.sizeRatio * SS;
  ctx.font = FONT(size, true);
  const maxW = Math.hypot(canvas.width, canvas.height) * 0.8;
  const w = ctx.measureText(text).width;
  if (w > maxW) {
    size *= maxW / w;
    ctx.font = FONT(size, true);
  }
  ctx.fillStyle = cfg.color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 0, 0);
  return toBase64(canvas);
}

/** 页眉/页脚条：整页宽 × 条高的透明画布，分左/中/右三段 */
function renderBar(
  parts: [string, string, string],
  pw: number,
  fontSize: number,
  color: string,
): string | null {
  const key = `bar|${parts.join("|")}|${Math.round(pw)}|${fontSize}|${color}`;
  return cachedBitmap(key, () => renderBarCanvas(parts, pw, fontSize, color));
}

function renderBarCanvas(
  parts: [string, string, string],
  pw: number,
  fontSize: number,
  color: string,
): string | null {
  if (parts.every((p) => !p.trim())) return null;
  const h = Math.round(fontSize * 2.2);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(pw * SS);
  canvas.height = h * SS;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.scale(SS, SS);
  ctx.font = FONT(fontSize);
  ctx.fillStyle = color;
  ctx.textBaseline = "middle";
  const pad = pw * 0.06;
  const y = h / 2;
  const [left, center, right] = parts;
  if (left.trim()) {
    ctx.textAlign = "left";
    ctx.fillText(left, pad, y);
  }
  if (center.trim()) {
    ctx.textAlign = "center";
    ctx.fillText(center, pw / 2, y);
  }
  if (right.trim()) {
    ctx.textAlign = "right";
    ctx.fillText(right, pw - pad, y);
  }
  return toBase64(canvas);
}

/** 替换 {page}/{total} 占位符 */
const fill = (tpl: string, page: number, total: number): string =>
  tpl.replace(/\{page\}/g, String(page)).replace(/\{total\}/g, String(total));

/**
 * 为目标页批量构建印章位图。pages 提供（原始页下标、未旋转页尺寸、显示页码）。
 * 页眉页脚在未旋转坐标系中放置，与页面 /Rotate 保持一致。
 */
export function buildStamps(
  pages: { origIdx: number; pw: number; ph: number; displayNo: number }[],
  watermark: WatermarkConfig | null,
  hf: HeaderFooterConfig | null,
): { pageIndex: number; image: string; rect: [number, number, number, number]; opacity?: number }[] {
  const out: { pageIndex: number; image: string; rect: [number, number, number, number]; opacity?: number }[] = [];
  const total = pages.length;
  // 同尺寸页面共享一张水印位图，避免大文档重复渲染
  const wmCache = new Map<string, string | null>();

  for (const p of pages) {
    if (watermark?.text.trim()) {
      const key = `${Math.round(p.pw)}x${Math.round(p.ph)}`;
      if (!wmCache.has(key)) wmCache.set(key, renderWatermark(watermark, p.pw, p.ph));
      const image = wmCache.get(key);
      if (image) {
        out.push({
          pageIndex: p.origIdx,
          image,
          rect: [0, 0, p.pw, p.ph],
          opacity: watermark.opacity,
        });
      }
    }

    if (!hf) continue;
    const no = hf.startAt + p.displayNo - 1;
    const barH = hf.fontSize * 2.2;
    const margin = Math.min(p.ph * 0.035, 26);

    const header = renderBar(
      [hf.headerLeft, hf.headerCenter, hf.headerRight].map((s) => fill(s, no, total)) as [
        string,
        string,
        string,
      ],
      p.pw,
      hf.fontSize,
      hf.color,
    );
    if (header) {
      out.push({
        pageIndex: p.origIdx,
        image: header,
        rect: [0, p.ph - margin - barH, p.pw, p.ph - margin],
      });
    }

    const footerCenter = hf.pageNumber ? `${no} / ${total}` : fill(hf.footerCenter, no, total);
    const footer = renderBar(
      [fill(hf.footerLeft, no, total), footerCenter, fill(hf.footerRight, no, total)],
      p.pw,
      hf.fontSize,
      hf.color,
    );
    if (footer) {
      out.push({ pageIndex: p.origIdx, image: footer, rect: [0, margin, p.pw, margin + barH] });
    }
  }
  return out;
}

/** 页眉页脚是否启用了任意内容 */
export function headerFooterUsed(hf: HeaderFooterConfig): boolean {
  return (
    hf.pageNumber ||
    [hf.headerLeft, hf.headerCenter, hf.headerRight, hf.footerLeft, hf.footerCenter, hf.footerRight].some(
      (s) => s.trim().length > 0,
    )
  );
}

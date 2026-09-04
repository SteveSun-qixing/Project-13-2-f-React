/**
 * 按文件的阅读位置持久化（回到上次看到的位置）。所有条目存在一个
 * localStorage 键下，以路径为键的 map，带 LRU 裁剪。纯模块——
 * storage 可注入以便测试。
 */

export type PdfFitMode = "width" | "page" | null;

export type PdfViewState = {
  /** 视口顶部所在行的 1 起始页码 */
  page: number;
  /** 该行内视口顶部偏移占行高的比例。用比例（而非像素）保存，
      下次打开时即使窗口尺寸或适应缩放不同也能还原。 */
  frac: number;
  scale: number;
  fitMode: PdfFitMode;
};

type StoredEntry = PdfViewState & { at: number };

export const VIEW_STATE_KEY = "chips-pdf-view-state";
export const MAX_VIEW_ENTRIES = 100;

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function readAll(storage: StorageLike): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(VIEW_STATE_KEY) ?? "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

/** 条目来自磁盘，可能来自旧版本或损坏数据——不可信任 */
function sanitize(entry: unknown): StoredEntry | null {
  if (!entry || typeof entry !== "object") return null;
  const e = entry as Record<string, unknown>;
  if (typeof e.page !== "number" || !Number.isFinite(e.page) || e.page < 1) return null;
  if (typeof e.scale !== "number" || !Number.isFinite(e.scale) || e.scale <= 0) return null;
  if (e.fitMode !== "width" && e.fitMode !== "page" && e.fitMode !== null) return null;
  return {
    page: Math.floor(e.page),
    frac: typeof e.frac === "number" && Number.isFinite(e.frac) ? Math.min(Math.max(e.frac, 0), 1) : 0,
    scale: e.scale,
    fitMode: e.fitMode,
    at: typeof e.at === "number" && Number.isFinite(e.at) ? e.at : 0,
  };
}

export function loadViewState(path: string, storage: StorageLike = localStorage): PdfViewState | null {
  if (!path) return null;
  const entry = sanitize(readAll(storage)[path]);
  if (!entry) return null;
  const { at: _at, ...state } = entry;
  return state;
}

export function saveViewState(
  path: string,
  state: PdfViewState,
  storage: StorageLike = localStorage,
  now: number = Date.now(),
): void {
  if (!path) return;
  const all = readAll(storage);
  all[path] = { ...state, at: now };
  const paths = Object.keys(all);
  if (paths.length > MAX_VIEW_ENTRIES) {
    const age = (p: string): number => sanitize(all[p])?.at ?? -1;
    paths.sort((a, b) => age(b) - age(a));
    for (const stale of paths.slice(MAX_VIEW_ENTRIES)) delete all[stale];
  }
  try {
    storage.setItem(VIEW_STATE_KEY, JSON.stringify(all));
  } catch {
    // 配额溢出 / 存储不可用：还原尽力而为，绝不影响阅读
  }
}

/** 从当前滚动几何推导可持久化的视图状态。行自上而下堆叠，行间留 gap；
 *  rowHeights 为各行的屏幕像素高度。 */
export function captureViewState(args: {
  scrollTop: number;
  rowHeights: number[];
  rowPages: number[];
  gap: number;
  scale: number;
  fitMode: PdfFitMode;
}): PdfViewState {
  const { scrollTop, rowHeights, rowPages, gap, scale, fitMode } = args;
  let top = gap;
  let rowIdx = 0;
  let rowTop = top;
  for (let i = 0; i < rowHeights.length; i++) {
    if (top <= scrollTop) {
      rowIdx = i;
      rowTop = top;
    } else break;
    top += (rowHeights[i] ?? 0) + gap;
  }
  const height = rowHeights[rowIdx] ?? 0;
  return {
    page: rowPages[rowIdx] ?? 1,
    frac: height > 0 ? Math.min(Math.max((scrollTop - rowTop) / height, 0), 1) : 0,
    scale,
    fitMode,
  };
}

import type { DrawingInput, NoteReplyTarget } from "./drawings";

/** pdf.js AnnotationType.TEXT（便签批注） */
export const PDFJS_ANNOT_TEXT = 1;

export type NoteInput = Extract<DrawingInput, { kind: "note" }>;

/** 文件中已保存的便签（Text）批注（经 pdf.js getAnnotations 读取） */
export interface SavedNoteAnnot {
  pageIndex: number;
  /** PDF 对象号（pdf.js id "123R" → 123） */
  objNum: number;
  type: "note";
  rect: [number, number, number, number];
  /** rgb 0-1；批注无 /C 时为 null */
  color: [number, number, number] | null;
  /** /T；缺省为空串 */
  author: string;
  contents: string;
  /** /CreationDate（回退 /M）对应的 epoch 毫秒；缺失或无法解析为 null */
  timeMs: number | null;
  /** 父便签对象号（/IRT）；null 表示线程根 */
  inReplyTo: number | null;
}

/** 线程中的一条评论：已保存在文件中，或会话内待保存 */
export interface NoteThreadItem {
  /** 已保存为 'S<objNum>'，待保存为 'P<drawingId>' */
  key: string;
  saved: SavedNoteAnnot | null;
  pendingId: string | null;
  author: string;
  contents: string;
  timeMs: number | null;
  color: [number, number, number] | null;
  at: [number, number];
  replies: NoteThreadItem[];
}

export const savedNoteKey = (objNum: number): string => `S${objNum}`;
export const pendingNoteKey = (id: string): string => `P${id}`;

/** PDF 日期字符串（D:YYYYMMDDHHmmSS±hh'mm'）→ epoch 毫秒；无法解析返回 null */
export function parsePdfDate(s: string | null | undefined): number | null {
  if (!s) return null;
  const m =
    /^D:(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?(\d{2})?(?:([+\-Z])(?:(\d{2})'?(\d{2})?'?)?)?/.exec(
      s.trim(),
    );
  if (!m) return null;
  const [, y, mo, d, h, mi, se, tzSign, tzH, tzM] = m;
  const year = Number(y);
  const month = Number(mo ?? "1") - 1;
  const day = Number(d ?? "1");
  const hour = Number(h ?? "0");
  const min = Number(mi ?? "0");
  const sec = Number(se ?? "0");
  if (month < 0 || month > 11 || day < 1 || day > 31 || hour > 23 || min > 59 || sec > 59) {
    return null;
  }
  let ms = Date.UTC(year, month, day, hour, min, sec);
  if (tzSign === "+" || tzSign === "-") {
    const offMin = Number(tzH ?? "0") * 60 + Number(tzM ?? "0");
    ms += (tzSign === "+" ? -1 : 1) * offMin * 60_000;
  } else if (tzSign !== "Z") {
    ms = new Date(year, month, day, hour, min, sec).getTime();
  }
  return Number.isFinite(ms) ? ms : null;
}

/** pdf.js getAnnotations() 条目中本模块读取的字段 */
export interface PdfJsAnnotData {
  id: string;
  annotationType: number;
  rect: number[];
  color?: { [i: number]: number; length: number } | null;
  titleObj?: { str: string } | null;
  contentsObj?: { str: string } | null;
  creationDate?: string | null;
  modificationDate?: string | null;
  inReplyTo?: string | null;
  replyType?: string;
  hidden?: boolean;
}

/**
 * pdf.js 批注 → SavedNoteAnnot。非 Text、隐藏、无对象引用
 * （无法寻址删除/回复）与 /RT Group 成员的批注返回 null。
 */
export function toSavedNote(a: PdfJsAnnotData, pageIndex: number): SavedNoteAnnot | null {
  if (a.annotationType !== PDFJS_ANNOT_TEXT || a.hidden) return null;
  if (a.replyType === "Group") return null;
  const objNum = /^(\d+)R$/.exec(a.id);
  if (!objNum || !Array.isArray(a.rect) || a.rect.length !== 4) return null;
  const parent = a.inReplyTo ? /^(\d+)R$/.exec(a.inReplyTo) : null;
  const color =
    a.color && a.color.length >= 3
      ? ([a.color[0] / 255, a.color[1] / 255, a.color[2] / 255] as [number, number, number])
      : null;
  return {
    pageIndex,
    objNum: Number(objNum[1]),
    type: "note",
    rect: [a.rect[0], a.rect[1], a.rect[2], a.rect[3]],
    color,
    author: a.titleObj?.str ?? "",
    contents: a.contentsObj?.str ?? "",
    timeMs: parsePdfDate(a.creationDate) ?? parsePdfDate(a.modificationDate),
    inReplyTo: parent ? Number(parent[1]) : null,
  };
}

const byTime = (a: NoteThreadItem, b: NoteThreadItem): number => {
  if (a.timeMs === null && b.timeMs === null) return 0;
  if (a.timeMs === null) return 1;
  if (b.timeMs === null) return -1;
  return a.timeMs - b.timeMs;
};

/**
 * 将一页的已保存 + 待保存便签组装为线程。无法解析父级的回复（父级已被删除）
 * 提升为线程根而不是丢弃；畸形文件中的 /IRT 环也不会隐藏便签。
 * 回复按创建时间排序（时间未知排最后）；根顺序保持输入顺序。
 */
export function buildNoteThreads(
  saved: SavedNoteAnnot[],
  pending: { id: string; input: NoteInput }[],
): NoteThreadItem[] {
  const savedItems = new Map<number, NoteThreadItem>();
  for (const s of saved) {
    savedItems.set(s.objNum, {
      key: savedNoteKey(s.objNum),
      saved: s,
      pendingId: null,
      author: s.author,
      contents: s.contents,
      timeMs: s.timeMs,
      color: s.color,
      at: [s.rect[0], Math.max(s.rect[1], s.rect[3])],
      replies: [],
    });
  }
  const roots: NoteThreadItem[] = [];
  const attached = new Set<number>();
  for (const s of saved) {
    const item = savedItems.get(s.objNum);
    if (!item) continue;
    const parent = s.inReplyTo !== null ? savedItems.get(s.inReplyTo) : undefined;
    if (parent && parent !== item) {
      parent.replies.push(item);
      attached.add(s.objNum);
    } else {
      roots.push(item);
    }
  }
  // 环检测：无法从任何根到达的已挂载条目提升为根，避免重复出现
  const reachable = new Set<string>();
  const visit = (item: NoteThreadItem): void => {
    if (reachable.has(item.key)) return;
    reachable.add(item.key);
    for (const r of item.replies) visit(r);
  };
  for (const r of roots) visit(r);
  for (const objNum of attached) {
    const item = savedItems.get(objNum);
    if (!item || reachable.has(item.key)) continue;
    for (const other of savedItems.values()) {
      if (other !== item) other.replies = other.replies.filter((r) => r !== item);
    }
    roots.push(item);
    visit(item);
  }

  const pendingItems = new Map<string, NoteThreadItem>();
  for (const p of pending) {
    pendingItems.set(p.id, {
      key: pendingNoteKey(p.id),
      saved: null,
      pendingId: p.id,
      author: p.input.author ?? "",
      contents: p.input.contents,
      timeMs: p.input.createdMs ?? null,
      color: p.input.color,
      at: p.input.at,
      replies: [],
    });
  }
  for (const p of pending) {
    const item = pendingItems.get(p.id);
    if (!item) continue;
    const parent = p.input.replyToLocalId
      ? pendingItems.get(p.input.replyToLocalId)
      : p.input.replyToSaved
        ? savedItems.get(p.input.replyToSaved.objNum)
        : undefined;
    if (parent && parent !== item) parent.replies.push(item);
    else roots.push(item);
  }

  const sortReplies = (item: NoteThreadItem): void => {
    item.replies.sort(byTime);
    for (const r of item.replies) sortReplies(r);
  };
  for (const r of roots) sortReplies(r);
  return roots;
}

/** 线程的 DFS 展平（根在前），附每条的深度 */
export function flattenThread(root: NoteThreadItem): { item: NoteThreadItem; depth: number }[] {
  const out: { item: NoteThreadItem; depth: number }[] = [];
  const walk = (item: NoteThreadItem, depth: number): void => {
    out.push({ item, depth });
    for (const r of item.replies) walk(r, depth + 1);
  };
  walk(root, 0);
  return out;
}

/** 便签回复目标 → NoteReplyTarget（由已保存便签推导） */
export function noteReplyTarget(note: SavedNoteAnnot): NoteReplyTarget {
  return {
    objNum: note.objNum,
    rect: note.rect,
    contents: note.contents,
  };
}

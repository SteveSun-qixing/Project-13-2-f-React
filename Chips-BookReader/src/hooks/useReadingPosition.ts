import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReadingMode } from "../engine/types";

/** 阅读位置持久化键前缀，按书源十六进制编码隔离（与书签持久化同一套约定）。 */
const CONFIG_KEY_PREFIX = "book-reader.reading-position";

/** 阅读位置持久化写入节流间隔（毫秒）。 */
const POSITION_WRITE_THROTTLE_MS = 2000;

/**
 * 阅读位置捕获值（不含写入时间戳，时间戳在持久化时生成）。
 *
 * 由 ReaderShell 在收到进度更新时捕获，交给本 Hook 节流持久化。
 */
export interface ReadingPositionCapture {
  /** 当前章节索引（从 0 开始）。 */
  sectionIndex: number;
  /** 当前阅读模式。 */
  readingMode: ReadingMode;
  /** 分页模式的 spread 索引；滚动模式无意义时省略。 */
  spreadIndex?: number;
  /** 通用滚动进度 0–1（分页模式为 scrollLeft/maxScroll，滚动模式为 scrollTop/maxScroll）。 */
  scrollFraction?: number;
}

/** 持久化的阅读位置快照。 */
export interface ReadingPositionSnapshot extends ReadingPositionCapture {
  /** 位置写入的时间戳（毫秒）。 */
  updatedAt: number;
}

/**
 * 恢复动作，由批次 2 在 ReaderShell 中接线执行：
 * 目标章节渲染完成后，若当前阅读模式为分页且 spreadIndex 存在，则 controller.goToSpread(spreadIndex)；
 * 否则 controller.goToProgress(scrollFraction)。
 */
export interface PendingPositionRestore {
  /** 目标章节索引。 */
  sectionIndex: number;
  /** 保存时所在的阅读模式。 */
  readingMode: ReadingMode;
  /** 分页模式的目标 spread 索引（仅在保存时为分页模式时提供）。 */
  spreadIndex?: number;
  /** 通用滚动进度 0–1，作为分页模式外的兜底目标。 */
  scrollFraction: number;
}

export interface UseReadingPositionParams {
  /** 当前书源标识；无书时为 null。 */
  bookSourceId: string | null;
  /** 配置读写客户端（只使用 get / set / reset 三个能力）。 */
  configClient: {
    get<T = unknown>(key: string): Promise<T | undefined>;
    set<T = unknown>(key: string, value: T): Promise<void>;
    reset?(key?: string): Promise<void>;
  };
}

export interface UseReadingPositionReturn {
  /** 当前书源持久化的阅读位置快照；未保存或加载失败时为 null。 */
  savedPosition: ReadingPositionSnapshot | null;
  /** 捕获一次阅读位置；在 2s 节流窗口内合并写入，窗口结束时写入最新值。 */
  track: (capture: ReadingPositionCapture) => void;
  /** 立即落盘待写入的位置（换书 / 关闭前调用）。 */
  flush: () => void;
  /** 将持久化位置规范化为待执行恢复动作；位置无效时返回 null。 */
  restore: (position: ReadingPositionSnapshot) => PendingPositionRestore | null;
  /** 清除当前书源的持久化位置（"从头开始"时调用）。 */
  clear: () => void;
}

function encodeConfigKey(sourceId: string): string {
  return Array.from(new TextEncoder().encode(sourceId))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

function createConfigKey(sourceId: string): string {
  return `${CONFIG_KEY_PREFIX}.${encodeConfigKey(sourceId)}`;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeReadingMode(value: unknown): ReadingMode | null {
  return value === "paginated" || value === "scroll" ? value : null;
}

function normalizePositionFields(
  value: unknown,
): Pick<ReadingPositionSnapshot, "sectionIndex" | "readingMode" | "spreadIndex" | "scrollFraction"> | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (!isFiniteNumber(record.sectionIndex) || record.sectionIndex < 0) {
    return null;
  }

  const readingMode = normalizeReadingMode(record.readingMode);
  if (!readingMode) {
    return null;
  }

  const spreadIndex =
    isFiniteNumber(record.spreadIndex) && record.spreadIndex >= 0 ? Math.floor(record.spreadIndex) : undefined;
  const scrollFraction = isFiniteNumber(record.scrollFraction)
    ? Math.min(1, Math.max(0, record.scrollFraction))
    : undefined;

  return {
    sectionIndex: Math.floor(record.sectionIndex),
    readingMode,
    spreadIndex,
    scrollFraction,
  };
}

function normalizeSavedPosition(value: unknown): ReadingPositionSnapshot | null {
  const fields = normalizePositionFields(value);
  if (!fields) {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (!isFiniteNumber(record.updatedAt) || record.updatedAt <= 0) {
    return null;
  }

  return {
    ...fields,
    updatedAt: Math.floor(record.updatedAt),
  };
}

/**
 * 根据保存位置与全书章节数估算全书进度百分比（0–100），用于恢复提示展示。
 */
export function computeSavedPositionPercentage(position: ReadingPositionSnapshot, sectionCount: number): number {
  const count = Math.max(1, Math.floor(sectionCount) || 1);
  const sectionIndex = Math.max(0, Math.floor(position.sectionIndex));
  const fraction = Math.min(1, Math.max(0, position.scrollFraction ?? 0));
  const percentage = ((sectionIndex + fraction) / count) * 100;
  return Math.min(100, Math.max(0, Math.round(percentage)));
}

export function useReadingPosition(params: UseReadingPositionParams): UseReadingPositionReturn {
  const { bookSourceId, configClient } = params;
  const [savedPosition, setSavedPosition] = useState<ReadingPositionSnapshot | null>(null);

  const currentKeyRef = useRef<string | null>(null);
  const pendingCaptureRef = useRef<ReadingPositionCapture | null>(null);
  const throttleTimerRef = useRef<number | null>(null);
  const lastWriteAtRef = useRef(0);

  const writePendingNow = useCallback((): void => {
    if (throttleTimerRef.current !== null) {
      window.clearTimeout(throttleTimerRef.current);
      throttleTimerRef.current = null;
    }

    const pending = pendingCaptureRef.current;
    pendingCaptureRef.current = null;
    const key = currentKeyRef.current;
    const normalized = pending ? normalizePositionFields(pending) : null;
    if (!key || !normalized) {
      return;
    }

    lastWriteAtRef.current = Date.now();
    void configClient.set<ReadingPositionSnapshot>(key, {
      ...normalized,
      updatedAt: Date.now(),
    });
  }, [configClient]);

  const track = useCallback(
    (capture: ReadingPositionCapture): void => {
      pendingCaptureRef.current = capture;
      const elapsed = Date.now() - lastWriteAtRef.current;

      if (elapsed >= POSITION_WRITE_THROTTLE_MS) {
        writePendingNow();
        return;
      }

      if (throttleTimerRef.current !== null) {
        return;
      }

      throttleTimerRef.current = window.setTimeout(() => {
        throttleTimerRef.current = null;
        writePendingNow();
      }, POSITION_WRITE_THROTTLE_MS - elapsed);
    },
    [writePendingNow],
  );

  const flush = useCallback((): void => {
    writePendingNow();
  }, [writePendingNow]);

  const restore = useCallback((position: ReadingPositionSnapshot): PendingPositionRestore | null => {
    const normalized = normalizePositionFields(position);
    if (!normalized) {
      return null;
    }

    return {
      sectionIndex: normalized.sectionIndex,
      readingMode: normalized.readingMode,
      spreadIndex: normalized.readingMode === "paginated" ? normalized.spreadIndex : undefined,
      scrollFraction: normalized.scrollFraction ?? 0,
    };
  }, []);

  const clear = useCallback((): void => {
    if (throttleTimerRef.current !== null) {
      window.clearTimeout(throttleTimerRef.current);
      throttleTimerRef.current = null;
    }
    pendingCaptureRef.current = null;
    setSavedPosition(null);

    const key = currentKeyRef.current;
    if (!key) {
      return;
    }

    if (typeof configClient.reset === "function") {
      void configClient.reset(key);
    } else {
      void configClient.set<ReadingPositionSnapshot | null>(key, null);
    }
  }, [configClient]);

  const writePendingNowRef = useRef<() => void>(writePendingNow);
  writePendingNowRef.current = writePendingNow;

  useEffect(() => {
    writePendingNowRef.current();

    if (!bookSourceId) {
      currentKeyRef.current = null;
      setSavedPosition(null);
      return;
    }

    const key = createConfigKey(bookSourceId);
    currentKeyRef.current = key;
    let cancelled = false;

    void configClient.get<ReadingPositionSnapshot>(key).then((stored) => {
      if (cancelled) {
        return;
      }

      setSavedPosition(normalizeSavedPosition(stored));
    });

    return () => {
      cancelled = true;
    };
  }, [bookSourceId, configClient]);

  useEffect(() => {
    return () => {
      writePendingNowRef.current();
    };
  }, []);

  return useMemo<UseReadingPositionReturn>(
    () => ({
      savedPosition,
      track,
      flush,
      restore,
      clear,
    }),
    [clear, flush, restore, savedPosition, track],
  );
}

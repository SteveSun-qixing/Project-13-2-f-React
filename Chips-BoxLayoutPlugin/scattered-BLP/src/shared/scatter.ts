import type { BoxEntrySnapshot } from "./types";

export interface ScatterPlacement {
  x: number;
  y: number;
  rotate: number;
  scale: number;
  colorIndex: number;
}

export type ScatteredSortMode = "manual" | "name" | "random";
export type ScatteredSpread = "calm" | "loose" | "wild";

const SPREAD_MULTIPLIER: Record<ScatteredSpread, number> = {
  calm: 0.56,
  loose: 0.82,
  wild: 1.08,
};

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createRandom(seed: string): () => number {
  let state = hashString(seed) || 0x9e3779b9;
  return () => {
    state += 0x6d2b79f5;
    let next = state;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function resolveEntryTitle(entry: BoxEntrySnapshot): string {
  return entry.snapshot.title ?? entry.snapshot.documentId ?? entry.entryId;
}

export function orderScatteredEntries(
  entries: BoxEntrySnapshot[],
  sortMode: ScatteredSortMode,
  seed: string,
): BoxEntrySnapshot[] {
  if (sortMode === "manual") {
    return entries;
  }

  if (sortMode === "name") {
    return [...entries].sort((left, right) => {
      const compared = resolveEntryTitle(left).localeCompare(resolveEntryTitle(right), "zh-CN");
      return compared === 0 ? left.entryId.localeCompare(right.entryId) : compared;
    });
  }

  return [...entries].sort((left, right) => {
    const leftRank = hashString(`${seed}:${left.entryId}`);
    const rightRank = hashString(`${seed}:${right.entryId}`);
    return leftRank === rightRank ? left.entryId.localeCompare(right.entryId) : leftRank - rightRank;
  });
}

export function createScatterPlacements(
  count: number,
  seed: string,
  spread: ScatteredSpread,
): ScatterPlacement[] {
  const safeCount = Math.max(0, Math.min(32, Math.round(count)));
  const random = createRandom(`${seed}:${spread}:${safeCount}`);
  const multiplier = SPREAD_MULTIPLIER[spread];

  return Array.from({ length: safeCount }, (_, index) => {
    const depth = safeCount <= 1 ? 1 : index / (safeCount - 1);
    const radius = multiplier * (0.28 + random() * 0.72);
    return {
      x: Math.round((random() - 0.5) * 52 * radius),
      y: Math.round((random() - 0.5) * 40 * radius),
      rotate: Math.round((random() - 0.5) * 34 * multiplier),
      scale: Number((0.82 + depth * 0.14 + random() * 0.05).toFixed(3)),
      colorIndex: Math.floor(random() * 7),
    };
  });
}

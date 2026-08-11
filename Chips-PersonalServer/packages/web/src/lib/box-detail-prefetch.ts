import { boxesApi, type BoxDetail } from '../api/content';

const boxDetailCache = new Map<string, Promise<BoxDetail>>();

export function prefetchBoxDetail(boxId: string): Promise<BoxDetail> {
  const existing = boxDetailCache.get(boxId);
  if (existing) {
    return existing;
  }

  const next = boxesApi.getBox(boxId).catch((error) => {
    boxDetailCache.delete(boxId);
    throw error;
  });
  boxDetailCache.set(boxId, next);
  return next;
}

export function readPrefetchedBoxDetail(boxId: string): Promise<BoxDetail> | null {
  return boxDetailCache.get(boxId) ?? null;
}

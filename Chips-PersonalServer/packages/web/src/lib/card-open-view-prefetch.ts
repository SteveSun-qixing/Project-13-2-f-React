import { cardsApi, type CardOpenView } from '../api/content';

const cardOpenViewCache = new Map<string, Promise<CardOpenView>>();

export function prefetchCardOpenView(cardId: string): Promise<CardOpenView> {
  const existing = cardOpenViewCache.get(cardId);
  if (existing) {
    return existing;
  }

  const next = cardsApi.getCardOpenView(cardId).catch((error) => {
    cardOpenViewCache.delete(cardId);
    throw error;
  });
  cardOpenViewCache.set(cardId, next);
  return next;
}

export function readPrefetchedCardOpenView(cardId: string): Promise<CardOpenView> | null {
  return cardOpenViewCache.get(cardId) ?? null;
}

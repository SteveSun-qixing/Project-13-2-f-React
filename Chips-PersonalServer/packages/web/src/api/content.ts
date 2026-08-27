import { apiClient } from './client';

export interface CardSummary {
  id: string;
  title: string;
  coverUrl: string | null;
  coverRatio: string | null;
  htmlUrl: string | null;
  status: 'pending' | 'ready' | 'error';
  visibility: 'public' | 'private';
  createdAt: string;
}

export interface BoxSummary {
  id: string;
  title: string;
  coverUrl: string | null;
  coverRatio: string | null;
  documentUrl: string | null;
  layoutPlugin: string | null;
  visibility: 'public' | 'private';
  createdAt: string;
}

export interface CardDetail {
  id: string;
  cardFileId: string | null;
  title: string;
  coverUrl: string | null;
  coverRatio: string | null;
  htmlUrl: string | null;
  status: 'pending' | 'ready' | 'error';
  visibility: 'public' | 'private';
  fileSizeBytes: number | null;
  cardMetadata: unknown;
  cardStructure: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface CardOpenView {
  id: string;
  title: string;
  coverUrl: string | null;
  coverRatio: string | null;
  viewUrl: string;
  viewState?: 'ready' | 'pending' | 'error';
  status: 'pending' | 'ready' | 'error';
  visibility: 'public' | 'private';
  createdAt: string;
  updatedAt: string;
}

export interface EnrichedBoxEntryRef {
  entry_id: string;
  url: string;
  document_id?: string;
  title?: string;
  cover_url?: string;
  content_type?: string;
  embedded: boolean;
  communityCardId?: string;
  communityViewUrl?: string;
}

export interface CardStatus {
  cardId: string;
  status: 'pending' | 'ready' | 'error';
  errorMessage: string | null;
  htmlUrl: string | null;
  viewUrl?: string | null;
  hasRenderArtifacts: boolean;
  updatedAt: string;
}

export interface BoxDetail {
  id: string;
  boxFileId: string | null;
  title: string;
  coverUrl: string | null;
  coverRatio: string | null;
  documentUrl: string | null;
  layoutPlugin: string | null;
  visibility: 'public' | 'private';
  fileSizeBytes: number | null;
  metadata: unknown;
  cards?: EnrichedBoxEntryRef[];
  createdAt: string;
  updatedAt: string;
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface PaginatedEnvelope<T> {
  data: T[];
  pagination: Pagination;
}

async function fetchAllPages<T>(
  loader: (page: number, pageSize: number) => Promise<PaginatedEnvelope<T>>,
  pageSize = 100,
): Promise<T[]> {
  const firstPage = await loader(1, pageSize);

  if (firstPage.pagination.totalPages <= 1) {
    return firstPage.data;
  }

  const remainingPages = Array.from(
    { length: firstPage.pagination.totalPages - 1 },
    (_, index) => loader(index + 2, pageSize),
  );
  const rest = await Promise.all(remainingPages);

  return [firstPage, ...rest].flatMap((page) => page.data);
}

export const cardsApi = {
  async getCard(cardId: string) {
    const res = await apiClient.get<{ data: CardDetail }>(`/cards/${cardId}`);
    return res.data;
  },

  async getCardOpenView(cardId: string) {
    const res = await apiClient.get<{ data: CardOpenView }>(`/cards/${cardId}/open-view`);
    return res.data;
  },

  async getCardStatus(cardId: string) {
    const res = await apiClient.get<{ data: CardStatus }>(`/cards/${cardId}/status`);
    return res.data;
  },

  async getAllCards() {
    return fetchAllPages<CardSummary>((page, pageSize) =>
      apiClient.get<PaginatedEnvelope<CardSummary>>('/cards', { page, pageSize }),
    );
  },
};

export const boxesApi = {
  async getBox(boxId: string) {
    const res = await apiClient.get<{ data: BoxDetail }>(`/boxes/${boxId}`);
    return res.data;
  },

  async getAllBoxes() {
    return fetchAllPages<BoxSummary>((page, pageSize) =>
      apiClient.get<PaginatedEnvelope<BoxSummary>>('/boxes', { page, pageSize }),
    );
  },
};

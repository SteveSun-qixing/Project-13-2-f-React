export type CommunityWorkType = 'card' | 'box';

export interface CommunityWorkItem {
  id: string;
  type: CommunityWorkType;
  title: string;
  coverUrl: string | null;
  coverRatio: string | null;
  href: string;
  createdAt: string;
}

export function getCommunityWorkSelectionKey(item: Pick<CommunityWorkItem, 'type' | 'id'>): string {
  return `${item.type}:${item.id}`;
}

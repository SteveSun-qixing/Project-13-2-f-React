/**
 * 卡片会话 undo/redo 历史栈
 *
 * 基于 Host 公共泛型历史栈（`src/shared/history.ts`），快照为卡片会话深拷贝。
 */

import { HistoryStack } from '../../../../src/shared/history';
import type { CardSessionSnapshot } from './types';

export class CardSessionHistory extends HistoryStack<CardSessionSnapshot> {
  protected override clone(snapshot: CardSessionSnapshot): CardSessionSnapshot {
    return {
      ...snapshot,
      metadata: {
        ...snapshot.metadata,
        tags: snapshot.metadata.tags ? [...snapshot.metadata.tags] : undefined,
      },
      cover: {
        html: snapshot.cover.html,
        ratio: snapshot.cover.ratio,
        resources: snapshot.cover.resources.map((resource) => ({
          path: resource.path,
          data: new Uint8Array(resource.data),
        })),
      },
      structure: {
        layout: { ...snapshot.structure.layout },
        basicCards: snapshot.structure.basicCards.map((basicCard) => ({
          ...basicCard,
          data: JSON.parse(JSON.stringify(basicCard.data)) as Record<string, unknown>,
        })),
      },
    };
  }
}

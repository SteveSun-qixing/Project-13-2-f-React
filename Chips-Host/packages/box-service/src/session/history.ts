/**
 * 箱子会话历史：基于 Host 公共泛型历史栈
 */

import { HistoryStack } from '../../../../src/shared/history';
import type { BoxSessionSnapshot } from './types';

export class BoxSessionHistory extends HistoryStack<BoxSessionSnapshot> {
  protected override clone(snapshot: BoxSessionSnapshot): BoxSessionSnapshot {
    return {
      ...snapshot,
      metadata: {
        ...snapshot.metadata,
        tags: snapshot.metadata.tags ? [...snapshot.metadata.tags] : undefined,
      },
      content: {
        activeLayoutType: snapshot.content.activeLayoutType,
        layoutConfigs: Object.fromEntries(
          Object.entries(snapshot.content.layoutConfigs).map(([layoutType, config]) => [
            layoutType,
            JSON.parse(JSON.stringify(config)) as typeof config,
          ]),
        ),
      },
      entries: snapshot.entries.map((entry) => JSON.parse(JSON.stringify(entry)) as typeof entry),
      assets: [...snapshot.assets],
    };
  }
}

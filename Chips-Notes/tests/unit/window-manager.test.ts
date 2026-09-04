import { describe, expect, it } from 'vitest';
import { WindowManager } from '../../src/core/window-manager';

describe('WindowManager', () => {
  it('keeps default card window geometry when optional overrides are undefined', () => {
    const manager = new WindowManager();

    const windowId = manager.createCardWindow('card-1', {
      title: '新卡片.card',
      position: undefined,
      size: undefined,
      isEditing: true,
    });

    expect(manager.getWindow(windowId)).toMatchObject({
      id: windowId,
      type: 'card',
      cardId: 'card-1',
      title: '新卡片.card',
      position: { x: 100, y: 100 },
      size: { width: 400, height: 600 },
      isEditing: true,
    });
  });
});

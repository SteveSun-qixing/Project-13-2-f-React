import { describe, expect, it } from 'vitest';
import type { IAppContext } from '@chips/sdk';
import plugin from '../src/index';

function createContext(titles: string[]): IAppContext {
  return {
    appId: 'chips.official.photo-viewer',
    window: {
      setTitle: async (title: string): Promise<void> => {
        titles.push(title);
      },
    },
    logger: {
      debug: (): void => undefined,
      info: (): void => undefined,
      warn: (): void => undefined,
      error: (): void => undefined,
    },
  } as unknown as IAppContext;
}

describe('AppPlugin.launch', () => {
  it('启动时把窗口标题设为插件显示名', async () => {
    const titles: string[] = [];
    await plugin.launch(createContext(titles));
    expect(titles).toEqual(['图片查看器']);
  });
});

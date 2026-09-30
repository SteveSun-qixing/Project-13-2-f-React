import { describe, expect, it } from 'vitest';
import type { IAppContext } from '@chips/sdk';
import plugin from '../src/index';

function createContext(titles: string[]): IAppContext {
  return {
    appId: 'chips.official.rich-text-editor',
    window: {
      setTitle: (title: string): Promise<void> => {
        titles.push(title);
        return Promise.resolve();
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
    expect(titles).toEqual(['富文本编辑器']);
  });
});

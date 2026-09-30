import { describe, expect, it } from 'vitest';
import type { IAppContext } from '@chips/sdk';
import plugin from '../src/index';

function createContext(overrides: {
  titles?: string[];
  infos?: unknown[];
  args?: Record<string, unknown>;
}): IAppContext {
  return {
    appId: 'chips.official.photo-viewer',
    args: overrides.args ?? { source: 'launcher', files: [] },
    window: {
      setTitle: (title: string): Promise<void> => {
        overrides.titles?.push(title);
        return Promise.resolve();
      },
    },
    logger: {
      debug: (): void => undefined,
      info: (message: string): void => {
        overrides.infos?.push(message);
      },
      warn: (): void => undefined,
      error: (): void => undefined,
    },
  } as unknown as IAppContext;
}

describe('AppPlugin.launch', () => {
  it('启动时把窗口标题设为插件显示名', async () => {
    const titles: string[] = [];
    await plugin.launch(createContext({ titles }));
    expect(titles).toEqual(['图片查看器']);
  });

  it('资源打开投递启动时以文件名前置窗口标题并记录启动来源', async () => {
    const titles: string[] = [];
    const infos: unknown[] = [];
    await plugin.launch(
      createContext({
        titles,
        infos,
        args: {
          source: 'file-association',
          files: ['chips-resource://ws/demo/photo.png'],
          resourceOpen: {
            intent: 'view',
            origin: 'os-association',
            uri: 'chips-resource://ws/demo/photo.png',
            mimeType: 'image/png',
            slot: 'mime:image/png',
            fileName: 'photo.png',
          },
        },
      }),
    );
    expect(titles).toEqual(['photo.png · 图片查看器']);
    expect(infos).toContain('应用已启动');
  });
});

describe('AppPlugin.openFile', () => {
  it('运行中投递以文件名前置窗口标题（上下文经 resource:opened 事件面送达界面）', async () => {
    const titles: string[] = [];
    await plugin.launch(createContext({ titles }));
    titles.length = 0;
    await plugin.openFile?.('chips-resource://ws/另一个/封面.webp');
    expect(titles).toEqual(['封面.webp · 图片查看器']);
  });
});

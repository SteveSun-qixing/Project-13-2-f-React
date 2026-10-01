import { describe, expect, it } from 'vitest';
import type { IAppContext } from '@chips/sdk';
import plugin from '../src/index';

function createContext(
  titles: string[],
  args: Record<string, unknown> = { source: 'launcher', files: [] },
): IAppContext {
  return {
    appId: 'chips.official.notes',
    args,
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
  it('启动时把窗口标题设为插件显示名并记录启动来源', async () => {
    const titles: string[] = [];
    await plugin.launch(createContext(titles));
    expect(titles).toEqual(['笔记']);
  });

  it('CLI 打开命令目标启动时标题保持插件显示名（领域消费在窗口会话内进行）', async () => {
    const titles: string[] = [];
    await plugin.launch(
      createContext(titles, {
        source: 'cli',
        command: 'notes:open-card',
        path: '~/文档/示例.card',
        files: ['~/文档/示例.card'],
      }),
    );
    expect(titles).toEqual(['笔记']);
  });
});

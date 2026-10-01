import { describe, expect, it } from 'vitest';
import type { IAppContext } from '@chips/sdk';
import plugin from '../src/index';

function createContext(
  titles: string[],
  args: Record<string, unknown> = { source: 'launcher', files: [] },
): IAppContext {
  return {
    appId: 'chips.official.resource-manager',
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
  it('启动时把窗口标题设为插件显示名（未绑定工作区时为应用名，§2.1 标题规则）', async () => {
    const titles: string[] = [];
    await plugin.launch(createContext(titles));
    expect(titles).toEqual(['资源管理器']);
  });

  it('CLI 打开命令目标启动时标题保持应用名（领域消费在窗口会话内进行）', async () => {
    const titles: string[] = [];
    await plugin.launch(
      createContext(titles, {
        source: 'cli',
        command: 'resource-manager:open-card',
        path: '~/文档/素材.box',
        files: ['~/文档/素材.box'],
      }),
    );
    expect(titles).toEqual(['资源管理器']);
  });
});

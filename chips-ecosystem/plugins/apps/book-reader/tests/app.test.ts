import { describe, expect, it } from 'vitest';
import type { IAppContext, IAppLogger, IAppWindow } from '@chips/sdk';
import type { IResourceOpenContext } from '@chips/sdk';
import plugin from '../src/index';

const LAUNCHER_CONTEXT_BASE = {
  appId: 'chips.official.book-reader',
  surface: 'window',
  launcher: null,
  lifecycle: {
    beforeExit: (): { dispose(): void } => ({ dispose: (): void => undefined }),
  },
  bridge: {},
  config: {},
  inject: (): void => undefined,
  on: (): { dispose(): void } => ({ dispose: (): void => undefined }),
  once: (): { dispose(): void } => ({ dispose: (): void => undefined }),
  emit: (): void => undefined,
  effect: (): void => undefined,
} as unknown as Record<string, unknown>;

function createWindow(titles: string[]): IAppWindow {
  return {
    id: 1,
    close: (): Promise<void> => Promise.resolve(),
    focus: (): Promise<void> => Promise.resolve(),
    setTitle: (title: string): Promise<void> => {
      titles.push(title);
      return Promise.resolve();
    },
    setSize: (): Promise<void> => Promise.resolve(),
  };
}

function createLogger(logs: Array<{ level: string; message: string }>): IAppLogger {
  const write =
    (level: string) =>
    (message: string): void => {
      logs.push({ level, message });
    };
  return {
    debug: write('debug'),
    info: write('info'),
    warn: write('warn'),
    error: write('error'),
  };
}

function createContext(options: {
  titles: string[];
  logs: Array<{ level: string; message: string }>;
  args?: Record<string, unknown>;
  withWindow?: boolean;
}): IAppContext {
  return {
    ...LAUNCHER_CONTEXT_BASE,
    args: options.args ?? { source: 'launcher', files: [] },
    window: options.withWindow === false ? null : createWindow(options.titles),
    logger: createLogger(options.logs),
  } as unknown as IAppContext;
}

const RESOURCE_OPEN_CONTEXT: IResourceOpenContext = {
  intent: 'view',
  origin: 'os-association',
  uri: 'chips-resource://temp-7a3f/report.pdf',
  mimeType: 'application/pdf',
  extension: '.pdf',
  fileName: 'report.pdf',
  slot: 'mime:application/pdf',
};

describe('AppPlugin.launch', () => {
  it('启动器来源启动时把窗口标题设为插件显示名', async () => {
    const titles: string[] = [];
    const logs: Array<{ level: string; message: string }> = [];
    await plugin.launch(createContext({ titles, logs }));
    expect(titles).toEqual(['书籍阅读器']);
    expect(logs.some((log) => log.message === '应用已启动')).toBe(true);
  });

  it('资源打开来源启动时把窗口标题收敛为书籍名并记录投递事实', async () => {
    const titles: string[] = [];
    const logs: Array<{ level: string; message: string }> = [];
    await plugin.launch(
      createContext({
        titles,
        logs,
        args: {
          source: 'file-association',
          files: [RESOURCE_OPEN_CONTEXT.uri],
          resourceOpen: RESOURCE_OPEN_CONTEXT,
        },
      })
    );
    expect(titles).toEqual(['report.pdf - 书籍阅读器']);
    expect(logs.some((log) => log.message === '已接收资源打开上下文')).toBe(true);
  });

  it('openFile 记录运行中投递', async () => {
    const titles: string[] = [];
    const logs: Array<{ level: string; message: string }> = [];
    await plugin.launch(createContext({ titles, logs }));
    await plugin.openFile?.('chips-resource://temp-7a3f/another.epub');
    expect(logs.some((log) => log.message === '已接收文件打开投递')).toBe(true);
  });
});

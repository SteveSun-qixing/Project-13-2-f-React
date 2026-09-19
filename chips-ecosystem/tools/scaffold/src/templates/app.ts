import type { IScaffoldContext, IScaffoldFile } from '../types.js';

/** `app` 角色模板：一个带窗口界面与启动器入口的最小应用插件。 */

const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <rect x="3" y="4" width="18" height="16" rx="2" />
  <path d="M3 9h18" stroke-linecap="round" />
  <circle cx="6.5" cy="6.5" r="0.75" fill="currentColor" stroke="none" />
  <circle cx="9" cy="6.5" r="0.75" fill="currentColor" stroke="none" />
</svg>
`;

function indexTs(context: IScaffoldContext): string {
  return `import type { IAppContext, IAppPlugin } from '@chips/sdk';

/**
 * 应用插件主逻辑。
 *
 * 模块顶层只允许声明；窗口标题与日志等副作用全部集中在 launch。
 */
class AppPlugin implements IAppPlugin {
  public async launch(ctx: IAppContext): Promise<void> {
    const appWindow = ctx.window;
    if (appWindow !== null) {
      await appWindow.setTitle('${context.options.name}');
    }
    ctx.logger.info('应用已启动', { appId: ctx.appId });
  }
}

export default new AppPlugin();
`;
}

function appViewTsx(context: IScaffoldContext): string {
  return `import React from 'react';
import { Button, ChipsProvider, theme } from '@chips/ui';

const APP_ID = '${context.options.pluginId}';

/** 应用界面内容：处于 ChipsProvider 提供的窗口级运行环境内（令牌与消息上下文可用）。 */
const AppContent: React.FC = () => {
  const { token } = theme.useToken();
  const [count, setCount] = React.useState(0);

  return (
    <section
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: token.marginSM,
        padding: token.padding,
      }}
    >
      <p style={{ margin: 0 }}>你好，这是「${context.options.name}」的应用界面。</p>
      <Button type="primary" onClick={() => setCount((value) => value + 1)}>
        点击次数：{count}
      </Button>
    </section>
  );
};

/**
 * 应用窗口界面根组件：render.js 的默认导出，由平台窗口壳装载。
 *
 * 挂载窗口级 ChipsProvider 一次（appId 与 manifest 一致、surface 与 manifest ui.surface 一致），
 * 包裹整个应用界面树；不得重复挂载或自建主题根（《@chips/ui 共享层使用指南》§3.1）。
 */
export const AppView: React.FC = () => (
  <ChipsProvider appId={APP_ID} surface="window">
    <AppContent />
  </ChipsProvider>
);

export default AppView;
`;
}

function testsTs(context: IScaffoldContext): string {
  return `import { describe, expect, it } from 'vitest';
import type { IAppContext } from '@chips/sdk';
import plugin from '../src/index';

function createContext(titles: string[]): IAppContext {
  return {
    appId: '${context.options.pluginId}',
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
    expect(titles).toEqual(['${context.options.name}']);
  });
});
`;
}

/** 构建 `app` 角色的全部角色文件（公共文件由模板装配器补充）。 */
export function buildAppFiles(context: IScaffoldContext): IScaffoldFile[] {
  return [
    { path: 'src/index.ts', content: indexTs(context) },
    { path: 'src/ui/AppView.tsx', content: appViewTsx(context) },
    { path: 'assets/icons/app.svg', content: ICON_SVG },
    { path: 'tests/app.test.ts', content: testsTs(context) },
  ];
}

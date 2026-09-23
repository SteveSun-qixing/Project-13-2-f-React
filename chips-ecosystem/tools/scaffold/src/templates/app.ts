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

function commandsTs(context: IScaffoldContext): string {
  return `import type { ICommandDefinition } from '@chips/sdk';
import type { ICommandLocalRegistration } from '@chips/ui';

/** 插件 ID（与 manifest.id 一致）。 */
export const APP_PLUGIN_ID = '${context.options.pluginId}';

/** 命令命名空间：取插件 ID 末段（《13-命令系统契约》§2.1）。 */
export const APP_COMMAND_DOMAIN = '${context.capabilityId}';

/** 运行时命令 ID；与 manifest \`cli.commands\` 声明逐字对应。 */
export const APP_COMMAND_IDS = {
  openCard: '${context.capabilityId}:open-card',
  refreshView: '${context.capabilityId}:refresh-view',
} as const;

/** ui 目标命令的本地处理器标识（《13-命令系统契约》§2.2，与注册记录配对）。 */
export const APP_COMMAND_HANDLER_IDS = {
  openCard: 'open-card',
  refreshView: 'refresh-view',
} as const;

/**
 * 可序列化命令元数据：注册进平台命令注册表的纯数据对象。
 *
 * 全部字段为 JSON 可往返的普通数据（无函数、无类实例）；界面文案简体中文直写，
 * 快捷键文法见《13-命令系统契约》§2.6。
 */
export const appCommandDefinitions: readonly ICommandDefinition[] = [
  {
    id: APP_COMMAND_IDS.openCard,
    title: '打开卡片',
    description: '打开指定的卡片文件并在主窗口中展示',
    shortcut: 'CommandOrControl+O',
    scope: { kind: 'app', appId: APP_PLUGIN_ID },
    handlerId: APP_COMMAND_HANDLER_IDS.openCard,
    keywords: ['open', 'card', '打开', '卡片'],
    group: '文件',
  },
  {
    id: APP_COMMAND_IDS.refreshView,
    title: '刷新当前视图',
    description: '重新拉取当前展示数据',
    shortcut: 'F5',
    scope: { kind: 'app', appId: APP_PLUGIN_ID },
    handlerId: APP_COMMAND_HANDLER_IDS.refreshView,
    keywords: ['refresh', '刷新'],
    group: '视图',
  },
];

export type AppCommandId = (typeof APP_COMMAND_IDS)[keyof typeof APP_COMMAND_IDS];
export type AppCommandHandlerId =
  (typeof APP_COMMAND_HANDLER_IDS)[keyof typeof APP_COMMAND_HANDLER_IDS];

const APP_COMMAND_ID_SET: ReadonlySet<string> = new Set<string>(Object.values(APP_COMMAND_IDS));

/** 判定命令 ID 是否属于本应用的命令记录（可见性由平台保证，此守卫为防御性复核）。 */
export function isAppCommandId(commandId: string): boolean {
  return APP_COMMAND_ID_SET.has(commandId);
}

/** 派发执行记录：本地处理器执行后上报给界面层消费。 */
export interface AppCommandStatus {
  readonly commandId: string;
  readonly handlerId: AppCommandHandlerId;
  readonly payload: unknown;
}

/**
 * 构造与 \`command:invoked\` 派发配对的本地处理器集合（《13-命令系统契约》§5.6）。
 *
 * 每条注册以 \`(commandId, handlerId)\` 与平台登记记录配对；处理器体执行对应命令的
 * 业务侧效应，本样例把执行记录上报给界面层展示。
 */
export function createAppCommandHandlers(
  notify: (status: AppCommandStatus) => void,
): readonly ICommandLocalRegistration[] {
  return appCommandDefinitions.map((definition) => {
    const handlerId = (definition.handlerId ?? '') as AppCommandHandlerId;
    return {
      commandId: definition.id,
      handlerId,
      handler: (payload: unknown): void => {
        notify({ commandId: definition.id, handlerId, payload });
      },
    };
  });
}
`;
}

function useAppCommandsTs(): string {
  return `import { useCallback, useEffect, useState } from 'react';
import { chips } from '@chips/sdk';
import { useCommandRuntime } from '@chips/ui';
import {
  APP_COMMAND_IDS,
  appCommandDefinitions,
  createAppCommandHandlers,
  type AppCommandStatus,
} from './appCommands';

/** 命令注册阶段：注册中 → 就绪；失败进入 error 并携带错误码。 */
export type CommandRegistryPhase = 'registering' | 'ready' | 'error';

/** 注册阶段的简体中文展示文案。 */
export const COMMAND_PHASE_LABELS: Readonly<Record<CommandRegistryPhase, string>> = {
  registering: '命令注册中',
  ready: '命令已就绪',
  error: '命令通道异常',
};

function toErrorCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string' && code.length > 0) {
      return code;
    }
  }
  return 'COMMAND_RUNTIME_ERROR';
}

/** \`useAppCommands\` 返回值。 */
export interface UseAppCommandsResult {
  readonly phase: CommandRegistryPhase;
  readonly errorCode: string | null;
  readonly lastInvoked: AppCommandStatus | null;
  invokeOpenCard(path: string): Promise<void>;
  invokeRefreshView(): Promise<void>;
}

/**
 * 应用 UI 命令运行时接线（《13-命令系统契约》§5.6 与 §5.7）。
 *
 * 装配顺序：
 * 1. 挂载时逐条 \`chips.request('command:register', { definition })\` 注册携带
 *    \`handlerId\` 的命令记录（权限 \`command:write\`，见 manifest permissions）；
 * 2. 用 \`@chips/ui\` 命令运行时的 \`attach\` 绑定本地处理器；运行时订阅
 *    \`command:invoked\`，按 \`(commandId, handlerId)\` 配对执行；
 * 3. 卸载时撤销订阅并注销命令记录（\`command:unregister\` 幂等）。
 *
 * \`command:*\` 能力的生产派发随宿主能力面逐能力派单；Bridge 不可用或能力未就绪时，
 * 注册失败收敛为 \`phase: 'error'\` 与错误码，界面不抛错。
 */
export function useAppCommands(): UseAppCommandsResult {
  const runtime = useCommandRuntime();
  const [phase, setPhase] = useState<CommandRegistryPhase>('registering');
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [lastInvoked, setLastInvoked] = useState<AppCommandStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    let detach: { dispose(): void } | null = null;
    setPhase('registering');
    setErrorCode(null);
    void (async (): Promise<void> => {
      try {
        for (const definition of appCommandDefinitions) {
          await chips.request('command:register', { definition });
        }
        if (cancelled) {
          return;
        }
        detach = runtime.attach(createAppCommandHandlers(setLastInvoked));
        setPhase('ready');
      } catch (error: unknown) {
        if (!cancelled) {
          setErrorCode(toErrorCode(error));
          setPhase('error');
        }
      }
    })();
    return () => {
      cancelled = true;
      detach?.dispose();
      for (const definition of appCommandDefinitions) {
        const settled = chips.request('command:unregister', { commandId: definition.id });
        void settled.catch((): undefined => undefined);
      }
    };
  }, [runtime]);

  const invokeCommand = useCallback(
    async (commandId: string, payload?: unknown): Promise<void> => {
      try {
        if (payload === undefined) {
          await runtime.invoke({ commandId, source: 'api' });
        } else {
          await runtime.invoke({ commandId, payload, source: 'api' });
        }
        setErrorCode(null);
      } catch (error: unknown) {
        setErrorCode(toErrorCode(error));
      }
    },
    [runtime],
  );

  return {
    phase,
    errorCode,
    lastInvoked,
    invokeOpenCard: (path: string): Promise<void> =>
      invokeCommand(APP_COMMAND_IDS.openCard, { path }),
    invokeRefreshView: (): Promise<void> => invokeCommand(APP_COMMAND_IDS.refreshView),
  };
}
`;
}

function appViewTsx(context: IScaffoldContext): string {
  return `import React from 'react';
import { Button, ChipsProvider, CommandProvider, theme } from '@chips/ui';
import { COMMAND_PHASE_LABELS, useAppCommands } from '../commands/useAppCommands';

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
 * 命令消费展示区：挂载命令注册状态与 \`command:invoked\` 派发执行记录。
 *
 * 两个按钮以 \`source: 'api'\` 经 \`command:invoke\` 触发本应用登记的 ui 目标命令，
 * 平台向本窗口派发后由 \`attach\` 的本地处理器执行并回写状态。
 */
const CommandSection: React.FC = () => {
  const { token } = theme.useToken();
  const { phase, errorCode, lastInvoked, invokeOpenCard, invokeRefreshView } = useAppCommands();

  return (
    <section
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: token.marginXS,
        paddingInline: token.padding,
        paddingBottom: token.padding,
      }}
    >
      <p style={{ margin: 0 }}>命令注册状态：{COMMAND_PHASE_LABELS[phase]}</p>
      {errorCode === null ? null : <p style={{ margin: 0 }}>最近错误码：{errorCode}</p>}
      <div style={{ display: 'flex', gap: token.marginXS }}>
        <Button onClick={() => void invokeOpenCard('~/文档/示例.cpk')}>触发打开卡片命令</Button>
        <Button onClick={() => void invokeRefreshView()}>触发刷新视图命令</Button>
      </div>
      <p style={{ margin: 0 }}>
        {lastInvoked === null
          ? '本窗口尚未执行过命令派发'
          : '最近执行：' + lastInvoked.commandId}
      </p>
    </section>
  );
};

/**
 * 应用窗口界面根组件：render.js 的默认导出，由平台窗口壳装载。
 *
 * 挂载窗口级 ChipsProvider 一次（appId 与 manifest 一致、surface 与 manifest ui.surface 一致），
 * 包裹整个应用界面树；不得重复挂载或自建主题根（《@chips/ui 共享层使用指南》§3.1）。
 * CommandProvider 为窗口内命令运行时单例（《13-命令系统契约》§5.6），包裹全部命令消费组件。
 */
export const AppView: React.FC = () => (
  <ChipsProvider appId={APP_ID} surface="window">
    <CommandProvider>
      <AppContent />
      <CommandSection />
    </CommandProvider>
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

function commandsTestTs(): string {
  return `import { describe, expect, it } from 'vitest';
import {
  APP_COMMAND_DOMAIN,
  APP_COMMAND_HANDLER_IDS,
  APP_COMMAND_IDS,
  APP_PLUGIN_ID,
  appCommandDefinitions,
  createAppCommandHandlers,
  isAppCommandId,
  type AppCommandStatus,
} from '../src/commands/appCommands';

const COMMAND_ID_PATTERN = /^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$/;
const HANDLER_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

describe('命令元数据（可序列化）', () => {
  it('每条命令元数据 JSON 往返稳定且不含函数字段', () => {
    expect(appCommandDefinitions.length).toBeGreaterThan(0);
    for (const definition of appCommandDefinitions) {
      expect(JSON.parse(JSON.stringify(definition))).toEqual(definition);
    }
  });

  it('命令 ID 属于本应用命名空间且携带 ui 目标 handlerId', () => {
    for (const definition of appCommandDefinitions) {
      expect(definition.id).toMatch(COMMAND_ID_PATTERN);
      expect(definition.id.split(':')[0]).toBe(APP_COMMAND_DOMAIN);
      expect(definition.scope).toEqual({ kind: 'app', appId: APP_PLUGIN_ID });
      expect(definition.handlerId).toMatch(HANDLER_ID_PATTERN);
      expect(definition.title.length).toBeGreaterThan(0);
      expect(definition.description?.length).toBeGreaterThan(0);
    }
  });

  it('命令 ID 与处理器 ID 各自唯一且一一对应', () => {
    const ids = appCommandDefinitions.map((definition) => definition.id);
    expect(new Set(ids).size).toBe(ids.length);
    const handlerIds = appCommandDefinitions.map((definition) => definition.handlerId);
    expect(new Set(handlerIds).size).toBe(handlerIds.length);
  });
});

describe('command:invoked 派发消费', () => {
  it('本地处理器按 (commandId, handlerId) 配对并在执行时上报状态', () => {
    const seen: AppCommandStatus[] = [];
    const registrations = createAppCommandHandlers((status) => {
      seen.push(status);
    });
    expect(registrations.map((registration) => registration.commandId)).toEqual(ids());
    expect(registrations.map((registration) => registration.handlerId)).toEqual(handlerIds());
    for (const registration of registrations) {
      registration.handler({ demo: true });
    }
    expect(seen.map((status) => status.commandId)).toEqual(ids());
    expect(seen.every((status) => status.payload !== undefined)).toBe(true);
  });

  it('命令 ID 归属守卫放行本应用命令并拒绝外部命令', () => {
    expect(isAppCommandId(APP_COMMAND_IDS.openCard)).toBe(true);
    expect(isAppCommandId(APP_COMMAND_IDS.refreshView)).toBe(true);
    expect(isAppCommandId('platform:noop')).toBe(false);
  });
});

function ids(): string[] {
  return Object.values(APP_COMMAND_IDS);
}

function handlerIds(): string[] {
  return Object.values(APP_COMMAND_HANDLER_IDS);
}
`;
}

/** 构建 `app` 角色的全部角色文件（公共文件由模板装配器补充）。 */
export function buildAppFiles(context: IScaffoldContext): IScaffoldFile[] {
  return [
    { path: 'src/index.ts', content: indexTs(context) },
    { path: 'src/commands/appCommands.ts', content: commandsTs(context) },
    { path: 'src/commands/useAppCommands.ts', content: useAppCommandsTs() },
    { path: 'src/ui/AppView.tsx', content: appViewTsx(context) },
    { path: 'assets/icons/app.svg', content: ICON_SVG },
    { path: 'tests/app.test.ts', content: testsTs(context) },
    { path: 'tests/commands.test.ts', content: commandsTestTs() },
  ];
}

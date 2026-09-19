import { describe, expect, it, vi } from 'vitest';
import type {
  AppExitReason,
  IAppConfigChange,
  IAppConfigView,
  IAppContext,
  IAppLaunchArgs,
  ICommandRegisterInput,
  ICommandRegisterOutput,
  IEventSubscription,
} from '@chips/sdk';
import defaultPlugin, { HelloApp, HelloAppError } from './index';

/** 插件 ID，与 manifest.yaml 的 id 一致。 */
const PLUGIN_ID = 'chips.example.hello';

/** 自身命名空间与配置键，与 assets/schemas/config.schema.json 一致。 */
const NAMESPACE = `plugins.${PLUGIN_ID}`;
const TITLE_KEY = 'title';
const GREETING_KEY = 'greeting';
const DEFAULT_TITLE = '你好世界';

/** 命令 ID，与 src/index.ts 注册的定义一致。 */
const COMMAND_SET_GREETING = 'hello:set-greeting';
const COMMAND_NOTIFY = 'hello:notify';
const COMMAND_EXIT = 'hello:exit';

interface ICall {
  readonly capabilityId: string;
  readonly input: unknown;
}

interface IConfigWrite {
  readonly key: string;
  readonly value: unknown;
  readonly scope: string;
}

interface IHarnessOptions {
  readonly args?: IAppLaunchArgs;
  readonly windowAvailable?: boolean;
  readonly configuredTitle?: unknown;
  readonly configGetFails?: boolean;
  readonly notificationFails?: boolean;
}

interface IHarness {
  readonly app: HelloApp;
  readonly ctx: IAppContext;
  readonly calls: readonly ICall[];
  readonly titles: readonly string[];
  readonly configWrites: readonly IConfigWrite[];
  readonly infoLogs: readonly unknown[][];
  readonly exitCount: () => number;
  readonly isTitleWatchDisposed: () => boolean;
  emitConfigChange(change: IAppConfigChange): void;
  callBeforeExit(reason?: AppExitReason): Promise<void>;
}

/**
 * 构造主逻辑测试替身：只实现被测代码实际消费的实例访问面。
 *
 * 平台调用经 `ctx.bridge.request` 桩记录并返回契约形状；渲染侧 Mock 由
 * `@chips/sdk/testing` 提供，主进程上下文替身按《测试规范》由用例自建。
 *
 * @param options - 覆盖启动参数、窗口与配置桩行为的选项
 * @returns 被测实例与观测句柄
 */
const createHarness = (options: IHarnessOptions = {}): IHarness => {
  const calls: ICall[] = [];
  const titles: string[] = [];
  const configWrites: IConfigWrite[] = [];
  const infoLogs: unknown[][] = [];
  const watchHandlers: ((change: IAppConfigChange) => void)[] = [];
  const beforeExitHandlers: ((reason: AppExitReason) => Promise<void> | void)[] = [];
  let titleWatchDisposed = false;
  let exitCalls = 0;

  const args: IAppLaunchArgs = options.args ?? { source: 'launcher', files: [] };

  const request = <TOutput>(capabilityId: string, input?: unknown): Promise<TOutput> => {
    calls.push({ capabilityId, input });
    if (capabilityId === 'command:register') {
      const definition = (input as ICommandRegisterInput).definition;
      const output: ICommandRegisterOutput = {
        view: {
          definition,
          iconUri: null,
          owner: { kind: 'plugin', pluginId: PLUGIN_ID, sessionId: null },
          target: 'main',
          state: { visible: true, enabled: true, checked: false },
          updatedAt: '2026-09-19T00:00:00Z',
        },
      };
      return Promise.resolve(output as unknown as TOutput);
    }
    if (capabilityId === 'notification:send' && options.notificationFails === true) {
      return Promise.reject(new HelloAppError('BRIDGE_PERMISSION_DENIED', '缺少通知权限'));
    }
    return Promise.resolve(undefined as TOutput);
  };

  const subscription = (dispose: () => void): IEventSubscription => ({ dispose });

  const ctx: IAppContext = {
    appId: PLUGIN_ID,
    surface: 'window',
    launcher: { name: '你好世界', icon: 'assets/icons/app.svg' },
    args,
    window:
      options.windowAvailable === false
        ? null
        : {
            id: 1,
            close: (): Promise<void> => Promise.resolve(),
            focus: (): Promise<void> => Promise.resolve(),
            setTitle: (title: string): Promise<void> => {
              titles.push(title);
              return Promise.resolve();
            },
            setSize: (): Promise<void> => Promise.resolve(),
          },
    lifecycle: {
      beforeExit: (handler): IEventSubscription => {
        beforeExitHandlers.push(handler);
        return subscription(() => undefined);
      },
    },
    bridge: {
      request,
      resource: () => {
        throw new Error('示例插件不访问资源句柄');
      },
    },
    config: {
      get: (key: string): Promise<IAppConfigView> => {
        if (options.configGetFails === true) {
          return Promise.reject(new Error('配置读取失败'));
        }
        return Promise.resolve({
          key: `${NAMESPACE}.${key}`,
          value: key === TITLE_KEY ? options.configuredTitle : undefined,
          layer: 'plugin',
          isDefault: options.configuredTitle === undefined,
        });
      },
      snapshot: (): Promise<Readonly<Record<string, unknown>>> => Promise.resolve({}),
      set: (key: string, value: unknown, scope: string): Promise<void> => {
        configWrites.push({ key, value, scope });
        return Promise.resolve();
      },
      reset: (): Promise<void> => Promise.resolve(),
      watch: (_prefix: string, handler: (change: IAppConfigChange) => void): IEventSubscription => {
        watchHandlers.push(handler);
        return subscription(() => {
          titleWatchDisposed = true;
        });
      },
    },
    logger: {
      debug: (...logged: unknown[]): void => {
        void logged;
      },
      info: (...logged: unknown[]): void => {
        infoLogs.push(logged);
      },
      warn: (...logged: unknown[]): void => {
        void logged;
      },
      error: (...logged: unknown[]): void => {
        void logged;
      },
    },
    inject: (): void => undefined,
    on: (): IEventSubscription => subscription(() => undefined),
    once: (): IEventSubscription => subscription(() => undefined),
    emit: (): void => undefined,
    effect: (): void => undefined,
    exit: (): Promise<void> => {
      exitCalls += 1;
      return Promise.resolve();
    },
  };

  return {
    app: new HelloApp(),
    ctx,
    calls,
    titles,
    configWrites,
    infoLogs,
    exitCount: () => exitCalls,
    isTitleWatchDisposed: () => titleWatchDisposed,
    emitConfigChange: (change: IAppConfigChange): void => {
      for (const handler of watchHandlers) {
        handler(change);
      }
    },
    callBeforeExit: async (reason: AppExitReason = 'user'): Promise<void> => {
      for (const handler of beforeExitHandlers) {
        await handler(reason);
      }
    },
  };
};

const createConfigChange = (effectiveValue: unknown): IAppConfigChange => ({
  key: `${NAMESPACE}.${TITLE_KEY}`,
  layer: 'user',
  value: effectiveValue,
  effectiveValue,
  isDefault: false,
  origin: `plugin:${PLUGIN_ID}`,
});

describe('HelloApp.launch', () => {
  it('把三条主进程命令注册到平台', async () => {
    const harness = createHarness();

    await harness.app.launch(harness.ctx);

    const definitions = harness.calls
      .filter((call) => call.capabilityId === 'command:register')
      .map((call) => (call.input as ICommandRegisterInput).definition);
    expect(definitions.map((definition) => definition.id)).toEqual([
      COMMAND_SET_GREETING,
      COMMAND_NOTIFY,
      COMMAND_EXIT,
    ]);
    expect(definitions.map((definition) => definition.title)).toEqual([
      '设置问候语',
      '发送你好通知',
      '退出你好世界',
    ]);
    expect(definitions.every((definition) => definition.scope?.kind === 'app')).toBe(true);
    const setGreeting = definitions[0];
    expect(setGreeting?.paramsSchema).toMatchObject({
      type: 'object',
      additionalProperties: false,
    });
    expect(setGreeting?.keywords).toEqual(['问候', '你好']);
  });

  it('读取自身配置并应用到窗口标题', async () => {
    const harness = createHarness({ configuredTitle: '配置里的标题' });

    await harness.app.launch(harness.ctx);

    expect(harness.titles).toEqual(['配置里的标题']);
  });

  it('配置变更后更新窗口标题，非字符串值被忽略', async () => {
    const harness = createHarness({ configuredTitle: '初始标题' });
    await harness.app.launch(harness.ctx);

    harness.emitConfigChange(createConfigChange('变更后的标题'));
    await vi.waitFor(() => {
      expect(harness.titles).toContain('变更后的标题');
    });

    harness.emitConfigChange(createConfigChange(42));
    await Promise.resolve();
    expect(harness.titles).not.toContain(42);
    expect(harness.titles).toHaveLength(2);
  });

  it('配置读取失败时回退默认标题且不阻断启动', async () => {
    const harness = createHarness({ configGetFails: true });

    await expect(harness.app.launch(harness.ctx)).resolves.toBeUndefined();
    expect(harness.titles).toEqual([DEFAULT_TITLE]);
  });

  it('启动来源为 command 时处理初始命令', async () => {
    const harness = createHarness({
      args: {
        source: 'command',
        files: [],
        command: COMMAND_SET_GREETING,
        commandArgs: { greeting: '早上好！' },
      },
    });

    await harness.app.launch(harness.ctx);

    expect(harness.configWrites).toEqual([{ key: GREETING_KEY, value: '早上好！', scope: 'user' }]);
  });

  it('托盘表面（无主窗口）下启动不失败', async () => {
    const harness = createHarness({ windowAvailable: false });

    await expect(harness.app.launch(harness.ctx)).resolves.toBeUndefined();
    expect(harness.titles).toEqual([]);
  });

  it('记录启动日志', async () => {
    const harness = createHarness();

    await harness.app.launch(harness.ctx);

    expect(harness.infoLogs).toHaveLength(1);
    expect(harness.infoLogs[0]?.[0]).toBe('你好世界应用已启动');
    expect(harness.infoLogs[0]?.[1]).toEqual({ source: 'launcher', pluginId: PLUGIN_ID });
  });

  it('退出前清理配置订阅', async () => {
    const harness = createHarness({ configuredTitle: '初始标题' });
    await harness.app.launch(harness.ctx);

    await harness.callBeforeExit();

    expect(harness.isTitleWatchDisposed()).toBe(true);
    harness.emitConfigChange(createConfigChange('退出后的标题'));
    await Promise.resolve();
    expect(harness.titles).toEqual(['初始标题']);
  });
});

describe('HelloApp.handleCommand', () => {
  it('hello:set-greeting 校验参数并写入用户层配置', async () => {
    const harness = createHarness();
    await harness.app.launch(harness.ctx);

    await harness.app.handleCommand(COMMAND_SET_GREETING, { greeting: '晚上好' });

    expect(harness.configWrites).toEqual([{ key: GREETING_KEY, value: '晚上好', scope: 'user' }]);
  });

  it('hello:set-greeting 参数非法时抛出 APP_COMMAND_ARGS_INVALID', async () => {
    const harness = createHarness();
    await harness.app.launch(harness.ctx);

    await expect(harness.app.handleCommand(COMMAND_SET_GREETING, undefined)).rejects.toMatchObject({
      code: 'APP_COMMAND_ARGS_INVALID',
    });
    await expect(
      harness.app.handleCommand(COMMAND_SET_GREETING, { greeting: '   ' })
    ).rejects.toMatchObject({ code: 'APP_COMMAND_ARGS_INVALID' });
    expect(harness.configWrites).toEqual([]);
  });

  it('hello:notify 经主进程能力链路发送通知', async () => {
    const harness = createHarness();
    await harness.app.launch(harness.ctx);
    const before = harness.calls.length;

    await harness.app.handleCommand(COMMAND_NOTIFY, { title: '你好', body: '来自示例插件' });

    expect(harness.calls.slice(before)).toEqual([
      {
        capabilityId: 'notification:send',
        input: { title: '你好', body: '来自示例插件' },
      },
    ]);
  });

  it('hello:notify 省略正文时只提交标题', async () => {
    const harness = createHarness();
    await harness.app.launch(harness.ctx);
    const before = harness.calls.length;

    await harness.app.handleCommand(COMMAND_NOTIFY, { title: '仅标题' });

    expect(harness.calls.slice(before)).toEqual([
      { capabilityId: 'notification:send', input: { title: '仅标题' } },
    ]);
  });

  it('hello:notify 能力调用失败时原样传播平台错误', async () => {
    const harness = createHarness({ notificationFails: true });
    await harness.app.launch(harness.ctx);

    await expect(
      harness.app.handleCommand(COMMAND_NOTIFY, { title: '你好' })
    ).rejects.toMatchObject({ code: 'BRIDGE_PERMISSION_DENIED' });
  });

  it('hello:notify 参数非法时抛出 APP_COMMAND_ARGS_INVALID', async () => {
    const harness = createHarness();
    await harness.app.launch(harness.ctx);

    await expect(harness.app.handleCommand(COMMAND_NOTIFY, {})).rejects.toMatchObject({
      code: 'APP_COMMAND_ARGS_INVALID',
    });
    await expect(
      harness.app.handleCommand(COMMAND_NOTIFY, { title: '标题', body: 42 })
    ).rejects.toMatchObject({ code: 'APP_COMMAND_ARGS_INVALID' });
  });

  it('hello:exit 请求结束应用实例', async () => {
    const harness = createHarness();
    await harness.app.launch(harness.ctx);

    await harness.app.handleCommand(COMMAND_EXIT, undefined);

    expect(harness.exitCount()).toBe(1);
  });

  it('未知命令抛出 APP_COMMAND_UNSUPPORTED', async () => {
    const harness = createHarness();
    await harness.app.launch(harness.ctx);

    const caught: unknown = await harness.app
      .handleCommand('hello:unknown', undefined)
      .catch((error: unknown) => error);

    expect(caught).toBeInstanceOf(HelloAppError);
    expect(caught).toMatchObject({ code: 'APP_COMMAND_UNSUPPORTED' });
  });
});

describe('插件入口', () => {
  it('默认导出实现 IAppPlugin 的实例', () => {
    expect(defaultPlugin).toBeInstanceOf(HelloApp);
    expect(typeof defaultPlugin.launch).toBe('function');
    expect(typeof defaultPlugin.handleCommand).toBe('function');
  });
});

import type {
  CapabilityInput,
  CapabilityOutput,
  IAppConfigChange,
  IAppContext,
  IAppPlugin,
  ICommandDefinition,
  ICommandRegisterOutput,
  IEventSubscription,
} from '@chips/sdk';

/** 插件 ID，与 manifest.yaml 的 id 一致。 */
const PLUGIN_ID = 'chips.example.hello';

/** 自身命名空间配置键。 */
const TITLE_KEY = 'title';
const GREETING_KEY = 'greeting';

/** 配置默认值，与 assets/schemas/config.schema.json 保持一致。 */
const DEFAULT_TITLE = '你好世界';

/** 命令 ID；域取插件 ID 末段。 */
const COMMAND_SET_GREETING = 'hello:set-greeting';
const COMMAND_NOTIFY = 'hello:notify';
const COMMAND_EXIT = 'hello:exit';

/** 通知命令参数。 */
interface INotifyArgs {
  readonly title: string;
  readonly body?: string;
}

/**
 * 应用域错误：异常携带字符串 code 时平台保留该错误码（07-应用插件接口 §8.1）。
 */
export class HelloAppError extends Error {
  public readonly code: string;
  public readonly details?: unknown;

  public constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'HelloAppError';
    this.code = code;
    this.details = details;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/**
 * 解析设置问候语命令参数。
 *
 * @param args - 命令载荷
 * @returns 非空问候语
 * @throws {HelloAppError} 载荷不含非空字符串 greeting 字段时抛出 APP_COMMAND_ARGS_INVALID
 */
const parseGreetingArgs = (args: unknown): string => {
  if (isRecord(args) && typeof args.greeting === 'string' && args.greeting.trim().length > 0) {
    return args.greeting;
  }
  throw new HelloAppError('APP_COMMAND_ARGS_INVALID', '命令参数必须包含非空字符串 greeting 字段', {
    args,
  });
};

/**
 * 解析发送通知命令参数。
 *
 * @param args - 命令载荷
 * @returns 通知标题与可选正文
 * @throws {HelloAppError} 参数不满足约定时抛出 APP_COMMAND_ARGS_INVALID
 */
const parseNotifyArgs = (args: unknown): INotifyArgs => {
  if (!isRecord(args) || typeof args.title !== 'string' || args.title.trim().length === 0) {
    throw new HelloAppError('APP_COMMAND_ARGS_INVALID', '命令参数必须包含非空字符串 title 字段', {
      args,
    });
  }
  if (args.body !== undefined && typeof args.body !== 'string') {
    throw new HelloAppError('APP_COMMAND_ARGS_INVALID', '命令参数 body 必须是字符串', { args });
  }
  return args.body === undefined ? { title: args.title } : { title: args.title, body: args.body };
};

/** 启动时注册的主进程命令定义；owner 由平台按调用会话绑定。 */
const COMMAND_DEFINITIONS: readonly ICommandDefinition[] = [
  {
    id: COMMAND_SET_GREETING,
    title: '设置问候语',
    description: '更新界面问候语并写入用户配置',
    scope: { kind: 'app' },
    group: '你好',
    keywords: ['问候', '你好'],
    paramsSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['greeting'],
      properties: {
        greeting: { type: 'string', minLength: 1, maxLength: 128 },
      },
    },
  },
  {
    id: COMMAND_NOTIFY,
    title: '发送你好通知',
    description: '通过系统通知发送一条问候',
    scope: { kind: 'app' },
    group: '你好',
    keywords: ['通知', '问候'],
    paramsSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['title'],
      properties: {
        title: { type: 'string', minLength: 1, maxLength: 128 },
        body: { type: 'string', maxLength: 1024 },
      },
    },
  },
  {
    id: COMMAND_EXIT,
    title: '退出你好世界',
    description: '结束当前应用实例',
    scope: { kind: 'app' },
    group: '你好',
    keywords: ['退出', '关闭'],
  },
];

/**
 * 最小应用插件：窗口标题跟随自身配置，注册三条主进程命令，并演示主进程与渲染进程两条能力调用链路。
 */
export class HelloApp implements IAppPlugin {
  private context: IAppContext | null = null;
  private titleSubscription: IEventSubscription | null = null;

  public async launch(ctx: IAppContext): Promise<void> {
    this.context = ctx;

    for (const definition of COMMAND_DEFINITIONS) {
      await ctx.bridge.request<ICommandRegisterOutput>('command:register', { definition });
    }

    this.titleSubscription = ctx.config.watch(TITLE_KEY, (change: IAppConfigChange) => {
      if (typeof change.effectiveValue === 'string' && change.effectiveValue.length > 0) {
        void this.applyTitle(change.effectiveValue);
      }
    });

    await this.applyConfiguredTitle();

    if (ctx.args.source === 'command' && ctx.args.command !== undefined) {
      await this.handleCommand(ctx.args.command, ctx.args.commandArgs);
    }

    ctx.lifecycle.beforeExit(() => {
      this.titleSubscription?.dispose();
      this.titleSubscription = null;
      this.context = null;
    });

    ctx.logger.info('你好世界应用已启动', { source: ctx.args.source, pluginId: PLUGIN_ID });
  }

  public async handleCommand(command: string, args: unknown): Promise<void> {
    switch (command) {
      case COMMAND_SET_GREETING: {
        const greeting = parseGreetingArgs(args);
        await this.context?.config.set(GREETING_KEY, greeting, 'user');
        return;
      }
      case COMMAND_NOTIFY: {
        await this.notify(parseNotifyArgs(args));
        return;
      }
      case COMMAND_EXIT: {
        await this.context?.exit();
        return;
      }
      default: {
        throw new HelloAppError('APP_COMMAND_UNSUPPORTED', `不支持的命令：${command}`, {
          command,
        });
      }
    }
  }

  private async notify(args: INotifyArgs): Promise<void> {
    const input: CapabilityInput<'notification:send'> =
      args.body === undefined ? { title: args.title } : { title: args.title, body: args.body };
    await this.context?.bridge.request<CapabilityOutput<'notification:send'>>(
      'notification:send',
      input
    );
  }

  private async applyConfiguredTitle(): Promise<void> {
    let title = DEFAULT_TITLE;
    try {
      const view = await this.context?.config.get(TITLE_KEY);
      if (view !== undefined && typeof view.value === 'string' && view.value.length > 0) {
        title = view.value;
      }
    } catch {
      // 自身配置读取失败不阻断启动，回退默认标题；平台统一记录诊断
    }
    await this.applyTitle(title);
  }

  private async applyTitle(title: string): Promise<void> {
    const appWindow = this.context?.window ?? null;
    if (appWindow === null) {
      return;
    }
    await appWindow.setTitle(title);
  }
}

export default new HelloApp();

import type { ICommandDefinition } from '@chips/sdk';
import type { ICommandLocalRegistration } from '@chips/ui';

/** 插件 ID（与 manifest.id 一致）。 */
export const APP_PLUGIN_ID = 'chips.official.iconmaker';

/** 命令命名空间：取插件 ID 末段（《13-命令系统契约》§2.1）。 */
export const APP_COMMAND_DOMAIN = 'iconmaker';

/** 运行时命令 ID；与 manifest `cli.commands` 声明逐字对应。 */
export const APP_COMMAND_IDS = {
  generate: 'iconmaker:generate',
} as const;

/** ui 目标命令的本地处理器标识（《13-命令系统契约》§2.2，与注册记录配对）。 */
export const APP_COMMAND_HANDLER_IDS = {
  generate: 'generate',
} as const;

/** `iconmaker:generate` 的调用参数（与 paramsSchema 对应；13-命令系统契约 §八示例口径）。 */
export interface GenerateCommandPayload {
  /** 输入图片路径；ui 目标派发时缺省表示使用工作台当前来源。 */
  readonly source?: string;
  /** 输出目录覆盖；缺省由工作台保存链路决定。 */
  readonly outputDir?: string;
  /** 是否覆盖已存在产物。 */
  readonly overwrite?: boolean;
}

/**
 * 可序列化命令元数据：注册进平台命令注册表的纯数据对象。
 *
 * 全部字段为 JSON 可往返的普通数据（无函数、无类实例）；界面文案简体中文直写，
 * 快捷键文法见《13-命令系统契约》§2.6。
 */
export const appCommandDefinitions: readonly ICommandDefinition[] = [
  {
    id: APP_COMMAND_IDS.generate,
    title: '生成图标',
    description: '从当前图片生成 PNG、ICO 与 ICNS 图标包',
    shortcut: 'CommandOrControl+Alt+G',
    scope: { kind: 'app', appId: APP_PLUGIN_ID },
    paramsSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        source: { type: 'string', minLength: 1 },
        outputDir: { type: 'string', minLength: 1 },
        overwrite: { type: 'boolean', default: false },
      },
    },
    keywords: ['图标', '生成', 'icns'],
    group: '导出',
    handlerId: APP_COMMAND_HANDLER_IDS.generate,
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

/** 命令处理器宿主：界面层注入的生成执行入口（工作台当前设置即命令上下文）。 */
export interface AppCommandHandlerContext {
  /** 执行生成链路：渲染当前来源并尝试落盘；失败以异常透出，由命令通道诚实上报。 */
  readonly generate: (payload: GenerateCommandPayload | undefined) => Promise<void>;
}

/**
 * 构造与 `command:invoked` 派发配对的本地处理器集合（《13-命令系统契约》§5.6）。
 *
 * 每条注册以 `(commandId, handlerId)` 与平台登记记录配对；`iconmaker:generate` 为
 * ui 目标命令，派发进入窗口后交由界面注入的生成执行入口完成渲染与落盘链路。
 */
export function createAppCommandHandlers(
  context: AppCommandHandlerContext,
): readonly ICommandLocalRegistration[] {
  return appCommandDefinitions.map((definition) => {
    const handlerId = (definition.handlerId ?? '') as AppCommandHandlerId;
    return {
      commandId: definition.id,
      handlerId,
      handler: (payload: unknown): Promise<void> => {
        return context.generate(payload as GenerateCommandPayload | undefined);
      },
    };
  });
}

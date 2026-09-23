import type {
  IPluginCardType,
  IPluginCli,
  IPluginLayoutType,
  IPluginManifest,
  IScaffoldBase,
} from './types.js';

/** 卡片类型 ID 文法（《02-插件清单规范》§7.2）。 */
export const CARD_TYPE_ID_PATTERN = /^[A-Za-z][A-Za-z0-9]*(?:\.[a-z][a-z0-9-]*)*$/;

/** 布局类型 ID 文法（《02-插件清单规范》§7.3）。 */
export const LAYOUT_TYPE_ID_PATTERN = /^chips\.layout\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

/** 生成结果使用的初始版本号：0.1.0（第一版发布前的起步版本）。 */
export const SCAFFOLD_VERSION = '0.1.0';

/** 布局配置 schema 支持的版本范围（与生成的 config.schema.json 结构一致）。 */
export const LAYOUT_SCHEMA_VERSIONS = '>=1.0.0 <2.0.0';

/** 服务健康检查默认周期与超时（《02-插件清单规范》§7.5）。 */
export const HEALTH_CHECK_INTERVAL = '30s';
export const HEALTH_CHECK_TIMEOUT = '5s';

function buildCardType(context: IScaffoldBase): IPluginCardType {
  const { options, assetSlug, capabilityId } = context;
  return {
    id: capabilityId,
    name: options.name,
    ...(options.description === undefined ? {} : { description: options.description }),
    icon: `assets/icons/${assetSlug}.svg`,
    configSchema: `assets/schemas/${assetSlug}-config.schema.json`,
  };
}

function buildLayoutType(context: IScaffoldBase): IPluginLayoutType {
  const { options, assetSlug, capabilityId } = context;
  return {
    id: capabilityId,
    name: options.name,
    icon: `assets/icons/${assetSlug}.svg`,
    ...(options.description === undefined ? {} : { description: options.description }),
    configSchema: `assets/schemas/${assetSlug}-config.schema.json`,
    schemaVersions: LAYOUT_SCHEMA_VERSIONS,
  };
}

function buildLauncher(context: IScaffoldBase): Readonly<Record<string, unknown>> {
  const { options } = context;
  return {
    icon: 'assets/icons/app.svg',
    name: options.name,
    ...(options.description === undefined ? {} : { description: options.description }),
  };
}

/**
 * `app` 角色的 `cli.commands` 声明样例（《02-插件清单规范》§7.6、《07-CLI完整参考》§5.1）。
 *
 * 命令 ID 域取插件 ID 末段（《13-命令系统契约》§2.1），与 `src/commands/appCommands.ts`
 * 运行时注册的命令记录一一对应：CLI 与 UI 共享同一记录、同一校验、同一审计（§5.7）。
 * 生成器锁校验权威在 `packages/host/src/loader/manifest.ts` 的 `validateCliCommands`。
 */
function buildAppCliCommands(context: IScaffoldBase): IPluginCli {
  const { options, assetSlug } = context;
  return {
    commands: [
      {
        commandPath: [assetSlug, 'open-card'],
        commandId: `${assetSlug}:open-card`,
        title: '打开卡片',
        description: `通过「${options.name}」打开指定卡片文件`,
        examples: [`chips ${assetSlug} open-card ~/文档/示例.cpk`],
        target: {
          type: 'app',
          pluginId: options.pluginId,
          surface: { open: true, focus: true, reuse: 'preferred' },
        },
        arguments: [
          {
            name: 'path',
            position: 0,
            type: 'path',
            required: true,
            mapsTo: 'path',
            path: { kind: 'file', role: 'input', exists: true },
          },
        ],
      },
      {
        commandPath: [assetSlug, 'refresh-view'],
        commandId: `${assetSlug}:refresh-view`,
        title: '刷新当前视图',
        description: `请求「${options.name}」重新拉取当前展示数据`,
        target: { type: 'app', pluginId: options.pluginId },
        output: { mode: 'json', json: 'supported' },
      },
    ],
  };
}

/** 生成结构化 manifest；角色专有字段严格按《02-插件清单规范》§7 的角色差异表。 */
export function buildManifest(context: IScaffoldBase): IPluginManifest {
  const { options } = context;
  const role = options.role;
  const base = {
    id: options.pluginId,
    version: SCAFFOLD_VERSION,
    type: role,
    name: options.name,
    ...(options.description === undefined ? {} : { description: options.description }),
    ...(options.author === undefined ? {} : { author: options.author }),
    license: options.license,
    runtime: {
      targets: ['host'] as const,
      ...(role === 'app' ? { background: false } : {}),
    },
  };

  switch (role) {
    case 'basecard':
      return {
        ...base,
        permissions: [],
        capabilities: { cardTypes: [buildCardType(context)] },
      };
    case 'boxlayout':
      return {
        ...base,
        permissions: ['resources:read'],
        capabilities: { layouts: [buildLayoutType(context)] },
      };
    case 'app':
      return {
        ...base,
        // ui 目标命令注册与调用所需的能力权限（《04-能力契约规范》§六命令域）。
        permissions: ['command:write', 'command:execute'],
        ui: { surface: 'window', launcher: buildLauncher(context) },
        cli: buildAppCliCommands(context),
      };
    case 'service':
      return {
        ...base,
        healthCheck: { interval: HEALTH_CHECK_INTERVAL, timeout: HEALTH_CHECK_TIMEOUT },
      };
  }
}

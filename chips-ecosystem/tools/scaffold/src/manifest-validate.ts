import type { IPluginManifest, IPluginRuntime, PluginRole } from './types.js';

/**
 * 脚手架内自检用的清单校验器：按《02-插件清单规范》§2–§7 的字段规则做结构校验。
 *
 * 平台安装/打包的权威校验由 `@chips/cli` 与内核实现；本模块只用于保证生成结果
 * 满足生成器自身的契约（模板单测与未来的 CLI 预检），不参与运行时。
 */

const ID_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/;
const CARD_TYPE_ID_PATTERN = /^[A-Za-z][A-Za-z0-9]*(?:\.[a-z][a-z0-9-]*)*$/;
const LAYOUT_TYPE_ID_PATTERN = /^chips\.layout\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
const SEMVER_PATTERN = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/;
const DURATION_PATTERN = /^[1-9]\d*(?:ms|s|m)$/;
const ASSET_PATH_PATTERN = /^assets\/[^\s]+$/;
const ROLES: readonly PluginRole[] = ['basecard', 'boxlayout', 'app', 'service'];

// === `cli.commands` 生成物自检规则（镜像 `packages/host/src/loader/manifest.ts` 的 validateCliCommands） ===
const COMMAND_ID_PATTERN = /^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$/;
const COMMAND_PATH_SEGMENT_PATTERN = /^[a-z0-9][a-z0-9-]*$/i;
const PARAMETER_NAME_PATTERN = /^[a-z][a-z0-9-]*$/i;
/** 固定命令根清单与宿主 `FIXED_COMMAND_ROOTS` 同源（《13-命令系统契约》、《07-CLI完整参考》§2.3）。 */
const FIXED_COMMAND_ROOTS: readonly string[] = [
  'help',
  'start',
  'stop',
  'status',
  'config',
  'logs',
  'plugin',
  'update',
  'doctor',
  'open',
  'completion',
  'dev',
  'host',
];
const SURFACE_REUSE_POLICIES = new Set(['always', 'never', 'preferred']);
const OUTPUT_JSON_POLICIES = new Set(['supported', 'required', 'unsupported']);
const COMMAND_ENTRY_KEYS: readonly string[] = [
  'commandPath',
  'commandId',
  'title',
  'description',
  'examples',
  'permissions',
  'target',
  'arguments',
  'options',
  'output',
  'job',
  'conflict',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function checkAssetPath(errors: string[], field: string, value: unknown): void {
  if (value === undefined) {
    return;
  }
  if (typeof value !== 'string' || !ASSET_PATH_PATTERN.test(value)) {
    errors.push(`${field} 必须是位于 assets/ 内的包内相对 POSIX 路径`);
  }
}

function checkRuntime(errors: string[], manifest: IPluginManifest): void {
  const runtime: IPluginRuntime | undefined = manifest.runtime;
  if (runtime === undefined) {
    errors.push('runtime 缺失');
    return;
  }
  const targets = runtime.targets;
  if (!Array.isArray(targets) || targets.length === 0) {
    errors.push('runtime.targets 必须非空');
  } else {
    if (targets.some((target) => target !== 'host')) {
      errors.push('runtime.targets 只允许 host');
    }
    if (new Set(targets).size !== targets.length) {
      errors.push('runtime.targets 不得重复');
    }
  }
  if (runtime.background === true && manifest.type !== 'service') {
    errors.push('runtime.background: true 仅 service 允许');
  }
}

/**
 * 校验 `cli.commands` 声明的入口级形状；深层参数规则（`batch` / `ui` / `validation` 组合约束、
 * 权限 ID 目录登记等）的权威在 `packages/host/src/loader/manifest.ts` 与《07-CLI完整参考》§5.2，
 * 平台打包与安装时全量校验，本自检通道覆盖生成器可产出的全部字段形状。
 */
function checkCliSection(errors: string[], manifest: IPluginManifest): void {
  const cli = manifest.cli;
  if (cli === undefined) {
    return;
  }
  if (manifest.type !== 'app' && manifest.type !== 'service') {
    errors.push('cli 只允许 app / service 角色声明');
  }
  if (!isRecord(cli)) {
    errors.push('cli 必须是映射');
    return;
  }
  const unknownCliKeys = Object.keys(cli).filter((key) => key !== 'commands');
  if (unknownCliKeys.length > 0) {
    errors.push(`cli 只能包含 commands，出现额外键：${unknownCliKeys.join('、')}`);
  }
  if (!Array.isArray(cli.commands) || cli.commands.length === 0) {
    errors.push('cli.commands 必须为非空数组');
    return;
  }
  const pathKeys = new Set<string>();
  cli.commands.forEach((item, index) => {
    const pointer = `cli.commands[${index}]`;
    if (!isRecord(item)) {
      errors.push(`${pointer} 必须是映射`);
      return;
    }
    const unknownKeys = Object.keys(item).filter((key) => !COMMAND_ENTRY_KEYS.includes(key));
    if (unknownKeys.length > 0) {
      errors.push(`${pointer} 出现未在册键：${unknownKeys.join('、')}`);
    }
    const rawPath = item.commandPath;
    const segments = typeof rawPath === 'string' ? [rawPath] : rawPath;
    if (!Array.isArray(segments) || segments.length === 0) {
      errors.push(`${pointer}.commandPath 必须为非空字符串或字符串数组`);
    } else {
      if (
        segments.some(
          (segment) => typeof segment !== 'string' || !COMMAND_PATH_SEGMENT_PATTERN.test(segment)
        )
      ) {
        errors.push(`${pointer}.commandPath 段不符合文法（小写字母、数字与连字符）`);
      } else {
        const firstSegment = String(segments[0]).toLowerCase();
        if (FIXED_COMMAND_ROOTS.includes(firstSegment)) {
          errors.push(`${pointer}.commandPath 命中固定命令根：${firstSegment}`);
        }
        const key = segments.map((segment) => String(segment).toLowerCase()).join(' ');
        if (pathKeys.has(key)) {
          errors.push(`${pointer}.commandPath 在插件内重复：${key}`);
        }
        pathKeys.add(key);
      }
    }
    if (typeof item.title !== 'string' || item.title.trim().length === 0) {
      errors.push(`${pointer}.title 必须是非空显示文案`);
    }
    if (item.description !== undefined && typeof item.description !== 'string') {
      errors.push(`${pointer}.description 必须是字符串`);
    }
    if (item.examples !== undefined) {
      if (
        !Array.isArray(item.examples) ||
        item.examples.some((example) => typeof example !== 'string')
      ) {
        errors.push(`${pointer}.examples 必须是字符串数组`);
      }
    }
    if (item.permissions !== undefined && !Array.isArray(item.permissions)) {
      errors.push(`${pointer}.permissions 必须是字符串数组`);
    }
    const commandId = typeof item.commandId === 'string' ? item.commandId : undefined;
    if (commandId !== undefined && !COMMAND_ID_PATTERN.test(commandId)) {
      errors.push(`${pointer}.commandId 文法非法：${commandId}（应为 <domain>:<action>）`);
    }
    if (!isRecord(item.target)) {
      errors.push(`${pointer}.target 必须是映射`);
      return;
    }
    const target = item.target;
    const unknownTargetKeys = Object.keys(target).filter(
      (key) => !['type', 'pluginId', 'capability', 'surface'].includes(key)
    );
    if (unknownTargetKeys.length > 0) {
      errors.push(`${pointer}.target 出现未在册键：${unknownTargetKeys.join('、')}`);
    }
    if (target.type !== manifest.type) {
      errors.push(`${pointer}.target.type 必须等于插件角色：${manifest.type}`);
    }
    if (target.pluginId !== manifest.id) {
      errors.push(`${pointer}.target.pluginId 必须等于插件 ID`);
    }
    if (manifest.type === 'app') {
      if (commandId === undefined) {
        errors.push(`${pointer} app 目标必须声明 commandId`);
      }
      if (target.capability !== undefined) {
        errors.push(`${pointer}.target.capability 不适用于 app 目标`);
      }
      if (target.surface !== undefined) {
        if (!isRecord(target.surface)) {
          errors.push(`${pointer}.target.surface 必须是映射`);
        } else {
          const surface = target.surface;
          const unknownSurfaceKeys = Object.keys(surface).filter(
            (key) => !['open', 'focus', 'reuse'].includes(key)
          );
          if (unknownSurfaceKeys.length > 0) {
            errors.push(`${pointer}.target.surface 出现未在册键：${unknownSurfaceKeys.join('、')}`);
          }
          if (surface.open !== undefined && typeof surface.open !== 'boolean') {
            errors.push(`${pointer}.target.surface.open 必须是布尔值`);
          }
          if (surface.focus !== undefined && typeof surface.focus !== 'boolean') {
            errors.push(`${pointer}.target.surface.focus 必须是布尔值`);
          }
          if (
            surface.reuse !== undefined &&
            !(typeof surface.reuse === 'string' && SURFACE_REUSE_POLICIES.has(surface.reuse))
          ) {
            errors.push(`${pointer}.target.surface.reuse 取值非法`);
          }
        }
      }
    } else if (manifest.type === 'service') {
      if (commandId !== undefined) {
        errors.push(`${pointer}.commandId 不适用于 service 目标`);
      }
      if (target.surface !== undefined) {
        errors.push(`${pointer}.target.surface 不适用于 service 目标`);
      }
      if (item.job !== undefined) {
        errors.push(`${pointer}.job 不适用于 service 目标`);
      }
      if (typeof target.capability !== 'string' || !COMMAND_ID_PATTERN.test(target.capability)) {
        errors.push(
          `${pointer}.target.capability 缺失或文法非法（service 目标必须声明已登记能力 ID）`
        );
      }
    }
    if (item.output !== undefined) {
      if (!isRecord(item.output)) {
        errors.push(`${pointer}.output 必须是映射`);
      } else {
        if (
          item.output.mode !== undefined &&
          item.output.mode !== 'human' &&
          item.output.mode !== 'json'
        ) {
          errors.push(`${pointer}.output.mode 取值非法`);
        }
        if (
          item.output.json !== undefined &&
          !(typeof item.output.json === 'string' && OUTPUT_JSON_POLICIES.has(item.output.json))
        ) {
          errors.push(`${pointer}.output.json 取值非法`);
        }
        if (item.output.artifacts !== undefined && !Array.isArray(item.output.artifacts)) {
          errors.push(`${pointer}.output.artifacts 必须是字符串数组`);
        }
      }
    }
    if (item.job !== undefined && !isRecord(item.job)) {
      errors.push(`${pointer}.job 必须是映射`);
    }
    for (const parameterField of ['arguments', 'options'] as const) {
      const parameters = item[parameterField];
      if (parameters === undefined) {
        continue;
      }
      if (!Array.isArray(parameters) || parameters.length === 0) {
        errors.push(`${pointer}.${parameterField} 必须为非空数组`);
        continue;
      }
      const seenNames = new Set<string>();
      parameters.forEach((parameter, parameterIndex) => {
        const parameterPointer = `${pointer}.${parameterField}[${parameterIndex}]`;
        if (!isRecord(parameter)) {
          errors.push(`${parameterPointer} 必须是映射`);
          return;
        }
        if (typeof parameter.name !== 'string' || !PARAMETER_NAME_PATTERN.test(parameter.name)) {
          errors.push(`${parameterPointer}.name 不符合参数名文法`);
        } else {
          const nameKey = parameter.name.toLowerCase();
          if (seenNames.has(nameKey)) {
            errors.push(`${parameterPointer}.name 重复：${parameter.name}`);
          }
          seenNames.add(nameKey);
        }
        if (typeof parameter.type !== 'string' || parameter.type.length === 0) {
          errors.push(`${parameterPointer}.type 必须是非空参数类型`);
        }
        if (
          parameter.type === 'enum' &&
          (!Array.isArray(parameter.choices) || parameter.choices.length === 0)
        ) {
          errors.push(`${parameterPointer}.choices enum 参数必须非空`);
        }
      });
    }
  });
}

/** 校验 manifest；返回错误消息数组，空数组表示通过。 */
export function validateManifest(manifest: unknown): readonly string[] {
  const errors: string[] = [];
  if (!isRecord(manifest)) {
    return ['manifest 必须是映射'];
  }
  const candidate = manifest as unknown as IPluginManifest;

  if (typeof candidate.id !== 'string' || !ID_PATTERN.test(candidate.id)) {
    errors.push('id 必须是反向域名形式');
  }
  if (typeof candidate.version !== 'string' || !SEMVER_PATTERN.test(candidate.version)) {
    errors.push('version 必须是语义化版本');
  }
  if (
    typeof candidate.type !== 'string' ||
    !(ROLES as readonly string[]).includes(candidate.type)
  ) {
    errors.push('type 必须是四个角色之一');
  }
  if (typeof candidate.name !== 'string' || candidate.name.trim().length === 0) {
    errors.push('name 必须是非空显示名');
  }
  checkRuntime(errors, candidate);

  const capabilities = candidate.capabilities;
  const ui = candidate.ui;
  const healthCheck = candidate.healthCheck;

  switch (candidate.type) {
    case 'basecard': {
      if (ui !== undefined) errors.push('ui 不适用于 basecard 角色');
      if (healthCheck !== undefined) errors.push('healthCheck 不适用于 basecard 角色');
      if (candidate.fileAssociations !== undefined) {
        errors.push('fileAssociations 不适用于 basecard 角色');
      }
      if (candidate.deepLinks !== undefined) errors.push('deepLinks 不适用于 basecard 角色');
      if (capabilities === undefined || capabilities.cardTypes === undefined) {
        errors.push('capabilities.cardTypes 缺失');
      } else if (capabilities.cardTypes.length === 0) {
        errors.push('capabilities.cardTypes 至少一项');
      } else {
        if (capabilities.layouts !== undefined) {
          errors.push('capabilities.layouts 与 cardTypes 互斥');
        }
        for (const [index, cardType] of capabilities.cardTypes.entries()) {
          if (typeof cardType.id !== 'string' || !CARD_TYPE_ID_PATTERN.test(cardType.id)) {
            errors.push(`cardTypes[${index}].id 不符合卡片类型 ID 文法`);
          }
          if (typeof cardType.name !== 'string' || cardType.name.length === 0) {
            errors.push(`cardTypes[${index}].name 必须非空`);
          }
          checkAssetPath(errors, `cardTypes[${index}].icon`, cardType.icon);
          checkAssetPath(errors, `cardTypes[${index}].configSchema`, cardType.configSchema);
        }
      }
      break;
    }
    case 'boxlayout': {
      if (ui !== undefined) errors.push('ui 不适用于 boxlayout 角色');
      if (healthCheck !== undefined) errors.push('healthCheck 不适用于 boxlayout 角色');
      if (candidate.fileAssociations !== undefined) {
        errors.push('fileAssociations 不适用于 boxlayout 角色');
      }
      if (candidate.deepLinks !== undefined) errors.push('deepLinks 不适用于 boxlayout 角色');
      if (capabilities === undefined || capabilities.layouts === undefined) {
        errors.push('capabilities.layouts 缺失');
      } else if (capabilities.layouts.length === 0) {
        errors.push('capabilities.layouts 至少一项');
      } else {
        if (capabilities.cardTypes !== undefined) {
          errors.push('capabilities.cardTypes 与 layouts 互斥');
        }
        for (const [index, layout] of capabilities.layouts.entries()) {
          if (typeof layout.id !== 'string' || !LAYOUT_TYPE_ID_PATTERN.test(layout.id)) {
            errors.push(`layouts[${index}].id 必须匹配 chips.layout.<name>`);
          }
          if (typeof layout.name !== 'string' || layout.name.length === 0) {
            errors.push(`layouts[${index}].name 必须非空`);
          }
          checkAssetPath(errors, `layouts[${index}].icon`, layout.icon);
          checkAssetPath(errors, `layouts[${index}].configSchema`, layout.configSchema);
          if (typeof layout.schemaVersions !== 'string' || layout.schemaVersions.length === 0) {
            errors.push(`layouts[${index}].schemaVersions 必须非空`);
          }
        }
      }
      break;
    }
    case 'app': {
      if (capabilities !== undefined) errors.push('capabilities 不适用于 app 角色');
      if (healthCheck !== undefined) errors.push('healthCheck 不适用于 app 角色');
      if (ui === undefined) {
        errors.push('ui 缺失');
      } else {
        if (!['window', 'desktop', 'tray'].includes(ui.surface)) {
          errors.push('ui.surface 必须是 window、desktop 或 tray');
        }
        const launcher = ui.launcher;
        if (launcher !== undefined && isRecord(launcher)) {
          checkAssetPath(errors, 'ui.launcher.icon', launcher.icon);
        }
      }
      if (candidate.deepLinks !== undefined) {
        for (const [index, deepLink] of candidate.deepLinks.entries()) {
          if (typeof deepLink.scheme !== 'string' || deepLink.scheme.length === 0) {
            errors.push(`deepLinks[${index}].scheme 必须非空`);
          }
          if (typeof deepLink.host !== 'string' || deepLink.host.length === 0) {
            errors.push(`deepLinks[${index}].host 必须非空`);
          }
        }
      }
      break;
    }
    case 'service': {
      if (capabilities !== undefined) errors.push('capabilities 不适用于 service 角色');
      if (ui !== undefined) errors.push('ui 不适用于 service 角色');
      if (candidate.deepLinks !== undefined) errors.push('deepLinks 不适用于 service 角色');
      if (healthCheck !== undefined) {
        const interval = healthCheck.interval;
        const timeout = healthCheck.timeout;
        if (typeof interval !== 'string' || !DURATION_PATTERN.test(interval)) {
          errors.push('healthCheck.interval 必须是 <正整数><ms|s|m>');
        }
        if (typeof timeout !== 'string' || !DURATION_PATTERN.test(timeout)) {
          errors.push('healthCheck.timeout 必须是 <正整数><ms|s|m>');
        }
      }
      break;
    }
    default:
      break;
  }

  if (candidate.permissions !== undefined) {
    if (!Array.isArray(candidate.permissions)) {
      errors.push('permissions 必须是字符串数组');
    } else if (candidate.permissions.some((item) => typeof item !== 'string')) {
      errors.push('permissions 元素必须是字符串');
    }
  }

  checkCliSection(errors, candidate);

  return errors;
}

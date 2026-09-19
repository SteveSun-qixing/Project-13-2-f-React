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

  return errors;
}

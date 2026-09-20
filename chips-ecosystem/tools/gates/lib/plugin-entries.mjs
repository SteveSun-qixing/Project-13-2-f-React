/**
 * 四角色入口判定表（工单 021 收口：门禁与 CLI validate 同源判定）。
 *
 * 唯一规范事实源为《04-文件格式规范/03-插件包格式》§2.3 根目录白名单与 §2.4 入口约定：
 * `dist/index.js` 全部角色必需；`render.js` 对 `basecard` / `boxlayout` / `app` 必需、
 * 对 `service` 禁止。本表与 `packages/cli/src/artifacts/cpk-validate.ts` 的
 * `validateLayout` 角色分支、`tools/scaffold/src/templates/` 的 `RENDER_ENTRY_BY_ROLE`
 * 三个消费面同源；新增角色或入口要求变更时，以《插件包格式》为准同步三处。
 *
 * 角色取值来源为插件工程包根 `manifest.yaml` 顶层 `type` 字段（与 CLI 清单校验、
 * 安装校验同一事实源），不做目录名嗅探、不接受调用方猜测。
 */

import fs from 'node:fs';
import path from 'node:path';

import { UsageError } from './cli.mjs';

/** 四角色清单（《插件包格式》§2.3；与 CLI `allPluginRoles()`、scaffold `PluginRole` 一致）。 */
export const PLUGIN_ROLES = Object.freeze(['basecard', 'boxlayout', 'app', 'service']);

/** 渲染入口相对路径（包根）。 */
export const RENDER_ENTRY_PATH = 'render.js';

/** 主进程入口相对路径。 */
export const MAIN_ENTRY_PATH = 'dist/index.js';

/**
 * 单一判定表：角色 → 渲染入口要求。
 *
 * - `required`：缺 `render.js` 即入口缺失（与 CLI `CPK_ENTRY_MISSING` 同向）；
 * - `forbidden`：出现 `render.js` 即布局违规（与 CLI `CPK_LAYOUT_INVALID` 同向）。
 *
 * 主入口 `dist/index.js` 对全部角色必需，不随角色变化，故不入表。
 */
export const ROLE_RENDER_ENTRY_REQUIREMENTS = Object.freeze(
  /** @type {Record<string, 'required' | 'forbidden'>} */ ({
    basecard: 'required',
    boxlayout: 'required',
    app: 'required',
    service: 'forbidden',
  })
);

/**
 * 从 `manifest.yaml` 文本提取顶层 `type` 标量（first-column 键，嵌套同名词条不误匹配）。
 *
 * 只承担入口判定所需的最小读取；字段合法性（取值域、必需性）的完整校验归 CLI
 * `chips plugin validate` / `parseManifestText`，本模块只在其之上做 fail-closed 判定。
 */
export function extractManifestType(text) {
  const match = text.match(/^type:[ \t]*(.*?)[ \t]*$/m);
  if (match === null) {
    return undefined;
  }
  // YAML 行内注释（前置空白 + `#`）不参与取值。
  const raw = match[1].replace(/\s+#.*$/, '');
  const quoted = raw.match(/^(['"])(.*)\1$/);
  const value = quoted ? quoted[2] : raw;
  return value.length === 0 ? undefined : value;
}

/**
 * 读取 `<pluginDir>/manifest.yaml` 并解析角色。
 *
 * 任一环节不可判定即抛 `UsageError`（退出码 2）：manifest 缺失或不可读、
 * 缺顶层 `type`、`type` 取值不在四角色清单。禁止回退到任何猜测口径。
 */
export function resolvePluginRole(pluginDir) {
  const manifestPath = path.join(pluginDir, 'manifest.yaml');
  let text;
  try {
    text = fs.readFileSync(manifestPath, 'utf8');
  } catch (error) {
    throw new UsageError(
      `无法确定插件角色：读取 manifest.yaml 失败：${manifestPath}（${error.code ?? error.message}）；` +
        `入口校验要求插件目录包根含 manifest.yaml（角色事实源）`
    );
  }
  const type = extractManifestType(text);
  if (type === undefined) {
    throw new UsageError(
      `无法确定插件角色：${manifestPath} 缺少顶层 type 字段（basecard / boxlayout / app / service）`
    );
  }
  if (!PLUGIN_ROLES.includes(type)) {
    throw new UsageError(
      `未知插件角色：type=${type}（允许值：${PLUGIN_ROLES.join(' / ')}；来源：${manifestPath}）`
    );
  }
  return type;
}

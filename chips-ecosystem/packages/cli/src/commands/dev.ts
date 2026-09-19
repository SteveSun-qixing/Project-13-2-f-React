/**
 * 开发侧命令：`chips dev run` 与 `chips dev service invoke`（[CLI 完整参考] §4.2、§4.3）。
 *
 * 开发工作区选择由全局选项与 `CHIPS_WORKSPACE` 完成（§2.2）；本模块只做工程校验、
 * 参数解析与开发宿主委托。
 */

import { isAbsolute, resolve } from 'node:path';

import { cliError } from '../errors.js';
import { readManifestRole } from '../artifacts/manifest.js';
import type { IParameterDeclaration } from '../args/types.js';
import type { ICommandResult } from '../output/result.js';
import type { ICliCommandDefinition, ICommandContext } from './types.js';
import { parseCommandOptions, providedOptionNames, readString, requireWorkspace } from './helpers.js';

const dirOption: IParameterDeclaration = {
  name: 'dir',
  type: 'path',
  mapsTo: 'dir',
  path: { kind: 'directory', role: 'input' },
};

const capabilityOption: IParameterDeclaration = {
  name: 'capability',
  type: 'string',
  mapsTo: 'capability',
  validation: { minLength: 1, pattern: '^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*(:[^\\s]+)?$' },
};

const inputOption: IParameterDeclaration = {
  name: 'input',
  type: 'json',
  mapsTo: 'input',
};

const inputFileOption: IParameterDeclaration = {
  name: 'input-file',
  type: 'jsonFile',
  mapsTo: 'inputFile',
};

/** `chips dev run`。 */
const runCommand: ICliCommandDefinition = {
  path: ['run'],
  summary: '启动开发宿主运行当前 app 插件工程',
  usage: 'chips dev run [--dir <插件工程目录>] [--workspace <路径>]',
  parameters: { options: [dirOption] },
  run: async (context: ICommandContext): Promise<ICommandResult> => {
    const { values } = parseCommandOptions(context, { options: [dirOption] });
    const dir = readString(values, 'dir') ?? context.cwd;
    const role = readManifestRole(context.fileSystem, dir);
    if (role === undefined) {
      throw cliError('CLI_PATH_NOT_FOUND', `目录缺少 manifest.yaml：${dir}`, { path: dir });
    }
    if (role !== 'app') {
      throw cliError('CLI_ARGUMENT_INVALID', 'chips dev run 仅支持 app 角色插件工程', {
        role,
        path: dir,
      });
    }
    const workspace = await requireWorkspace(context);
    await context.client.devHost.runPlugin({ dir, workspace: workspace.path });
    return {
      json: { ok: true, dir, workspace: workspace.path },
      human: [`开发宿主已结束：${dir}`],
    };
  },
};

/** `chips dev service invoke`。 */
const serviceInvokeCommand: ICliCommandDefinition = {
  path: ['service', 'invoke'],
  summary: '在开发宿主中调用服务能力',
  usage: 'chips dev service invoke --capability <能力ID> [--dir <插件工程目录>] [--input <JSON>] [--input-file <路径>]',
  parameters: { options: [capabilityOption, dirOption, inputOption, inputFileOption] },
  run: async (context: ICommandContext): Promise<ICommandResult> => {
    const declarations = { options: [capabilityOption, dirOption, inputOption, inputFileOption] };
    // 互斥校验先于解析：`--input` 与 `--input-file` 不得同时出现（§4.3），
    // 否则文件读取会先抛出 `CLI_PATH_*`（退出码 5）而不是参数错误（退出码 2）。
    const provided = providedOptionNames(context.args);
    if (provided.has('input') && provided.has('input-file')) {
      throw cliError('CLI_ARGUMENT_INVALID', '--input 与 --input-file 不得同时出现', {
        params: ['input', 'input-file'],
      });
    }
    const { values } = parseCommandOptions(context, declarations);
    const capability = readString(values, 'capability');
    if (capability === undefined) {
      throw cliError('CLI_ARGUMENT_INVALID', '缺少必填选项：--capability', { param: 'capability' });
    }
    const dir = readString(values, 'dir') ?? context.cwd;
    const input = values.has('input') ? values.get('input') : (values.get('input-file') ?? {});
    const workspace = await requireWorkspace(context);
    const result = await context.client.capabilities.invoke({
      capability,
      dir: normalizeDirectory(dir, context.cwd),
      input,
      workspace: workspace.path,
    });
    const json: {
      ok: true;
      capability: string;
      owner?: string;
      output: unknown;
    } = { ok: true, capability, output: result.output };
    if (result.owner !== undefined) {
      json.owner = result.owner;
    }
    const human = [
      `能力：${capability}`,
      ...(result.owner === undefined ? [] : [`提供方：${result.owner}`]),
      '输出:',
      JSON.stringify(result.output, null, 2),
    ];
    return { json, human };
  },
};

function normalizeDirectory(dir: string, cwd: string): string {
  return isAbsolute(dir) ? dir : resolve(cwd, dir);
}

/** 开发侧专用命令。 */
export const devCommands: readonly ICliCommandDefinition[] = [runCommand, serviceInvokeCommand];

/** `dev service` 组提示。 */
export const DEV_SERVICE_SUBCOMMANDS: readonly string[] = ['invoke'];

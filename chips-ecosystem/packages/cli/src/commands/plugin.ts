/**
 * 插件管理命令：`chips plugin create | pack | validate | install | uninstall | list | info | enable | disable`
 * （[CLI 完整参考] §3.5）。
 *
 * - `create`：模板计划来自 `@chips/sdk/scaffold`（端口），CLI 负责落盘；
 * - `pack` / `validate`：归 CLI 的五阶段打包与校验引擎（[插件包格式] §7.1）；
 * - `install` / `enable` / `disable` / `uninstall` / `list` / `info`：经平台承载适配器执行。
 */

import { cliError } from '../errors.js';
import { TRUST_ROOTS_ENV } from '../artifacts/trust-roots.js';
import type {
  ICliArtifactStageResult,
  ICliPluginRecord,
  CliPluginRole,
  CliPluginSource,
} from '../client/types.js';
import type { IParameterDeclaration, IParameterSet } from '../args/types.js';
import type { ICommandResult } from '../output/result.js';
import type { ICliCommandDefinition, ICommandContext } from './types.js';
import { parseCommandOptions, readBoolean, readString } from './helpers.js';

const ROLE_CHOICES: readonly string[] = ['app', 'basecard', 'boxlayout', 'service'];

const roleOption: IParameterDeclaration = {
  name: 'role',
  type: 'enum',
  choices: [...ROLE_CHOICES],
  mapsTo: 'role',
};

const idOption: IParameterDeclaration = {
  name: 'id',
  type: 'string',
  mapsTo: 'id',
  validation: { pattern: '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$' },
};

const nameOption: IParameterDeclaration = {
  name: 'name',
  type: 'string',
  mapsTo: 'name',
  validation: { minLength: 1 },
};

const dirOption: IParameterDeclaration = {
  name: 'dir',
  type: 'path',
  mapsTo: 'dir',
  path: { kind: 'directory', role: 'input' },
};

const outOption: IParameterDeclaration = {
  name: 'out',
  type: 'path',
  mapsTo: 'out',
  path: { kind: 'directory', role: 'output', create: true, overwrite: 'overwrite' },
};

const signOption: IParameterDeclaration = {
  name: 'sign',
  type: 'boolean',
  mapsTo: 'sign',
};

const keyIdOption: IParameterDeclaration = {
  name: 'key-id',
  type: 'string',
  mapsTo: 'keyId',
  validation: { minLength: 1 },
};

/**
 * `plugin validate` 的路径参数：可读性与存在性交给与安装同源的五阶段校验链
 * （[CLI 完整参考] §3.5.3「路径不可读返回 `CLI_PATH_*`，退出 5」、§六：CLI 不重复校验）。
 */
const validatePathArgument: IParameterDeclaration = {
  name: 'path',
  position: 0,
  type: 'path',
  required: true,
  mapsTo: 'path',
  path: { kind: 'any', role: 'input' },
};

/**
 * `plugin install` 的安装源描述符（目录 | .cpk | manifest.yaml）按用户输入原样交给平台安装链，
 * 校验与路径诊断同源产出（§3.5.4）。
 */
const installSourceArgument: IParameterDeclaration = {
  name: 'path',
  position: 0,
  type: 'string',
  required: true,
  mapsTo: 'path',
  validation: { minLength: 1 },
};

const pluginIdArgument: IParameterDeclaration = {
  name: 'pluginId',
  position: 0,
  type: 'string',
  required: true,
  mapsTo: 'pluginId',
  validation: { minLength: 1 },
};

function readRole(value: string | undefined): CliPluginRole {
  if (value === 'app' || value === 'basecard' || value === 'boxlayout' || value === 'service') {
    return value;
  }
  throw cliError('CLI_ARGUMENT_INVALID', `插件角色无效：${value ?? ''}`, { param: 'role' });
}

function sourceChoices(context: ICommandContext): readonly string[] {
  return context.entry === 'dev' ? ['builtin', 'user', 'development'] : ['builtin', 'user'];
}

function readSource(value: string | undefined): CliPluginSource | undefined {
  return value === 'builtin' || value === 'user' || value === 'development' ? value : undefined;
}

const STAGE_LABEL: Readonly<Record<ICliArtifactStageResult['stage'], string>> = {
  archive: '归档校验',
  layout: '结构校验',
  manifest: '清单校验',
  signature: '签名校验',
  hash: '摘要校验',
};

const STAGE_STATUS_LABEL: Readonly<Record<ICliArtifactStageResult['status'], string>> = {
  passed: '通过',
  skipped: '已跳过',
  failed: '未通过',
};

/** `chips plugin create`。 */
const createCommand: ICliCommandDefinition = {
  path: ['plugin', 'create'],
  summary: '按角色生成插件工程脚手架',
  usage:
    'chips plugin create --role <app|basecard|boxlayout|service> --id <插件ID> --name <显示名> [--dir <目录>]',
  outputMode: 'human',
  parameters: { options: [roleOption, idOption, nameOption, dirOption] },
  run: async (context: ICommandContext): Promise<ICommandResult> => {
    const declarations: IParameterSet = { options: [roleOption, idOption, nameOption, dirOption] };
    const { values } = parseCommandOptions(context, declarations);
    const role = readRole(readString(values, 'role'));
    const pluginId = readString(values, 'id');
    const name = readString(values, 'name');
    if (pluginId === undefined) {
      throw cliError('CLI_ARGUMENT_INVALID', '缺少必填选项：--id', { param: 'id' });
    }
    if (name === undefined) {
      throw cliError('CLI_ARGUMENT_INVALID', '缺少必填选项：--name', { param: 'name' });
    }
    const explicitDir = readString(values, 'dir');
    const lastSegment = pluginId.split('.').pop() ?? pluginId;
    const dir = explicitDir ?? `${context.cwd}/${lastSegment}`;
    const result = await context.client.artifacts.create({
      role,
      pluginId,
      name,
      dir,
      fileSystem: context.fileSystem,
    });
    const human = [
      `已创建 ${role} 角色插件：${result.pluginId}`,
      `目标目录：${result.targetDir}`,
      `生成文件：${result.files.join('、')}`,
      '下一步：pnpm install 建立工作区链接，然后执行 chips dev run 启动开发宿主',
    ];
    return { json: result, human };
  },
};

/** `chips plugin pack`。 */
const packCommand: ICliCommandDefinition = {
  path: ['plugin', 'pack'],
  summary: '打包插件目录为 .cpk（ZIP Store）',
  usage: 'chips plugin pack [--dir <目录>] [--out <目录>] [--sign --key-id <密钥ID>]',
  outputMode: 'human',
  parameters: { options: [dirOption, outOption, signOption, keyIdOption] },
  run: async (context: ICommandContext): Promise<ICommandResult> => {
    const declarations: IParameterSet = {
      options: [dirOption, outOption, signOption, keyIdOption],
    };
    const { values } = parseCommandOptions(context, declarations);
    const dir = readString(values, 'dir') ?? context.cwd;
    const out = readString(values, 'out');
    const sign = readBoolean(values, 'sign') === true;
    const keyId = readString(values, 'key-id');
    if (sign && keyId === undefined) {
      throw cliError('CLI_ARGUMENT_INVALID', '--sign 需要同时提供 --key-id', { param: 'key-id' });
    }
    const signingKeyFile = context.env.CHIPS_SIGNING_KEY_FILE;
    if (sign && (signingKeyFile === undefined || signingKeyFile.length === 0)) {
      throw cliError('CLI_ARGUMENT_INVALID', '--sign 需要设置 CHIPS_SIGNING_KEY_FILE', {
        param: 'key-id',
        hint: '请先设置环境变量 CHIPS_SIGNING_KEY_FILE，指向受保护的文件路径以注入 Ed25519 私钥',
      });
    }
    const result = await context.client.artifacts.pack({
      dir,
      ...(out === undefined ? {} : { out }),
      sign,
      ...(keyId === undefined ? {} : { keyId }),
      ...(signingKeyFile === undefined ? {} : { signingKeyFile }),
      fileSystem: context.fileSystem,
    });
    const human = [
      `已生成 ${result.archivePath}`,
      `  manifest: ${result.name}@${result.version}（${result.role}）`,
      `  成员数: ${result.memberCount}`,
      `  归档大小: ${formatKiB(result.archiveSize)}（ZIP Store）`,
      `  安装摘要: ${result.digest}`,
      `  校验: 通过`,
    ];
    return { json: result, human };
  },
};

/** `chips plugin validate`。 */
const validateCommand: ICliCommandDefinition = {
  path: ['plugin', 'validate'],
  summary: '执行与安装同源的五阶段校验',
  usage: 'chips plugin validate <目录或 .cpk 路径>',
  outputMode: 'human',
  parameters: { arguments: [validatePathArgument] },
  run: async (context: ICommandContext): Promise<ICommandResult> => {
    const { values } = parseCommandOptions(context, { arguments: [validatePathArgument] });
    const path = readString(values, 'path') ?? '';
    const source: CliPluginSource = context.entry === 'dev' ? 'development' : 'user';
    const platformVersion = await context.resolvePlatformVersion();
    // 信任根正式注入通道（[CLI 完整参考] §2.7）：空串按未设置，与 CHIPS_SIGNING_KEY_FILE 口径一致。
    const trustRootsFile = context.env[TRUST_ROOTS_ENV];
    const result = await context.client.artifacts.validate({
      path,
      source,
      ...(platformVersion === undefined ? {} : { platformVersion }),
      ...(trustRootsFile === undefined || trustRootsFile.length === 0 ? {} : { trustRootsFile }),
      fileSystem: context.fileSystem,
    });
    const human = [
      ...result.stages.map(
        (stage) =>
          `${STAGE_LABEL[stage.stage]}: ${STAGE_STATUS_LABEL[stage.status]}${
            stage.detail.length > 0 ? `（${stage.detail}）` : ''
          }`
      ),
      `结果: ${result.valid ? 'valid' : 'invalid'}`,
      ...(result.warnings ?? []).map((warning) => `警告: ${warning}`),
    ];
    return { json: result, human };
  },
};

/** `chips plugin install`。 */
const installCommand: ICliCommandDefinition = {
  path: ['plugin', 'install'],
  summary: '安装插件（只登记为 installed，不自动启用）',
  usage: 'chips plugin install <目录 | .cpk | manifest.yaml>',
  parameters: { arguments: [installSourceArgument] },
  run: async (context: ICommandContext): Promise<ICommandResult> => {
    const { values } = parseCommandOptions(context, { arguments: [installSourceArgument] });
    const path = readString(values, 'path') ?? '';
    const source: CliPluginSource = context.entry === 'dev' ? 'development' : 'user';
    // 未签名发布者的确认先于安装链：非交互环境缺少 `--yes` 直接返回参数错误，不挂起等待（§2.1、§3.5.4）。
    if (source === 'user' && !context.globals.yes && !context.io.isTTY) {
      throw cliError('CLI_ARGUMENT_INVALID', '非交互环境安装插件必须显式传入 --yes', {
        option: 'yes',
        hint: '未签名发布者需要用户确认',
      });
    }
    const record = await context.client.platform.pluginInstall({
      path,
      source,
      yes: context.globals.yes,
    });
    const json = {
      pluginId: record.id,
      version: record.version,
      type: record.role,
      state: 'installed',
    };
    return {
      json,
      human: [
        `已安装插件：${record.name}（${record.id}@${record.version}）`,
        `角色：${record.role}`,
        '状态：installed（未自动启用，执行 chips plugin enable 启用）',
      ],
    };
  },
};

/** `chips plugin list`。 */
const listCommand: ICliCommandDefinition = {
  path: ['plugin', 'list'],
  summary: '列出已发现与已安装插件',
  usage: 'chips plugin list [--role <basecard|boxlayout|app|service>] [--source <builtin|user>]',
  parameters: {
    options: [
      roleOption,
      {
        name: 'source',
        type: 'enum',
        choices: ['builtin', 'user', 'development'],
        mapsTo: 'source',
      },
    ],
  },
  run: async (context: ICommandContext): Promise<ICommandResult> => {
    const sourceDeclaration: IParameterDeclaration = {
      name: 'source',
      type: 'enum',
      choices: [...sourceChoices(context)],
      mapsTo: 'source',
    };
    const { values } = parseCommandOptions(context, { options: [roleOption, sourceDeclaration] });
    const roleRaw = readString(values, 'role');
    const source = readSource(readString(values, 'source'));
    const records = await context.client.platform.pluginList({
      ...(roleRaw === undefined ? {} : { role: readRole(roleRaw) }),
      ...(source === undefined ? {} : { source }),
    });
    const human = records.map(
      (record) =>
        `${record.id}@${record.version}  ${record.role}  ${record.name}  ${record.source}  ${record.state}${
          record.enabled ? '（已启用）' : ''
        }`
    );
    // 表格便于终端阅读，其后的 JSON 记录数组是稳定契约（§2.4.2、§3.5.5）。
    return {
      json: records,
      human: human.length > 0 ? human : ['未发现插件'],
      mode: 'human',
      humanEnvelope: true,
    };
  },
};

/** `chips plugin info`。 */
const infoCommand: ICliCommandDefinition = {
  path: ['plugin', 'info'],
  summary: '查看单插件详情',
  usage: 'chips plugin info <pluginId>',
  parameters: { arguments: [pluginIdArgument] },
  run: async (context: ICommandContext): Promise<ICommandResult> => {
    const { values } = parseCommandOptions(context, { arguments: [pluginIdArgument] });
    const pluginId = readString(values, 'pluginId') ?? '';
    const detail = await context.client.platform.pluginInfo(pluginId);
    const human = [
      `${detail.name}（${detail.id}@${detail.version}）`,
      `角色：${detail.role}`,
      `来源：${detail.source}`,
      `状态：${detail.state}${detail.enabled ? '（已启用）' : ''}`,
      `安装路径：${detail.installPath}`,
      `清单路径：${detail.manifestPath}`,
      `权限申请：${detail.permissions.length > 0 ? detail.permissions.join('、') : '无'}`,
      `已授权：${detail.grantedPermissions.length > 0 ? detail.grantedPermissions.join('、') : '无'}`,
    ];
    if (detail.lastError !== undefined) {
      human.push(`最近错误：${detail.lastError.code} ${detail.lastError.message}`);
    }
    return { json: detail, human };
  },
};

function lifecycleCommand(
  action: 'enable' | 'disable' | 'uninstall',
  summary: string
): ICliCommandDefinition {
  return {
    path: ['plugin', action],
    summary,
    usage: `chips plugin ${action} <pluginId>`,
    parameters: { arguments: [pluginIdArgument] },
    run: async (context: ICommandContext): Promise<ICommandResult> => {
      const { values } = parseCommandOptions(context, { arguments: [pluginIdArgument] });
      const pluginId = readString(values, 'pluginId') ?? '';
      if (action === 'uninstall') {
        await context.client.platform.pluginUninstall(pluginId);
        return { json: { ok: true }, human: [`已卸载插件：${pluginId}`] };
      }
      const record: ICliPluginRecord =
        action === 'enable'
          ? await context.client.platform.pluginEnable(pluginId)
          : await context.client.platform.pluginDisable(pluginId);
      const state = action === 'enable' ? 'active' : 'disabled';
      return {
        json: { ...record, state },
        human: [`插件 ${record.id} 状态：${state}`],
      };
    },
  };
}

/** 缺少子命令时的统一错误（退出码 3，[CLI 完整参考] §2.3）。 */
export function missingSubcommand(context: ICommandContext, subcommands: readonly string[]): never {
  throw cliError('CLI_COMMAND_NOT_FOUND', `命令 ${context.commandPath} 缺少子命令`, {
    commandPath: context.commandPath,
    subcommands,
  });
}

/** `plugin` 命令组。 */
export const pluginCommands: readonly ICliCommandDefinition[] = [
  createCommand,
  packCommand,
  validateCommand,
  installCommand,
  listCommand,
  infoCommand,
  lifecycleCommand('enable', '启用插件（首次启用进入逐项授权）'),
  lifecycleCommand('disable', '停用插件并级联停用依赖方'),
  lifecycleCommand('uninstall', '卸载插件并清理入口与注册记录'),
];

/** `plugin` 组提示（无子命令时）。 */
export const PLUGIN_SUBCOMMANDS: readonly string[] = [
  'create',
  'pack',
  'validate',
  'install',
  'uninstall',
  'list',
  'info',
  'enable',
  'disable',
];

function formatKiB(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

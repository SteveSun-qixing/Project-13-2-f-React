/**
 * `@chips/scaffold` 公开面逐名在册锁测（工单 #225 交回项收口，任务 #237）。
 *
 * 三条臂：
 * 1. 源面逐名在册：从 `src/index.ts` 文本解析 `export type { ... } from './types.js'`
 *    与两条值导出语句，断言公开名单与在册名单**精确相等**——名单少一名（漏转发）或
 *    多一名（擅自扩面）都红；再逐名回查 `src/types.ts` 的声明存在性，杜绝入口与单源脱钩。
 * 2. 类型级可达：CLI 契约九型与参数类型标量联合 `PluginCliParameterType` 经入口导入后与
 *    `src/types.ts` 单源声明 `expectTypeOf` 全等（同一声明、非结构复刻），并以九型完整装配
 *    一份 `IPluginCli` 值、以联合核证其为 `IPluginCliParameter['type']` 的字段类型——任何一名
 *    从入口移除都会在 `pnpm typecheck`（tsconfig include 覆盖 tests）处编译失败。
 * 3. 运行时面：值导出恰为五个在册名、无默认导出，`Object.keys` 精确断言。
 *
 * 在册名单依据：九型 CLI 契约类型与标量联合 `PluginCliParameterType` 经《02-SDK-API规范》
 * §2.2 manifest 行在册类型 `IPluginManifest` 的 `cli?` 字段传递在册（字段文法权威
 * 《02-插件清单规范》§7.6、《07-CLI完整参考》§五；现状登记见《02.08》§八 类型面注记），
 * 随 manifest 面公开。
 */
import { readFileSync } from 'node:fs';

import { describe, expect, expectTypeOf, it } from 'vitest';

import * as scaffoldEntry from '../src/index.js';
import type {
  IPluginCli,
  IPluginCliCommand,
  IPluginCliCommandConflict,
  IPluginCliCommandJob,
  IPluginCliCommandOutput,
  IPluginCliCommandSurface,
  IPluginCliCommandTarget,
  IPluginCliParameter,
  IPluginCliParameterPath,
  PluginCliParameterType,
} from '../src/index.js';
import type {
  IPluginCli as SourceIPluginCli,
  IPluginCliCommand as SourceIPluginCliCommand,
  IPluginCliCommandConflict as SourceIPluginCliCommandConflict,
  IPluginCliCommandJob as SourceIPluginCliCommandJob,
  IPluginCliCommandOutput as SourceIPluginCliCommandOutput,
  IPluginCliCommandSurface as SourceIPluginCliCommandSurface,
  IPluginCliCommandTarget as SourceIPluginCliCommandTarget,
  IPluginCliParameter as SourceIPluginCliParameter,
  IPluginCliParameterPath as SourceIPluginCliParameterPath,
  PluginCliParameterType as SourcePluginCliParameterType,
} from '../src/types.js';

/** 入口 `export type` 自 `./types.js` 的在册类型名单（29 名，精确集合）。 */
const PUBLIC_TYPE_NAMES: readonly string[] = [
  'IPluginCapabilities',
  'IPluginCardType',
  'IPluginCli',
  'IPluginCliCommand',
  'IPluginCliCommandConflict',
  'IPluginCliCommandJob',
  'IPluginCliCommandOutput',
  'IPluginCliCommandSurface',
  'IPluginCliCommandTarget',
  'IPluginCliParameter',
  'IPluginCliParameterPath',
  'IPluginDeepLink',
  'IPluginDependency',
  'IPluginEngines',
  'IPluginExportFormat',
  'IPluginFileAssociation',
  'IPluginHealthCheck',
  'IPluginLayoutType',
  'IPluginManifest',
  'IPluginRuntime',
  'IPluginUi',
  'IScaffoldFile',
  'IScaffoldOptions',
  'IScaffoldPlan',
  'IScaffoldTemplate',
  'PluginCliParameterType',
  'PluginRole',
  'PluginSurface',
  'PluginTarget',
];

/** CLI 契约九型在册名单（`IPluginManifest.cli?` 的传递在册成员；标量联合 `PluginCliParameterType`
 *  不带 `IPluginCli` 前缀，单独随 29 名公开名单在册）。 */
const CLI_CONTRACT_NAMES: readonly string[] = [
  'IPluginCli',
  'IPluginCliCommand',
  'IPluginCliCommandConflict',
  'IPluginCliCommandJob',
  'IPluginCliCommandOutput',
  'IPluginCliCommandSurface',
  'IPluginCliCommandTarget',
  'IPluginCliParameter',
  'IPluginCliParameterPath',
];

/** 入口值导出在册名单（5 个命名值，无默认导出）。 */
const PUBLIC_VALUE_NAMES: readonly string[] = [
  'ScaffoldError',
  'createScaffoldPlan',
  'isScaffoldError',
  'listScaffoldTemplates',
  'SCAFFOLD_TEMPLATE_ROLES',
];

function parseExportTypeNames(source: string, specifier: string): string[] {
  const pattern = new RegExp(
    `export type \\{([^}]*)\\} from '${specifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}';`
  );
  const match = pattern.exec(source);
  if (match === null) {
    throw new Error(`入口源中未找到自 ${specifier} 的 export type 块`);
  }
  return (match[1] ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

describe('@chips/scaffold 入口源面逐名在册（偏差注入双向臂）', () => {
  const indexSource = readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8');

  it('export type 名单与在册 29 名精确相等（少一名或多一名都红）', () => {
    expect(parseExportTypeNames(indexSource, './types.js').sort()).toEqual(
      [...PUBLIC_TYPE_NAMES].sort()
    );
  });

  it('CLI 契约九型逐名在公开名单内，且公开名单内以 IPluginCli 开头的恰为九型', () => {
    for (const name of CLI_CONTRACT_NAMES) {
      expect(PUBLIC_TYPE_NAMES).toContain(name);
    }
    const exportedCliNames = parseExportTypeNames(indexSource, './types.js').filter((name) =>
      name.startsWith('IPluginCli')
    );
    expect(exportedCliNames.sort()).toEqual([...CLI_CONTRACT_NAMES].sort());
  });

  it('在册类型名逐名可在单源 src/types.ts 找到 export 声明（入口与单源不脱钩）', () => {
    const typesSource = readFileSync(new URL('../src/types.ts', import.meta.url), 'utf8');
    for (const name of PUBLIC_TYPE_NAMES) {
      const declared = new RegExp(`^export (?:interface|type) ${name}\\b`, 'm').test(typesSource);
      expect(declared, `src/types.ts 缺少导出声明：${name}`).toBe(true);
    }
  });
});

describe('CLI 契约九型与标量联合经入口可达且与单源同一（类型级）', () => {
  it('九个入口类型与 src/types.ts 单源声明两两全等（同一声明、非复刻）', () => {
    expectTypeOf<IPluginCli>().toEqualTypeOf<SourceIPluginCli>();
    expectTypeOf<IPluginCliCommand>().toEqualTypeOf<SourceIPluginCliCommand>();
    expectTypeOf<IPluginCliCommandConflict>().toEqualTypeOf<SourceIPluginCliCommandConflict>();
    expectTypeOf<IPluginCliCommandJob>().toEqualTypeOf<SourceIPluginCliCommandJob>();
    expectTypeOf<IPluginCliCommandOutput>().toEqualTypeOf<SourceIPluginCliCommandOutput>();
    expectTypeOf<IPluginCliCommandSurface>().toEqualTypeOf<SourceIPluginCliCommandSurface>();
    expectTypeOf<IPluginCliCommandTarget>().toEqualTypeOf<SourceIPluginCliCommandTarget>();
    expectTypeOf<IPluginCliParameter>().toEqualTypeOf<SourceIPluginCliParameter>();
    expectTypeOf<IPluginCliParameterPath>().toEqualTypeOf<SourceIPluginCliParameterPath>();
  });

  it("标量联合 PluginCliParameterType 入口与单源全等，且即 IPluginCliParameter['type'] 的字段类型", () => {
    expectTypeOf<PluginCliParameterType>().toEqualTypeOf<SourcePluginCliParameterType>();
    expectTypeOf<IPluginCliParameter['type']>().toEqualTypeOf<PluginCliParameterType>();
  });

  it('以入口九型完整装配一条命令声明，入口任一类型缺失时本文件编译即红', () => {
    const surface: IPluginCliCommandSurface = { open: true, focus: false, reuse: 'preferred' };
    const target: IPluginCliCommandTarget = {
      type: 'app',
      pluginId: 'chips.official.demo',
      capability: 'command:invoke',
      surface,
    };
    const outputPath: IPluginCliParameterPath = {
      kind: 'file',
      role: 'output',
      exists: false,
      create: true,
      extensions: ['.card'],
      overwrite: 'rename',
    };
    const positionals: readonly IPluginCliParameter[] = [
      { name: 'document', type: 'string', required: true, position: 0 },
    ];
    const options: readonly IPluginCliParameter[] = [
      { name: 'output', short: 'o', type: 'path', required: false, path: outputPath },
    ];
    const output: IPluginCliCommandOutput = {
      mode: 'human',
      json: 'supported',
      artifacts: ['document'],
    };
    const job: IPluginCliCommandJob = { wait: true, cancelOnInterrupt: true };
    const conflict: IPluginCliCommandConflict = { priority: 10, namespace: 'demo' };
    const command: IPluginCliCommand = {
      commandPath: ['demo', 'export'],
      commandId: 'demo:export',
      title: '导出文档',
      description: '把当前文档导出为指定文件',
      examples: ['chips demo export --output ./out.card'],
      permissions: ['file:write'],
      target,
      arguments: positionals,
      options,
      output,
      job,
      conflict,
    };
    const cli: IPluginCli = { commands: [command] };
    expect(cli.commands).toHaveLength(1);
    expect(cli.commands[0]?.commandPath).toEqual(['demo', 'export']);
    expect(cli.commands[0]?.target.type).toBe('app');
  });
});

describe('@chips/scaffold 运行时值面', () => {
  it('值导出恰为五个在册名且无默认导出', () => {
    expect(Object.keys(scaffoldEntry).sort()).toEqual([...PUBLIC_VALUE_NAMES].sort());
    expect('default' in scaffoldEntry).toBe(false);
  });
});

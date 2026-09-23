/**
 * `IPluginCli*` 九型与标量联合 `PluginCliParameterType` SDK 转发面锁测
 * （工单 #225 交回项收口，任务 #237；同缺陷类补齐，任务 #239）。
 *
 * 锁三件事：
 * 1. 源面逐名在册（偏差注入双向臂）：`src/scaffold/index.ts` 自 `@chips/scaffold` 的
 *    转发名单、`src/index.ts` manifest 块自 `./scaffold/index.js` 的再导出名单，都与
 *    在册名单**精确相等**——少一名（漏转发）或多一名（擅自扩面）都红；两块的
 *    `IPluginCli` 前缀子集恰为九型（标量联合不带该前缀，单独随名单在册）。
 * 2. 同一引用可达性（类型级）：九型与标量联合 `PluginCliParameterType` 经主入口、
 *    `@chips/sdk/scaffold` 子入口与上游 `@chips/scaffold` 三处 `expectTypeOf` 全等，
 *    证明 SDK 面是转发而非第二份形状（§2.3 单源纪律、§11 约束 5）；联合并核证其为
 *    `IPluginCliParameter['type']` 的字段类型（可赋值臂）。
 * 3. 消费形状：以主入口再导出的九型装配一份含 `cli` 的 `IPluginManifest`，任一类型
 *    在链路中断可达即 `pnpm typecheck` 编译失败。
 *
 * 边界照登：脚手架开发期四型（`IScaffoldOptions` / `IScaffoldPlan` / `IScaffoldTemplate` /
 * `IScaffoldFile`）不入主入口（§2.2 末段、§8.3），主入口 manifest 块 25 名 = 在册 15 名
 * + CLI 九型 + 标量联合 `PluginCliParameterType`；子入口 29 名 = 主入口 25 名 + 开发期四型。
 */
import { readFileSync } from 'node:fs';

import { describe, expect, expectTypeOf, it } from 'vitest';

import type * as upstreamScaffold from '@chips/scaffold';

import type * as sdkMain from '../src/index.js';
import type * as sdkScaffold from '../src/scaffold/index.js';

/** CLI 契约九型在册名单（与 `@chips/scaffold` 公开面同名同源）。 */
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

/** `@chips/sdk` 主入口 manifest 再导出块在册名单（25 名 = CLI 九型 + 标量联合 + 在册 15 名，精确集合）。 */
const MAIN_MANIFEST_NAMES: readonly string[] = [
  ...CLI_CONTRACT_NAMES,
  'IPluginCapabilities',
  'IPluginCardType',
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
  'PluginCliParameterType',
  'PluginRole',
  'PluginSurface',
  'PluginTarget',
];

/** `@chips/sdk/scaffold` 子入口类型转发在册名单（29 名 = 上游公开类型面全集）。 */
const SUB_ENTRY_TYPE_NAMES: readonly string[] = [
  ...MAIN_MANIFEST_NAMES,
  'IScaffoldFile',
  'IScaffoldOptions',
  'IScaffoldPlan',
  'IScaffoldTemplate',
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

describe('SDK 两入口源面逐名在册（偏差注入双向臂）', () => {
  const mainSource = readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8');
  const subSource = readFileSync(new URL('../src/scaffold/index.ts', import.meta.url), 'utf8');

  it('主入口 manifest 块与在册 25 名精确相等（少一名或多一名都红）', () => {
    expect(parseExportTypeNames(mainSource, './scaffold/index.js').sort()).toEqual(
      [...MAIN_MANIFEST_NAMES].sort()
    );
  });

  it('子入口转发名单与上游公开类型面 29 名精确相等（少一名或多一名都红）', () => {
    expect(parseExportTypeNames(subSource, '@chips/scaffold').sort()).toEqual(
      [...SUB_ENTRY_TYPE_NAMES].sort()
    );
  });

  it('两入口的 IPluginCli 前缀子集恰为九型（CLI 面逐名在册、无夹带）', () => {
    const mainCliNames = parseExportTypeNames(mainSource, './scaffold/index.js').filter((name) =>
      name.startsWith('IPluginCli')
    );
    const subCliNames = parseExportTypeNames(subSource, '@chips/scaffold').filter((name) =>
      name.startsWith('IPluginCli')
    );
    expect(mainCliNames.sort()).toEqual([...CLI_CONTRACT_NAMES].sort());
    expect(subCliNames.sort()).toEqual([...CLI_CONTRACT_NAMES].sort());
  });
});

describe('九型与标量联合三层同一引用（§2.3 单源纪律，类型级）', () => {
  it('主入口 ≡ 子入口 ≡ 上游：九型逐名两两全等，SDK 面是转发不是第二份形状', () => {
    expectTypeOf<sdkMain.IPluginCli>().toEqualTypeOf<sdkScaffold.IPluginCli>();
    expectTypeOf<sdkScaffold.IPluginCli>().toEqualTypeOf<upstreamScaffold.IPluginCli>();
    expectTypeOf<sdkMain.IPluginCliCommand>().toEqualTypeOf<sdkScaffold.IPluginCliCommand>();
    expectTypeOf<sdkScaffold.IPluginCliCommand>().toEqualTypeOf<upstreamScaffold.IPluginCliCommand>();
    expectTypeOf<sdkMain.IPluginCliCommandConflict>().toEqualTypeOf<sdkScaffold.IPluginCliCommandConflict>();
    expectTypeOf<sdkScaffold.IPluginCliCommandConflict>().toEqualTypeOf<upstreamScaffold.IPluginCliCommandConflict>();
    expectTypeOf<sdkMain.IPluginCliCommandJob>().toEqualTypeOf<sdkScaffold.IPluginCliCommandJob>();
    expectTypeOf<sdkScaffold.IPluginCliCommandJob>().toEqualTypeOf<upstreamScaffold.IPluginCliCommandJob>();
    expectTypeOf<sdkMain.IPluginCliCommandOutput>().toEqualTypeOf<sdkScaffold.IPluginCliCommandOutput>();
    expectTypeOf<sdkScaffold.IPluginCliCommandOutput>().toEqualTypeOf<upstreamScaffold.IPluginCliCommandOutput>();
    expectTypeOf<sdkMain.IPluginCliCommandSurface>().toEqualTypeOf<sdkScaffold.IPluginCliCommandSurface>();
    expectTypeOf<sdkScaffold.IPluginCliCommandSurface>().toEqualTypeOf<upstreamScaffold.IPluginCliCommandSurface>();
    expectTypeOf<sdkMain.IPluginCliCommandTarget>().toEqualTypeOf<sdkScaffold.IPluginCliCommandTarget>();
    expectTypeOf<sdkScaffold.IPluginCliCommandTarget>().toEqualTypeOf<upstreamScaffold.IPluginCliCommandTarget>();
    expectTypeOf<sdkMain.IPluginCliParameter>().toEqualTypeOf<sdkScaffold.IPluginCliParameter>();
    expectTypeOf<sdkScaffold.IPluginCliParameter>().toEqualTypeOf<upstreamScaffold.IPluginCliParameter>();
    expectTypeOf<sdkMain.IPluginCliParameterPath>().toEqualTypeOf<sdkScaffold.IPluginCliParameterPath>();
    expectTypeOf<sdkScaffold.IPluginCliParameterPath>().toEqualTypeOf<upstreamScaffold.IPluginCliParameterPath>();
  });

  it("PluginCliParameterType 主入口 ≡ 子入口 ≡ 上游同一引用，且即 IPluginCliParameter['type'] 的字段类型（可赋值臂）", () => {
    expectTypeOf<sdkMain.PluginCliParameterType>().toEqualTypeOf<sdkScaffold.PluginCliParameterType>();
    expectTypeOf<sdkScaffold.PluginCliParameterType>().toEqualTypeOf<upstreamScaffold.PluginCliParameterType>();
    expectTypeOf<
      sdkMain.IPluginCliParameter['type']
    >().toEqualTypeOf<sdkMain.PluginCliParameterType>();
    const typeField: sdkMain.PluginCliParameterType = 'stringList';
    expect(typeField).toBe('stringList');
  });
});

describe('主入口消费形状：含 cli 的 IPluginManifest 可逐名装配', () => {
  it('九型经主入口命名并完整装配，链路任一环断可达即编译红', () => {
    const manifest: sdkMain.IPluginManifest = {
      id: 'chips.official.demo',
      version: '0.1.0',
      type: 'app',
      name: '演示应用',
      runtime: { targets: ['host'] },
      permissions: ['command:register'],
      cli: {
        commands: [
          {
            commandPath: 'demo:export',
            title: '导出文档',
            target: {
              type: 'app',
              pluginId: 'chips.official.demo',
              surface: { open: true, reuse: 'always' },
            },
            arguments: [{ name: 'document', type: 'string', required: true, position: 0 }],
            options: [
              {
                name: 'output',
                short: 'o',
                type: 'path',
                path: { kind: 'file', role: 'output', create: true, overwrite: 'fail' },
              },
            ],
            output: { mode: 'json', json: 'required' },
            job: { wait: true, cancelOnInterrupt: false },
            conflict: { priority: 5, namespace: 'demo' },
          },
        ],
      },
    };
    expect(manifest.cli?.commands).toHaveLength(1);
    expect(manifest.cli?.commands[0]?.target.surface?.reuse).toBe('always');
  });
});

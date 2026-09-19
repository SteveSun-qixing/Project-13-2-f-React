/**
 * 帮助渲染（[CLI 完整参考] §3.1.1、§5.1、§5.2）：`chips help` 的三段内容来源
 * （固定命令树用法行、插件命令声明、参数与选项的模型标签）与冲突/未知命令的失败形态。
 */

import { describe, expect, it } from 'vitest';

import type { IParameterDeclaration, IParameterSet } from '../src/args/types.js';
import type { ICliCommandView } from '../src/client/types.js';
import { renderParameterHelp, renderPluginHelp } from '../src/commands/help.js';
import { FakeCliClient, runUser } from './support/harness.js';

const ARGUMENT_PATH: IParameterDeclaration = {
  name: '路径',
  type: 'path',
  position: 0,
  required: true,
  mapsTo: 'path',
};

const ARGUMENT_CHAPTER: IParameterDeclaration = {
  name: '章节',
  type: 'integer',
  position: 1,
  default: 1,
};

const ARGUMENT_FORMAT: IParameterDeclaration = {
  name: '格式',
  type: 'enum',
  position: 2,
  choices: ['lines', 'json-array'],
  multiple: true,
};

const ARGUMENT_NOTE: IParameterDeclaration = {
  name: '备注',
  type: 'text',
};

const OPTION_OUTPUT: IParameterDeclaration = {
  name: 'output',
  short: 'o',
  type: 'path',
  path: { kind: 'file', role: 'output', overwrite: 'rename' },
};

const OPTION_FORCE: IParameterDeclaration = {
  name: 'force',
  short: 'f',
  type: 'boolean',
};

const OPTION_TAGS: IParameterDeclaration = {
  name: '标签',
  type: 'stringList',
  default: [],
  multiple: true,
};

function commandView(
  overrides: Partial<ICliCommandView['declaration']> & { pluginId?: string } = {}
): ICliCommandView {
  const { pluginId = 'chips.official.office', ...declaration } = overrides;
  return {
    entryId: 'chips.official.office.cli.office.open',
    commandPath: ['office', 'open'],
    commandId: 'office:open',
    pluginId,
    enabled: true,
    conflicts: [],
    declaration: {
      commandPath: ['office', 'open'],
      commandId: 'office:open',
      title: '打开办公文档',
      target: { type: 'app', pluginId },
      ...declaration,
    },
  };
}

describe('renderParameterHelp（§5.2 参数标签）', () => {
  it('无参数集合与空参数集合都不产出内容', () => {
    expect(renderParameterHelp(undefined)).toEqual([]);
    expect(renderParameterHelp({})).toEqual([]);
    const onlyArguments: IParameterSet = { arguments: [ARGUMENT_NOTE] };
    expect(renderParameterHelp(onlyArguments)).toEqual(['参数:', '  <备注> （文本 ）']);
  });

  it('位置参数与选项分别成段，短名、枚举候选、默认值、必填、可重复与输出冲突策略逐一落地', () => {
    const lines = renderParameterHelp({
      arguments: [ARGUMENT_PATH, ARGUMENT_CHAPTER, ARGUMENT_FORMAT],
      options: [OPTION_OUTPUT, OPTION_FORCE, OPTION_TAGS],
    });
    expect(lines).toEqual([
      '参数:',
      '  <路径> （路径 ） 必填',
      '  <章节> （整数 ） 默认 1',
      '  <格式> （枚举 ：lines | json-array ） 可重复',
      '选项:',
      '  -o, --output （路径 ） 输出冲突：rename',
      '  -f, --force （布尔 ）',
      '  --标签 （字符串列表 ） 默认 [] 可重复',
    ]);
  });

  it('输入角色路径不产出输出冲突策略，未声明 default 不产出默认值', () => {
    const inputOnly: IParameterDeclaration = {
      name: 'out',
      type: 'path',
      path: { kind: 'file', role: 'input' },
    };
    expect(renderParameterHelp({ options: [inputOnly] })).toEqual(['选项:', '  --out （路径 ）']);
    const outputWithoutPolicy: IParameterDeclaration = {
      name: 'out',
      type: 'path',
      path: { kind: 'file', role: 'output' },
    };
    expect(renderParameterHelp({ options: [outputWithoutPolicy] })).toEqual([
      '选项:',
      '  --out （路径 ）',
    ]);
  });
});

describe('renderPluginHelp（§3.1.1、§5.1）', () => {
  it('完整声明：命令路径、标题、描述、插件身份、参数与示例按序渲染', () => {
    const lines = renderPluginHelp(
      commandView({
        description: '在默认应用中打开文档，可选定位到章节。',
        arguments: [ARGUMENT_PATH, ARGUMENT_CHAPTER],
        options: [OPTION_FORCE],
        examples: ['chips office open ~/a.doc', 'chips office open ~/a.doc --chapter 3'],
      })
    );
    expect(lines).toEqual([
      '命令: office open',
      '说明: 打开办公文档',
      '在默认应用中打开文档，可选定位到章节。',
      '插件: chips.official.office',
      '参数:',
      '  <路径> （路径 ） 必填',
      '  <章节> （整数 ） 默认 1',
      '选项:',
      '  -f, --force （布尔 ）',
      '示例:',
      '  chips office open ~/a.doc',
      '  chips office open ~/a.doc --chapter 3',
    ]);
  });

  it('最小声明只产出三段身份行；空示例数组不产出示例段', () => {
    expect(renderPluginHelp(commandView())).toEqual([
      '命令: office open',
      '说明: 打开办公文档',
      '插件: chips.official.office',
    ]);
    expect(renderPluginHelp(commandView({ examples: [] }))).toEqual([
      '命令: office open',
      '说明: 打开办公文档',
      '插件: chips.official.office',
    ]);
  });
});

describe('chips help 命令（§3.1.1）', () => {
  it('插件命令帮助经 cli.command.resolve 取声明并输出可读段落', async () => {
    const client = new FakeCliClient();
    client.resolveResult = {
      command: commandView({
        arguments: [ARGUMENT_PATH],
        options: [OPTION_OUTPUT],
        examples: ['chips office open ~/a.doc'],
      }),
    };
    const outcome = await runUser(['help', 'office', 'open'], { client });
    expect(outcome.exitCode).toBe(0);
    expect(outcome.stdout).toContain('命令: office open');
    expect(outcome.stdout).toContain('插件: chips.official.office');
    expect(outcome.stdout).toContain('-o, --output （路径 ） 输出冲突：rename');
    expect(client.calls).toContain('cliCommand.resolve:{"commandPath":["office","open"]}');
  });

  it('插件命令帮助：大小写不敏感的命令路径匹配', async () => {
    const client = new FakeCliClient();
    client.resolveResult = { command: commandView() };
    const outcome = await runUser(['help', 'Office', 'OPEN'], { client });
    expect(outcome.exitCode).toBe(0);
    expect(outcome.stdout).toContain('命令: office open');
  });

  it('带连字符的 token 不参与命令路径拼接', async () => {
    const client = new FakeCliClient();
    client.resolveResult = { command: commandView() };
    const outcome = await runUser(['--json', 'help', 'office', 'open'], { client });
    expect(outcome.exitCode).toBe(0);
    expect((outcome.json() as { command: string }).command).toBe('office open');
  });

  it('内建命令帮助输出用法、说明与子命令段', async () => {
    const outcome = await runUser(['help', 'plugin'], { client: new FakeCliClient() });
    expect(outcome.exitCode).toBe(0);
    expect(outcome.stdout).toContain(
      '用法: chips plugin <create|pack|validate|install|uninstall|list|info|enable|disable>'
    );
    expect(outcome.stdout).toContain(
      '子命令: create | pack | validate | install | uninstall | list | info | enable | disable'
    );
    expect(outcome.stdout).toContain('说明: 插件安装、启停与打包校验');
    // 组命令没有参数声明：只输出用法、说明与子命令三行。
    expect(outcome.stdout.trim().split('\n')).toHaveLength(3);
  });

  it('无参数子命令的内建命令只输出用法与说明两段', async () => {
    const outcome = await runUser(['help', 'start'], { client: new FakeCliClient() });
    expect(outcome.exitCode).toBe(0);
    const lines = outcome.stdout.trim().split('\n');
    expect(lines).toEqual([
      expect.stringMatching(/^用法: chips start/),
      expect.stringMatching(/^说明: /),
    ]);
  });

  it('路径冲突返回 CLI_COMMAND_CONFLICT（退出码 3）并带上冲突组', async () => {
    const client = new FakeCliClient();
    client.resolveResult = {
      conflicts: [
        {
          entryId: 'a.cli.office.open',
          commandPath: ['office', 'open'],
          pluginId: 'chips.a',
          priority: 10,
        },
        {
          entryId: 'b.cli.office.open',
          commandPath: ['office', 'open'],
          pluginId: 'chips.b',
          priority: 10,
        },
      ],
    };
    const outcome = await runUser(['help', 'office', 'open'], { client });
    expect(outcome.exitCode).toBe(3);
    const error = outcome.json() as { code: string; details?: { conflicts?: unknown[] } };
    expect(error.code).toBe('CLI_COMMAND_CONFLICT');
    expect(error.details?.conflicts).toHaveLength(2);
  });

  it('解析结果为空且无冲突时返回 CLI_COMMAND_NOT_FOUND（退出码 3）', async () => {
    const client = new FakeCliClient();
    client.resolveResult = {};
    const outcome = await runUser(['help', 'office', 'open'], { client });
    expect(outcome.exitCode).toBe(3);
    const error = outcome.json() as { code: string; details?: { commandPath?: string[] } };
    expect(error.code).toBe('CLI_COMMAND_NOT_FOUND');
    expect(error.details?.commandPath).toEqual(['office', 'open']);
  });

  it('索引不可用时帮助仍输出固定命令树并标注插件命令段不可用', async () => {
    const fake = new FakeCliClient();
    const client = {
      ...fake,
      cliCommand: {
        ...fake.cliCommand,
        list: () => Promise.reject(new Error('索引不可用')),
      },
    };
    const outcome = await runUser(['help'], { client });
    expect(outcome.exitCode).toBe(0);
    expect(outcome.stdout).toContain('插件命令：');
    expect(outcome.stdout).toContain('（命令索引不可用）');
    expect(outcome.stdout).toContain('config list');
  });
});

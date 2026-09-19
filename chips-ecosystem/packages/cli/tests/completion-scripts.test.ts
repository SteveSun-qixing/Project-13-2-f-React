/**
 * Shell 补全脚本与补全候选（[CLI 完整参考] §3.9、§4.5）：脚本每次补都回调
 * `chips __complete`（开发侧为 `chips dev __complete`），候选由固定命令树 + 工作区索引合成。
 */

import { describe, expect, it } from 'vitest';

import { COMPLETION_SHELLS, renderCompletionScript } from '../src/completion/scripts.js';
import { fixedPathsForEntry } from '../src/commands/completion.js';
import { FakeCliClient, runDev, runUser } from './support/harness.js';

const PLUGIN_COMMAND = {
  entryId: 'chips.official.office.cli.office.open',
  commandPath: ['office', 'open'],
  pluginId: 'chips.official.office',
  enabled: true,
  declaration: {
    commandPath: ['office', 'open'],
    commandId: 'office:open',
    title: '打开办公文档',
    target: { type: 'app' as const, pluginId: 'chips.official.office' },
  },
  conflicts: [],
};

describe('renderCompletionScript（§3.9）', () => {
  it('三种 shell 都注册到 chips 命令并回调 __complete 私有入口', () => {
    expect([...COMPLETION_SHELLS]).toEqual(['bash', 'zsh', 'fish']);
    for (const shell of COMPLETION_SHELLS) {
      const script = renderCompletionScript(shell, 'user');
      expect(script.endsWith('\n')).toBe(true);
      expect(script.split('\n')[0]).toBe(`# 薯片生态 chips 补全脚本（${shell}）`);
      expect(script).toContain('__complete');
      expect(script).toContain('chips');
      expect(script).not.toContain('undefined');
    }
  });

  it('bash 与 zsh 以当前入口前缀调用 __complete，注册行不受入口影响', () => {
    expect(renderCompletionScript('bash', 'user')).toContain(
      'candidates=$(chips __complete "${COMP_WORDS[@]:1:COMP_CWORD}" 2>/dev/null)',
    );
    expect(renderCompletionScript('bash', 'dev')).toContain(
      'candidates=$(chips dev __complete "${COMP_WORDS[@]:1:COMP_CWORD}" 2>/dev/null)',
    );
    expect(renderCompletionScript('zsh', 'dev')).toContain(
      'candidates=("${(@f)$(chips dev __complete "${words[@]:1}" 2>/dev/null)}")',
    );
    for (const entry of ['user', 'dev'] as const) {
      expect(renderCompletionScript('bash', entry)).toContain('complete -F _chips_complete chips');
      expect(renderCompletionScript('zsh', entry)).toContain('compdef _chips_complete chips');
      expect(renderCompletionScript('bash', entry).split('\n')[0]).toBe(
        `# 薯片生态 ${entry === 'dev' ? 'chips dev' : 'chips'} 补全脚本（bash）`,
      );
    }
  });

  it('fish 脚本按入口决定是否带 dev 段，并剥掉命令行首 token', () => {
    const user = renderCompletionScript('fish', 'user');
    expect(user).toContain('chips __complete $tokens 2>/dev/null');
    expect(user).toContain('complete -c chips -f -a "(__chips_complete)"');
    const dev = renderCompletionScript('fish', 'dev');
    expect(dev).toContain('chips dev __complete $tokens 2>/dev/null');
    expect(dev.split('\n')[0]).toBe('# 薯片生态 chips dev 补全脚本（fish）');
    expect(user).not.toBe(dev);
  });

  it('未登记的 shell 返回空脚本（由命令层给出参数错误）', () => {
    expect(renderCompletionScript('powershell', 'user')).toBe('');
    expect(renderCompletionScript('', 'dev')).toBe('');
  });
});

describe('fixedPathsForEntry（§4.4、§4.5）', () => {
  it('用户侧保留 update，不含开发专用命令', () => {
    const paths = fixedPathsForEntry('user').map((path) => path.join(' '));
    expect(paths).toContain('update check');
    expect(paths).toContain('dev run');
    expect(paths).not.toContain('run');
  });

  it('开发侧命令面严格等于 dev 子树：剥离前缀、去重且不含用户侧专属入口', () => {
    const paths = fixedPathsForEntry('dev').map((path) => path.join(' '));
    expect([...paths].sort()).toEqual(
      [
        '__complete',
        'completion',
        'config',
        'config list',
        'config reset',
        'config set',
        'doctor',
        'help',
        'logs',
        'open',
        'plugin',
        'plugin create',
        'plugin disable',
        'plugin enable',
        'plugin info',
        'plugin install',
        'plugin list',
        'plugin pack',
        'plugin uninstall',
        'plugin validate',
        'run',
        'service',
        'service invoke',
        'start',
        'status',
        'stop',
      ].sort(),
    );
    // `update` 是用户侧平台自更新入口（§1.5），开发侧不存在。
    expect(paths).not.toContain('update');
    expect(paths).not.toContain('update check');
    expect(paths).not.toContain('dev');
    expect(new Set(paths).size).toBe(paths.length);
  });
});

describe('__complete 候选合成（§3.9）', () => {
  it('首段给出排序后的固定命令候选，并纳入工作区插件命令', async () => {
    const client = new FakeCliClient();
    client.commandsIndex = [PLUGIN_COMMAND];
    const outcome = await runUser(['__complete'], { client });
    expect(outcome.exitCode).toBe(0);
    const candidates = outcome.stdout.trim().split('\n');
    expect(candidates).toEqual(expect.arrayContaining(['__complete', 'config', 'plugin', 'update', 'office']));
    // 只补当前段：不出现多级路径。
    expect(candidates.every((candidate) => !candidate.includes(' '))).toBe(true);
    expect(candidates).toEqual([...candidates].sort((left, right) => left.localeCompare(right, 'en')));
  });

  it('已输入段定位到子命令层并按前缀过滤（大小写不敏感）', async () => {
    const outcome = await runUser(['__complete', 'plugin', 'IN'], { client: new FakeCliClient() });
    expect(outcome.stdout.trim().split('\n')).toEqual(['info', 'install']);
  });

  it('叶子命令之后没有候选：已到底的路径不再扩展', async () => {
    const outcome = await runUser(['__complete', 'start', 'x'], { client: new FakeCliClient() });
    expect(outcome.exitCode).toBe(0);
    expect(outcome.stdout.trim()).toBe('');
  });

  it('与已输入段不匹配时返回空集', async () => {
    const outcome = await runUser(['__complete', 'plugin', 'nope', 'a'], { client: new FakeCliClient() });
    expect(outcome.stdout.trim()).toBe('');
  });

  it('开发入口下的候选集与用户入口不同', async () => {
    const dev = await runDev(['__complete'], { client: new FakeCliClient() });
    const devCandidates = dev.stdout.trim().split('\n');
    expect(devCandidates).toContain('run');
    expect(devCandidates).toContain('service');
    expect(devCandidates).not.toContain('update');
  });

  it('插件命令索引参与补全：demo 前缀命中插件命令段', async () => {
    const client = new FakeCliClient();
    client.commandsIndex = [PLUGIN_COMMAND];
    const outcome = await runUser(['__complete', 'offi'], { client });
    expect(outcome.stdout.trim()).toBe('office');
  });
});

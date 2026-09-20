/**
 * 命令未找到定性（工单033 缺陷②，《07-CLI完整参考》§2.3、§3.1.1）：
 * 保留固定根（含历史保留名 `host`）与 `help <未注册>`、任意未知命令在无承载
 * 进程上也必须先行回 `CLI_COMMAND_NOT_FOUND`（退出码 3），不得退化为
 * `CLI_TARGET_UNAVAILABLE`（6）；真「目标不可用」语义（匹配成功后的执行链路
 * 触达承载失败）保持 6 不被吞。
 */

import { describe, expect, it } from 'vitest';

import { cliError } from '../src/errors.js';
import type { ICliClient, ICliCommandView } from '../src/client/types.js';
import { FakeCliClient } from './support/fake-client.js';
import { runUser } from './support/harness.js';

const OFFICE_OPEN: ICliCommandView = {
  entryId: 'chips.official.office.cli.office.open',
  commandPath: ['office', 'open'],
  commandId: 'office:open',
  pluginId: 'chips.official.office',
  enabled: true,
  declaration: {
    commandPath: ['office', 'open'],
    commandId: 'office:open',
    title: '打开办公文档',
    target: { type: 'app', pluginId: 'chips.official.office' },
  },
  conflicts: [],
};

/** 无承载替身：`cli.command.*` 路由全部以 `CLI_TARGET_UNAVAILABLE` 拒绝，并记录触达次数。 */
function noCarrierClient(): { client: ICliClient; touches: () => number } {
  const base = new FakeCliClient();
  let touched = 0;
  const client: ICliClient = {
    ...base,
    cliCommand: {
      list: () => {
        touched += 1;
        return Promise.reject(
          cliError('CLI_TARGET_UNAVAILABLE', '缺少承载适配器：cli.command.list', {
            route: 'cli.command.list',
          })
        );
      },
      get: (query) => {
        touched += 1;
        void query;
        return Promise.resolve(undefined);
      },
      resolve: (query) => {
        touched += 1;
        void query;
        return Promise.reject(
          cliError('CLI_TARGET_UNAVAILABLE', '缺少承载适配器：cli.command.resolve', {
            route: 'cli.command.resolve',
          })
        );
      },
    },
  };
  return { client, touches: () => touched };
}

describe('无承载进程的命令未找到定性（§2.3、§3.1.1）', () => {
  it('chips host * 保留固定根先行定性为 CLI_COMMAND_NOT_FOUND / 3，不触达插件索引', async () => {
    const { client, touches } = noCarrierClient();
    const outcome = await runUser(['host', 'list'], { client });
    expect(outcome.exitCode).toBe(3);
    expect((outcome.json() as { code: string }).code).toBe('CLI_COMMAND_NOT_FOUND');
    expect(touches()).toBe(0);
  });

  it('任意未知命令在无承载环境回 CLI_COMMAND_NOT_FOUND / 3（发现不可用即无匹配）', async () => {
    const outcome = await runUser(['frobnicate', 'xyz'], { client: noCarrierClient().client });
    expect(outcome.exitCode).toBe(3);
    expect((outcome.json() as { code: string }).code).toBe('CLI_COMMAND_NOT_FOUND');
  });

  it('chips help <未注册> 在无承载环境回 CLI_COMMAND_NOT_FOUND / 3', async () => {
    const outcome = await runUser(['help', 'nosuchcmd'], { client: noCarrierClient().client });
    expect(outcome.exitCode).toBe(3);
    expect((outcome.json() as { code: string }).code).toBe('CLI_COMMAND_NOT_FOUND');
  });

  it('有承载环境保持原时序：未知命令经索引匹配失败同样回 3', async () => {
    const outcome = await runUser(['frobnicate', 'xyz'], { client: new FakeCliClient() });
    expect(outcome.exitCode).toBe(3);
    expect((outcome.json() as { code: string }).code).toBe('CLI_COMMAND_NOT_FOUND');
  });

  it('真「目标不可用」不被吞：插件命令匹配成功后的执行链路失败仍回 CLI_TARGET_UNAVAILABLE / 6', async () => {
    const client = new FakeCliClient();
    client.commandsIndex = [OFFICE_OPEN];
    client.invokeError = cliError('CLI_TARGET_UNAVAILABLE', '目标应用不可用：承载环境缺失', {
      pluginId: 'chips.official.office',
    });
    const outcome = await runUser(['office', 'open'], { client });
    expect(outcome.exitCode).toBe(6);
    expect((outcome.json() as { code: string }).code).toBe('CLI_TARGET_UNAVAILABLE');
  });

  it('大小写不敏感：HOST 同样命中保留根定性', async () => {
    const outcome = await runUser(['HOST', 'anything'], { client: noCarrierClient().client });
    expect(outcome.exitCode).toBe(3);
    expect((outcome.json() as { code: string }).code).toBe('CLI_COMMAND_NOT_FOUND');
  });
});

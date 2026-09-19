import { describe, expect, it } from 'vitest';

import { FakeCliClient } from './support/fake-client.js';
import { MemoryFileSystem } from './support/memory-file-system.js';
import { runDev, runUser } from './support/harness.js';
import { cliError } from '../src/errors.js';

describe('插件命令（§3.5）', () => {
  it('plugin create 校验参数并输出生成摘要', async () => {
    const client = new FakeCliClient();
    const outcome = await runUser(
      ['plugin', 'create', '--role', 'app', '--id', 'chips.example.hello-world', '--name', '你好世界', '--dir', '/work/hello-world'],
      { client },
    );
    expect(outcome.exitCode).toBe(0);
    expect(client.calls).toContain('artifacts.create:app:chips.example.hello-world');
    expect(outcome.stdout).toContain('已创建 app 角色插件');
    expect(outcome.stdout).toContain('下一步：pnpm install');

    const missing = await runUser(['plugin', 'create', '--role', 'app', '--id', 'chips.example.a'], { client });
    expect(missing.exitCode).toBe(2);
    expect((missing.json() as { code: string }).code).toBe('CLI_ARGUMENT_INVALID');

    const badId = await runUser(
      ['plugin', 'create', '--role', 'app', '--id', 'Bad_Id', '--name', '名称'],
      { client },
    );
    expect(badId.exitCode).toBe(2);

    const badRole = await runUser(['plugin', 'create', '--role', 'module', '--id', 'chips.example.a', '--name', '名'], {
      client,
    });
    expect(badRole.exitCode).toBe(2);
  });

  it('plugin pack 默认输出目录与 --sign 校验', async () => {
    const client = new FakeCliClient();
    const outcome = await runUser(['plugin', 'pack', '--dir', '/work/hello', '--out', '/work/hello/dist'], { client });
    expect(outcome.exitCode).toBe(0);
    expect(client.calls).toContain('artifacts.pack:/work/hello:false');
    expect(outcome.stdout).toContain('已生成 /tmp/hello/dist/hello-0.1.0.cpk');
    expect(outcome.stdout).toContain('ZIP Store');

    const missingKey = await runUser(['plugin', 'pack', '--sign'], { client });
    expect(missingKey.exitCode).toBe(2);

    const missingKeyFile = await runUser(['plugin', 'pack', '--sign', '--key-id', 'k1'], { client });
    expect(missingKeyFile.exitCode).toBe(2);
    expect((missingKeyFile.json() as { details: { hint: string } }).details.hint).toContain('CHIPS_SIGNING_KEY_FILE');

    const signed = await runUser(['plugin', 'pack', '--sign', '--key-id', 'k1'], {
      client,
      env: { CHIPS_SIGNING_KEY_FILE: '/run/secrets/key.pem' },
    });
    expect(signed.exitCode).toBe(0);
    expect(client.calls).toContain('artifacts.pack:/work:true');
  });

  it('plugin validate 输出五阶段并透传来源', async () => {
    const userClient = new FakeCliClient();
    const userOutcome = await runUser(['plugin', 'validate', 'dist/hello.cpk'], {
      client: userClient,
      fileSystem: new MemoryFileSystem(),
    });
    expect(userOutcome.exitCode).toBe(0);
    expect(userOutcome.stdout).toContain('归档校验: 通过（全部成员 Stored）');
    expect(userOutcome.stdout).toContain('结果: valid');

    const devClient = new FakeCliClient();
    await runDev(['plugin', 'validate', 'dist/hello.cpk'], { client: devClient });
    expect(devClient.calls.some((call) => call.startsWith('artifacts.validate:') && call.endsWith(':development'))).toBe(
      true,
    );
  });

  it('plugin validate 失败时以 CPK_* 错误对象与退出码 1 收口', async () => {
    const client = new FakeCliClient();
    client.validateError = cliError('CPK_LAYOUT_INVALID', '包根出现白名单外条目：src', {
      stage: 'layout',
      file: 'src/index.ts',
    });
    const outcome = await runUser(['plugin', 'validate', 'dist/hello.cpk'], { client });
    expect(outcome.exitCode).toBe(1);
    expect((outcome.json() as { code: string }).code).toBe('CPK_LAYOUT_INVALID');
  });

  it('plugin validate 路径不可读返回退出码 5', async () => {
    const client = new FakeCliClient();
    client.validateError = cliError('CLI_PATH_NOT_FOUND', '路径不存在：/work/missing.cpk', { path: '/work/missing.cpk' });
    const outcome = await runUser(['plugin', 'validate', '/work/missing.cpk'], { client });
    expect(outcome.exitCode).toBe(5);
  });

  it('plugin install：非交互且未传 --yes 返回 CLI_ARGUMENT_INVALID；开发侧来源为 development', async () => {
    const client = new FakeCliClient();
    const blocked = await runUser(['plugin', 'install', 'dist/hello.cpk'], { client });
    expect(blocked.exitCode).toBe(2);
    expect((blocked.json() as { details: { hint: string } }).details.hint).toContain('未签名发布者');

    const installed = await runUser(['plugin', 'install', 'dist/hello.cpk', '--yes'], { client });
    expect(installed.exitCode).toBe(0);
    expect(client.calls).toContain('platform.pluginInstall:dist/hello.cpk:user:true');
    expect(installed.json()).toEqual({
      pluginId: 'chips.example.hello',
      version: '0.1.0',
      type: 'app',
      state: 'installed',
    });

    const devClient = new FakeCliClient();
    await runDev(['plugin', 'install', '/work/hello'], { client: devClient });
    expect(devClient.calls).toContain('platform.pluginInstall:/work/hello:development:false');
  });

  it('plugin list 支持 --role / --source，开发侧可见 development', async () => {
    const client = new FakeCliClient();
    client.pluginRecords = [
      { id: 'chips.a', version: '1.0.0', role: 'boxlayout', name: '网格', source: 'user', state: 'active', enabled: true },
    ];
    const outcome = await runUser(['plugin', 'list', '--role', 'boxlayout', '--source', 'user'], { client });
    expect(outcome.exitCode).toBe(0);
    expect(client.calls).toContain('platform.pluginList:boxlayout:user');
    expect(outcome.stdout).toContain('chips.a@1.0.0');

    const devClient = new FakeCliClient();
    await runDev(['plugin', 'list', '--source', 'development'], { client: devClient });
    expect(devClient.calls).toContain('platform.pluginList:all:development');

    const invalid = await runUser(['plugin', 'list', '--source', 'development'], { client });
    expect(invalid.exitCode).toBe(2);
  });

  it('plugin info 输出详情；enable / disable / uninstall 输出状态', async () => {
    const client = new FakeCliClient();
    const info = await runUser(['plugin', 'info', 'chips.example.hello'], { client });
    expect(info.exitCode).toBe(0);
    expect((info.json() as { installPath: string }).installPath).toBe('/tmp/plugins/hello');

    const enable = await runUser(['plugin', 'enable', 'chips.example.hello'], { client });
    expect((enable.json() as { state: string }).state).toBe('active');

    const disable = await runUser(['plugin', 'disable', 'chips.example.hello'], { client });
    expect((disable.json() as { state: string }).state).toBe('disabled');

    const uninstall = await runUser(['plugin', 'uninstall', 'chips.example.hello'], { client });
    expect(uninstall.json()).toEqual({ ok: true });
  });

  it('plugin 无子命令返回 CLI_COMMAND_NOT_FOUND（退出码 3）', async () => {
    const outcome = await runUser(['plugin'], { client: new FakeCliClient() });
    expect(outcome.exitCode).toBe(3);
    expect((outcome.json() as { details: { subcommands: string[] } }).details.subcommands).toContain('install');
  });
});

describe('开发侧命令（§4.2、§4.3、§4.4）', () => {
  it('dev run 校验 manifest 角色与存在性', async () => {
    const fileSystem = new MemoryFileSystem();
    fileSystem.writeText(
      '/work/hello/manifest.yaml',
      'id: chips.example.hello\nversion: 0.1.0\ntype: app\nname: 你好\nruntime:\n  targets: [host]\nui:\n  surface: window\n',
    );
    const client = new FakeCliClient();
    const outcome = await runDev(['run', '--dir', '/work/hello', '--workspace', '/tmp/ws'], { client, fileSystem });
    expect(outcome.exitCode).toBe(0);
    expect(client.devRunCalls).toEqual([{ dir: '/work/hello', workspace: '/tmp/ws' }]);

    const missing = await runDev(['run', '--dir', '/work/none'], { client, fileSystem });
    expect(missing.exitCode).toBe(5);

    fileSystem.writeText('/work/svc/manifest.yaml', 'id: chips.example.svc\nversion: 0.1.0\ntype: service\nname: 服务\nruntime:\n  targets: [host]\n');
    const wrongRole = await runDev(['run', '--dir', '/work/svc'], { client, fileSystem });
    expect(wrongRole.exitCode).toBe(2);
    expect((wrongRole.json() as { details: { role: string } }).details.role).toBe('service');
  });

  it('dev service invoke 互斥参数、默认入参与输出形状', async () => {
    const client = new FakeCliClient();
    const outcome = await runDev(
      ['service', 'invoke', '--capability', 'translate:run', '--input', '{"text":"Hello chips"}', '--workspace', '/tmp/ws'],
      { client },
    );
    expect(outcome.exitCode).toBe(0);
    expect(client.calls).toContain('capabilities.invoke:translate:run');
    expect(outcome.json()).toEqual({
      ok: true,
      capability: 'translate:run',
      owner: undefined,
      output: { text: '你好' },
    });

    const conflict = await runDev(
      ['service', 'invoke', '--capability', 'translate:run', '--input', '{}', '--input-file', '/work/in.json'],
      { client },
    );
    expect(conflict.exitCode).toBe(2);

    const missingCapability = await runDev(['service', 'invoke'], { client });
    expect(missingCapability.exitCode).toBe(2);
  });

  it('dev service 无子命令返回退出码 3', async () => {
    const outcome = await runDev(['service'], { client: new FakeCliClient() });
    expect(outcome.exitCode).toBe(3);
  });

  it('开发工作区缺省路径解析：--workspace 优先，其次 CHIPS_WORKSPACE', async () => {
    const client = new FakeCliClient();
    await runDev(['status', '--workspace', '/tmp/explicit'], { client });
    expect(client.calls).toContain('platform.defaultWorkspacePath:dev');

    const client2 = new FakeCliClient();
    await runDev(['status'], { client: client2, env: { CHIPS_WORKSPACE: '/tmp/env-ws' } });
    expect(client2.calls).toContain('platform.defaultWorkspacePath:dev');
  });

  it('用户侧不接受 --workspace（退出码 2）', async () => {
    const outcome = await runUser(['status', '--workspace', '/tmp/ws'], { client: new FakeCliClient() });
    expect(outcome.exitCode).toBe(2);
  });
});

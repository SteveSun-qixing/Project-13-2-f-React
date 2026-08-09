import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { StoreZipService } from '../../packages/zip-service/src';

let workspace: string;
const themeManifestPath = path.resolve(process.cwd(), '../ThemePack/Chips-default/manifest.yaml');

const appManifestContract = {
  runtime: {
    targets: {
      desktop: { supported: true },
      web: { supported: false },
      mobile: { supported: false },
      headless: { supported: false }
    }
  },
  ui: {
    surface: {
      defaultKind: 'window',
      preferredKinds: {
        desktop: 'window',
        web: 'route',
        mobile: 'fullscreen',
        headless: 'window'
      }
    }
  }
};

const moduleRuntimeYamlLines = [
  'runtime:',
  '  targets:',
  '    desktop:',
  '      supported: true',
  '    web:',
  '      supported: false',
  '    mobile:',
  '      supported: false',
  '    headless:',
  '      supported: true'
];

const writeText = async (filePath: string, content: string): Promise<void> => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf-8');
};

const captureRunCli = async (argv: string[]): Promise<{ code: number; output: string }> => {
  const { runCli } = await import('../../src/main/cli/index');
  const chunks: string[] = [];
  const originalWrite = process.stdout.write.bind(process.stdout);
  process.stdout.write = ((chunk: string | Uint8Array) => {
    chunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf-8'));
    return true;
  }) as typeof process.stdout.write;

  try {
    const code = await runCli(argv);
    return { code, output: chunks.join('') };
  } finally {
    process.stdout.write = originalWrite;
  }
};

const captureRunCliWithStderr = async (
  argv: string[],
  env: Record<string, string | undefined> = {}
): Promise<{ code: number; output: string; errorOutput: string }> => {
  const { runCli } = await import('../../src/main/cli/index');
  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];
  const originalStdoutWrite = process.stdout.write.bind(process.stdout);
  const originalStderrWrite = process.stderr.write.bind(process.stderr);
  const previousEnv = new Map(Object.keys(env).map((key) => [key, process.env[key]]));

  process.stdout.write = ((chunk: string | Uint8Array) => {
    stdoutChunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf-8'));
    return true;
  }) as typeof process.stdout.write;
  process.stderr.write = ((chunk: string | Uint8Array) => {
    stderrChunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf-8'));
    return true;
  }) as typeof process.stderr.write;

  for (const [key, value] of Object.entries(env)) {
    if (typeof value === 'undefined') {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    const code = await runCli(argv);
    return {
      code,
      output: stdoutChunks.join(''),
      errorOutput: stderrChunks.join('')
    };
  } finally {
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
    for (const [key, value] of previousEnv.entries()) {
      if (typeof value === 'undefined') {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
};

const createCliModuleFixture = async (
  pluginId: string,
  commandPath: string,
  capability: string
): Promise<string> => {
  const pluginDir = path.join(workspace, pluginId);
  await writeText(path.join(pluginDir, 'contracts/echo.input.schema.json'), '{"type":"object"}');
  await writeText(path.join(pluginDir, 'contracts/echo.output.schema.json'), '{"type":"object"}');
  await writeText(
    path.join(pluginDir, 'dist/index.cjs'),
    [
      'exports.providers = [{',
      `  capability: ${JSON.stringify(capability)},`,
      '  methods: {',
      '    echo(_ctx, input) {',
      `      return { pluginId: ${JSON.stringify(pluginId)}, input };`,
      '    }',
      '  }',
      '}];',
      ''
    ].join('\n'),
  );
  await writeText(
    path.join(pluginDir, 'manifest.yaml'),
    [
      `id: ${pluginId}`,
      `name: ${pluginId}`,
      'version: "1.0.0"',
      'type: module',
      'entry: dist/index.cjs',
      'permissions: []',
      ...moduleRuntimeYamlLines,
      'module:',
      '  apiVersion: 1',
      '  runtime: worker',
      '  activation: onDemand',
      '  provides:',
      `    - capability: ${capability}`,
      '      version: "1.0.0"',
      '      methods:',
      '        - name: echo',
      '          mode: sync',
      '          inputSchema: contracts/echo.input.schema.json',
      '          outputSchema: contracts/echo.output.schema.json',
      '  consumes: []',
      'cli:',
      '  commands:',
      `    - commandPath: ${commandPath}`,
      '      target:',
      '        type: module',
      `        pluginId: ${pluginId}`,
      `        capability: ${capability}`,
      '        method: echo',
      '      titleKey: cli.echo.title',
      '      arguments:',
      '        - name: value',
      '          position: 0',
      '          type: string',
      '          required: true',
      '          mapsTo: value',
      '      options:',
      '        - name: count',
      '          short: c',
      '          type: integer',
      '          default: 1',
      '          mapsTo: meta.count',
      '    - commandPath: demo inspect',
      '      target:',
      '        type: module',
      `        pluginId: ${pluginId}`,
      `        capability: ${capability}`,
      '        method: echo',
      '      titleKey: cli.inspect.title',
      '      arguments:',
      '        - name: input',
      '          position: 0',
      '          type: path',
      '          required: true',
      '          mapsTo: inputPath',
      '          path:',
      '            kind: file',
      '            exists: true'
    ].join('\n'),
  );
  return path.join(pluginDir, 'manifest.yaml');
};

const createCliJobModuleFixture = async (): Promise<string> => {
  const pluginId = 'chips.cli.job.module';
  const pluginDir = path.join(workspace, pluginId);
  await writeText(path.join(pluginDir, 'contracts/run.input.schema.json'), '{"type":"object"}');
  await writeText(path.join(pluginDir, 'contracts/run.output.schema.json'), '{"type":"object"}');
  await writeText(
    path.join(pluginDir, 'dist/index.cjs'),
    [
      'exports.providers = [{',
      '  capability: "cli.job.run",',
      '  methods: {',
      '    async run(ctx, input) {',
      '      await ctx.job.reportProgress({ stage: "started", percent: 25 });',
      '      await new Promise((resolve) => setTimeout(resolve, Number(input.delayMs || 20)));',
      '      await ctx.job.reportProgress({ stage: "completed", percent: 100 });',
      '      return { ok: true, input };',
      '    }',
      '  }',
      '}];',
      ''
    ].join('\n'),
  );
  await writeText(
    path.join(pluginDir, 'manifest.yaml'),
    [
      `id: ${pluginId}`,
      'name: CLI Job Module',
      'version: "1.0.0"',
      'type: module',
      'entry: dist/index.cjs',
      'permissions: []',
      ...moduleRuntimeYamlLines,
      'module:',
      '  apiVersion: 1',
      '  runtime: worker',
      '  activation: onDemand',
      '  provides:',
      '    - capability: cli.job.run',
      '      version: "1.0.0"',
      '      methods:',
      '        - name: run',
      '          mode: job',
      '          inputSchema: contracts/run.input.schema.json',
      '          outputSchema: contracts/run.output.schema.json',
      '  consumes: []',
      'cli:',
      '  commands:',
      '    - commandPath: demo job',
      '      target:',
      '        type: module',
      `        pluginId: ${pluginId}`,
      '        capability: cli.job.run',
      '        method: run',
      '      titleKey: cli.job.title',
      '      arguments:',
      '        - name: value',
      '          position: 0',
      '          type: string',
      '          required: true',
      '          mapsTo: value',
      '      options:',
      '        - name: delay-ms',
      '          type: integer',
      '          default: 20',
      '          mapsTo: delayMs',
      '      job:',
      '        wait: true',
      '        cancelOnInterrupt: true'
    ].join('\n'),
  );
  return path.join(pluginDir, 'manifest.yaml');
};

const createCliOutputBatchModuleFixture = async (): Promise<string> => {
  const pluginId = 'chips.cli.output.batch.module';
  const pluginDir = path.join(workspace, pluginId);
  await writeText(path.join(pluginDir, 'contracts/run.input.schema.json'), '{"type":"object"}');
  await writeText(path.join(pluginDir, 'contracts/run.output.schema.json'), '{"type":"object"}');
  await writeText(
    path.join(pluginDir, 'dist/index.cjs'),
    [
      'exports.providers = [{',
      '  capability: "cli.output.batch",',
      '  methods: {',
      '    run(_ctx, input) {',
      '      return { input };',
      '    }',
      '  }',
      '}];',
      ''
    ].join('\n'),
  );
  await writeText(
    path.join(pluginDir, 'manifest.yaml'),
    [
      `id: ${pluginId}`,
      'name: CLI Output Batch Module',
      'version: "1.0.0"',
      'type: module',
      'entry: dist/index.cjs',
      'permissions: []',
      ...moduleRuntimeYamlLines,
      'module:',
      '  apiVersion: 1',
      '  runtime: worker',
      '  activation: onDemand',
      '  provides:',
      '    - capability: cli.output.batch',
      '      version: "1.0.0"',
      '      methods:',
      '        - name: run',
      '          mode: sync',
      '          inputSchema: contracts/run.input.schema.json',
      '          outputSchema: contracts/run.output.schema.json',
      '  consumes: []',
      'cli:',
      '  commands:',
      '    - commandPath: demo output',
      '      target:',
      '        type: module',
      `        pluginId: ${pluginId}`,
      '        capability: cli.output.batch',
      '        method: run',
      '      titleKey: cli.output.title',
      '      arguments:',
      '        - name: value',
      '          position: 0',
      '          type: string',
      '          required: true',
      '          mapsTo: value',
      '      options:',
      '        - name: out',
      '          type: path',
      '          required: true',
      '          mapsTo: outputPath',
      '          path:',
      '            kind: file',
      '            role: output',
      '            create: true',
      '            overwrite: fail',
      '    - commandPath: demo output-rename',
      '      target:',
      '        type: module',
      `        pluginId: ${pluginId}`,
      '        capability: cli.output.batch',
      '        method: run',
      '      titleKey: cli.output.rename.title',
      '      arguments:',
      '        - name: value',
      '          position: 0',
      '          type: string',
      '          required: true',
      '          mapsTo: value',
      '      options:',
      '        - name: out',
      '          type: path',
      '          required: true',
      '          mapsTo: outputPath',
      '          path:',
      '            kind: file',
      '            role: output',
      '            create: true',
      '            overwrite: rename',
      '    - commandPath: demo output-skip',
      '      target:',
      '        type: module',
      `        pluginId: ${pluginId}`,
      '        capability: cli.output.batch',
      '        method: run',
      '      titleKey: cli.output.skip.title',
      '      arguments:',
      '        - name: value',
      '          position: 0',
      '          type: string',
      '          required: true',
      '          mapsTo: value',
      '      options:',
      '        - name: out',
      '          type: path',
      '          required: true',
      '          mapsTo: outputPath',
      '          path:',
      '            kind: file',
      '            role: output',
      '            create: true',
      '            overwrite: skip',
      '    - commandPath: demo human-output',
      '      target:',
      '        type: module',
      `        pluginId: ${pluginId}`,
      '        capability: cli.output.batch',
      '        method: run',
      '      titleKey: cli.output.human.title',
      '      output:',
      '        mode: human',
      '        artifacts:',
      '          - output.input.outputPath',
      '      arguments:',
      '        - name: value',
      '          position: 0',
      '          type: string',
      '          required: true',
      '          mapsTo: value',
      '      options:',
      '        - name: out',
      '          type: path',
      '          required: true',
      '          mapsTo: outputPath',
      '          path:',
      '            kind: file',
      '            role: output',
      '            create: true',
      '            overwrite: overwrite',
      '    - commandPath: demo batch-lines',
      '      target:',
      '        type: module',
      `        pluginId: ${pluginId}`,
      '        capability: cli.output.batch',
      '        method: run',
      '      titleKey: cli.batch.lines.title',
      '      options:',
      '        - name: input-list',
      '          type: textFile',
      '          required: true',
      '          mapsTo: items',
      '          path:',
      '            kind: file',
      '            exists: true',
      '          batch:',
      '            format: lines',
      '            itemType: path',
      '            itemPath:',
      '              kind: file',
      '              exists: true',
      '    - commandPath: demo batch-json',
      '      target:',
      '        type: module',
      `        pluginId: ${pluginId}`,
      '        capability: cli.output.batch',
      '        method: run',
      '      titleKey: cli.batch.json.title',
      '      options:',
      '        - name: items',
      '          type: jsonFile',
      '          required: true',
      '          mapsTo: items',
      '          path:',
      '            kind: file',
      '            exists: true',
      '          batch:',
      '            format: json-array'
    ].join('\n'),
  );
  return path.join(pluginDir, 'manifest.yaml');
};

beforeEach(async () => {
  workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'chips-cli-test-'));
  process.env.CHIPS_HOME = workspace;
});

afterEach(async () => {
  await fs.rm(workspace, { recursive: true, force: true });
  delete process.env.CHIPS_HOME;
});

describe('chips cli', () => {
  it('does not block in non-tty interactive entry', async () => {
    const empty = await captureRunCli([]);
    expect(empty.code).toBe(0);
    expect(empty.output).toContain('Chips TUI requires an interactive terminal');

    const explicit = await captureRunCli(['--interactive']);
    expect(explicit.code).toBe(1);
    expect(explicit.output).toContain('Chips TUI requires an interactive terminal');
  });

  it('exposes direct chips help without host subcommand', async () => {
    const { runCli } = await import('../../src/main/cli/index');

    expect(await runCli(['help'])).toBe(0);
    expect(await runCli(['host', 'help'])).toBe(1);
  }, 15000);

  it('prints shell completion scripts', async () => {
    const bash = await captureRunCli(['completion', 'bash']);
    expect(bash.code).toBe(0);
    expect(bash.output).toContain('complete -F _chips_completion chips');
    expect(bash.output).toContain('chips __complete');

    const zsh = await captureRunCli(['completion', 'zsh']);
    expect(zsh.code).toBe(0);
    expect(zsh.output).toContain('compdef _chips chips');

    const fish = await captureRunCli(['completion', 'fish']);
    expect(fish.code).toBe(0);
    expect(fish.output).toContain('complete -c chips');

    const dev = await captureRunCli(['completion', 'bash', 'chipsdev-r']);
    expect(dev.code).toBe(0);
    expect(dev.output).toContain('complete -F _chipsdev_completion chipsdev-r');
    expect(dev.output).toContain('chipsdev-r __complete');
  });

  it('supports start/status/stop lifecycle', async () => {
    const { runCli } = await import('../../src/main/cli/index');

    expect(await runCli(['start'])).toBe(0);
    expect(await runCli(['status'])).toBe(0);
    expect(await runCli(['stop'])).toBe(0);
  }, 15000);

  it('supports config set/list', async () => {
    const { runCli } = await import('../../src/main/cli/index');

    expect(await runCli(['config', 'set', 'editor.autoSave', 'true'])).toBe(0);
    expect(await runCli(['config', 'list'])).toBe(0);
  });

  it('supports doctor command', async () => {
    const { runCli } = await import('../../src/main/cli/index');
    const code = await runCli(['doctor']);
    expect(code).toBe(0);
  });

  it('supports plugin lifecycle commands', async () => {
    const { runCli } = await import('../../src/main/cli/index');
    const manifestPath = path.join(workspace, 'demo.plugin.json');
    await fs.writeFile(
      manifestPath,
      JSON.stringify({
        id: 'chips.cli.plugin',
        version: '1.0.0',
        type: 'app',
        name: 'CLI Plugin',
        permissions: ['file.read'],
        ...appManifestContract
      })
    );

    expect(await runCli(['plugin', 'install', manifestPath])).toBe(0);
    expect(await runCli(['plugin', 'list'])).toBe(0);
    expect(await runCli(['plugin', 'query'])).toBe(0);
  });

  it('upserts plugins.json when the same plugin is installed again', async () => {
    const { runCli } = await import('../../src/main/cli/index');
    const manifestPath = path.join(workspace, 'replace.plugin.json');
    await fs.writeFile(
      manifestPath,
      JSON.stringify({
        id: 'chips.cli.replaceable',
        version: '1.0.0',
        type: 'app',
        name: 'Replaceable CLI Plugin',
        permissions: ['file.read'],
        ...appManifestContract
      })
    );

    expect(await runCli(['plugin', 'install', manifestPath])).toBe(0);
    expect(await runCli(['plugin', 'install', manifestPath])).toBe(0);

    const pluginsJson = JSON.parse(await fs.readFile(path.join(workspace, 'plugins.json'), 'utf-8'));
    expect(pluginsJson).toHaveLength(1);
    expect(pluginsJson[0]).toMatchObject({
      id: 'chips.cli.replaceable',
      manifestPath: path.resolve(manifestPath)
    });
  });

  it('returns structured error output when plugin install fails', async () => {
    const { runCli } = await import('../../src/main/cli/index');
    const chunks: string[] = [];
    const originalWrite = process.stdout.write.bind(process.stdout);

    process.stdout.write = ((chunk: string | Uint8Array) => {
      chunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf-8'));
      return true;
    }) as typeof process.stdout.write;

    try {
      const code = await runCli(['plugin', 'install', path.join(workspace, 'missing-plugin.cpk')]);
      expect(code).toBe(1);
    } finally {
      process.stdout.write = originalWrite;
    }

    const output = chunks.join('');
    expect(output).toContain('"code": "PLUGIN_SOURCE_NOT_FOUND"');
    expect(output).toContain('Plugin source not found');
    expect(output).not.toContain('UnhandledPromiseRejection');
  });

  it('supports theme management commands', async () => {
    const { runCli } = await import('../../src/main/cli/index');
    expect(await runCli(['plugin', 'install', themeManifestPath])).toBe(0);
    expect(await runCli(['plugin', 'enable', 'theme.theme.chips-official-default-theme'])).toBe(0);

    expect(await runCli(['theme', 'list'])).toBe(0);
    expect(await runCli(['theme', 'current'])).toBe(0);
    expect(await runCli(['theme', 'validate'])).toBe(0);
  });

  it('opens .card file through file association entry', async () => {
    const { runCli } = await import('../../src/main/cli/index');
    expect(await runCli(['plugin', 'install', themeManifestPath])).toBe(0);
    expect(await runCli(['plugin', 'enable', 'theme.theme.chips-official-default-theme'])).toBe(0);
    const cardSourceDir = path.join(workspace, 'demo-card-source');
    await fs.mkdir(path.join(cardSourceDir, '.card'), { recursive: true });
    await fs.writeFile(path.join(cardSourceDir, '.card/metadata.yaml'), 'id: demo.card\nname: Demo Card\n', 'utf-8');
    await fs.writeFile(path.join(cardSourceDir, '.card/structure.yaml'), 'cards: []\n', 'utf-8');
    await fs.writeFile(path.join(cardSourceDir, '.card/cover.html'), '<h1>cover</h1>', 'utf-8');

    const cardFile = path.join(workspace, 'demo.card');
    const zip = new StoreZipService();
    await zip.compress(cardSourceDir, cardFile);

    expect(await runCli(['open', cardFile])).toBe(0);
  });

  it('executes module plugin CLI commands and reports path or conflict errors', async () => {
    const { runCli } = await import('../../src/main/cli/index');
    const firstManifestPath = await createCliModuleFixture(
      'chips.cli.exec.first',
      'demo echo',
      'cli.exec.echo.first'
    );

    expect(await runCli(['plugin', 'install', firstManifestPath])).toBe(0);
    expect(await runCli(['plugin', 'enable', 'chips.cli.exec.first'])).toBe(0);

    const executed = await captureRunCli(['demo', 'echo', 'hello', '--count', '2']);
    expect(executed.code).toBe(0);
    const executedJson = JSON.parse(executed.output);
    expect(executedJson.output).toMatchObject({
      pluginId: 'chips.cli.exec.first',
      input: {
        value: 'hello',
        meta: {
          count: 2
        }
      }
    });

    const missingPath = await captureRunCli(['demo', 'inspect', path.join(workspace, 'missing.txt')]);
    expect(missingPath.code).toBe(5);
    expect(missingPath.output).toContain('"code": "CLI_PATH_NOT_FOUND"');

    const secondManifestPath = await createCliModuleFixture(
      'chips.cli.exec.second',
      'demo echo',
      'cli.exec.echo.second'
    );
    expect(await runCli(['plugin', 'install', secondManifestPath])).toBe(0);
    expect(await runCli(['plugin', 'enable', 'chips.cli.exec.second'])).toBe(0);

    const conflicted = await captureRunCli(['demo', 'echo', 'hello']);
    expect(conflicted.code).toBe(3);
    expect(conflicted.output).toContain('"code": "CLI_COMMAND_CONFLICT"');

    const disambiguated = await captureRunCli(['--plugin', 'chips.cli.exec.first', 'demo', 'echo', 'again']);
    expect(disambiguated.code).toBe(0);
    expect(JSON.parse(disambiguated.output).output).toMatchObject({
      pluginId: 'chips.cli.exec.first',
      input: {
        value: 'again'
      }
    });
  }, 30000);

  it('records CLI operations in the Host log export', async () => {
    const { runCli } = await import('../../src/main/cli/index');
    const manifestPath = await createCliModuleFixture(
      'chips.cli.log.module',
      'demo log',
      'cli.log.echo'
    );

    expect(await runCli(['plugin', 'install', manifestPath])).toBe(0);
    expect(await runCli(['plugin', 'enable', 'chips.cli.log.module'])).toBe(0);

    const executed = await captureRunCli(['demo', 'log', 'hello', '--count', '2']);
    expect(executed.code).toBe(0);

    const status = await captureRunCli(['status']);
    expect(status.code).toBe(0);

    const failed = await captureRunCli(['demo', 'inspect', path.join(workspace, 'missing-for-log.txt')]);
    expect(failed.code).toBe(5);

    const exported = await captureRunCli(['logs']);
    expect(exported.code).toBe(0);
    const entries = JSON.parse(JSON.parse(exported.output).payload) as Array<{
      namespace?: string;
      action?: string;
      result?: string;
      errorCode?: string;
      pluginId?: string;
      metadata?: Record<string, unknown>;
    }>;
    const operations = entries.filter((entry) => entry.namespace === 'cli' && entry.action === 'operation.execute');

    expect(operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          result: 'success',
          pluginId: 'chips.cli.log.module',
          metadata: expect.objectContaining({
            source: 'cli',
            commandLine: 'chips demo log hello --count 2',
            exitCode: 0
          })
        }),
        expect.objectContaining({
          result: 'error',
          errorCode: 'CLI_PATH_NOT_FOUND',
          metadata: expect.objectContaining({
            source: 'cli',
            exitCode: 5
          })
        }),
        expect.objectContaining({
          result: 'success',
          metadata: expect.objectContaining({
            source: 'cli',
            commandRoot: 'status',
            commandLine: 'chips status',
            exitCode: 0
          })
        })
      ])
    );

    const failedPluginOperations = operations.filter((entry) => {
      return entry.result === 'error' && entry.metadata?.exitCode === 5 && entry.errorCode === 'CLI_PATH_NOT_FOUND';
    });
    expect(failedPluginOperations).toHaveLength(1);
    expect(failedPluginOperations[0]?.pluginId).toBe('chips.cli.log.module');
  }, 30000);

  it('completes built-in and enabled plugin CLI command paths dynamically', async () => {
    const { runCli } = await import('../../src/main/cli/index');
    const manifestPath = await createCliModuleFixture(
      'chips.cli.completion.module',
      'demo complete',
      'cli.completion.echo'
    );

    const initial = await captureRunCli(['__complete', '']);
    expect(initial.code).toBe(0);
    expect(initial.output.split('\n')).toContain('completion');
    expect(initial.output.split('\n')).not.toContain('demo');

    const globalOptions = await captureRunCli(['__complete', '--']);
    expect(globalOptions.code).toBe(0);
    expect(globalOptions.output.split('\n')).toEqual(
      expect.arrayContaining(['--interactive', '--json', '--plugin'])
    );

    expect(await runCli(['plugin', 'install', manifestPath])).toBe(0);
    expect(await runCli(['plugin', 'enable', 'chips.cli.completion.module'])).toBe(0);

    const roots = await captureRunCli(['__complete', '']);
    expect(roots.code).toBe(0);
    expect(roots.output.split('\n')).toContain('demo');

    const leaves = await captureRunCli(['__complete', 'demo', '']);
    expect(leaves.code).toBe(0);
    expect(leaves.output.split('\n')).toEqual(expect.arrayContaining(['complete', 'inspect']));

    const options = await captureRunCli(['__complete', 'demo', 'complete', 'value', '--c']);
    expect(options.code).toBe(0);
    expect(options.output.split('\n')).toContain('--count');

    expect(await runCli(['plugin', 'disable', 'chips.cli.completion.module'])).toBe(0);
    const disabled = await captureRunCli(['__complete', '']);
    expect(disabled.code).toBe(0);
    expect(disabled.output.split('\n')).not.toContain('demo');
  }, 30000);

  it('waits for module job CLI commands and reports progress without polluting stdout', async () => {
    const { runCli } = await import('../../src/main/cli/index');
    const manifestPath = await createCliJobModuleFixture();

    expect(await runCli(['plugin', 'install', manifestPath])).toBe(0);
    expect(await runCli(['plugin', 'enable', 'chips.cli.job.module'])).toBe(0);

    const executed = await captureRunCliWithStderr(['demo', 'job', 'hello'], {
      CHIPS_CLI_JOB_PROGRESS: '1'
    });
    expect(executed.code).toBe(0);
    expect(executed.errorOutput).toContain('CLI job');
    expect(executed.errorOutput).toContain('completed 100% [########################]');

    const output = JSON.parse(executed.output);
    expect(output.job).toMatchObject({
      status: 'completed',
      progress: {
        stage: 'completed',
        percent: 100
      }
    });
    expect(output.output).toMatchObject({
      ok: true,
      input: {
        value: 'hello',
        delayMs: 20
      }
    });
  }, 30000);

  it('applies output overwrite policies and batch input formats before invoking module commands', async () => {
    const { runCli } = await import('../../src/main/cli/index');
    const manifestPath = await createCliOutputBatchModuleFixture();

    expect(await runCli(['plugin', 'install', manifestPath])).toBe(0);
    expect(await runCli(['plugin', 'enable', 'chips.cli.output.batch.module'])).toBe(0);

    const existingOutput = path.join(workspace, 'result.json');
    await writeText(existingOutput, '{}');
    const existingFailed = await captureRunCli(['demo', 'output', 'value', '--out', existingOutput]);
    expect(existingFailed.code).toBe(5);
    expect(existingFailed.output).toContain('"code": "CLI_OUTPUT_EXISTS"');

    const renamed = await captureRunCli(['demo', 'output-rename', 'value', '--out', existingOutput]);
    expect(renamed.code).toBe(0);
    const renamedOutput = JSON.parse(renamed.output);
    expect(renamedOutput.output.input.outputPath).toBe(path.join(workspace, 'result-1.json'));

    const overwritten = await captureRunCli(['demo', 'output', 'value', '--out', existingOutput, '--overwrite']);
    expect(overwritten.code).toBe(0);
    expect(JSON.parse(overwritten.output).output.input.outputPath).toBe(existingOutput);

    const skipped = await captureRunCli(['demo', 'output-skip', 'value', '--out', existingOutput]);
    expect(skipped.code).toBe(0);
    const skippedOutput = JSON.parse(skipped.output);
    expect(skippedOutput).toMatchObject({
      ok: true,
      skipped: true,
      output: {
        skipped: [
          {
            parameter: 'out',
            path: existingOutput,
            policy: 'skip',
            reason: 'exists'
          }
        ]
      }
    });

    const humanOutputPath = path.join(workspace, 'human.json');
    const human = await captureRunCli(['demo', 'human-output', 'value', '--out', humanOutputPath]);
    expect(human.code).toBe(0);
    expect(human.output).toContain('完成');
    expect(human.output).toContain('命令: demo human-output');
    expect(human.output).toContain(humanOutputPath);
    expect(() => JSON.parse(human.output)).toThrow();

    const forcedJson = await captureRunCli(['--json', 'demo', 'human-output', 'value', '--out', humanOutputPath]);
    expect(forcedJson.code).toBe(0);
    expect(JSON.parse(forcedJson.output).output.input.outputPath).toBe(humanOutputPath);

    const firstInput = path.join(workspace, 'a.txt');
    const secondInput = path.join(workspace, 'b.txt');
    await writeText(firstInput, 'a');
    await writeText(secondInput, 'b');
    const listFile = path.join(workspace, 'inputs.txt');
    await writeText(listFile, `${firstInput}\n${secondInput}\n\n`);
    const batchLines = await captureRunCli(['demo', 'batch-lines', '--input-list', listFile]);
    expect(batchLines.code).toBe(0);
    expect(JSON.parse(batchLines.output).output.input.items).toEqual([firstInput, secondInput]);

    const jsonItemsFile = path.join(workspace, 'items.json');
    await writeText(jsonItemsFile, JSON.stringify([{ id: 1 }, { id: 2 }]));
    const batchJson = await captureRunCli(['demo', 'batch-json', '--items', jsonItemsFile]);
    expect(batchJson.code).toBe(0);
    expect(JSON.parse(batchJson.output).output.input.items).toEqual([{ id: 1 }, { id: 2 }]);
  }, 30000);

  it('opens app plugin surfaces from plugin CLI commands', async () => {
    const { runCli } = await import('../../src/main/cli/index');
    const appDir = path.join(workspace, 'cli-app-open');
    await writeText(path.join(appDir, 'dist/index.html'), '<!doctype html><title>CLI App</title>');
    await writeText(
      path.join(appDir, 'manifest.yaml'),
      [
        'id: chips.cli.open.app',
        'version: "1.0.0"',
        'type: app',
        'name: CLI Open App',
        'permissions: []',
        'entry: dist/index.html',
        'runtime:',
        '  targets:',
        '    desktop:',
        '      supported: true',
        '    web:',
        '      supported: false',
        '    mobile:',
        '      supported: false',
        '    headless:',
        '      supported: false',
        'ui:',
        '  surface:',
        '    defaultKind: window',
        '    preferredKinds:',
        '      desktop: window',
        '      web: route',
        '      mobile: fullscreen',
        '      headless: window',
        'cli:',
        '  commands:',
        '    - commandPath: demo open',
        '      target:',
        '        type: app',
        '        pluginId: chips.cli.open.app',
        '        surface:',
        '          open: true',
        '          focus: true',
        '      titleKey: cli.open.title',
        '      arguments:',
        '        - name: subject',
        '          position: 0',
        '          type: string',
        '          required: true',
        '          mapsTo: subject'
      ].join('\n'),
    );

    expect(await runCli(['plugin', 'install', path.join(appDir, 'manifest.yaml')])).toBe(0);
    expect(await runCli(['plugin', 'enable', 'chips.cli.open.app'])).toBe(0);

    const opened = await captureRunCli(['demo', 'open', 'notebook']);
    expect(opened.code).toBe(0);
    const openedJson = JSON.parse(opened.output);
    expect(openedJson.target).toMatchObject({
      type: 'app',
      pluginId: 'chips.cli.open.app'
    });
    expect(openedJson.commandContext).toMatchObject({
      source: 'cli',
      payload: {
        subject: 'notebook'
      }
    });
    expect(openedJson.surface?.id).toBeTruthy();
  }, 30000);

});

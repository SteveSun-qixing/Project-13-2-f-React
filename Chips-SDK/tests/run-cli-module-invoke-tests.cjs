/* eslint-disable no-console */
const assert = require('node:assert/strict');
const path = require('node:path');
const childProcess = require('node:child_process');
const fs = require('node:fs/promises');
const os = require('node:os');

const projectRoot = path.resolve(__dirname, '..');
const ecosystemRoot = path.resolve(projectRoot, '..');
const cliPath = path.join(projectRoot, 'cli', 'index.js');

const runCapture = (args, cwd, env = process.env) =>
  new Promise((resolve, reject) => {
    const child = childProcess.spawn('node', [cliPath, ...args], {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(new Error(`chipsdev-r ${args.join(' ')} exited with code ${code}\nstdout:\n${stdout}\nstderr:\n${stderr}`));
    });
  });

const parseLastJsonLine = (stdout) => {
  const lines = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('{') && line.endsWith('}'));

  const last = lines.at(-1);
  if (!last) {
    throw new Error(`Missing JSON output.\n${stdout}`);
  }
  return JSON.parse(last);
};

const createModuleProject = async (targetDir) => {
  await fs.mkdir(path.join(targetDir, 'src'), { recursive: true });
  await fs.mkdir(path.join(targetDir, 'contracts'), { recursive: true });

  await fs.writeFile(
    path.join(targetDir, 'chips.config.mjs'),
    [
      'const config = {',
      '  type: "module",',
      '  entry: "./src/index.ts",',
      '  outDir: "./dist",',
      '  testsDir: "./tests"',
      '};',
      '',
      'export default config;'
    ].join('\n'),
    'utf-8'
  );

  await fs.writeFile(
    path.join(targetDir, 'package.json'),
    JSON.stringify(
      {
        name: 'chips.module.dev.invoke.test',
        version: '0.1.0',
        private: true,
        type: 'commonjs',
        scripts: {
          build: 'chipsdev-r build',
          validate: 'chipsdev-r validate'
        },
        devDependencies: {
          'chips-sdk': '^0.1.0',
          typescript: '^5.8.2',
          '@types/node': '^22.13.10'
        },
        volta: {
          extends: '../../package.json'
        }
      },
      null,
      2
    ),
    'utf-8'
  );

  await fs.writeFile(
    path.join(targetDir, 'manifest.yaml'),
    [
      'id: chips.module.dev.invoke.test',
      'name: Chips Module Dev Invoke Test',
      'version: 0.1.0',
      'type: module',
      'entry: dist/index.mjs',
      'permissions:',
      '  - file.read',
      'runtime:',
      '  targets:',
      '    desktop:',
      '      supported: true',
      '    web:',
      '      supported: false',
      '    mobile:',
      '      supported: false',
      '    headless:',
      '      supported: true',
      'module:',
      '  apiVersion: 1',
      '  runtime: worker',
      '  activation: onDemand',
      '  provides:',
      '    - capability: module.dev.invoke.test',
      '      version: "1.0.0"',
      '      methods:',
      '        - name: run',
      '          mode: sync',
      '          inputSchema: contracts/run.input.schema.json',
      '          outputSchema: contracts/run.output.schema.json',
      '        - name: runAsync',
      '          mode: job',
      '          inputSchema: contracts/run.input.schema.json',
      '          outputSchema: contracts/run.output.schema.json'
    ].join('\n'),
    'utf-8'
  );

  await fs.writeFile(
    path.join(targetDir, 'contracts', 'run.input.schema.json'),
    JSON.stringify(
      {
        type: 'object',
        required: ['value'],
        properties: {
          value: { type: 'string' }
        },
        additionalProperties: false
      },
      null,
      2
    ),
    'utf-8'
  );

  await fs.writeFile(
    path.join(targetDir, 'contracts', 'run.output.schema.json'),
    JSON.stringify(
      {
        type: 'object',
        required: ['echo', 'handledBy'],
        properties: {
          echo: { type: 'string' },
          handledBy: { type: 'string' }
        },
        additionalProperties: false
      },
      null,
      2
    ),
    'utf-8'
  );

  await fs.writeFile(
    path.join(targetDir, 'src', 'index.ts'),
    [
      'const handledBy = "chips.module.dev.invoke.test";',
      '',
      'const buildOutput = (value: string) => ({',
      '  echo: value,',
      '  handledBy,',
      '});',
      '',
      'export default {',
      '  providers: [',
      '    {',
      '      capability: "module.dev.invoke.test",',
      '      methods: {',
      '        async run(_ctx: unknown, input: { value: string }) {',
      '          return buildOutput(input.value);',
      '        },',
      '        async runAsync(ctx: { job?: { reportProgress(payload: Record<string, unknown>): Promise<void> } }, input: { value: string }) {',
      '          await ctx.job?.reportProgress({ stage: "working", percent: 50 });',
      '          return buildOutput(`${input.value}:async`);',
      '        },',
      '      },',
      '    },',
      '  ],',
      '};'
    ].join('\n'),
    'utf-8'
  );
};

const createCustomBuildModuleProject = async (targetDir) => {
  await fs.mkdir(path.join(targetDir, 'contracts'), { recursive: true });
  await fs.mkdir(path.join(targetDir, 'scripts'), { recursive: true });

  await fs.writeFile(
    path.join(targetDir, 'chips.config.mjs'),
    [
      'const config = {',
      '  type: "module",',
      '  entry: "./src/index.ts",',
      '  outDir: "./dist",',
      '  testsDir: "./tests"',
      '};',
      '',
      'export default config;'
    ].join('\n'),
    'utf-8'
  );

  await fs.writeFile(
    path.join(targetDir, 'package.json'),
    JSON.stringify(
      {
        name: 'chips.module.dev.invoke.custom-build-test',
        version: '0.1.0',
        private: true,
        type: 'commonjs',
        scripts: {
          build: 'node ./scripts/build.mjs',
          validate: 'chipsdev-r validate'
        },
        devDependencies: {
          'chips-sdk': '^0.1.0',
          typescript: '^5.8.2',
          '@types/node': '^22.13.10'
        },
        volta: {
          extends: '../../package.json'
        }
      },
      null,
      2
    ),
    'utf-8'
  );

  await fs.writeFile(
    path.join(targetDir, 'manifest.yaml'),
    [
      'id: chips.module.dev.invoke.custom-build-test',
      'name: Chips Module Dev Invoke Custom Build Test',
      'version: 0.1.0',
      'type: module',
      'entry: dist/index.mjs',
      'permissions:',
      '  - file.read',
      'runtime:',
      '  targets:',
      '    desktop:',
      '      supported: true',
      '    web:',
      '      supported: false',
      '    mobile:',
      '      supported: false',
      '    headless:',
      '      supported: true',
      'module:',
      '  apiVersion: 1',
      '  runtime: worker',
      '  activation: onDemand',
      '  provides:',
      '    - capability: module.dev.invoke.custom-build-test',
      '      version: "1.0.0"',
      '      methods:',
      '        - name: run',
      '          mode: sync',
      '          inputSchema: contracts/run.input.schema.json',
      '          outputSchema: contracts/run.output.schema.json'
    ].join('\n'),
    'utf-8'
  );

  await fs.writeFile(
    path.join(targetDir, 'contracts', 'run.input.schema.json'),
    JSON.stringify(
      {
        type: 'object',
        required: ['value'],
        properties: {
          value: { type: 'string' }
        },
        additionalProperties: false
      },
      null,
      2
    ),
    'utf-8'
  );

  await fs.writeFile(
    path.join(targetDir, 'contracts', 'run.output.schema.json'),
    JSON.stringify(
      {
        type: 'object',
        required: ['echo', 'builtBy'],
        properties: {
          echo: { type: 'string' },
          builtBy: { type: 'string' }
        },
        additionalProperties: false
      },
      null,
      2
    ),
    'utf-8'
  );

  await fs.writeFile(
    path.join(targetDir, 'scripts', 'build.mjs'),
    [
      'import fs from "node:fs/promises";',
      'import path from "node:path";',
      '',
      'const projectRoot = process.cwd();',
      'const outDir = path.join(projectRoot, "dist");',
      'await fs.mkdir(outDir, { recursive: true });',
      'await fs.writeFile(',
      '  path.join(outDir, "index.mjs"),',
      '  [',
      '    "const builtBy = \\"custom-build-script\\";",',
      '    "",',
      '    "export default {",',
      '    "  providers: [",',
      '    "    {",',
      '    "      capability: \\"module.dev.invoke.custom-build-test\\",",',
      '    "      methods: {",',
      '    "        async run(_ctx, input) {",',
      '    "          return { echo: input.value, builtBy };",',
      '    "        },",',
      '    "      },",',
      '    "    },",',
      '    "  ],",',
      '    "};",',
      '    "",',
      '  ].join("\\n"),',
      '  "utf-8"',
      ');'
    ].join('\n'),
    'utf-8'
  );
};

const writeMockElectronFiles = async (sandboxRoot) => {
  const fakeElectronExecutable = path.join(sandboxRoot, 'fake-electron.cjs');
  const fakeElectronLoader = path.join(sandboxRoot, 'mock-electron-loader.cjs');

  await fs.writeFile(
    fakeElectronExecutable,
    [
      '#!/usr/bin/env node',
      'const { EventEmitter } = require("node:events");',
      'class MockElectronApp extends EventEmitter {',
      '  async whenReady() { return undefined; }',
      '  quit() { this.emit("before-quit"); }',
      '  requestSingleInstanceLock() { return true; }',
      '}',
      'global.__chipsElectronMock = {',
      '  app: new MockElectronApp(),',
      '  ipcMain: {',
      '    handle() {},',
      '    removeHandler() {},',
      '    on() {},',
      '    off() {},',
      '  },',
      '};',
      'const [, , scriptPath, ...restArgs] = process.argv;',
      'process.argv = [process.argv[0], scriptPath, ...restArgs];',
      'require(scriptPath);'
    ].join('\n'),
    'utf-8'
  );
  await fs.chmod(fakeElectronExecutable, 0o755);

  await fs.writeFile(
    fakeElectronLoader,
    [
      'const Module = require("node:module");',
      'const originalLoad = Module._load;',
      'const fakeExecutable = process.env.CHIPSDEV_TEST_ELECTRON_EXECUTABLE;',
      'Module._load = function patched(request, parent, isMain) {',
      '  if (request === "electron") {',
      '    return fakeExecutable;',
      '  }',
      '  return originalLoad.call(this, request, parent, isMain);',
      '};'
    ].join('\n'),
    'utf-8'
  );

  return {
    fakeElectronExecutable,
    fakeElectronLoader
  };
};

const main = async () => {
  console.log('Running chipsdev-r module invoke integration tests...');

  const sandboxRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'chipsdev-module-invoke-'));
  const moduleProject = path.join(sandboxRoot, 'module-project');
  const customBuildProject = path.join(sandboxRoot, 'custom-build-module-project');
  const workspace = path.join(sandboxRoot, '.chips-host-dev');

  try {
    await createModuleProject(moduleProject);
    await createCustomBuildModuleProject(customBuildProject);
    const { fakeElectronExecutable, fakeElectronLoader } = await writeMockElectronFiles(sandboxRoot);

    await new Promise((resolve, reject) => {
      const child = childProcess.spawn('npm', ['run', 'build'], {
        cwd: path.join(ecosystemRoot, 'Chips-Host'),
        stdio: 'inherit',
        env: process.env
      });
      child.on('error', reject);
      child.on('exit', (code) => {
        if (code === 0) {
          resolve();
          return;
        }
        reject(new Error(`npm run build exited with code ${code}`));
      });
    });

    const env = {
      ...process.env,
      CHIPS_HOME: workspace,
      CHIPS_ECOSYSTEM_ROOT: ecosystemRoot,
      CHIPSDEV_TEST_ELECTRON_EXECUTABLE: fakeElectronExecutable,
      NODE_OPTIONS: [process.env.NODE_OPTIONS, '--require', fakeElectronLoader].filter(Boolean).join(' ')
    };

    await assert.rejects(
      () =>
        runCapture(
          ['module', 'invoke', '--capability', 'module.dev.invoke.test', '--method', 'run', '--unknown'],
          moduleProject,
          env
        ),
      /chipsdev-r module invoke 不支持参数：--unknown/
    );

    const sync = await runCapture(
      ['module', 'invoke', '--capability=module.dev.invoke.test', '--method=run', '--input={"value":"sync"}', '--timeout-ms=60000'],
      moduleProject,
      env
    );
    const syncResult = parseLastJsonLine(sync.stdout);
    assert.equal(syncResult.mode, 'sync');
    assert.equal(syncResult.installedPluginId, 'chips.module.dev.invoke.test');
    assert.deepEqual(syncResult.output, {
      echo: 'sync',
      handledBy: 'chips.module.dev.invoke.test'
    });

    const inputFile = path.join(sandboxRoot, 'invoke-input.json');
    await fs.writeFile(inputFile, JSON.stringify({ value: 'job' }, null, 2), 'utf-8');

    const job = await runCapture(
      ['module', 'invoke', '--capability', 'module.dev.invoke.test', '--method', 'runAsync', '--input-file', inputFile],
      moduleProject,
      env
    );
    const jobResult = parseLastJsonLine(job.stdout);
    assert.equal(jobResult.mode, 'job');
    assert.equal(jobResult.installedPluginId, 'chips.module.dev.invoke.test');
    assert.equal(jobResult.job.status, 'completed');
    assert.deepEqual(jobResult.job.output, {
      echo: 'job:async',
      handledBy: 'chips.module.dev.invoke.test'
    });

    const runtimeRecords = JSON.parse(await fs.readFile(path.join(workspace, 'plugin-runtime.json'), 'utf-8'));
    assert.equal(
      runtimeRecords.some((record) => record.manifest?.id === 'chips.module.dev.invoke.test' && record.enabled === true),
      true
    );

    const customBuild = await runCapture(
      ['module', 'invoke', '--capability', 'module.dev.invoke.custom-build-test', '--method', 'run', '--input', '{"value":"custom"}'],
      customBuildProject,
      env
    );
    const customBuildResult = parseLastJsonLine(customBuild.stdout);
    assert.equal(customBuildResult.mode, 'sync');
    assert.equal(customBuildResult.installedPluginId, 'chips.module.dev.invoke.custom-build-test');
    assert.deepEqual(customBuildResult.output, {
      echo: 'custom',
      builtBy: 'custom-build-script'
    });

    console.log('chipsdev-r module invoke integration tests completed.');
  } finally {
    await fs.rm(sandboxRoot, { recursive: true, force: true });
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

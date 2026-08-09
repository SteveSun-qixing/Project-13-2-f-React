/* eslint-disable no-console */
const assert = require('node:assert/strict');
const path = require('node:path');
const childProcess = require('node:child_process');
const fsp = require('node:fs/promises');
const os = require('node:os');

const projectRoot = path.resolve(__dirname, '..');
const ecosystemRoot = path.resolve(projectRoot, '..');
const cliPath = path.join(projectRoot, 'cli', 'index.js');
const TEST_NPM_OVERRIDES = {
  tldts: '7.0.30',
  'tldts-core': '7.0.30'
};

const run = (command, args, cwd, env = process.env) =>
  new Promise((resolve, reject) => {
    const child = childProcess.spawn(command, args, {
      cwd,
      stdio: 'inherit',
      env
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
    });
  });

const symlinkDir = async (source, target) => {
  const type = process.platform === 'win32' ? 'junction' : 'dir';
  await fsp.symlink(source, target, type);
};

const withWritableNpmCache = (env, cacheRoot) => ({
  ...env,
  NPM_CONFIG_CACHE: cacheRoot,
  npm_config_cache: cacheRoot
});

const main = async () => {
  console.log('Running chipsdev-r create module workspace integration tests...');

  const sandboxRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'chipsdev-create-module-workspace-'));
const linkedEntries = ['Chips-SDK', 'Chips-Scaffold', 'Chips-ComponentLibrary'];

  try {
    for (const entry of linkedEntries) {
      await symlinkDir(path.join(ecosystemRoot, entry), path.join(sandboxRoot, entry));
    }

    await fsp.writeFile(
      path.join(sandboxRoot, 'package.json'),
      JSON.stringify(
        {
          name: 'chips-ecosystem-workspace',
          private: true,
          volta: {
            node: process.versions.node,
            npm: '10.9.3'
          },
          workspaces: [
            'Chips-*',
            'Chips-BaseCardPlugin/*',
            'Chips-Scaffold/*'
          ],
          overrides: TEST_NPM_OVERRIDES
        },
        null,
        2
      ),
      'utf-8'
    );

    const env = withWritableNpmCache({
      ...process.env,
      CHIPS_ECOSYSTEM_ROOT: sandboxRoot
    }, path.join(sandboxRoot, '.npm-cache'));

    const targetRelativePath = path.join('validation-projects', 'module-smoke');
    const targetDir = path.join(sandboxRoot, targetRelativePath);

    await run('node', [cliPath, 'create', 'module', targetRelativePath], sandboxRoot, env);

    const rootPackage = JSON.parse(await fsp.readFile(path.join(sandboxRoot, 'package.json'), 'utf-8'));
    assert.equal(rootPackage.workspaces.includes('validation-projects/module-smoke'), true);

    const createdPackage = JSON.parse(await fsp.readFile(path.join(targetDir, 'package.json'), 'utf-8'));
    assert.equal(createdPackage.devDependencies['chips-sdk'], '^0.1.0');
    assert.equal(createdPackage.devDependencies.vitest, '^3.0.8');
    assert.equal(createdPackage.devDependencies['@types/node'], '^22.13.10');
    assert.equal(createdPackage.volta.extends, '../../package.json');

    const chipsConfig = await fsp.readFile(path.join(targetDir, 'chips.config.mjs'), 'utf-8');
    assert.match(chipsConfig, /type:\s*"module"/);

    const manifestText = await fsp.readFile(path.join(targetDir, 'manifest.yaml'), 'utf-8');
    assert.match(manifestText, /type:\s*module/);
    assert.match(manifestText, /entry:\s*dist\/index\.mjs/);
    assert.match(manifestText, /runtime:\s*\n\s*targets:/);
    assert.match(manifestText, /headless:\s*\n\s*supported:\s*true/);
    assert.match(manifestText, /module:/);
    assert.match(manifestText, /provides:/);
    assert.match(manifestText, /capability:\s+module\.module\.smoke|capability:\s+module\.smoke/);
    const capabilityMatch = manifestText.match(/capability:\s*([^\n]+)/);
    assert.ok(capabilityMatch, 'module capability should be declared in manifest');
    const moduleCapability = capabilityMatch[1].trim();

    const runtimeTest = await fsp.readFile(
      path.join(targetDir, 'tests', 'unit', 'module-definition.test.ts'),
      'utf-8'
    );
    assert.match(runtimeTest, /runAsync/);
    assert.doesNotMatch(runtimeTest, /mountModule/);

    const source = await fsp.readFile(path.join(targetDir, 'src', 'index.ts'), 'utf-8');
    assert.match(source, /providers:/);
    assert.match(source, /reportProgress/);

    const matrixRelativePath = path.join('validation-projects', 'module-html-render');
    const matrixTargetDir = path.join(sandboxRoot, matrixRelativePath);
    await run(
      'node',
      [
        cliPath,
        'create',
        'module',
        matrixRelativePath,
        '--template',
        'module-html-rendering',
        '--plugin-id',
        'chips.module.html.render',
        '--capability',
        'converter.html.render'
      ],
      sandboxRoot,
      env
    );

    const matrixPackage = JSON.parse(await fsp.readFile(path.join(matrixTargetDir, 'package.json'), 'utf-8'));
    assert.equal(matrixPackage.scripts.verify.includes('npm run package'), true);
    const matrixManifest = await fsp.readFile(path.join(matrixTargetDir, 'manifest.yaml'), 'utf-8');
    assert.match(matrixManifest, /id:\s+chips\.module\.html\.render/);
    assert.match(matrixManifest, /capability:\s+converter\.html\.render/);
    assert.match(matrixManifest, /name:\s+convert/);
    assert.match(matrixManifest, /platform\.read/);
    assert.match(matrixManifest, /consumes:\s+\[\]/);
    await fsp.access(path.join(matrixTargetDir, 'contracts', 'convert.input.schema.json'));
    await fsp.access(path.join(matrixTargetDir, 'contracts', 'convert.output.schema.json'));
    await assert.rejects(
      () => fsp.stat(path.join(matrixTargetDir, 'contracts', 'runAsync.input.schema.json')),
      { code: 'ENOENT' }
    );
    const matrixSource = await fsp.readFile(path.join(matrixTargetDir, 'src', 'index.ts'), 'utf-8');
    assert.match(matrixSource, /platform\.renderHtmlToPdf/);
    assert.match(matrixSource, /platform\.renderHtmlToImage/);
    assert.doesNotMatch(matrixSource, /mountModule|ctx\.services|template\.json/);

    const orchestrationRelativePath = path.join('validation-projects', 'module-orchestrator');
    const orchestrationTargetDir = path.join(sandboxRoot, orchestrationRelativePath);
    await run(
      'node',
      [
        cliPath,
        'create',
        'module',
        orchestrationRelativePath,
        '--template=module-orchestration',
        '--capability=converter.file.convert',
        '--consumes',
        'converter.card.to-html@^1.0.0',
        '--consumes=converter.html.to-pdf@^1.0.0'
      ],
      sandboxRoot,
      env
    );
    const orchestrationManifest = await fsp.readFile(path.join(orchestrationTargetDir, 'manifest.yaml'), 'utf-8');
    assert.match(orchestrationManifest, /capability:\s+converter\.file\.convert/);
    assert.match(orchestrationManifest, /capability:\s+"converter\.card\.to-html"/);
    assert.match(orchestrationManifest, /versionRange:\s+"\^1\.0\.0"/);
    assert.match(orchestrationManifest, /capability:\s+"converter\.html\.to-pdf"/);

    await run('npm', ['install'], sandboxRoot, env);
    await run('npm', ['run', 'lint'], targetDir, env);
    await run('npm', ['run', 'build'], targetDir, env);
    await run('npm', ['test'], targetDir, env);
    await run('npm', ['run', 'validate'], targetDir, env);
    await run('node', [cliPath, 'package'], targetDir, env);

    await run('npm', ['run', 'build'], path.join(ecosystemRoot, 'Chips-Host'));

    const { HostApplication } = require(path.join(
      ecosystemRoot,
      'Chips-Host',
      'dist',
      'src',
      'main',
      'core',
      'host-application.js'
    ));
    const { RuntimeClient } = require(path.join(
      ecosystemRoot,
      'Chips-Host',
      'dist',
      'src',
      'renderer',
      'runtime-client.js'
    ));
    const { PluginRuntime } = require(path.join(
      ecosystemRoot,
      'Chips-Host',
      'dist',
      'src',
      'runtime',
      'plugin-runtime.js'
    ));

    const hostWorkspace = await fsp.mkdtemp(path.join(os.tmpdir(), 'chips-module-host-workspace-'));
    let app;

    try {
      const bootstrapRuntime = new PluginRuntime(hostWorkspace, {
        locale: 'zh-CN',
        themeId: 'chips-official.default-theme',
      });
      await bootstrapRuntime.load();

      app = new HostApplication({ workspacePath: hostWorkspace });
      await app.start();

      const runtimeClient = new RuntimeClient(app.createBridge(), {
        defaultTimeout: 5000,
        maxRetries: 1,
        retryDelay: 10,
        retryBackoff: 2,
        enableRetry: true,
      });

      const packagedModulePath = path.join(targetDir, 'dist', `${createdPackage.name}-${createdPackage.version}.cpk`);
      const installed = await runtimeClient.invoke('plugin.install', {
        manifestPath: packagedModulePath,
      });
      await runtimeClient.invoke('plugin.enable', { pluginId: installed.pluginId });

      const providers = await runtimeClient.invoke('module.listProviders', {
        capability: moduleCapability,
      });
      assert.equal(
        providers.providers.some((provider) => provider.pluginId === createdPackage.name),
        true,
        'generated module should be visible in Host provider registry'
      );

      const syncResult = await runtimeClient.invoke('module.invoke', {
        capability: moduleCapability,
        method: 'run',
        input: {
          sourceText: 'hello from scaffold',
          uppercase: true,
          prefix: '[host] ',
        },
      });
      assert.equal(syncResult.mode, 'sync');
      assert.deepEqual(syncResult.output, {
        text: '[host] HELLO FROM SCAFFOLD',
        length: '[host] HELLO FROM SCAFFOLD'.length,
        handledBy: createdPackage.name,
      });

      const started = await runtimeClient.invoke('module.invoke', {
        capability: moduleCapability,
        method: 'runAsync',
        input: {
          sourceText: 'async scaffold',
          delayMs: 1,
        },
      });
      assert.equal(started.mode, 'job');

      let completedJob;
      for (let attempt = 0; attempt < 20; attempt += 1) {
        const snapshot = await runtimeClient.invoke('module.job.get', { jobId: started.jobId });
        if (snapshot.job.status === 'completed') {
          completedJob = snapshot.job;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 20));
      }

      assert.ok(completedJob, 'generated module async job should complete through Host runtime');
      assert.deepEqual(completedJob.output, {
        text: 'async scaffold',
        length: 14,
        handledBy: createdPackage.name,
      });
    } finally {
      if (app) {
        await app.stop();
      }
      await fsp.rm(hostWorkspace, { recursive: true, force: true });
    }

    console.log('chipsdev-r create module workspace integration tests completed.');
  } finally {
    await fsp.rm(sandboxRoot, { recursive: true, force: true });
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

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

const shouldCopyWorkspacePath = (sourceRoot, entryPath) => {
  const relativePath = path.relative(sourceRoot, entryPath);
  if (relativePath.length === 0) {
    return true;
  }
  const segments = relativePath.split(path.sep);
  return !segments.includes('node_modules') && !segments.includes('.git');
};

const copyDir = async (source, target) => {
  await fsp.cp(source, target, {
    recursive: true,
    dereference: true,
    filter: (entryPath) => shouldCopyWorkspacePath(source, entryPath)
  });
};

const withWritableNpmCache = (env, cacheRoot) => ({
  ...env,
  NPM_CONFIG_CACHE: cacheRoot,
  npm_config_cache: cacheRoot
});

const main = async () => {
  console.log('Running chipsdev-r create layout workspace integration tests...');

  const sandboxRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'chipsdev-create-layout-workspace-'));
  const workspaceEntries = [
    { name: 'Chips-SDK', mode: 'symlink' },
    { name: 'Chips-Scaffold', mode: 'symlink' },
    { name: 'Chips-ComponentLibrary', mode: 'copy' }
  ];

  try {
    for (const entry of workspaceEntries) {
      const sourceDir = path.join(ecosystemRoot, entry.name);
      const targetDir = path.join(sandboxRoot, entry.name);
      if (entry.mode === 'copy') {
        await copyDir(sourceDir, targetDir);
        continue;
      }
      await symlinkDir(sourceDir, targetDir);
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

    const targetRelativePath = path.join('validation-projects', 'layout-smoke');
    const targetDir = path.join(sandboxRoot, targetRelativePath);

    await run('node', [cliPath, 'create', 'layout', targetRelativePath], sandboxRoot, env);

    const rootPackage = JSON.parse(await fsp.readFile(path.join(sandboxRoot, 'package.json'), 'utf-8'));
    assert.equal(rootPackage.workspaces.includes('validation-projects/layout-smoke'), true);

    const createdPackage = JSON.parse(await fsp.readFile(path.join(targetDir, 'package.json'), 'utf-8'));
    assert.equal(createdPackage.devDependencies['chips-sdk'], '^0.1.0');
    assert.equal(createdPackage.devDependencies.vitest, '^3.0.8');
    assert.equal(createdPackage.devDependencies.jsdom, '^28.1.0');
    assert.equal(createdPackage.volta.extends, '../../package.json');

    const chipsConfig = await fsp.readFile(path.join(targetDir, 'chips.config.mjs'), 'utf-8');
    assert.match(chipsConfig, /type:\s*"layout"/);

    const manifestText = await fsp.readFile(path.join(targetDir, 'manifest.yaml'), 'utf-8');
    assert.match(manifestText, /type:\s*layout/);
    assert.match(manifestText, /entry:\s*dist\/index\.mjs/);
    assert.match(manifestText, /runtime:\s*\n\s*targets:/);
    assert.match(manifestText, /headless:\s*\n\s*supported:\s*true/);
    assert.match(manifestText, /layout:/);
    assert.match(manifestText, /layoutType:\s+chips\.layout\./);
    assert.match(manifestText, /displayName:\s+Layout Smoke/);

    const vitestConfig = await fsp.readFile(path.join(targetDir, 'vitest.config.mts'), 'utf-8');
    assert.match(vitestConfig, /environment:\s*"jsdom"/);

    const source = await fsp.readFile(path.join(targetDir, 'src', 'index.ts'), 'utf-8');
    assert.match(source, /export const layoutDefinition/);
    assert.match(source, /renderView/);
    assert.match(source, /renderEditor/);
    await assert.rejects(
      () => fsp.stat(path.join(targetDir, 'template.json')),
      (error) => error && error.code === 'ENOENT'
    );

    await run('npm', ['install'], sandboxRoot, env);
    await run('npm', ['run', 'lint'], targetDir, env);
    await run('npm', ['run', 'build'], targetDir, env);
    await run('npm', ['test'], targetDir, env);
    await run('npm', ['run', 'validate'], targetDir, env);
    await run('node', [cliPath, 'package'], targetDir, env);

    console.log('chipsdev-r create layout workspace integration tests completed.');
  } finally {
    await fsp.rm(sandboxRoot, { recursive: true, force: true });
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

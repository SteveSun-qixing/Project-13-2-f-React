/* eslint-disable no-console */
const assert = require('node:assert/strict');
const path = require('node:path');
const childProcess = require('node:child_process');
const fs = require('node:fs/promises');
const os = require('node:os');

const projectRoot = path.resolve(__dirname, '..');
const ecosystemRoot = path.resolve(projectRoot, '..');
const cliPath = path.join(projectRoot, 'cli', 'index.js');

const run = (args, cwd, env = process.env) =>
  new Promise((resolve, reject) => {
    const child = childProcess.spawn('node', [cliPath, ...args], {
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
      reject(new Error(`chipsdev ${args.join(' ')} exited with code ${code}`));
    });
  });

const runCommand = (command, args, cwd, env = process.env) =>
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

const ensurePackagedTheme = async (themeProjectPath, packageFileName, env) => {
  const packagePath = path.join(themeProjectPath, 'dist', packageFileName);

  try {
    await fs.access(packagePath);
    return packagePath;
  } catch {
    await runCommand('npm', ['run', 'build'], themeProjectPath, env);
    await run(['package'], themeProjectPath, env);
    return packagePath;
  }
};

const main = async () => {
  console.log('Running chipsdev host-managed command tests...');

  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'chipsdev-host-managed-'));
  const env = {
    ...process.env,
    CHIPS_HOME: workspace,
    CHIPS_ECOSYSTEM_ROOT: ecosystemRoot
  };

  try {
    await run(['theme', 'current'], projectRoot, env);
    await run(['status'], projectRoot, env);

    const runtimeRecords = JSON.parse(await fs.readFile(path.join(workspace, 'plugin-runtime.json'), 'utf-8'));
    assert.equal(
      runtimeRecords.some((record) => record.manifest?.id === 'theme.theme.chips-official-default-theme' && record.enabled === true),
      true
    );

    await run(['config', 'set', 'chipsdev.mode', 'isolated'], projectRoot, env);
    const config = JSON.parse(await fs.readFile(path.join(workspace, 'config.json'), 'utf-8'));
    assert.equal(config['chipsdev.mode'], 'isolated');

    await run(['theme', 'current'], projectRoot, env);

    const darkThemeManifestPath = await ensurePackagedTheme(
      path.join(ecosystemRoot, 'ThemePack', 'Chips-theme-default-dark'),
      'theme.theme.chips-official-default-dark-theme-1.0.0.cpk',
      env
    );
    await run(['plugin', 'install', darkThemeManifestPath], projectRoot, env);
    await run(['plugin', 'enable', 'theme.theme.chips-official-default-dark-theme'], projectRoot, env);
    await run(['theme', 'apply', 'chips-official.default-dark-theme'], projectRoot, env);
    await run(['theme', 'current'], projectRoot, env);

    const nextConfig = JSON.parse(await fs.readFile(path.join(workspace, 'config.json'), 'utf-8'));
    assert.equal(nextConfig['ui.theme'], 'chips-official.default-dark-theme');

    await run(['doctor'], projectRoot, env);

    console.log('chipsdev host-managed command tests completed.');
  } finally {
    await fs.rm(workspace, { recursive: true, force: true });
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

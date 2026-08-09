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
  console.log('Running chipsdev-r create theme workspace integration tests...');

  const sandboxRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'chipsdev-create-theme-workspace-'));
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
            'Chips-ComponentLibrary/packages/*',
            'Chips-ComponentLibrary/packages/adapters/*',
            'Chips-Scaffold/*',
            'ThemePack/*'
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

    const targetRelativePath = path.join('validation-projects', 'theme-smoke');
    const targetDir = path.join(sandboxRoot, targetRelativePath);

    await run(
      'node',
      [
        cliPath,
        'create',
        'theme',
        targetRelativePath,
        '--theme-id=theme.cli.smoke',
        '--plugin-id',
        'chips.theme.cli.smoke',
        '--display-name',
        'Theme CLI Smoke',
        '--publisher',
        'chips-cli',
        '--version',
        '2.3.4',
        '--parent-theme-id',
        'chips-official.default-theme',
        '--description',
        'Theme CLI smoke package.'
      ],
      sandboxRoot,
      env
    );

    const rootPackage = JSON.parse(await fsp.readFile(path.join(sandboxRoot, 'package.json'), 'utf-8'));
    assert.equal(rootPackage.workspaces.includes('validation-projects/theme-smoke'), true);

    const createdPackage = JSON.parse(await fsp.readFile(path.join(targetDir, 'package.json'), 'utf-8'));
    assert.equal(createdPackage.name, 'chips.theme.cli.smoke');
    assert.equal(createdPackage.version, '2.3.4');
    assert.equal(createdPackage.devDependencies['chips-sdk'], '^0.1.0');
    assert.equal(createdPackage.devDependencies['@chips/theme-contracts'], '0.1.0');
    assert.equal(createdPackage.scripts.build.includes('build:contracts'), true);
    assert.equal(createdPackage.scripts.verify.includes('npm run package'), true);
    assert.equal(createdPackage.volta.extends, '../../package.json');

    const manifestText = await fsp.readFile(path.join(targetDir, 'manifest.yaml'), 'utf-8');
    assert.match(manifestText, /id:\s*"chips\.theme\.cli\.smoke"/);
    assert.match(manifestText, /name:\s*"Theme CLI Smoke"/);
    assert.match(manifestText, /version:\s*"2\.3\.4"/);
    assert.match(manifestText, /type:\s*"theme"/);
    assert.match(manifestText, /publisher:\s*"chips-cli"/);
    assert.match(manifestText, /themeId:\s*"theme\.cli\.smoke"/);
    assert.match(manifestText, /displayName:\s*"Theme CLI Smoke"/);
    assert.match(manifestText, /parentTheme:\s*"chips-official\.default-theme"/);
    assert.match(manifestText, /tokens:\s*"dist\/tokens\.json"/);
    assert.match(manifestText, /themeCss:\s*"dist\/theme\.css"/);

    await fsp.access(path.join(targetDir, 'tokens', 'ref.json'));
    await fsp.access(path.join(targetDir, 'tokens', 'sys.json'));
    await fsp.access(path.join(targetDir, 'tokens', 'motion.json'));
    await fsp.access(path.join(targetDir, 'tokens', 'layout.json'));
    await fsp.access(path.join(targetDir, 'tokens', 'comp', 'button.json'));
    await fsp.access(path.join(targetDir, 'contracts', 'theme-interface.contract.json'));
    await fsp.access(path.join(targetDir, 'icons', 'variablefont', 'MaterialSymbolsOutlined[FILL,GRAD,opsz,wght].woff2'));

    const matrix = JSON.parse(await fsp.readFile(path.join(targetDir, 'preview', 'theme-matrix.json'), 'utf-8'));
    assert.equal(matrix.themeId, 'theme.cli.smoke');
    assert.equal(matrix.themeVersion, '2.3.4');

    const contractSource = await fsp.readFile(path.join(targetDir, 'src', 'build-contracts.ts'), 'utf-8');
    assert.doesNotMatch(contractSource, /Chips-ComponentLibrary/);
    assert.doesNotMatch(contractSource, /\{\{\s*[a-zA-Z0-9_]+\s*\}\}/);

    await assert.rejects(
      () => fsp.stat(path.join(targetDir, 'tokens', 'global.json')),
      (error) => error && error.code === 'ENOENT'
    );

    console.log('chipsdev-r create theme workspace integration tests completed.');
  } finally {
    await fsp.rm(sandboxRoot, { recursive: true, force: true });
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

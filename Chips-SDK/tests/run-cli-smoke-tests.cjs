/* eslint-disable no-console */
const path = require('node:path');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');

const projectRoot = path.resolve(__dirname, '..');
const cliPath = path.join(projectRoot, 'cli', 'index.js');

const run = (args, cwd = projectRoot) =>
  new Promise((resolve, reject) => {
    const child = childProcess.spawn('node', [cliPath, ...args], {
      cwd,
      stdio: 'inherit',
      env: process.env
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`chipsdev-r ${args.join(' ')} exited with code ${code}`));
    });
  });

const runBinary = (command, args, cwd, env = process.env) =>
  new Promise((resolve, reject) => {
    const child = childProcess.spawn(command, args, {
      cwd,
      stdio: 'inherit',
      env
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
    });
  });

const withWritableNpmCache = (env, cacheRoot) => ({
  ...env,
  NPM_CONFIG_CACHE: cacheRoot,
  npm_config_cache: cacheRoot
});

const main = async () => {
  console.log('Running chipsdev-r CLI smoke tests...');
  await run(['help']);
  await run(['version']);

  const buildProject = fs.mkdtempSync(path.join(os.tmpdir(), 'chipsdev-build-smoke-'));
  fs.writeFileSync(
    path.join(buildProject, 'chips.config.mjs'),
    [
      'export default {',
      "  type: 'app',",
      "  srcDir: 'src',",
      "  outDir: 'dist',",
      "  entry: 'index.html',",
      "  testsDir: 'tests'",
      '};'
    ].join('\n')
  );
  fs.writeFileSync(
    path.join(buildProject, 'manifest.yaml'),
    [
      'id: chips.build.smoke',
      'version: "1.0.0"',
      'type: app',
      'name: Build Smoke Plugin',
      'permissions: []',
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
      'entry: dist/index.html',
      'ui:',
      '  surface:',
      '    defaultKind: window',
      '    preferredKinds:',
      '      desktop: window',
      '      web: route',
      '      mobile: fullscreen',
      '      headless: window'
    ].join('\n')
  );
  fs.writeFileSync(
    path.join(buildProject, 'index.html'),
    '<!doctype html><html><body><div id="app"></div><script type="module" src="./main.js"></script></body></html>'
  );
  fs.writeFileSync(path.join(buildProject, 'main.js'), 'document.getElementById("app").textContent = "chips";');

  const tempProject = fs.mkdtempSync(path.join(os.tmpdir(), 'chipsdev-local-bin-'));
  const npmCache = path.join(tempProject, '.npm-cache');
  fs.writeFileSync(
    path.join(tempProject, 'package.json'),
    JSON.stringify(
      {
        name: 'chipsdev-local-bin-smoke',
        private: true,
        devDependencies: {
          'chips-sdk': `file:${projectRoot}`
        }
      },
      null,
      2
    )
  );

  try {
    await run(['build'], buildProject);
    if (!fs.existsSync(path.join(buildProject, 'dist', 'index.html'))) {
      throw new Error('chipsdev-r build did not produce dist/index.html');
    }
    if (!fs.existsSync(path.join(buildProject, 'dist', 'assets'))) {
      throw new Error('chipsdev-r build did not produce dist/assets');
    }
    if (fs.existsSync(path.join(buildProject, 'dist', 'manifest.yaml'))) {
      throw new Error('chipsdev-r build must not copy manifest.yaml into dist/');
    }
    const builtHtml = fs.readFileSync(path.join(buildProject, 'dist', 'index.html'), 'utf8');
    if (!builtHtml.includes('./assets/')) {
      throw new Error('chipsdev-r build must emit relative asset paths for app plugins');
    }

    const env = withWritableNpmCache(process.env, npmCache);
    await runBinary('npm', ['install'], tempProject, env);
    await runBinary('chipsdev-r', ['help'], tempProject, env);
  } finally {
    fs.rmSync(buildProject, { recursive: true, force: true });
    fs.rmSync(tempProject, { recursive: true, force: true });
  }

  console.log('chipsdev-r CLI smoke tests completed.');
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

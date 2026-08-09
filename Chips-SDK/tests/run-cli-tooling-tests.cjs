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

const runJson = async (args, cwd, env = process.env) => {
  const { stdout } = await runCapture([...args, '--json'], cwd, env);
  return JSON.parse(stdout);
};

const createPreviewProject = async (targetDir) => {
  await fs.mkdir(path.join(targetDir, 'dist'), { recursive: true });
  await fs.writeFile(
    path.join(targetDir, 'package.json'),
    JSON.stringify({ name: 'chipsdev-tooling-test', private: true }, null, 2),
    'utf-8'
  );
  await fs.writeFile(
    path.join(targetDir, 'chips.config.mjs'),
    [
      'export default {',
      "  type: 'app',",
      "  srcDir: 'src',",
      "  outDir: 'dist',",
      "  entry: 'index.html',",
      "  testsDir: 'tests'",
      '};'
    ].join('\n'),
    'utf-8'
  );
  await fs.writeFile(
    path.join(targetDir, 'manifest.yaml'),
    [
      'id: chipsdev.tooling.test',
      'version: "1.0.0"',
      'type: app',
      'name: Chipsdev Tooling Test',
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
    ].join('\n'),
    'utf-8'
  );
  await fs.writeFile(path.join(targetDir, 'dist', 'index.html'), '<!doctype html><div id="app"></div>', 'utf-8');
};

const createAssimilationTarget = async (targetDir) => {
  await fs.writeFile(
    path.join(targetDir, 'package.json'),
    JSON.stringify(
      {
        name: 'legacy-player',
        private: true,
        scripts: { dev: 'vite' },
        dependencies: {
          react: '^18.2.0',
          vite: '^5.0.0'
        }
      },
      null,
      2
    ),
    'utf-8'
  );
  await fs.writeFile(
    path.join(targetDir, 'index.html'),
    [
      '<!doctype html>',
      '<button style="color:#fff" onclick="window.open(\'https://example.com\')">保存文件</button>',
      '<input type="file" />',
      '<script>',
      '  localStorage.setItem("theme", "dark");',
      '  navigator.clipboard.writeText("copy");',
      '</script>'
    ].join('\n'),
    'utf-8'
  );
  await fs.writeFile(
    path.join(targetDir, 'App.jsx'),
    [
      'export function App() {',
      '  return <button onKeyDown={(event) => event.metaKey && fetch("/api")}>Play</button>;',
      '}'
    ].join('\n'),
    'utf-8'
  );
};

const main = async () => {
  console.log('Running chipsdev-r tooling command tests...');

  const sandbox = await fs.mkdtemp(path.join(os.tmpdir(), 'chipsdev-tooling-'));
  const appProject = path.join(sandbox, 'app');
  const assimilationTarget = path.join(sandbox, 'legacy-web');
  const env = {
    ...process.env,
    CHIPS_ECOSYSTEM_ROOT: ecosystemRoot
  };

  try {
    await fs.mkdir(appProject, { recursive: true });
    await fs.mkdir(assimilationTarget, { recursive: true });
    await createPreviewProject(appProject);
    await createAssimilationTarget(assimilationTarget);

    const preview = await runJson(['preview', '--mode', 'mock', '--target', 'app'], appProject, env);
    assert.equal(preview.kind, 'chipsdev.preview');
    assert.equal(preview.summary.status, 'passed');
    assert.equal(preview.project.manifest.id, 'chipsdev.tooling.test');
    assert.equal(preview.previewPlan.hostMock.supported, true);

    const componentGallery = await runJson(['component', 'gallery'], appProject, env);
    assert.equal(componentGallery.kind, 'chipsdev.component.gallery');
    assert.equal(componentGallery.summary.status, 'skipped');
    assert.equal(componentGallery.summary.componentCount, 0);
    assert.ok(
      componentGallery.checks.some((check) => check.name === 'componentLibrary.exists' && check.status === 'skipped')
    );

    const qualityGate = await runJson(['quality', 'gate'], appProject, env);
    assert.equal(qualityGate.kind, 'chipsdev.quality.gate');
    assert.equal(qualityGate.summary.status, 'passed');
    assert.equal(qualityGate.summary.failedCheckCount, 0);

    const diagnostics = await runJson(['diagnostics'], appProject, env);
    assert.equal(diagnostics.kind, 'chipsdev.diagnostics');
    assert.equal(diagnostics.summary.status, 'passed');
    assert.ok(diagnostics.routes.routeCount > 100);

    const assimilationScan = await runJson(['assimilate', 'scan', assimilationTarget], appProject, env);
    assert.equal(assimilationScan.kind, 'chipsdev.assimilate.scan');
    assert.equal(assimilationScan.summary.status, 'blocked');
    assert.ok(assimilationScan.project.frameworks.includes('react'));
    assert.ok(assimilationScan.project.frameworks.includes('vite'));
    assert.ok(assimilationScan.manifestSuggestion.permissions.includes('file.read'));
    assert.ok(assimilationScan.manifestSuggestion.permissions.includes('platform.external'));

    const outPath = path.join(sandbox, 'assimilate-report.json');
    const { stdout } = await runCapture(
      ['assimilate', 'report', assimilationTarget, '--out', outPath],
      appProject,
      env
    );
    assert.match(stdout, /JSON 报告已写入/);
    const savedReport = JSON.parse(await fs.readFile(outPath, 'utf-8'));
    assert.equal(savedReport.kind, 'chipsdev.assimilate.report');
    assert.equal(savedReport.migrationPlan.length, 4);

    console.log('chipsdev-r tooling command tests completed.');
  } finally {
    await fs.rm(sandbox, { recursive: true, force: true });
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

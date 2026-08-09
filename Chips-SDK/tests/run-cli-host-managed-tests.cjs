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
      reject(new Error(`chipsdev-r ${args.join(' ')} exited with code ${code}`));
    });
  });

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
      resolve({ code, stdout, stderr });
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

const main = async () => {
  console.log('Running chipsdev-r host-managed command tests...');

  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'chipsdev-host-managed-'));
  const env = {
    ...process.env,
    CHIPS_HOME: workspace,
    CHIPS_ECOSYSTEM_ROOT: ecosystemRoot
  };

  try {
    const implicitInteractive = await runCapture([], projectRoot, env);
    assert.equal(implicitInteractive.code, 0);
    assert.match(implicitInteractive.stdout, /Chips TUI requires an interactive terminal/);

    const explicitInteractive = await runCapture(['--interactive'], projectRoot, env);
    assert.equal(explicitInteractive.code, 1);
    assert.match(explicitInteractive.stdout, /Chips TUI requires an interactive terminal/);

    const completionScript = await runCapture(['completion', 'bash'], projectRoot, env);
    assert.equal(completionScript.code, 0);
    assert.match(completionScript.stdout, /chipsdev-r __complete/);
    assert.match(completionScript.stdout, /complete -F _chipsdev_r_completion chipsdev-r/);

    const privateCompletion = await runCapture(['__complete', ''], projectRoot, env);
    assert.equal(privateCompletion.code, 0);
    assert.match(privateCompletion.stdout, /completion/);

    await run(['status'], projectRoot, env);

    await run(['config', 'set', 'chipsdev.mode', 'isolated'], projectRoot, env);
    const config = JSON.parse(await fs.readFile(path.join(workspace, 'config.json'), 'utf-8'));
    assert.equal(config['chipsdev.mode'], 'isolated');

    await run(['doctor'], projectRoot, env);

    console.log('chipsdev-r host-managed command tests completed.');
  } finally {
    await fs.rm(workspace, { recursive: true, force: true });
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

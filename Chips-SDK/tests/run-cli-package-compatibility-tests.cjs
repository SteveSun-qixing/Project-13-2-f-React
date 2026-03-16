/* eslint-disable no-console */
const assert = require('node:assert/strict');
const path = require('node:path');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');

const projectRoot = path.resolve(__dirname, '..');
const cliPath = path.join(projectRoot, 'cli', 'index.js');
const EOCD_SIGNATURE = 0x06054b50;
const CD_SIGNATURE = 0x02014b50;

const run = (args, cwd) =>
  new Promise((resolve, reject) => {
    const child = childProcess.spawn('node', [cliPath, ...args], {
      cwd,
      stdio: 'inherit',
      env: process.env
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

const findEocdOffset = (buffer) => {
  for (let offset = buffer.length - 22; offset >= 0; offset -= 1) {
    if (buffer.readUInt32LE(offset) === EOCD_SIGNATURE) {
      return offset;
    }
  }
  throw new Error('End of central directory not found');
};

const listEntries = (buffer) => {
  const eocdOffset = findEocdOffset(buffer);
  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  const entries = [];
  let cursor = centralDirectoryOffset;

  for (let index = 0; index < totalEntries; index += 1) {
    if (buffer.readUInt32LE(cursor) !== CD_SIGNATURE) {
      throw new Error('Invalid ZIP central directory signature');
    }

    const compressionMethod = buffer.readUInt16LE(cursor + 10);
    const fileNameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const fileName = buffer.subarray(cursor + 46, cursor + 46 + fileNameLength).toString('utf-8');

    entries.push({
      path: fileName,
      compressionMethod
    });

    cursor += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
};

const main = async () => {
  console.log('Running chipsdev package compatibility tests...');
  const workspace = await fsp.mkdtemp(path.join(os.tmpdir(), 'chipsdev-package-test-'));

  try {
    await fsp.writeFile(
      path.join(workspace, 'chips.config.mjs'),
      [
        'export default {',
        "  type: 'app',",
        "  outDir: 'dist'",
        '};'
      ].join('\n'),
      'utf-8'
    );

    await fsp.writeFile(
      path.join(workspace, 'manifest.yaml'),
      [
        'id: chips.test.package',
        'version: "1.0.0"',
        'type: app',
        'name: Package Compatibility Test',
        'permissions: []',
        'entry: dist/main.js',
        'ui:',
        '  launcher:',
        '    icon: assets/icon.png'
      ].join('\n'),
      'utf-8'
    );

    await fsp.mkdir(path.join(workspace, 'dist'), { recursive: true });
    await fsp.mkdir(path.join(workspace, 'assets'), { recursive: true });
    await fsp.writeFile(path.join(workspace, 'dist', 'main.js'), 'console.log("ok");\n', 'utf-8');
    await fsp.writeFile(path.join(workspace, 'assets', 'icon.png'), 'icon', 'utf-8');
    await fsp.writeFile(path.join(workspace, 'dist', 'manifest.yaml'), 'shadow: true\n', 'utf-8');
    await fsp.writeFile(
      path.join(workspace, 'dist', 'publish-meta.json'),
      JSON.stringify({ stale: true }, null, 2),
      'utf-8'
    );
    await fsp.writeFile(path.join(workspace, 'dist', 'old-release.cpk'), 'stale', 'utf-8');

    await run(['package'], workspace);

    const packagePath = path.join(workspace, 'dist', 'chips.test.package-1.0.0.cpk');
    assert.equal(fs.existsSync(packagePath), true, 'package output should exist');

    const buffer = await fsp.readFile(packagePath);
    const entries = listEntries(buffer);

    assert.deepEqual(
      entries.map((entry) => entry.path),
      ['manifest.yaml', 'assets/icon.png', 'dist/main.js'],
      'package should include root manifest, declared manifest assets, and runtime artifacts only'
    );
    assert.deepEqual(
      entries.map((entry) => entry.compressionMethod),
      [0, 0, 0],
      'all ZIP entries must use store-only compression for Host compatibility'
    );

    console.log('chipsdev package compatibility tests completed.');
  } finally {
    await fsp.rm(workspace, { recursive: true, force: true });
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

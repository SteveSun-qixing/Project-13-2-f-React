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
      reject(new Error(`chipsdev-r ${args.join(' ')} exited with code ${code}`));
    });
  });

const runExpectFailure = (args, cwd) =>
  new Promise((resolve, reject) => {
    const child = childProcess.spawn('node', [cliPath, ...args], {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env
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
      if (code && code !== 0) {
        resolve({ stdout, stderr, code });
        return;
      }
      reject(new Error(`chipsdev-r ${args.join(' ')} was expected to fail but exited with code ${code}`));
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

const writeAppManifest = async (workspace, extraLines = []) => {
  await fsp.writeFile(
    path.join(workspace, 'manifest.yaml'),
    [
      'id: chips.test.package',
      'version: "1.0.0"',
      'type: app',
      'name: Package Compatibility Test',
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
      'entry: dist/main.js',
      'ui:',
      '  surface:',
      '    defaultKind: window',
      '    preferredKinds:',
      '      desktop: window',
      '      web: route',
      '      mobile: fullscreen',
      '      headless: window',
      '  launcher:',
      '    displayName: Package Compatibility Test',
      '    icon: assets/icons/app-icon.ico',
      ...extraLines
    ].join('\n'),
    'utf-8'
  );
};

const writeModuleManifest = async (workspace, extraLines = []) => {
  await fsp.writeFile(
    path.join(workspace, 'manifest.yaml'),
    [
      'id: chips.test.package.module',
      'version: "1.0.0"',
      'type: module',
      'name: Package Compatibility Module Test',
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
      '      supported: true',
      'entry: dist/main.js',
      'module:',
      '  apiVersion: 1',
      '  runtime: worker',
      '  activation: onDemand',
      '  provides:',
      '    - capability: package.module.test',
      '      version: "1.0.0"',
      '      methods:',
      '        - name: run',
      '          mode: sync',
      '          inputSchema: contracts/run.input.schema.json',
      '          outputSchema: contracts/run.output.schema.json',
      '  consumes: []',
      ...extraLines
    ].join('\n'),
    'utf-8'
  );
};

const main = async () => {
  console.log('Running chipsdev-r package compatibility tests...');
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

    await writeAppManifest(workspace);

    await fsp.mkdir(path.join(workspace, 'dist'), { recursive: true });
    await fsp.mkdir(path.join(workspace, 'assets', 'icons'), { recursive: true });
    await fsp.mkdir(path.join(workspace, 'contracts'), { recursive: true });
    await fsp.writeFile(path.join(workspace, 'dist', 'main.js'), 'console.log("ok");\n', 'utf-8');
    await fsp.writeFile(path.join(workspace, 'assets', 'icons', 'app-icon.ico'), 'icon-binary\n', 'utf-8');
    await fsp.writeFile(path.join(workspace, 'contracts', 'run.input.schema.json'), '{"type":"object"}\n', 'utf-8');
    await fsp.writeFile(path.join(workspace, 'contracts', 'run.output.schema.json'), '{"type":"object"}\n', 'utf-8');
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
      entries.map((entry) => entry.path).sort(),
      ['assets/icons/app-icon.ico', 'dist/main.js', 'manifest.yaml'],
      'package should include root manifest, runtime artifacts, and manifest-declared static assets'
    );
    assert.deepEqual(
      entries.map((entry) => entry.compressionMethod),
      entries.map(() => 0),
      'all ZIP entries must use store-only compression for Host compatibility'
    );

    await fsp.rm(packagePath, { force: true });
    await writeAppManifest(workspace, [
      'module:',
      '  apiVersion: 1',
      '  runtime: worker',
      '  activation: onDemand',
      '  provides: []',
      'theme:',
      '  themeId: chips.invalid.theme',
      'themeId: chips.invalid.theme',
      'plugin:',
      '  id: chips.reserved'
    ]);

    const invalidFieldsValidate = await runExpectFailure(['validate'], workspace);
    assert.match(
      invalidFieldsValidate.stderr,
      /manifest\.module 只允许 module 插件声明/,
      'validate should reject app manifests that declare module metadata'
    );
    assert.match(
      invalidFieldsValidate.stderr,
      /manifest\.theme 只允许 theme 插件声明/,
      'validate should reject app manifests that declare theme object metadata'
    );
    assert.match(
      invalidFieldsValidate.stderr,
      /manifest\.themeId 只允许 theme 插件声明/,
      'validate should reject app manifests that declare theme metadata'
    );
    assert.match(
      invalidFieldsValidate.stderr,
      /manifest\.plugin 是 Host 插件治理保留字段/,
      'validate should reject app manifests that declare reserved plugin metadata'
    );

    const invalidFieldsPackage = await runExpectFailure(['package'], workspace);
    assert.match(
      invalidFieldsPackage.stderr,
      /manifest\.module 只允许 module 插件声明/,
      'package should run manifest shape validation before writing a cpk'
    );
    assert.match(
      invalidFieldsPackage.stderr,
      /manifest\.theme 只允许 theme 插件声明/,
      'package should reject app manifests that declare theme object metadata'
    );
    assert.equal(fs.existsSync(packagePath), false, 'invalid official fields must not produce a package');

    await writeModuleManifest(workspace, [
      'theme:',
      '  themeId: chips.invalid.theme',
      'themeId: chips.invalid.theme',
      'plugin:',
      '  id: chips.reserved'
    ]);

    const invalidModuleFieldsValidate = await runExpectFailure(['validate'], workspace);
    assert.match(
      invalidModuleFieldsValidate.stderr,
      /manifest\.theme 只允许 theme 插件声明/,
      'validate should reject module manifests that declare theme object metadata'
    );
    assert.match(
      invalidModuleFieldsValidate.stderr,
      /manifest\.themeId 只允许 theme 插件声明/,
      'validate should reject module manifests that declare theme metadata'
    );
    assert.match(
      invalidModuleFieldsValidate.stderr,
      /manifest\.plugin 是 Host 插件治理保留字段/,
      'validate should reject module manifests that declare reserved plugin metadata'
    );

    const invalidModuleFieldsPackage = await runExpectFailure(['package'], workspace);
    assert.match(
      invalidModuleFieldsPackage.stderr,
      /manifest\.theme 只允许 theme 插件声明/,
      'package should reject module manifests that declare theme object metadata'
    );
    assert.match(
      invalidModuleFieldsPackage.stderr,
      /manifest\.themeId 只允许 theme 插件声明/,
      'package should reject module manifests that declare theme metadata'
    );
    assert.equal(fs.existsSync(path.join(workspace, 'dist', 'chips.test.package.module-1.0.0.cpk')), false, 'invalid module official fields must not produce a package');

    await writeModuleManifest(workspace, [
      'cli:',
      '  commands:',
      '    - commandPath: package invalid-output',
      '      target:',
      '        type: module',
      '        capability: package.module.test',
      '        method: run',
      '      titleKey: cli.invalid.output.title',
      '      options:',
      '        - name: output',
      '          type: textFile',
      '          path:',
      '            role: output',
      '            overwrite: fail'
    ]);
    const invalidOutputPathMetadata = await runExpectFailure(['validate'], workspace);
    assert.match(
      invalidOutputPathMetadata.stderr,
      /path\.role 为 output 时参数类型必须是 path/,
      'validate should reject output path metadata on non-path parameters'
    );

    await writeModuleManifest(workspace, [
      'cli:',
      '  commands:',
      '    - commandPath: package invalid-batch',
      '      target:',
      '        type: module',
      '        capability: package.module.test',
      '        method: run',
      '      titleKey: cli.invalid.batch.title',
      '      options:',
      '        - name: batch',
      '          type: textFile',
      '          batch:',
      '            format: json-array'
    ]);
    const invalidBatchMetadata = await runExpectFailure(['package'], workspace);
    assert.match(
      invalidBatchMetadata.stderr,
      /batch\.format 为 json-array 时参数类型必须是 jsonFile/,
      'package should reject batch json-array metadata on textFile parameters'
    );

    await writeAppManifest(workspace, [
      'cli:',
      '  commands:',
      '    - commandPath: completion refresh',
      '      target:',
      '        type: app',
      '      titleKey: cli.reserved.title'
    ]);

    const reservedCommand = await runExpectFailure(['package'], workspace);
    assert.match(
      reservedCommand.stderr,
      /commandPath 不得以 Host 固定命令 .*completion.* 开头/,
      'package should reject plugin CLI commands that shadow fixed Host commands'
    );
    assert.equal(fs.existsSync(packagePath), false, 'reserved CLI command paths must not produce a package');

    await writeAppManifest(workspace, [
      'cli:',
      '  commands:',
      '    - commandPath: package missing-title',
      '      target:',
      '        type: app'
    ]);
    const missingTitleKey = await runExpectFailure(['validate'], workspace);
    assert.match(
      missingTitleKey.stderr,
      /titleKey 必须是非空多语言 key/,
      'validate should reject CLI commands without titleKey'
    );

    await writeModuleManifest(workspace, [
      'cli:',
      '  commands:',
      '    - commandPath: package invalid_segment',
      '      target:',
      '        type: module',
      '        capability: package.module.test',
      '        method: run',
      '      titleKey: cli.invalid.segment.title'
    ]);
    const invalidSegment = await runExpectFailure(['package'], workspace);
    assert.match(
      invalidSegment.stderr,
      /commandPath 只能包含字母、数字和连字符/,
      'package should reject CLI command path segments that Host runtime would reject'
    );

    await writeModuleManifest(workspace, [
      'cli:',
      '  commands:',
      '    - commandPath: package wrong-owner',
      '      target:',
      '        type: module',
      '        pluginId: chips.other.module',
      '        capability: package.module.test',
      '        method: run',
      '      titleKey: cli.wrong.owner.title'
    ]);
    const wrongOwner = await runExpectFailure(['validate'], workspace);
    assert.match(
      wrongOwner.stderr,
      /target\.pluginId 必须与 manifest\.id 一致/,
      'validate should reject CLI targets owned by another plugin'
    );

    console.log('chipsdev-r package compatibility tests completed.');
  } finally {
    await fsp.rm(workspace, { recursive: true, force: true });
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

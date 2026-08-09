import childProcess from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { StoreZipService } from '../../packages/zip-service/src';
import { PluginRuntime } from '../../src/runtime';

let workspace: string;
let runtime: PluginRuntime;

beforeEach(async () => {
  workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'chips-runtime-test-'));
  runtime = new PluginRuntime(workspace, {
    locale: 'zh-CN',
    themeId: 'chips-official.default-theme'
  });
  await runtime.load();
});

afterEach(async () => {
  await fs.rm(workspace, { recursive: true, force: true });
});

const appManifestContract = {
  runtime: {
    targets: {
      desktop: { supported: true },
      web: { supported: false },
      mobile: { supported: false },
      headless: { supported: false }
    }
  },
  ui: {
    surface: {
      defaultKind: 'window',
      preferredKinds: {
        desktop: 'window',
        web: 'route',
        mobile: 'fullscreen',
        headless: 'window'
      }
    }
  }
};

const appRuntimeYamlLines = [
  'runtime:',
  '  targets:',
  '    desktop:',
  '      supported: true',
  '    web:',
  '      supported: false',
  '    mobile:',
  '      supported: false',
  '    headless:',
  '      supported: false'
];

const appSurfaceYamlLines = [
  'ui:',
  '  surface:',
  '    defaultKind: window',
  '    preferredKinds:',
  '      desktop: window',
  '      web: route',
  '      mobile: fullscreen',
  '      headless: window'
];

describe('PluginRuntime', () => {
  it('installs/enables/queries plugins', async () => {
    const manifestPath = path.join(workspace, 'demo.plugin.json');
    await fs.writeFile(
      manifestPath,
      JSON.stringify(
        {
          id: 'chips.demo.plugin',
          version: '1.0.0',
          type: 'app',
          name: 'Demo Plugin',
          permissions: ['file.read'],
          ...appManifestContract
        },
        null,
        2
      )
    );

    const record = await runtime.install(manifestPath);
    expect(record.manifest.id).toBe('chips.demo.plugin');

    await runtime.enable('chips.demo.plugin');
    const queried = runtime.query();
    expect(queried).toHaveLength(1);
    expect(queried[0]?.enabled).toBe(true);
  });

  it('installs plugin from root manifest with dist entry', async () => {
    const projectDir = path.join(workspace, 'root-manifest-project');
    await fs.mkdir(path.join(projectDir, 'dist', 'assets'), { recursive: true });
    const manifestPath = path.join(projectDir, 'manifest.yaml');
    await fs.writeFile(
      manifestPath,
      [
        'id: chips.root.manifest',
        'version: "1.0.0"',
        'type: app',
        'name: Root Manifest Plugin',
        'permissions:',
        '  - file.read',
        'entry: dist/index.html',
        ...appRuntimeYamlLines,
        ...appSurfaceYamlLines
      ].join('\n'),
      'utf-8'
    );
    await fs.writeFile(path.join(projectDir, 'dist', 'index.html'), '<!doctype html>', 'utf-8');
    await fs.writeFile(path.join(projectDir, 'dist', 'assets', 'entry.js'), 'console.log("chips");', 'utf-8');

    const record = await runtime.install(manifestPath);
    expect(record.manifest.id).toBe('chips.root.manifest');
    await expect(fs.access(path.join(record.installPath, 'manifest.yaml'))).resolves.toBeUndefined();
    await expect(fs.access(path.join(record.installPath, 'dist', 'index.html'))).resolves.toBeUndefined();
    await expect(fs.access(path.join(record.installPath, 'dist', 'assets', 'entry.js'))).resolves.toBeUndefined();
  });

  it('keeps launcher icon assets for app plugins and rejects launcher metadata on non-app plugins', async () => {
    const appDir = path.join(workspace, 'launcher-app');
    await fs.mkdir(path.join(appDir, 'dist'), { recursive: true });
    await fs.mkdir(path.join(appDir, 'assets', 'icons'), { recursive: true });
    await fs.writeFile(path.join(appDir, 'dist', 'index.html'), '<!doctype html>', 'utf-8');
    await fs.writeFile(path.join(appDir, 'assets', 'icons', 'app-icon.ico'), 'icon-binary', 'utf-8');
    await fs.writeFile(
      path.join(appDir, 'manifest.yaml'),
      [
        'id: chips.launcher.app',
        'version: "1.0.0"',
        'type: app',
        'name: Launcher App',
        'permissions:',
        '  - file.read',
        'entry: dist/index.html',
        ...appRuntimeYamlLines,
        'ui:',
        '  launcher:',
        '    displayName: Launcher App',
        '    icon: assets/icons/app-icon.ico',
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

    const appRecord = await runtime.install(path.join(appDir, 'manifest.yaml'));
    expect(appRecord.manifest.ui?.launcher).toMatchObject({
      displayName: 'Launcher App',
      icon: 'assets/icons/app-icon.ico'
    });
    await expect(fs.access(path.join(appRecord.installPath, 'assets', 'icons', 'app-icon.ico'))).resolves.toBeUndefined();

    const cardManifestPath = path.join(workspace, 'invalid-launcher.card.json');
    await fs.writeFile(
      cardManifestPath,
      JSON.stringify(
        {
          id: 'chips.invalid.launcher.card',
          version: '1.0.0',
          type: 'card',
          name: 'Invalid Launcher Card',
          permissions: [],
          ui: {
            launcher: {
              displayName: 'Invalid'
            }
          }
        },
        null,
        2
      )
    );

    await expect(runtime.install(cardManifestPath)).rejects.toMatchObject({
      code: 'PLUGIN_INVALID'
    });
  });

  it('creates and completes plugin-init handshake sessions', async () => {
    const manifestPath = path.join(workspace, 'session.plugin.json');
    await fs.writeFile(
      manifestPath,
      JSON.stringify(
        {
          id: 'chips.session.plugin',
          version: '1.0.0',
          type: 'app',
          name: 'Session Plugin',
          permissions: ['file.read'],
          ...appManifestContract
        },
        null,
        2
      )
    );

    await runtime.install(manifestPath);
    await runtime.enable('chips.session.plugin');

    const session = runtime.pluginInit('chips.session.plugin', { entry: 'viewer' });
    expect(session.status).toBe('handshaking');

    const completed = runtime.completeHandshake(session.sessionId, session.sessionNonce);
    expect(completed.status).toBe('running');
  });

  it('enforces permissions and quotas', async () => {
    const manifestPath = path.join(workspace, 'perm.plugin.json');
    await fs.writeFile(
      manifestPath,
      JSON.stringify(
        {
          id: 'chips.perm.plugin',
          version: '1.0.0',
          type: 'app',
          name: 'Permission Plugin',
          permissions: ['file.read'],
          ...appManifestContract
        },
        null,
        2
      )
    );

    await runtime.install(manifestPath);
    let permissionError: unknown;
    try {
      runtime.ensurePermission('chips.perm.plugin', 'file.write');
    } catch (error) {
      permissionError = error;
    }
    expect(permissionError).toMatchObject({
      code: 'PERMISSION_DENIED',
      messageKey: 'chips.error.permissionDenied',
      permission: expect.objectContaining({
        required: ['file.write'],
        granted: ['file.read'],
        pluginId: 'chips.perm.plugin'
      })
    });

    const quota = runtime.setQuota('chips.perm.plugin', {
      cpuBudget: 40,
      memoryBudgetMb: 256
    });
    expect(quota.cpuBudget).toBe(40);
    expect(runtime.getQuota('chips.perm.plugin').memoryBudgetMb).toBe(256);
  });

  it('installs .cpk package with manifest.yaml', async () => {
    const packageDir = path.join(workspace, 'cpk-source');
    await fs.mkdir(path.join(packageDir, 'dist'), { recursive: true });
    await fs.writeFile(
      path.join(packageDir, 'manifest.yaml'),
      [
        'id: chips.cpk.plugin',
        'version: "1.0.0"',
        'type: app',
        'name: CPK Plugin',
        'permissions:',
        '  - file.read',
        'capabilities:',
        '  - preview',
        'entry: dist/main.js',
        ...appRuntimeYamlLines,
        ...appSurfaceYamlLines
      ].join('\n'),
      'utf-8'
    );
    await fs.writeFile(path.join(packageDir, 'dist/main.js'), 'module.exports = {};', 'utf-8');

    const cpkPath = path.join(workspace, 'chips.cpk.plugin.cpk');
    const zip = new StoreZipService();
    await zip.compress(packageDir, cpkPath);

    const record = await runtime.install(cpkPath);
    expect(record.manifest.id).toBe('chips.cpk.plugin');
    expect(record.manifest.permissions).toEqual(['file.read']);
    expect(record.manifest.capabilities).toEqual(['preview']);
    expect(record.manifestPath.endsWith('manifest.yaml')).toBe(true);
    await expect(fs.access(path.join(record.installPath, 'dist/main.js'))).resolves.toBeUndefined();
  });

  it('parses app plugin cli.commands declarations', async () => {
    const appDir = path.join(workspace, 'cli-app');
    await fs.mkdir(path.join(appDir, 'dist'), { recursive: true });
    await fs.writeFile(path.join(appDir, 'dist/index.html'), '<!doctype html>', 'utf-8');
    await fs.writeFile(
      path.join(appDir, 'manifest.yaml'),
      [
        'id: chips.cli.app',
        'version: "1.0.0"',
        'type: app',
        'name: CLI App',
        'permissions:',
        '  - file.read',
        '  - command.invoke',
        'entry: dist/index.html',
        ...appRuntimeYamlLines,
        ...appSurfaceYamlLines,
        'cli:',
        '  commands:',
        '    - commandPath: editor open',
        '      target:',
        '        type: app',
        '        pluginId: chips.cli.app',
        '        commandId: chips.cli.app.open',
        '        surface:',
        '          open: true',
        '          focus: true',
        '          reuse: preferred',
        '      titleKey: cli.app.open.title',
        '      descriptionKey: cli.app.open.description',
        '      permissions:',
        '        - file.read',
        '      arguments:',
        '        - name: path',
        '          position: 0',
        '          type: path',
        '          required: true',
        '          mapsTo: path',
        '          path:',
        '            kind: file',
        '            exists: true',
        '      options:',
        '        - name: readonly',
        '          short: r',
        '          type: boolean',
        '          mapsTo: readonly',
        '      output:',
        '        mode: human'
      ].join('\n'),
      'utf-8'
    );

    const record = await runtime.install(path.join(appDir, 'manifest.yaml'));

    expect(record.manifest.cli?.commands).toHaveLength(1);
    expect(record.manifest.cli?.commands[0]).toMatchObject({
      commandId: 'chips.cli.app.cli.editor.open',
      commandPath: ['editor', 'open'],
      target: {
        type: 'app',
        pluginId: 'chips.cli.app',
        commandId: 'chips.cli.app.open',
        surface: {
          open: true,
          focus: true,
          reuse: 'preferred'
        }
      },
      titleKey: 'cli.app.open.title',
      permissions: ['file.read'],
      arguments: [
        expect.objectContaining({
          name: 'path',
          position: 0,
          type: 'path',
          mapsTo: 'path',
          path: {
            kind: 'file',
            exists: true
          }
        })
      ],
      options: [
        expect.objectContaining({
          name: 'readonly',
          short: 'r',
          type: 'boolean',
          mapsTo: 'readonly'
        })
      ],
      output: {
        mode: 'human'
      }
    });
  });

  it('parses module plugin cli.commands declarations', async () => {
    const moduleDir = path.join(workspace, 'cli-module');
    await fs.mkdir(path.join(moduleDir, 'dist'), { recursive: true });
    await fs.mkdir(path.join(moduleDir, 'contracts'), { recursive: true });
    await fs.writeFile(path.join(moduleDir, 'dist/index.cjs'), 'exports.providers = [];', 'utf-8');
    await fs.writeFile(path.join(moduleDir, 'contracts/generate.input.schema.json'), '{"type":"object"}', 'utf-8');
    await fs.writeFile(path.join(moduleDir, 'contracts/generate.output.schema.json'), '{"type":"object"}', 'utf-8');
    await fs.writeFile(
      path.join(moduleDir, 'manifest.yaml'),
      [
        'id: chips.cli.module',
        'version: "1.0.0"',
        'type: module',
        'name: CLI Module',
        'permissions:',
        '  - file.read',
        '  - file.write',
        'entry: dist/index.cjs',
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
        '    - capability: converter.icon.generate',
        '      version: "1.0.0"',
        '      methods:',
        '        - name: generate',
        '          mode: job',
        '          inputSchema: contracts/generate.input.schema.json',
        '          outputSchema: contracts/generate.output.schema.json',
        '  consumes: []',
        'cli:',
        '  commands:',
        '    - commandPath: icon generate',
        '      target:',
        '        type: module',
        '        capability: converter.icon.generate',
        '        method: generate',
        '        timeoutMs: 60000',
        '      titleKey: cli.icon.generate.title',
        '      permissions:',
        '        - file.read',
        '        - file.write',
      '      arguments:',
      '        - name: input',
      '          position: 0',
      '          type: path',
      '          required: true',
      '          mapsTo: inputPath',
      '      options:',
      '        - name: output',
      '          short: o',
      '          type: path',
      '          mapsTo: outputPath',
      '          path:',
      '            kind: file',
      '            role: output',
      '            create: true',
      '            overwrite: rename',
      '        - name: batch',
      '          type: textFile',
      '          mapsTo: items',
      '          path:',
      '            kind: file',
      '            exists: true',
      '          batch:',
      '            format: lines',
      '            itemType: path',
      '            itemPath:',
      '              kind: file',
      '              exists: true',
      '        - name: formats',
      '          short: f',
      '          type: stringList',
        '          default: [png, ico]',
        '          mapsTo: formats',
        '          ui:',
        '            control: multiSelect',
        '            choices: [png, ico, icns]',
        '      output:',
        '        mode: human',
        '        json: supported',
        '      job:',
        '        wait: true',
        '        cancelOnInterrupt: true'
      ].join('\n'),
      'utf-8'
    );

    const record = await runtime.install(path.join(moduleDir, 'manifest.yaml'));

    expect(record.manifest.cli?.commands[0]).toMatchObject({
      commandId: 'chips.cli.module.cli.icon.generate',
      commandPath: ['icon', 'generate'],
      target: {
        type: 'module',
        capability: 'converter.icon.generate',
        method: 'generate',
        timeoutMs: 60000
      },
      permissions: ['file.read', 'file.write'],
      options: [
        expect.objectContaining({
          name: 'output',
          type: 'path',
          path: {
            kind: 'file',
            role: 'output',
            create: true,
            overwrite: 'rename'
          }
        }),
        expect.objectContaining({
          name: 'batch',
          type: 'textFile',
          mapsTo: 'items',
          path: {
            kind: 'file',
            exists: true
          },
          batch: {
            format: 'lines',
            itemType: 'path',
            itemPath: {
              kind: 'file',
              exists: true
            }
          }
        }),
        expect.objectContaining({
          name: 'formats',
          type: 'stringList',
          default: ['png', 'ico'],
          ui: {
            control: 'multiSelect',
            choices: ['png', 'ico', 'icns']
          }
        })
      ],
      output: {
        mode: 'human',
        json: 'supported'
      },
      job: {
        wait: true,
        cancelOnInterrupt: true
      }
    });
  });

  it('rejects invalid cli output path and batch metadata', async () => {
    const invalidManifestPath = path.join(workspace, 'invalid-cli-path-batch.json');
    await fs.writeFile(
      invalidManifestPath,
      JSON.stringify(
        {
          id: 'chips.invalid.cli.path.batch',
          version: '1.0.0',
          type: 'module',
          name: 'Invalid CLI Path Batch',
          permissions: [],
          entry: 'dist/index.cjs',
          runtime: {
            targets: {
              desktop: { supported: true },
              web: { supported: false },
              mobile: { supported: false },
              headless: { supported: true }
            }
          },
          module: {
            apiVersion: 1,
            runtime: 'worker',
            activation: 'onDemand',
            provides: [
              {
                capability: 'invalid.cli.path.batch',
                version: '1.0.0',
                methods: [
                  {
                    name: 'run',
                    mode: 'sync',
                    inputSchema: 'contracts/run.input.schema.json',
                    outputSchema: 'contracts/run.output.schema.json'
                  }
                ]
              }
            ],
            consumes: []
          },
          cli: {
            commands: [
              {
                commandPath: 'invalid batch',
                target: {
                  type: 'module',
                  capability: 'invalid.cli.path.batch',
                  method: 'run'
                },
                titleKey: 'invalid.batch.title',
                options: [
                  {
                    name: 'output',
                    type: 'textFile',
                    path: {
                      role: 'output',
                      overwrite: 'fail'
                    }
                  }
                ]
              }
            ]
          }
        },
        null,
        2
      ),
      'utf-8'
    );

    await fs.mkdir(path.join(workspace, 'dist'), { recursive: true });
    await fs.mkdir(path.join(workspace, 'contracts'), { recursive: true });
    await fs.writeFile(path.join(workspace, 'dist/index.cjs'), 'exports.providers = [];', 'utf-8');
    await fs.writeFile(path.join(workspace, 'contracts/run.input.schema.json'), '{"type":"object"}', 'utf-8');
    await fs.writeFile(path.join(workspace, 'contracts/run.output.schema.json'), '{"type":"object"}', 'utf-8');

    await expect(runtime.install(invalidManifestPath)).rejects.toMatchObject({
      code: 'PLUGIN_INVALID',
      details: expect.objectContaining({
        field: 'cli.commands[0].options[0].path.role'
      })
    });
  });

  it('rejects cli.commands on non app/module plugins and undeclared command permissions', async () => {
    const invalidCardManifestPath = path.join(workspace, 'invalid-cli-card.json');
    await fs.writeFile(
      invalidCardManifestPath,
      JSON.stringify(
        {
          id: 'chips.invalid.cli.card',
          version: '1.0.0',
          type: 'card',
          name: 'Invalid CLI Card',
          permissions: [],
          cli: {
            commands: [
              {
                commandPath: 'card run',
                target: {
                  type: 'module',
                  capability: 'card.run',
                  method: 'run'
                },
                titleKey: 'card.run.title'
              }
            ]
          }
        },
        null,
        2
      )
    );
    await expect(runtime.install(invalidCardManifestPath)).rejects.toMatchObject({
      code: 'PLUGIN_INVALID'
    });

    const invalidAppManifestPath = path.join(workspace, 'invalid-cli-permission.json');
    await fs.writeFile(
      invalidAppManifestPath,
      JSON.stringify(
        {
          id: 'chips.invalid.cli.permission',
          version: '1.0.0',
          type: 'app',
          name: 'Invalid CLI Permission',
          permissions: ['file.read'],
          ...appManifestContract,
          cli: {
            commands: [
              {
                commandPath: 'editor export',
                target: {
                  type: 'app',
                  pluginId: 'chips.invalid.cli.permission'
                },
                titleKey: 'editor.export.title',
                permissions: ['file.write']
              }
            ]
          }
        },
        null,
        2
      )
    );
    await expect(runtime.install(invalidAppManifestPath)).rejects.toMatchObject({
      code: 'PLUGIN_INVALID'
    });
  });

  it('rejects plugin cli.commands that shadow Host fixed commands', async () => {
    const invalidManifestPath = path.join(workspace, 'invalid-reserved-cli.json');
    await fs.writeFile(
      invalidManifestPath,
      JSON.stringify(
        {
          id: 'chips.invalid.reserved.cli',
          version: '1.0.0',
          type: 'app',
          name: 'Invalid Reserved CLI',
          permissions: [],
          ...appManifestContract,
          cli: {
            commands: [
              {
                commandPath: 'completion refresh',
                target: {
                  type: 'app'
                },
                titleKey: 'completion.refresh.title'
              }
            ]
          }
        },
        null,
        2
      )
    );

    await expect(runtime.install(invalidManifestPath)).rejects.toMatchObject({
      code: 'PLUGIN_INVALID',
      details: expect.objectContaining({
        reservedRoot: 'completion'
      })
    });
  });

  it('rejects type-exclusive official fields and reserved plugin governance metadata', async () => {
    const invalidAppManifestPath = path.join(workspace, 'invalid-official-fields-app.json');
    await fs.writeFile(
      invalidAppManifestPath,
      JSON.stringify(
        {
          id: 'chips.invalid.official.app',
          version: '1.0.0',
          type: 'app',
          name: 'Invalid Official App',
          permissions: [],
          ...appManifestContract,
          module: {
            apiVersion: 1,
            runtime: 'worker',
            activation: 'onDemand',
            provides: []
          }
        },
        null,
        2
      )
    );

    await expect(runtime.install(invalidAppManifestPath)).rejects.toMatchObject({
      code: 'PLUGIN_INVALID',
      details: expect.objectContaining({
        field: 'module',
        ownerType: 'module',
        type: 'app'
      })
    });

    const invalidAppThemeManifestPath = path.join(workspace, 'invalid-official-fields-app-theme.json');
    await fs.writeFile(
      invalidAppThemeManifestPath,
      JSON.stringify(
        {
          id: 'chips.invalid.official.app.theme',
          version: '1.0.0',
          type: 'app',
          name: 'Invalid Official App Theme',
          permissions: [],
          ...appManifestContract,
          theme: {
            themeId: 'chips.invalid.theme'
          }
        },
        null,
        2
      )
    );

    await expect(runtime.install(invalidAppThemeManifestPath)).rejects.toMatchObject({
      code: 'PLUGIN_INVALID',
      details: expect.objectContaining({
        field: 'theme',
        ownerType: 'theme',
        type: 'app'
      })
    });

    const invalidModuleDir = path.join(workspace, 'invalid-official-fields-module');
    await fs.mkdir(path.join(invalidModuleDir, 'dist'), { recursive: true });
    await fs.mkdir(path.join(invalidModuleDir, 'contracts'), { recursive: true });
    await fs.writeFile(path.join(invalidModuleDir, 'dist/index.cjs'), 'exports.providers = [];', 'utf-8');
    await fs.writeFile(path.join(invalidModuleDir, 'contracts/run.input.schema.json'), '{"type":"object"}', 'utf-8');
    await fs.writeFile(path.join(invalidModuleDir, 'contracts/run.output.schema.json'), '{"type":"object"}', 'utf-8');
    await fs.writeFile(
      path.join(invalidModuleDir, 'manifest.yaml'),
      [
        'id: chips.invalid.official.module',
        'version: "1.0.0"',
        'type: module',
        'name: Invalid Official Module',
        'permissions: []',
        'entry: dist/index.cjs',
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
        'theme:',
        '  themeId: chips.invalid.theme',
        'themeId: chips.invalid.theme',
        'module:',
        '  apiVersion: 1',
        '  runtime: worker',
        '  activation: onDemand',
        '  provides:',
        '    - capability: invalid.official.module',
        '      version: "1.0.0"',
        '      methods:',
        '        - name: run',
        '          mode: sync',
        '          inputSchema: contracts/run.input.schema.json',
        '          outputSchema: contracts/run.output.schema.json',
        '  consumes: []'
      ].join('\n'),
      'utf-8'
    );

    await expect(runtime.install(path.join(invalidModuleDir, 'manifest.yaml'))).rejects.toMatchObject({
      code: 'PLUGIN_INVALID',
      details: expect.objectContaining({
        field: 'theme',
        ownerType: 'theme',
        type: 'module'
      })
    });

    await fs.writeFile(
      path.join(invalidModuleDir, 'manifest.yaml'),
      [
        'id: chips.invalid.reserved.module',
        'version: "1.0.0"',
        'type: module',
        'name: Invalid Reserved Module',
        'permissions: []',
        'entry: dist/index.cjs',
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
        'plugin:',
        '  id: chips.reserved',
        'module:',
        '  apiVersion: 1',
        '  runtime: worker',
        '  activation: onDemand',
        '  provides:',
        '    - capability: invalid.reserved.module',
        '      version: "1.0.0"',
        '      methods:',
        '        - name: run',
        '          mode: sync',
        '          inputSchema: contracts/run.input.schema.json',
        '          outputSchema: contracts/run.output.schema.json',
        '  consumes: []'
      ].join('\n'),
      'utf-8'
    );

    await expect(runtime.install(path.join(invalidModuleDir, 'manifest.yaml'))).rejects.toMatchObject({
      code: 'PLUGIN_INVALID',
      details: expect.objectContaining({
        field: 'plugin',
        type: 'module'
      })
    });
  });

  it('installs .cpk package generated by chipsdev-r package', async () => {
    const projectDir = path.join(workspace, 'chipsdev-package-source');
    const sdkCliPath = path.resolve(__dirname, '../../../Chips-SDK/cli/index.js');

    await fs.mkdir(path.join(projectDir, 'dist'), { recursive: true });
    await fs.writeFile(
      path.join(projectDir, 'chips.config.mjs'),
      ['export default {', "  type: 'app',", "  outDir: 'dist'", '};'].join('\n'),
      'utf-8'
    );
    await fs.writeFile(
      path.join(projectDir, 'manifest.yaml'),
      [
        'id: chips.sdk.generated',
        'version: "1.0.0"',
        'type: app',
        'name: SDK Generated Plugin',
        'permissions:',
        '  - file.read',
        'entry: dist/main.js',
        ...appRuntimeYamlLines,
        ...appSurfaceYamlLines
      ].join('\n'),
      'utf-8'
    );
    await fs.writeFile(path.join(projectDir, 'dist', 'main.js'), 'module.exports = {};', 'utf-8');

    await new Promise<void>((resolve, reject) => {
      const child = childProcess.spawn('node', [sdkCliPath, 'package'], {
        cwd: projectDir,
        stdio: 'pipe',
        env: process.env
      });
      let stderr = '';

      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });
      child.on('error', reject);
      child.on('exit', (code) => {
        if (code === 0) {
          resolve();
          return;
        }
        reject(new Error(stderr || `chipsdev-r package exited with code ${code}`));
      });
    });

    const cpkPath = path.join(projectDir, 'dist', 'chips.sdk.generated-1.0.0.cpk');
    const record = await runtime.install(cpkPath);
    expect(record.manifest.id).toBe('chips.sdk.generated');
    await expect(fs.access(path.join(record.installPath, 'dist/main.js'))).resolves.toBeUndefined();
  }, 15_000);

  it('replaces an existing installed plugin with the same id', async () => {
    const v1Dir = path.join(workspace, 'replaceable-plugin-v1');
    const v2Dir = path.join(workspace, 'replaceable-plugin-v2');
    await fs.mkdir(path.join(v1Dir, 'dist'), { recursive: true });
    await fs.mkdir(path.join(v2Dir, 'dist'), { recursive: true });

    const manifestText = [
      'id: chips.replaceable.plugin',
      'version: "1.0.0"',
      'type: app',
      'name: Replaceable Plugin',
      'permissions:',
      '  - file.read',
      'entry: dist/index.html',
      ...appRuntimeYamlLines,
      ...appSurfaceYamlLines
    ].join('\n');

    await fs.writeFile(path.join(v1Dir, 'manifest.yaml'), manifestText, 'utf-8');
    await fs.writeFile(path.join(v1Dir, 'dist', 'index.html'), '<!doctype html><title>v1</title>', 'utf-8');
    await fs.writeFile(path.join(v1Dir, 'dist', 'legacy.js'), 'console.log("legacy");', 'utf-8');

    const firstInstall = await runtime.install(path.join(v1Dir, 'manifest.yaml'));
    await runtime.enable('chips.replaceable.plugin');

    await fs.writeFile(path.join(v2Dir, 'manifest.yaml'), manifestText, 'utf-8');
    await fs.writeFile(path.join(v2Dir, 'dist', 'index.html'), '<!doctype html><title>v2</title>', 'utf-8');
    await fs.writeFile(path.join(v2Dir, 'dist', 'fresh.js'), 'console.log("fresh");', 'utf-8');

    const secondInstall = await runtime.install(path.join(v2Dir, 'manifest.yaml'));
    expect(secondInstall.installPath).toBe(firstInstall.installPath);
    expect(runtime.get('chips.replaceable.plugin').enabled).toBe(true);

    await expect(fs.access(path.join(secondInstall.installPath, 'dist', 'fresh.js'))).resolves.toBeUndefined();
    await expect(fs.access(path.join(secondInstall.installPath, 'dist', 'legacy.js'))).rejects.toBeDefined();
  });

  it('normalizes theme plugin governance metadata during install', async () => {
    const record = await runtime.install(path.resolve(process.cwd(), '../ThemePack/Chips-default/manifest.yaml'));
    expect(record.manifest.theme).toMatchObject({
      themeId: 'chips-official.default-theme',
      displayName: '薯片官方 · 默认主题',
      isDefault: true,
      tokensPath: 'dist/tokens.json',
      themeCssPath: 'dist/theme.css'
    });
  });

  it('requires signature for non-local plugin source', async () => {
    const manifestPath = path.join(workspace, 'signed.plugin.json');
    await fs.writeFile(
      manifestPath,
      JSON.stringify(
        {
          id: 'chips.signed.plugin',
          version: '1.0.0',
          type: 'app',
          name: 'Signed Plugin',
          permissions: ['file.read'],
          source: 'official',
          ...appManifestContract
        },
        null,
        2
      )
    );

    await expect(runtime.install(manifestPath)).rejects.toMatchObject({
      code: 'PLUGIN_SIGNATURE_INVALID'
    });
  });
});

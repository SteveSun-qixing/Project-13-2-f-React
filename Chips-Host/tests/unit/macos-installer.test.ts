import childProcess from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createMacPkgInstaller,
  prepareMacHostAppBundle,
  stripInstallerBundleRelocationMetadata
} from '../../src/main/installer/macos-installer';

let workspaceRoot: string;
let hostProjectDir: string;
let outputDir: string;
let electronAppPath: string;
let yamlPackageDir: string;
let jsdomPackageDir: string;
let esbuildPackageDir: string;
let cssstylePackageDir: string;
let toughCookiePackageDir: string;
let dateNowSpy: ReturnType<typeof vi.spyOn>;
const execFile = promisify(childProcess.execFile);

const write = async (targetPath: string, value: string): Promise<void> => {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, value, 'utf-8');
};

const collectInstallerMetadataEntries = async (rootPath: string): Promise<string[]> => {
  const entries = await fs.readdir(rootPath, { withFileTypes: true });
  const found: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(rootPath, entry.name);
    if (entry.name.startsWith('._') || entry.name === '.DS_Store' || entry.name === 'CodeResources') {
      found.push(path.relative(rootPath, entryPath));
      continue;
    }

    if (entry.isDirectory()) {
      const nested = await collectInstallerMetadataEntries(entryPath);
      found.push(...nested.map((item) => path.join(entry.name, item)));
    }
  }

  return found.sort();
};

beforeEach(async () => {
  dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(0);
  workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'chips-installer-workspace-'));
  hostProjectDir = path.join(workspaceRoot, 'Chips-Host');
  outputDir = path.join(workspaceRoot, 'release');
  electronAppPath = path.join(workspaceRoot, 'Electron.app');
  yamlPackageDir = path.join(workspaceRoot, 'node_modules', 'yaml');
  jsdomPackageDir = path.join(workspaceRoot, 'node_modules', 'jsdom');
  esbuildPackageDir = path.join(workspaceRoot, 'node_modules', 'esbuild');
  cssstylePackageDir = path.join(workspaceRoot, 'node_modules', 'cssstyle');
  toughCookiePackageDir = path.join(workspaceRoot, 'node_modules', 'tough-cookie');

  await write(
    path.join(hostProjectDir, 'package.json'),
    JSON.stringify(
      {
        name: 'chips-host',
        version: '0.1.0',
        dependencies: {
          esbuild: '^0.27.3',
          jsdom: '^28.1.0',
          yaml: '^2.8.2'
        }
      },
      null,
      2
    )
  );
  await write(
    path.join(hostProjectDir, 'dist', 'src', 'main', 'electron', 'app-entry.js'),
    'module.exports = {};\n'
  );
  await write(path.join(hostProjectDir, 'dist', 'tests', 'unit', 'installer.test.js'), 'module.exports = {};\n');

  await write(path.join(electronAppPath, 'Contents', 'MacOS', 'Electron'), '#!/bin/sh\nexit 0\n');
  await write(path.join(electronAppPath, 'Contents', 'Info.plist'), '<plist version="1.0"></plist>\n');
  await write(path.join(electronAppPath, 'Contents', 'Resources', '._electron.icns'), 'sidecar');
  await write(path.join(yamlPackageDir, 'package.json'), JSON.stringify({ name: 'yaml', version: '2.0.0' }, null, 2));
  await write(path.join(yamlPackageDir, 'index.js'), 'module.exports = {};\n');
  await write(
    path.join(esbuildPackageDir, 'package.json'),
    JSON.stringify(
      {
        name: 'esbuild',
        version: '0.27.3',
        main: './lib/main.js',
        optionalDependencies: {
          '@esbuild/darwin-arm64': '0.27.3'
        }
      },
      null,
      2
    )
  );
  await write(path.join(esbuildPackageDir, 'lib', 'main.js'), 'exports.version = "0.27.3"; exports.build = async () => ({ outputFiles: [{ text: "ok" }] });\n');
  await write(
    path.join(workspaceRoot, 'node_modules', '@esbuild', 'darwin-arm64', 'package.json'),
    JSON.stringify({ name: '@esbuild/darwin-arm64', version: '0.27.3' }, null, 2)
  );
  await write(path.join(workspaceRoot, 'node_modules', '@esbuild', 'darwin-arm64', 'bin', 'esbuild'), '');
  await write(
    path.join(jsdomPackageDir, 'package.json'),
    JSON.stringify(
      {
        name: 'jsdom',
        version: '28.1.0',
        dependencies: {
          cssstyle: '^6.0.1',
          'tough-cookie': '^6.0.0'
        }
      },
      null,
      2
    )
  );
  await write(path.join(jsdomPackageDir, 'lib', 'api.js'), 'module.exports = {};\n');
  await write(path.join(cssstylePackageDir, 'package.json'), JSON.stringify({ name: 'cssstyle', version: '6.0.1' }, null, 2));
  await write(path.join(cssstylePackageDir, 'lib', 'index.js'), 'module.exports = {};\n');
  await write(
    path.join(toughCookiePackageDir, 'package.json'),
    JSON.stringify(
      {
        name: 'tough-cookie',
        version: '6.0.0',
        main: './dist/index.js',
        exports: './dist/index.js'
      },
      null,
      2
    )
  );
  await write(path.join(toughCookiePackageDir, 'dist', 'index.js'), 'module.exports = {};\n');

  await write(
    path.join(workspaceRoot, 'Chips-EcoSettingsPanel', 'manifest.yaml'),
    [
      'id: "com.chips.eco-settings-panel"',
      'name: "Settings Panel"',
      'version: "1.0.0"',
      'type: "app"',
      'permissions:',
      '  - "plugin.read"',
      'entry: dist/index.html',
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
      'ui:',
      '  launcher:',
      '    displayName: Settings Panel',
      '    icon: assets/icons/app-icon.ico',
      '  surface:',
      '    defaultKind: window',
      '    preferredKinds:',
      '      desktop: window',
      '      web: route',
      '      mobile: fullscreen',
      '      headless: window'
    ].join('\n')
  );
  await write(path.join(workspaceRoot, 'Chips-EcoSettingsPanel', 'dist', 'index.html'), '<!doctype html>\n');
  await write(path.join(workspaceRoot, 'Chips-EcoSettingsPanel', 'assets', 'icons', 'app-icon.ico'), 'icon');

  await write(
    path.join(workspaceRoot, 'Chips-PhotoViewer', 'manifest.yaml'),
    [
      'id: "com.chips.photo-viewer"',
      'name: "图片查看器"',
      'version: "0.1.0"',
      'type: "app"',
      'permissions:',
      '  - "platform.read"',
      '  - "file.read"',
      '  - "file.write"',
      'entry: dist/index.html',
      'capabilities:',
      '  - "file-handler:.png"',
      '  - "file-handler:.jpg"',
      '  - "file-handler:.jpeg"',
      '  - "file-handler:.webp"',
      '  - "file-handler:.gif"',
      '  - "file-handler:.bmp"',
      '  - "file-handler:.svg"',
      '  - "file-handler:.avif"',
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
      'ui:',
      '  launcher:',
      '    displayName: 图片查看器',
      '    icon: assets/icons/app-icon.ico',
      '  surface:',
      '    defaultKind: window',
      '    preferredKinds:',
      '      desktop: window',
      '      web: route',
      '      mobile: fullscreen',
      '      headless: window'
    ].join('\n')
  );
  await write(path.join(workspaceRoot, 'Chips-PhotoViewer', 'dist', 'index.html'), '<!doctype html>\n');
  await write(path.join(workspaceRoot, 'Chips-PhotoViewer', 'assets', 'icons', 'app-icon.ico'), 'icon');

  await write(
    path.join(workspaceRoot, '归档', 'ThemePack', 'Chips-default', 'manifest.yaml'),
    [
      'schemaVersion: "1.0.0"',
      'id: "theme.theme.chips-official-default-theme"',
      'name: "Default Theme"',
      'version: "1.0.0"',
      'type: "theme"',
      'publisher: "chips"',
      'permissions:',
      '  - "theme.read"',
      'entry:',
      '  tokens: "dist/tokens.json"',
      '  themeCss: "dist/theme.css"',
      'themeId: "chips-official.default-theme"',
      'displayName: "Default Theme"',
      'isDefault: true',
      'parentTheme: ""',
      'ui:',
      '  layout:',
      '    owner: page',
      '    unit: cpx',
      '    baseWidth: 1024',
      '    contract: contracts/theme-interface.contract.json',
      '    minFunctionalSet: contracts/theme-min-functional-set.json'
    ].join('\n')
  );
  await write(path.join(workspaceRoot, '归档', 'ThemePack', 'Chips-default', 'dist', 'tokens.json'), '{}');
  await write(path.join(workspaceRoot, '归档', 'ThemePack', 'Chips-default', 'dist', 'theme.css'), ':root {}\n');
  await write(path.join(workspaceRoot, '归档', 'ThemePack', 'Chips-default', 'contracts', 'theme-interface.contract.json'), '{}');
  await write(path.join(workspaceRoot, '归档', 'ThemePack', 'Chips-default', 'contracts', 'theme-min-functional-set.json'), '{}');
});

afterEach(async () => {
  dateNowSpy.mockRestore();
  await fs.rm(workspaceRoot, { recursive: true, force: true });
});

describe('macOS installer builder', () => {
  it('strips bundle relocation metadata from installer xml files', () => {
    const source = [
      '<pkg-info>',
      '  <bundle id="local.chips.host" path="./Applications/Chips.app"/>',
      '  <bundle-version>',
      '    <bundle id="local.chips.host"/>',
      '  </bundle-version>',
      '  <upgrade-bundle>',
      '    <bundle id="local.chips.host"/>',
      '  </upgrade-bundle>',
      '  <update-bundle/>',
      '  <atomic-update-bundle/>',
      '  <strict-identifier>',
      '    <bundle id="local.chips.host"/>',
      '  </strict-identifier>',
      '  <relocate>',
      '    <bundle id="local.chips.host"/>',
      '  </relocate>',
      '</pkg-info>',
      ''
    ].join('\n');

    const sanitized = stripInstallerBundleRelocationMetadata(source);

    expect(sanitized).not.toContain('<bundle-version>');
    expect(sanitized).not.toContain('<bundle id="local.chips.host"');
    expect(sanitized).not.toContain('<upgrade-bundle>');
    expect(sanitized).not.toContain('<update-bundle/>');
    expect(sanitized).not.toContain('<atomic-update-bundle/>');
    expect(sanitized).not.toContain('<strict-identifier>');
    expect(sanitized).not.toContain('<relocate>');
  });

  it('stages host runtime, built-in plugins, and card file association into Chips.app', async () => {
    const result = await prepareMacHostAppBundle({
      hostProjectDir,
      workspaceRoot,
      outputDir,
      electronAppPath,
      yamlPackageDir,
      runtimeDependencyPackageDirs: {
        cssstyle: cssstylePackageDir,
        esbuild: esbuildPackageDir,
        jsdom: jsdomPackageDir
      }
    });

    await expect(fs.access(path.join(result.appBundlePath, 'Contents', 'MacOS', 'Chips'))).resolves.toBeUndefined();
    await expect(
      fs.access(path.join(result.appBundlePath, 'Contents', 'Resources', 'app', 'dist', 'src', 'main', 'electron', 'app-entry.js'))
    ).resolves.toBeUndefined();
    await expect(
      fs.access(path.join(result.appBundlePath, 'Contents', 'Resources', 'app', 'dist', 'tests'))
    ).rejects.toThrow();
    await expect(
      fs.access(
        path.join(
          result.builtInPluginRoot,
          'com.chips.eco-settings-panel',
          'assets',
          'icons',
          'app-icon.ico'
        )
      )
    ).resolves.toBeUndefined();
    await expect(
      fs.access(
        path.join(
          result.builtInPluginRoot,
          'com.chips.photo-viewer',
          'assets',
          'icons',
          'app-icon.ico'
        )
      )
    ).resolves.toBeUndefined();
    await expect(
      fs.access(path.join(result.builtInPluginRoot, 'theme.theme.chips-official-default-theme'))
    ).rejects.toThrow();
    await expect(
      fs.access(path.join(result.appBundlePath, 'Contents', 'Resources', 'app', 'node_modules', 'jsdom', 'lib', 'api.js'))
    ).resolves.toBeUndefined();
    await expect(
      fs.access(
        path.join(result.appBundlePath, 'Contents', 'Resources', 'app', 'node_modules', 'cssstyle', 'lib', 'index.js')
      )
    ).resolves.toBeUndefined();
    await expect(
      fs.access(
        path.join(result.appBundlePath, 'Contents', 'Resources', 'app', 'node_modules', 'tough-cookie', 'dist', 'index.js')
      )
    ).resolves.toBeUndefined();
    await expect(
      fs.access(
        path.join(result.appBundlePath, 'Contents', 'Resources', 'app', 'node_modules', 'esbuild', 'lib', 'main.js')
      )
    ).resolves.toBeUndefined();
    await expect(
      fs.access(
        path.join(
          result.appBundlePath,
          'Contents',
          'Resources',
          'app',
          'node_modules',
          '@esbuild',
          'darwin-arm64',
          'bin',
          'esbuild'
        )
      )
    ).resolves.toBeUndefined();

    const packagedManifest = JSON.parse(
      await fs.readFile(path.join(result.appBundlePath, 'Contents', 'Resources', 'app', 'package.json'), 'utf-8')
    ) as { dependencies?: Record<string, string> };
    expect(packagedManifest.dependencies).toEqual({
      esbuild: '^0.27.3',
      jsdom: '^28.1.0',
      yaml: '^2.8.2'
    });

    const infoPlist = await fs.readFile(path.join(result.appBundlePath, 'Contents', 'Info.plist'), 'utf-8');
    expect(infoPlist).toContain('application/x-card');
    expect(infoPlist).toContain('<string>card</string>');
    expect(infoPlist).toContain('image/png');
    expect(infoPlist).toContain('<string>png</string>');
    await expect(fs.access(path.join(result.appBundlePath, 'Contents', 'Resources', '._electron.icns'))).rejects.toThrow();
  });

  it('does not register image document types when the built-in photo viewer bundle is absent', async () => {
    const result = await prepareMacHostAppBundle({
      hostProjectDir,
      workspaceRoot,
      outputDir,
      electronAppPath,
      yamlPackageDir,
      runtimeDependencyPackageDirs: {
        cssstyle: cssstylePackageDir,
        esbuild: esbuildPackageDir,
        jsdom: jsdomPackageDir
      },
      builtInPluginBundles: [
        {
          id: 'theme.theme.chips-official-default-theme',
          sourceDir: path.join(workspaceRoot, '归档', 'ThemePack', 'Chips-default'),
          includePaths: ['manifest.yaml', 'dist', 'contracts']
        },
        {
          id: 'com.chips.eco-settings-panel',
          sourceDir: path.join(workspaceRoot, 'Chips-EcoSettingsPanel'),
          includePaths: ['manifest.yaml', 'dist', 'assets']
        }
      ]
    });

    const infoPlist = await fs.readFile(path.join(result.appBundlePath, 'Contents', 'Info.plist'), 'utf-8');
    expect(infoPlist).toContain('application/x-card');
    expect(infoPlist).not.toContain('image/png');
    expect(infoPlist).not.toContain('<string>png</string>');
  });

  it('keeps packaging working when the optional photo viewer project is missing from the workspace', async () => {
    await fs.rm(path.join(workspaceRoot, 'Chips-PhotoViewer'), { recursive: true, force: true });

    const result = await prepareMacHostAppBundle({
      hostProjectDir,
      workspaceRoot,
      outputDir,
      electronAppPath,
      yamlPackageDir,
      runtimeDependencyPackageDirs: {
        cssstyle: cssstylePackageDir,
        esbuild: esbuildPackageDir,
        jsdom: jsdomPackageDir
      }
    });

    const infoPlist = await fs.readFile(path.join(result.appBundlePath, 'Contents', 'Info.plist'), 'utf-8');
    expect(infoPlist).toContain('application/x-card');
    expect(infoPlist).not.toContain('image/png');
    expect(infoPlist).not.toContain('<string>png</string>');
    await expect(fs.access(path.join(result.builtInPluginRoot, 'com.chips.photo-viewer'))).rejects.toThrow();
  });

  it('packages real runtime dependencies so the bundled app can require jsdom and esbuild directly', async () => {
    const resolvePackageDir = (packageName: string): string => {
      const manifestPath = require.resolve(`${packageName}/package.json`, {
        paths: [path.resolve(process.cwd(), '..')]
      });
      return path.dirname(manifestPath);
    };

    const result = await prepareMacHostAppBundle({
      hostProjectDir,
      workspaceRoot,
      outputDir,
      electronAppPath,
      runtimeDependencyPackageDirs: {
        esbuild: resolvePackageDir('esbuild'),
        jsdom: resolvePackageDir('jsdom'),
        yaml: resolvePackageDir('yaml')
      }
    });

    const runtimeNodeModules = path.join(result.appBundlePath, 'Contents', 'Resources', 'app', 'node_modules');
    const { JSDOM } = require(path.join(runtimeNodeModules, 'jsdom')) as {
      JSDOM: new (html?: string) => { window: { document: { body: { innerHTML: string } }; close(): void } };
    };
    const esbuild = require(path.join(runtimeNodeModules, 'esbuild')) as {
      version: string;
      build: (options: Record<string, unknown>) => Promise<{ outputFiles?: Array<{ text: string }> }>;
    };

    const dom = new JSDOM('<p>runtime-ok</p>');
    expect(dom.window.document.body.innerHTML).toContain('runtime-ok');
    dom.window.close();

    expect(esbuild.version).toBeTruthy();
    const buildResult = await esbuild.build({
      stdin: {
        contents: 'export const answer = 42;',
        resolveDir: workspaceRoot,
        sourcefile: 'entry.js'
      },
      bundle: true,
      write: false,
      format: 'cjs',
      platform: 'browser',
      logLevel: 'silent'
    });
    expect(buildResult.outputFiles?.[0]?.text).toContain('answer');
  }, 45_000);

  it('invokes productbuild to create the macOS installer package', async () => {
    const appBundlePath = path.join(outputDir, 'Chips.app');
    await fs.mkdir(appBundlePath, { recursive: true });
    let capturedPostinstall = '';
    let capturedPayloadRoot = '';
    const runCommand = vi.fn(async (command: string, args: string[]) => {
      const scriptsIndex = args.indexOf('--scripts');
      if (scriptsIndex >= 0) {
        const scriptsDir = args[scriptsIndex + 1];
        if (!scriptsDir) {
          throw new Error('Missing scripts directory argument');
        }
        capturedPostinstall = await fs.readFile(path.join(scriptsDir, 'postinstall'), 'utf-8');
      }

      if (command === 'pkgbuild') {
        const rootIndex = args.indexOf('--root');
        const payloadRoot = args[rootIndex + 1];
        if (!payloadRoot) {
          throw new Error('Missing payload root argument');
        }
        capturedPayloadRoot = payloadRoot;
        await fs.access(path.join(payloadRoot, 'Applications', 'Chips.app'));
      }
    });

    await createMacPkgInstaller({
      appBundlePath,
      outputPath: path.join(outputDir, 'Chips-Host-0.1.0-macos.pkg'),
      packageVersion: '0.1.0',
      runCommand
    });

    const calls = runCommand.mock.calls as unknown as Array<
      [string, string[], { cwd?: string; env?: Record<string, string | undefined> } | undefined]
    >;
    expect(calls.length).toBe(3);

    const [pkgbuildCommand, pkgbuildArgs, pkgbuildOptions] = calls[0]!;
    expect(pkgbuildCommand).toBe('pkgbuild');
    expect(pkgbuildArgs).toContain('--identifier');
    expect(pkgbuildArgs).toContain('local.chips.host.component');
    expect(pkgbuildArgs).toContain('--version');
    expect(pkgbuildArgs).toContain('0.1.0');
    expect(pkgbuildArgs).toContain('--root');
    expect(pkgbuildArgs).toContain('--install-location');
    expect(pkgbuildArgs).toContain('/');
    expect(pkgbuildArgs).toContain('--scripts');
    expect(pkgbuildArgs).not.toContain('--component');

    const rootIndex = pkgbuildArgs.indexOf('--root');
    const payloadRoot = pkgbuildArgs[rootIndex + 1];
    expect(payloadRoot).toBe(path.join(outputDir, '.pkg-build-0', 'payload-root'));
    expect(capturedPayloadRoot).toBe(payloadRoot);
    expect(pkgbuildOptions?.env).toMatchObject({
      COPYFILE_DISABLE: '1'
    });

    const [synthesizeCommand, synthesizeArgs, synthesizeOptions] = calls[1]!;
    expect(synthesizeCommand).toBe('productbuild');
    expect(synthesizeArgs).toEqual([
      '--synthesize',
      '--package',
      path.join(outputDir, '.pkg-build-0', 'packages', 'Chips-Host-component.pkg'),
      path.join(outputDir, '.pkg-build-0', 'Distribution.xml')
    ]);
    expect(synthesizeOptions?.env).toMatchObject({
      COPYFILE_DISABLE: '1'
    });

    const [productbuildCommand, productbuildArgs, productbuildOptions] = calls[2]!;
    expect(productbuildCommand).toBe('productbuild');
    expect(productbuildArgs).toEqual([
      '--distribution',
      path.join(outputDir, '.pkg-build-0', 'Distribution.xml'),
      '--package-path',
      path.join(outputDir, '.pkg-build-0', 'packages'),
      '--identifier',
      'local.chips.host',
      '--version',
      '0.1.0',
      path.join(outputDir, 'Chips-Host-0.1.0-macos.pkg')
    ]);
    expect(productbuildOptions?.env).toMatchObject({
      COPYFILE_DISABLE: '1'
    });

    expect(capturedPostinstall).toContain('Info.plist');
    expect(capturedPostinstall).toContain('CFBundleExecutable');
    expect(capturedPostinstall).toContain('CFBundleIconFile');
    expect(capturedPostinstall).toContain('chips-eco-settings-panel');
    expect(capturedPostinstall).toContain('APPLICATIONS_DIR="$USER_HOME/Applications"');
    expect(capturedPostinstall).toContain('LAUNCHERS_DIR="$APPLICATIONS_DIR/Chips Apps"');
    expect(capturedPostinstall).toContain('chown "$TARGET_USER:$PRIMARY_GROUP" "$APPLICATIONS_DIR" "$LAUNCHERS_DIR"');
    expect(capturedPostinstall).toContain('--chips-launch-plugin=${PLUGIN_ID}');
    expect(capturedPostinstall).not.toContain('APP_ENTRY=');
    expect(capturedPostinstall).not.toContain('app-entry.js');
  });

  it.runIf(process.platform === 'darwin')(
    'removes AppleDouble metadata entries from the generated installer payload',
    async () => {
      const appBundlePath = path.join(outputDir, 'Dirty.app');
      const appExecutablePath = path.join(appBundlePath, 'Contents', 'MacOS', 'Chips');
      const installerPath = path.join(outputDir, 'Chips-Host-0.1.0-macos.pkg');

      await write(appExecutablePath, '#!/bin/sh\nexit 0\n');
      await fs.chmod(appExecutablePath, 0o755);
      await write(path.join(appBundlePath, 'Contents', 'Info.plist'), '<plist version="1.0"></plist>\n');
      await execFile('xattr', ['-w', 'com.chips.test', 'dirty', appExecutablePath]);

      await createMacPkgInstaller({
        appBundlePath,
        outputPath: installerPath,
        packageVersion: '0.1.0'
      });

      const { stdout } = await execFile('pkgutil', ['--payload-files', installerPath]);
      expect(stdout).toContain('./Applications/Chips.app/Contents/MacOS/Chips');
      expect(stdout).not.toMatch(/(^|\/)\._/m);
      expect(stdout).not.toContain('/.DS_Store');

      const expandedInstallerPath = path.join(outputDir, 'expanded-installer');
      await execFile('pkgutil', ['--expand', installerPath, expandedInstallerPath]);
      await expect(collectInstallerMetadataEntries(expandedInstallerPath)).resolves.toEqual([]);
    },
    60_000
  );
});

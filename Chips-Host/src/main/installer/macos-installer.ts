import childProcess from 'node:child_process';
import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { createError } from '../../shared/errors';
import { parseYamlLite } from '../../shared/yaml-lite';

const execFile = promisify(childProcess.execFile);

export interface BuiltInPluginBundleSpec {
  id: string;
  sourceDir: string;
  includePaths: string[];
  required?: boolean;
}

export interface PrepareMacHostAppBundleOptions {
  hostProjectDir: string;
  workspaceRoot: string;
  outputDir: string;
  electronAppPath?: string;
  yamlPackageDir?: string;
  runtimeDependencyPackageDirs?: Record<string, string>;
  builtInPluginBundles?: BuiltInPluginBundleSpec[];
}

export interface CreateMacPkgInstallerOptions {
  appBundlePath: string;
  outputPath: string;
  packageVersion: string;
  runCommand?: RunCommandFn;
}

export interface BuildMacHostInstallerOptions extends PrepareMacHostAppBundleOptions {
  buildPrerequisites?: boolean;
  runCommand?: RunCommandFn;
}

export interface PrepareMacHostAppBundleResult {
  appBundlePath: string;
  packageVersion: string;
  builtInPluginRoot: string;
}

export interface BuildMacHostInstallerResult extends PrepareMacHostAppBundleResult {
  installerPath: string;
}

interface RunCommandOptions {
  cwd?: string;
  env?: Record<string, string | undefined>;
}

export type RunCommandFn = (command: string, args: string[], options?: RunCommandOptions) => Promise<void>;

const APP_BUNDLE_NAME = 'Chips.app';
const EXECUTABLE_NAME = 'Chips';
const APP_PACKAGE_NAME = 'chips-host';
const APP_BUNDLE_IDENTIFIER = 'local.chips.host';
const COMPONENT_PACKAGE_IDENTIFIER = 'local.chips.host.component';
const SETTINGS_PANEL_PLUGIN_ID = 'com.chips.eco-settings-panel';
const PHOTO_VIEWER_PLUGIN_ID = 'com.chips.photo-viewer';
const SETTINGS_PANEL_DISPLAY_NAME = '生态设置面板';
const SETTINGS_PANEL_EXECUTABLE_NAME = 'chips-eco-settings-panel';
const CARD_FILE_EXTENSION = 'card';
const CARD_FILE_MIME_TYPE = 'application/x-card';

const FILE_HANDLER_MIME_TYPES: Record<string, string> = {
  '.avif': 'image/avif',
  '.bmp': 'image/bmp',
  '.gif': 'image/gif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp'
};

interface InstallerDocumentTypeSpec {
  displayName: string;
  extensions: string[];
  mimeTypes: string[];
}

const pathExists = async (targetPath: string): Promise<boolean> => {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
};

const ensureFile = async (targetPath: string, message: string): Promise<void> => {
  if (!(await pathExists(targetPath))) {
    throw createError('HOST_INSTALLER_INPUT_MISSING', message, { targetPath });
  }
};

const resolveAvailableBuiltInPluginBundles = async (
  bundles: BuiltInPluginBundleSpec[]
): Promise<BuiltInPluginBundleSpec[]> => {
  const available: BuiltInPluginBundleSpec[] = [];

  for (const bundle of bundles) {
    const sourceDir = path.resolve(bundle.sourceDir);
    if (await pathExists(sourceDir)) {
      available.push({
        ...bundle,
        sourceDir
      });
      continue;
    }

    if (bundle.required === false) {
      continue;
    }

    throw createError('HOST_INSTALLER_INPUT_MISSING', 'Built-in plugin source directory is unavailable.', {
      pluginId: bundle.id,
      sourceDir
    });
  }

  return available;
};

const defaultRunCommand: RunCommandFn = async (command, args, options) => {
  await execFile(command, args, {
    cwd: options?.cwd,
    env: {
      ...process.env,
      ...(options?.env ?? {})
    }
  });
};

const PACKAGE_TOOL_ENV: Record<string, string> = {
  COPYFILE_DISABLE: '1'
};

const resolveRuntimePackageDir = (hostProjectDir: string, packageName: string): string => {
  const manifestPath = require.resolve(`${packageName}/package.json`, { paths: [hostProjectDir] });
  return path.dirname(manifestPath);
};

const resolveElectronAppPath = (hostProjectDir: string): string => {
  return path.join(resolveRuntimePackageDir(hostProjectDir, 'electron'), 'dist', 'Electron.app');
};

const defaultBuiltInPluginBundles = (workspaceRoot: string): BuiltInPluginBundleSpec[] => {
  return [
    {
      id: 'com.chips.eco-settings-panel',
      sourceDir: path.join(workspaceRoot, 'Chips-EcoSettingsPanel'),
      includePaths: ['manifest.yaml', 'dist', 'assets']
    },
    {
      id: PHOTO_VIEWER_PLUGIN_ID,
      sourceDir: path.join(workspaceRoot, 'Chips-PhotoViewer'),
      includePaths: ['manifest.yaml', 'dist', 'assets'],
      required: false
    }
  ];
};

const unique = (items: string[]): string[] => {
  return [...new Set(items.map((item) => item.trim()).filter((item) => item.length > 0))];
};

const normalizeFileHandlerExtension = (capability: string): string | null => {
  if (!capability.startsWith('file-handler:.')) {
    return null;
  }
  const extension = capability.slice('file-handler:'.length).trim().toLowerCase();
  if (!/^\.[a-z0-9]+$/.test(extension)) {
    return null;
  }
  return extension;
};

const collectBuiltInDocumentTypes = async (bundles: BuiltInPluginBundleSpec[]): Promise<InstallerDocumentTypeSpec[]> => {
  const collected: InstallerDocumentTypeSpec[] = [];
  const seenExtensions = new Set<string>([CARD_FILE_EXTENSION]);

  for (const bundle of bundles) {
    const manifestPath = path.join(bundle.sourceDir, 'manifest.yaml');
    if (!(await pathExists(manifestPath))) {
      continue;
    }

    const raw = await fs.readFile(manifestPath, 'utf-8');
    const parsed = parseYamlLite(raw);
    if (parsed.type !== 'app') {
      continue;
    }

    const capabilities = Array.isArray(parsed.capabilities)
      ? parsed.capabilities.filter((item): item is string => typeof item === 'string')
      : [];
    const extensions = unique(
      capabilities
        .map((capability) => normalizeFileHandlerExtension(capability))
        .filter((item): item is string => item !== null)
        .filter((extension) => extension.slice(1) !== CARD_FILE_EXTENSION)
        .filter((extension) => {
          const normalized = extension.slice(1);
          if (seenExtensions.has(normalized)) {
            return false;
          }
          seenExtensions.add(normalized);
          return true;
        })
        .map((extension) => extension.slice(1))
    );

    if (extensions.length === 0) {
      continue;
    }

    collected.push({
      displayName: typeof parsed.name === 'string' && parsed.name.trim().length > 0 ? parsed.name.trim() : bundle.id,
      extensions,
      mimeTypes: unique(
        extensions
          .map((extension) => FILE_HANDLER_MIME_TYPES[`.${extension}`])
          .filter((item): item is string => typeof item === 'string' && item.length > 0)
      )
    });
  }

  return collected;
};

const removeCopiedBundleArtifacts = async (rootPath: string): Promise<void> => {
  const entries = await fs.readdir(rootPath, { withFileTypes: true });
  await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(rootPath, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '_CodeSignature') {
          await fs.rm(entryPath, { recursive: true, force: true });
          return;
        }
        await removeCopiedBundleArtifacts(entryPath);
        return;
      }

      if (
        entry.isFile() &&
        (entry.name === 'CodeResources' || entry.name === '.DS_Store' || entry.name.startsWith('._'))
      ) {
        await fs.rm(entryPath, { force: true });
      }
    })
  );
};

export const stripInstallerBundleRelocationMetadata = (xml: string): string => {
  let next = xml;
  const blockPatterns = [
    /[ \t]*<bundle-version>[\s\S]*?<\/bundle-version>\n?/g,
    /[ \t]*<upgrade-bundle>[\s\S]*?<\/upgrade-bundle>\n?/g,
    /[ \t]*<atomic-update-bundle>[\s\S]*?<\/atomic-update-bundle>\n?/g,
    /[ \t]*<strict-identifier>[\s\S]*?<\/strict-identifier>\n?/g,
    /[ \t]*<relocate>[\s\S]*?<\/relocate>\n?/g
  ];
  const selfClosingPatterns = [
    /[ \t]*<bundle\b[^>]*\/>\n?/g,
    /[ \t]*<bundle-version\/>\n?/g,
    /[ \t]*<update-bundle\/>\n?/g,
    /[ \t]*<atomic-update-bundle\/>\n?/g
  ];

  for (const pattern of blockPatterns) {
    next = next.replace(pattern, '');
  }
  for (const pattern of selfClosingPatterns) {
    next = next.replace(pattern, '');
  }

  return next;
};

const sanitizeFlatComponentPackage = async (flatPackagePath: string): Promise<void> => {
  if (!(await pathExists(flatPackagePath))) {
    return;
  }

  const expandedDir = `${flatPackagePath}.expanded`;
  const packageInfoPath = path.join(expandedDir, 'PackageInfo');
  const payloadPath = path.join(expandedDir, 'Payload');
  const bomPath = path.join(expandedDir, 'Bom');

  await fs.rm(expandedDir, { recursive: true, force: true });

  try {
    await execFile('pkgutil', ['--expand', flatPackagePath, expandedDir], {
      env: process.env
    });

    await sanitizePackagePayload(payloadPath, bomPath);
    await removePackageMetadataEntries(expandedDir);

    if (!(await pathExists(packageInfoPath))) {
      return;
    }

    const original = await fs.readFile(packageInfoPath, 'utf-8');
    const sanitized = stripInstallerBundleRelocationMetadata(original);
    if (sanitized !== original) {
      await fs.writeFile(packageInfoPath, sanitized, 'utf-8');
      await fs.rm(flatPackagePath, { force: true });
      await execFile('pkgutil', ['--flatten', expandedDir, flatPackagePath], {
        env: process.env
      });
    } else if (await pathExists(payloadPath)) {
      await fs.rm(flatPackagePath, { force: true });
      await execFile('pkgutil', ['--flatten', expandedDir, flatPackagePath], {
        env: process.env
      });
    }
  } finally {
    await fs.rm(expandedDir, { recursive: true, force: true });
  }
};

const sanitizePackagePayload = async (payloadPath: string, bomPath: string): Promise<void> => {
  if (!(await pathExists(payloadPath))) {
    return;
  }

  const payloadDir = `${payloadPath}.contents`;
  await fs.rm(payloadDir, { recursive: true, force: true });
  await fs.mkdir(payloadDir, { recursive: true });

  try {
    await execFile('/bin/sh', ['-c', 'gzip -dc "$1" | cpio -id --quiet', 'sh', payloadPath], {
      cwd: payloadDir,
      env: process.env
    });

    await removePackageMetadataEntries(payloadDir);

    await execFile('/bin/sh', ['-c', 'find . | sort | cpio -o --format odc --quiet | gzip -c > "$1"', 'sh', payloadPath], {
      cwd: payloadDir,
      env: process.env
    });

    await execFile('mkbom', [payloadDir, bomPath], {
      env: process.env
    });
  } finally {
    await fs.rm(payloadDir, { recursive: true, force: true });
  }
};

const removePackageMetadataEntries = async (rootPath: string): Promise<number> => {
  let removedCount = 0;
  const entries = await fs.readdir(rootPath, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(rootPath, entry.name);
    if (entry.name.startsWith('._') || entry.name === '.DS_Store' || entry.name === 'CodeResources') {
      await fs.rm(entryPath, { recursive: true, force: true });
      removedCount += 1;
      continue;
    }

    if (entry.isDirectory()) {
      removedCount += await removePackageMetadataEntries(entryPath);
    }
  }

  return removedCount;
};

const sanitizeDistributionFile = async (distributionPath: string): Promise<void> => {
  if (!(await pathExists(distributionPath))) {
    return;
  }

  const original = await fs.readFile(distributionPath, 'utf-8');
  const sanitized = stripInstallerBundleRelocationMetadata(original);
  if (sanitized !== original) {
    await fs.writeFile(distributionPath, sanitized, 'utf-8');
  }
};

const sanitizeFlatProductArchive = async (archivePath: string): Promise<void> => {
  if (!(await pathExists(archivePath))) {
    return;
  }

  const expandedDir = `${archivePath}.expanded`;
  const distributionPath = path.join(expandedDir, 'Distribution');

  await fs.rm(expandedDir, { recursive: true, force: true });

  try {
    await execFile('pkgutil', ['--expand', archivePath, expandedDir], {
      env: process.env
    });

    await sanitizeDistributionFile(distributionPath);
    await removePackageMetadataEntries(expandedDir);

    await fs.rm(archivePath, { force: true });
    await execFile('pkgutil', ['--flatten', expandedDir, archivePath], {
      env: process.env
    });
  } finally {
    await fs.rm(expandedDir, { recursive: true, force: true });
  }
};

const prunePackagedHostArtifacts = async (packagedAppDir: string): Promise<void> => {
  await fs.rm(path.join(packagedAppDir, 'dist', 'tests'), { recursive: true, force: true });
};

type HostPackageManifest = {
  version: string;
  dependencies: Record<string, string>;
};

type RuntimePackageManifest = {
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
};

type RuntimeDependencySpec = {
  relativePath: string;
  sourceDir: string;
};

const readHostPackageManifest = async (hostProjectDir: string): Promise<HostPackageManifest> => {
  const raw = await fs.readFile(path.join(hostProjectDir, 'package.json'), 'utf-8');
  const parsed = JSON.parse(raw) as { version?: string; dependencies?: Record<string, string> };
  if (!parsed.version || parsed.version.trim().length === 0) {
    throw createError('HOST_INSTALLER_INVALID_VERSION', 'Chips-Host package.json is missing version');
  }
  return {
    version: parsed.version.trim(),
    dependencies: parsed.dependencies ?? {}
  };
};

const copyRuntimeDependency = async (sourceDir: string, destinationDir: string): Promise<void> => {
  await fs.mkdir(path.dirname(destinationDir), { recursive: true });
  await fs.cp(sourceDir, destinationDir, { recursive: true, dereference: true });
};

const readRuntimePackageManifest = async (packageDir: string): Promise<RuntimePackageManifest> => {
  const raw = await fs.readFile(path.join(packageDir, 'package.json'), 'utf-8');
  return JSON.parse(raw) as RuntimePackageManifest;
};

const findPackageRoot = (resolvedEntryPath: string, packageName: string): string | null => {
  let currentDir = path.dirname(resolvedEntryPath);
  while (true) {
    const manifestPath = path.join(currentDir, 'package.json');
    if (fsSync.existsSync(manifestPath)) {
      try {
        const parsed = JSON.parse(fsSync.readFileSync(manifestPath, 'utf-8')) as { name?: string };
        if (parsed.name === packageName) {
          return currentDir;
        }
      } catch {
        return null;
      }
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      return null;
    }
    currentDir = parentDir;
  }
};

const tryResolveRuntimePackageDir = (searchPaths: string[], packageName: string): string | null => {
  try {
    const manifestPath = require.resolve(`${packageName}/package.json`, { paths: searchPaths });
    return path.dirname(manifestPath);
  } catch {
    try {
      const entryPath = require.resolve(packageName, { paths: searchPaths });
      return findPackageRoot(entryPath, packageName);
    } catch {
      return null;
    }
  }
};

const toNodeModulesRelativePath = (packageDir: string): string => {
  const marker = `${path.sep}node_modules${path.sep}`;
  const segments = path.normalize(packageDir).split(marker);
  if (segments.length < 2) {
    throw createError('HOST_INSTALLER_INPUT_MISSING', 'Runtime dependency must resolve from a node_modules directory.', {
      packageDir
    });
  }
  return segments.slice(1).join(marker);
};

const collectRuntimeDependencySpecs = async (
  hostProjectDir: string,
  hostManifest: HostPackageManifest,
  runtimeDependencyPackageDirs?: Record<string, string>
): Promise<RuntimeDependencySpec[]> => {
  const overrides = new Map<string, string>(Object.entries(runtimeDependencyPackageDirs ?? {}));
  const collected = new Map<string, RuntimeDependencySpec>();
  const queue: string[] = [];

  for (const dependencyName of Object.keys(hostManifest.dependencies)) {
    const overrideDir = overrides.get(dependencyName);
    const resolvedDir = overrideDir
      ? path.resolve(overrideDir)
      : tryResolveRuntimePackageDir([hostProjectDir], dependencyName);
    if (!resolvedDir) {
      throw createError('HOST_INSTALLER_INPUT_MISSING', 'Runtime dependency is unavailable.', {
        dependencyName
      });
    }
    queue.push(resolvedDir);
  }

  while (queue.length > 0) {
    const resolvedDir = queue.shift();
    if (!resolvedDir) {
      continue;
    }
    const relativePath = toNodeModulesRelativePath(resolvedDir);
    if (collected.has(relativePath)) {
      continue;
    }

    await ensureFile(resolvedDir, 'Runtime dependency is unavailable.');
    collected.set(relativePath, {
      relativePath,
      sourceDir: resolvedDir
    });

    const runtimeManifest = await readRuntimePackageManifest(resolvedDir);
    for (const childDependencyName of Object.keys(runtimeManifest.dependencies ?? {})) {
      const overrideDir = overrides.get(childDependencyName);
      const childDir = overrideDir
        ? path.resolve(overrideDir)
        : tryResolveRuntimePackageDir([resolvedDir, hostProjectDir], childDependencyName);
      if (childDir) {
        queue.push(childDir);
      }
    }

    for (const optionalDependencyName of Object.keys(runtimeManifest.optionalDependencies ?? {})) {
      const optionalOverrideDir = overrides.get(optionalDependencyName);
      const optionalDir = optionalOverrideDir
        ? path.resolve(optionalOverrideDir)
        : tryResolveRuntimePackageDir([resolvedDir, hostProjectDir], optionalDependencyName);
      if (optionalDir) {
        queue.push(optionalDir);
      }
    }
  }

  return Array.from(collected.values()).sort((left, right) => left.relativePath.localeCompare(right.relativePath));
};

const stageRuntimeDependencies = async (
  packagedAppDir: string,
  runtimeDependencies: RuntimeDependencySpec[]
): Promise<void> => {
  const destinationRoot = path.join(packagedAppDir, 'node_modules');
  await fs.rm(destinationRoot, { recursive: true, force: true });
  await fs.mkdir(destinationRoot, { recursive: true });

  for (const runtimeDependency of runtimeDependencies) {
    const destinationDir = path.join(destinationRoot, runtimeDependency.relativePath);
    await copyRuntimeDependency(runtimeDependency.sourceDir, destinationDir);
  }
};

const writePackagedAppManifest = async (
  appDir: string,
  version: string,
  dependencies: Record<string, string>
): Promise<void> => {
  const payload = {
    name: APP_PACKAGE_NAME,
    version,
    private: true,
    main: 'dist/src/main/electron/app-entry.js',
    dependencies
  };

  await fs.writeFile(path.join(appDir, 'package.json'), JSON.stringify(payload, null, 2) + '\n', 'utf-8');
};

const stageBuiltInPluginBundle = async (bundle: BuiltInPluginBundleSpec, destinationRoot: string): Promise<void> => {
  await ensureFile(bundle.sourceDir, 'Built-in plugin source directory is unavailable.');
  const destinationDir = path.join(destinationRoot, bundle.id);
  await fs.rm(destinationDir, { recursive: true, force: true });
  await fs.mkdir(destinationDir, { recursive: true });

  for (const includePath of bundle.includePaths) {
    const sourcePath = path.join(bundle.sourceDir, includePath);
    await ensureFile(sourcePath, 'Built-in plugin asset is unavailable.');
    const destinationPath = path.join(destinationDir, includePath);
    const stats = await fs.stat(sourcePath);
    if (stats.isDirectory()) {
      await fs.cp(sourcePath, destinationPath, { recursive: true });
      continue;
    }

    await fs.mkdir(path.dirname(destinationPath), { recursive: true });
    await fs.copyFile(sourcePath, destinationPath);
  }
};

const stageMacInstallerPayloadRoot = async (appBundlePath: string, payloadRoot: string): Promise<string> => {
  const stagedApplicationsDir = path.join(payloadRoot, 'Applications');
  const stagedAppBundlePath = path.join(stagedApplicationsDir, APP_BUNDLE_NAME);

  await fs.rm(payloadRoot, { recursive: true, force: true });
  await fs.mkdir(stagedApplicationsDir, { recursive: true });
  await fs.cp(appBundlePath, stagedAppBundlePath, { recursive: true, dereference: true });

  return stagedAppBundlePath;
};

const renderDocumentTypePlist = (documentType: InstallerDocumentTypeSpec): string[] => {
  const lines = [
    '    <dict>',
    '      <key>CFBundleTypeName</key>',
    `      <string>${documentType.displayName}</string>`,
    '      <key>CFBundleTypeExtensions</key>',
    '      <array>',
    ...documentType.extensions.map((extension) => `        <string>${extension}</string>`),
    '      </array>'
  ];

  if (documentType.mimeTypes.length > 0) {
    lines.push(
      '      <key>CFBundleTypeMIMETypes</key>',
      '      <array>',
      ...documentType.mimeTypes.map((mimeType) => `        <string>${mimeType}</string>`),
      '      </array>'
    );
  }

  lines.push(
    '      <key>LSHandlerRank</key>',
    '      <string>Owner</string>',
    '    </dict>'
  );

  return lines;
};

const createInfoPlist = (version: string, additionalDocumentTypes: InstallerDocumentTypeSpec[]): string => {
  const documentTypes = [
    {
      displayName: 'Chips Card File',
      extensions: [CARD_FILE_EXTENSION],
      mimeTypes: [CARD_FILE_MIME_TYPE]
    },
    ...additionalDocumentTypes
  ];

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0">',
    '<dict>',
    '  <key>CFBundleDevelopmentRegion</key>',
    '  <string>zh_CN</string>',
    '  <key>CFBundleDisplayName</key>',
    '  <string>Chips Host</string>',
    '  <key>CFBundleExecutable</key>',
    `  <string>${EXECUTABLE_NAME}</string>`,
    '  <key>CFBundleIdentifier</key>',
    `  <string>${APP_BUNDLE_IDENTIFIER}</string>`,
    '  <key>CFBundleInfoDictionaryVersion</key>',
    '  <string>6.0</string>',
    '  <key>CFBundleName</key>',
    '  <string>Chips</string>',
    '  <key>CFBundlePackageType</key>',
    '  <string>APPL</string>',
    '  <key>CFBundleShortVersionString</key>',
    `  <string>${version}</string>`,
    '  <key>CFBundleVersion</key>',
    `  <string>${version}</string>`,
    '  <key>LSApplicationCategoryType</key>',
    '  <string>public.app-category.productivity</string>',
    '  <key>NSHighResolutionCapable</key>',
    '  <true/>',
    '  <key>NSPrincipalClass</key>',
    '  <string>AtomApplication</string>',
    '  <key>CFBundleDocumentTypes</key>',
    '  <array>',
    ...documentTypes.flatMap((documentType) => renderDocumentTypePlist(documentType)),
    '  </array>',
    '</dict>',
    '</plist>',
    ''
  ].join('\n');
};

export const prepareMacHostAppBundle = async (
  options: PrepareMacHostAppBundleOptions
): Promise<PrepareMacHostAppBundleResult> => {
  const hostProjectDir = path.resolve(options.hostProjectDir);
  const workspaceRoot = path.resolve(options.workspaceRoot);
  const outputDir = path.resolve(options.outputDir);
  const electronAppPath = path.resolve(options.electronAppPath ?? resolveElectronAppPath(hostProjectDir));
  const runtimeDependencyPackageDirs = {
    ...(options.runtimeDependencyPackageDirs ?? {}),
    ...(options.yamlPackageDir ? { yaml: path.resolve(options.yamlPackageDir) } : {})
  };
  const builtInPluginBundles = await resolveAvailableBuiltInPluginBundles(
    options.builtInPluginBundles ?? defaultBuiltInPluginBundles(workspaceRoot)
  );
  const hostManifest = await readHostPackageManifest(hostProjectDir);
  const version = hostManifest.version;
  const runtimeDependencies = await collectRuntimeDependencySpecs(
    hostProjectDir,
    hostManifest,
    runtimeDependencyPackageDirs
  );

  const hostDistDir = path.join(hostProjectDir, 'dist');
  await ensureFile(hostDistDir, 'Chips-Host dist output is unavailable. Please build Host first.');
  await ensureFile(electronAppPath, 'Electron.app template is unavailable.');
  const documentTypes = await collectBuiltInDocumentTypes(builtInPluginBundles);

  const appBundlePath = path.join(outputDir, APP_BUNDLE_NAME);
  const resourcesPath = path.join(appBundlePath, 'Contents', 'Resources');
  const packagedAppDir = path.join(resourcesPath, 'app');
  const builtInPluginRoot = path.join(resourcesPath, 'builtin-plugins');

  await fs.rm(appBundlePath, { recursive: true, force: true });
  await fs.mkdir(outputDir, { recursive: true });
  await fs.cp(electronAppPath, appBundlePath, { recursive: true, dereference: true });
  await removeCopiedBundleArtifacts(appBundlePath);

  const originalExecutable = path.join(appBundlePath, 'Contents', 'MacOS', 'Electron');
  const brandedExecutable = path.join(appBundlePath, 'Contents', 'MacOS', EXECUTABLE_NAME);
  if (await pathExists(originalExecutable)) {
    await fs.rename(originalExecutable, brandedExecutable);
  }

  await fs.mkdir(packagedAppDir, { recursive: true });
  await fs.cp(hostDistDir, path.join(packagedAppDir, 'dist'), { recursive: true });
  await prunePackagedHostArtifacts(packagedAppDir);
  await stageRuntimeDependencies(packagedAppDir, runtimeDependencies);
  await writePackagedAppManifest(packagedAppDir, version, hostManifest.dependencies);

  await fs.rm(builtInPluginRoot, { recursive: true, force: true });
  await fs.mkdir(builtInPluginRoot, { recursive: true });
  for (const bundle of builtInPluginBundles) {
    await stageBuiltInPluginBundle(bundle, builtInPluginRoot);
  }

  await removeCopiedBundleArtifacts(appBundlePath);
  await fs.writeFile(path.join(appBundlePath, 'Contents', 'Info.plist'), createInfoPlist(version, documentTypes), 'utf-8');

  return {
    appBundlePath,
    packageVersion: version,
    builtInPluginRoot
  };
};

const createLauncherInfoPlist = (bundleName: string, executableName: string, bundleIdentifier: string, version: string): string => {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0">',
    '<dict>',
    '  <key>CFBundleDevelopmentRegion</key>',
    '  <string>zh_CN</string>',
    '  <key>CFBundleExecutable</key>',
    `  <string>${executableName}</string>`,
    '  <key>CFBundleIdentifier</key>',
    `  <string>${bundleIdentifier}</string>`,
    '  <key>CFBundleName</key>',
    `  <string>${bundleName}</string>`,
    '  <key>CFBundlePackageType</key>',
    '  <string>APPL</string>',
    '  <key>CFBundleShortVersionString</key>',
    `  <string>${version}</string>`,
    '  <key>CFBundleVersion</key>',
    `  <string>${version}</string>`,
    '  <key>LSApplicationCategoryType</key>',
    '  <string>public.app-category.productivity</string>',
    '  <key>CFBundleIconFile</key>',
    '  <string>AppIcon.icns</string>',
    '</dict>',
    '</plist>',
    ''
  ].join('\n');
};

const createLauncherExecutableScript = (): string => {
  return [
    '#!/bin/sh',
    'WORKSPACE="${HOME}/.chips-host"',
    'HOST_APP="/Applications/Chips.app"',
    'HOST_EXEC="$HOST_APP/Contents/MacOS/Chips"',
    `PLUGIN_ID="${SETTINGS_PANEL_PLUGIN_ID}"`,
    'exec "$HOST_EXEC" "--workspace=${WORKSPACE}" "--chips-launch-plugin=${PLUGIN_ID}" >/dev/null 2>&1 &',
    ''
  ].join('\n');
};

const createMacPostinstallScript = (packageVersion: string): string => {
  const infoPlist = createLauncherInfoPlist(
    SETTINGS_PANEL_DISPLAY_NAME,
    SETTINGS_PANEL_EXECUTABLE_NAME,
    `chips.launcher.${SETTINGS_PANEL_PLUGIN_ID}`,
    packageVersion
  );
  const launcherScript = createLauncherExecutableScript();
  const lines: string[] = [
    '#!/bin/sh',
    'set -e',
    '',
    'TARGET_USER="$(stat -f%Su /dev/console 2>/dev/null || true)"',
    'if [ -z "$TARGET_USER" ] || [ "$TARGET_USER" = "root" ] || [ "$TARGET_USER" = "loginwindow" ]; then',
    '  exit 0',
    'fi',
    '',
    'USER_HOME="$(dscl . -read "/Users/$TARGET_USER" NFSHomeDirectory 2>/dev/null | awk \'{print $2}\')"',
    'if [ -z "$USER_HOME" ]; then',
    '  USER_HOME="$(eval echo "~$TARGET_USER")"',
    'fi',
    'if [ -z "$USER_HOME" ] || [ ! -d "$USER_HOME" ]; then',
    '  exit 0',
    'fi',
    '',
    'PRIMARY_GROUP="$(id -gn "$TARGET_USER" 2>/dev/null || echo staff)"',
    'HOST_APP="/Applications/Chips.app"',
    `DISPLAY_NAME="${SETTINGS_PANEL_DISPLAY_NAME}"`,
    `EXECUTABLE_NAME="${SETTINGS_PANEL_EXECUTABLE_NAME}"`,
    'APPLICATIONS_DIR="$USER_HOME/Applications"',
    'LAUNCHERS_DIR="$APPLICATIONS_DIR/Chips Apps"',
    'LAUNCHER_APP="$LAUNCHERS_DIR/${DISPLAY_NAME}.app"',
    'CONTENTS_DIR="$LAUNCHER_APP/Contents"',
    'MACOS_DIR="$CONTENTS_DIR/MacOS"',
    'RESOURCES_DIR="$CONTENTS_DIR/Resources"',
    `ICON_SOURCE="$HOST_APP/Contents/Resources/builtin-plugins/${SETTINGS_PANEL_PLUGIN_ID}/assets/icons/app-icon.icns"`,
    'EXECUTABLE_PATH="$MACOS_DIR/$EXECUTABLE_NAME"',
    '',
    'mkdir -p "$APPLICATIONS_DIR" "$LAUNCHERS_DIR"',
    'chown "$TARGET_USER:$PRIMARY_GROUP" "$APPLICATIONS_DIR" "$LAUNCHERS_DIR"',
    'rm -rf "$LAUNCHER_APP"',
    'mkdir -p "$MACOS_DIR" "$RESOURCES_DIR"',
    '',
  ];

  lines.push(
    `cat <<'PLISTEOF' > "$CONTENTS_DIR/Info.plist"`,
    infoPlist.trimEnd(),
    'PLISTEOF',
    'printf \'APPL????\' > "$CONTENTS_DIR/PkgInfo"',
    '',
    `cat <<'EXECEOF' > "$EXECUTABLE_PATH"`,
    launcherScript.trimEnd(),
    'EXECEOF',
    'chmod 755 "$EXECUTABLE_PATH"',
    ''
  );

  lines.push(
    'if [ -f "$ICON_SOURCE" ]; then',
    '  cp "$ICON_SOURCE" "$RESOURCES_DIR/AppIcon.icns"',
    'fi',
    '',
    'chown -R "$TARGET_USER:$PRIMARY_GROUP" "$LAUNCHER_APP"',
    '',
    'LSREGISTER="/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister"',
    'if [ -x "$LSREGISTER" ]; then',
    '  "$LSREGISTER" -f "$LAUNCHER_APP" >/dev/null 2>&1 || true',
    'fi',
    '',
    'exit 0',
    ''
  );

  return lines.join('\n');
};

export const createMacPkgInstaller = async (options: CreateMacPkgInstallerOptions): Promise<void> => {
  const runCommand = options.runCommand ?? defaultRunCommand;
  const appBundlePath = path.resolve(options.appBundlePath);
  const outputDir = path.dirname(options.outputPath);
  const stagingDir = path.join(outputDir, `.pkg-build-${Date.now()}`);
  const payloadRoot = path.join(stagingDir, 'payload-root');
  const scriptsDir = path.join(stagingDir, 'scripts');
  const packagesDir = path.join(stagingDir, 'packages');
  const postinstallPath = path.join(scriptsDir, 'postinstall');
  const componentPackagePath = path.join(packagesDir, 'Chips-Host-component.pkg');
  const distributionPath = path.join(stagingDir, 'Distribution.xml');

  await ensureFile(appBundlePath, 'Chips.app bundle is unavailable for installer packaging.');
  await fs.mkdir(outputDir, { recursive: true });
  await fs.rm(options.outputPath, { force: true });
  await fs.rm(stagingDir, { recursive: true, force: true });
  await stageMacInstallerPayloadRoot(appBundlePath, payloadRoot);
  await fs.mkdir(scriptsDir, { recursive: true });
  await fs.mkdir(packagesDir, { recursive: true });

  await fs.writeFile(postinstallPath, createMacPostinstallScript(options.packageVersion), 'utf-8');
  await fs.chmod(postinstallPath, 0o755);
  try {
    await runCommand(
      'pkgbuild',
      [
        '--identifier', COMPONENT_PACKAGE_IDENTIFIER,
        '--version', options.packageVersion,
        '--root', payloadRoot,
        '--install-location', '/',
        '--scripts', scriptsDir,
        componentPackagePath
      ],
      { env: PACKAGE_TOOL_ENV }
    );
    await sanitizeFlatComponentPackage(componentPackagePath);
    await runCommand(
      'productbuild',
      [
        '--synthesize',
        '--package', componentPackagePath,
        distributionPath
      ],
      { env: PACKAGE_TOOL_ENV }
    );
    await sanitizeDistributionFile(distributionPath);
    await runCommand(
      'productbuild',
      [
        '--distribution', distributionPath,
        '--package-path', packagesDir,
        '--identifier', APP_BUNDLE_IDENTIFIER,
        '--version', options.packageVersion,
        options.outputPath
      ],
      { env: PACKAGE_TOOL_ENV }
    );
    await sanitizeFlatProductArchive(options.outputPath);
  } finally {
    await fs.rm(stagingDir, { recursive: true, force: true });
  }
};

const buildProject = async (dir: string, script: string, runCommand: RunCommandFn): Promise<void> => {
  await runCommand('npm', ['run', script], { cwd: dir });
};

const stripMacExtendedAttributes = async (targetPath: string, runCommand: RunCommandFn): Promise<void> => {
  await runCommand('xattr', ['-cr', targetPath]);
};

export const buildMacHostInstaller = async (
  options: BuildMacHostInstallerOptions
): Promise<BuildMacHostInstallerResult> => {
  if (process.platform !== 'darwin') {
    throw createError('HOST_INSTALLER_PLATFORM_UNSUPPORTED', 'macOS installer can only be built on macOS.', {
      platform: process.platform
    });
  }

  const runCommand = options.runCommand ?? defaultRunCommand;
  const hostProjectDir = path.resolve(options.hostProjectDir);
  const workspaceRoot = path.resolve(options.workspaceRoot);
  const outputDir = path.resolve(options.outputDir);
  const builtInPluginBundles = await resolveAvailableBuiltInPluginBundles(
    options.builtInPluginBundles ?? defaultBuiltInPluginBundles(workspaceRoot)
  );

  if (options.buildPrerequisites !== false) {
    const uniqueBuildDirs = unique(builtInPluginBundles.map((bundle) => bundle.sourceDir));
    for (const dir of uniqueBuildDirs) {
      await buildProject(dir, 'build', runCommand);
    }
    await buildProject(hostProjectDir, 'build', runCommand);
  }

  const prepared = await prepareMacHostAppBundle({
    hostProjectDir,
    workspaceRoot,
    outputDir,
    electronAppPath: options.electronAppPath,
    yamlPackageDir: options.yamlPackageDir,
    builtInPluginBundles
  });

  const installerPath = path.join(outputDir, `Chips-Host-${prepared.packageVersion}-macos.pkg`);
  await stripMacExtendedAttributes(prepared.appBundlePath, runCommand);
  await createMacPkgInstaller({
    appBundlePath: prepared.appBundlePath,
    outputPath: installerPath,
    packageVersion: prepared.packageVersion,
    runCommand
  });

  return {
    ...prepared,
    installerPath
  };
};

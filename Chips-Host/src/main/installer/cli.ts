#!/usr/bin/env node

import path from 'node:path';
import { buildMacHostInstaller, discoverDefaultBuiltInPluginBundles } from './macos-installer';
import { toStandardError } from '../../shared/errors';

interface InstallerCliOptions {
  command: string;
  outputDir?: string;
  skipPrerequisites?: boolean;
  listPlugins?: boolean;
}

const parseArgs = (argv: string[]): InstallerCliOptions => {
  const options: InstallerCliOptions = { command: 'help' };
  const positional: string[] = [];

  for (const item of argv) {
    if (item.startsWith('--output=')) {
      options.outputDir = item.slice('--output='.length).trim();
      continue;
    }
    if (item === '--skip-prerequisites') {
      options.skipPrerequisites = true;
      continue;
    }
    if (item === '--list-plugins') {
      options.listPlugins = true;
      continue;
    }
    positional.push(item);
  }

  if (positional.length > 0) {
    options.command = positional[0]!;
  }
  return options;
};

const createDefaultOutputDir = (workspaceRoot: string): string => {
  const now = new Date();
  const year = now.getFullYear().toString().padStart(4, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return path.join(workspaceRoot, 'release-artifacts', `${year}-${month}-${day}`, 'macos-installer');
};

const USAGE = [
  'Usage: tsx src/main/installer/cli.ts macos [options]',
  '',
  'Options:',
  '  --output=<dir>             自定义产物输出目录（相对 Host 工程或绝对路径）',
  '  --skip-prerequisites       跳过前置构建（插件与 Host 构建），使用现有产物',
  '  --list-plugins             仅列出将被内置的官方插件工程，不执行构建',
  ''
].join('\n');

const run = async (): Promise<void> => {
  const hostProjectDir = process.cwd();
  const workspaceRoot = path.resolve(hostProjectDir, '..');
  const options = parseArgs(process.argv.slice(2));

  if (options.command !== 'macos') {
    process.stdout.write(USAGE);
    return;
  }

  const outputDir = options.outputDir
    ? path.resolve(hostProjectDir, options.outputDir)
    : createDefaultOutputDir(workspaceRoot);

  if (options.listPlugins) {
    const bundles = await discoverDefaultBuiltInPluginBundles(workspaceRoot);
    process.stdout.write(
      JSON.stringify(
        bundles.map((bundle) => ({
          id: bundle.id,
          sourceDir: bundle.sourceDir,
          includePaths: bundle.includePaths
        })),
        null,
        2
      ) + '\n'
    );
    return;
  }

  const result = await buildMacHostInstaller({
    hostProjectDir,
    workspaceRoot,
    outputDir,
    buildPrerequisites: options.skipPrerequisites === true ? false : true
  });

  process.stdout.write(
    JSON.stringify(
      {
        appBundlePath: result.appBundlePath,
        installerPath: result.installerPath,
        packageVersion: result.packageVersion,
        builtInPluginRoot: result.builtInPluginRoot
      },
      null,
      2
    ) + '\n'
  );
};

if (require.main === module) {
  void run().catch((error) => {
    const standard = toStandardError(error, 'HOST_INSTALLER_BUILD_FAILED');
    process.stderr.write(`${standard.code}: ${standard.message}\n`);
    process.exitCode = 1;
  });
}

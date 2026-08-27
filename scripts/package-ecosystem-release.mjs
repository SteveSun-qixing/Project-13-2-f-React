#!/usr/bin/env node

/**
 * 生态预发布打包脚本
 *
 * 职责：
 * 1. 自动发现工作区中全部官方插件工程（app/card/layout/module）；
 * 2. 对每个插件执行 build -> validate -> package，产出 .cpk；
 * 3. 将 .cpk 归档到打包输出目录的 cpk/ 子目录；
 * 4. 构建 Host 并调用 macOS 安装器，产出 Chips.app 与 .pkg。
 *
 * 用法：
 *   node scripts/package-ecosystem-release.mjs [--output=../打包/V0.01] [--skip-build]
 */

import fs from 'node:fs';
import path from 'node:path';
import childProcess from 'node:child_process';

const workspaceRoot = process.cwd();
const hostProjectDir = path.join(workspaceRoot, 'Chips-Host');

const NON_PLUGIN_PROJECT_DIRS = new Set([
  'Chips-Host',
  'Chips-SDK',
  'Chips-Scaffold',
  'Chips-Ui',
  'Chips-CommunityPlatformServer',
  'Chips-PersonalServer',
  'Chip-iconMaker'
]);

const PLUGIN_COLLECTION_DIRS = ['Chips-BaseCardPlugin', 'Chips-BoxLayoutPlugin', 'Chips-ModulePlugin'];

const OFFICIAL_PLUGIN_TYPE_NAMES = ['app', 'card', 'layout', 'module'];

const runCommand = (command, args, options = {}) => {
  const result = childProcess.spawnSync(command, args, {
    cwd: options.cwd ?? workspaceRoot,
    stdio: 'inherit',
    env: { ...process.env, ...(options.env ?? {}) }
  });
  if (result.status !== 0) {
    throw new Error(`命令执行失败：${command} ${args.join(' ')}（exit=${result.status}）`);
  }
};

const pathExists = (targetPath) => {
  try {
    fs.accessSync(targetPath);
    return true;
  } catch {
    return false;
  }
};

const readYamlIdAndType = (manifestPath) => {
  const raw = fs.readFileSync(manifestPath, 'utf-8');
  let id = '';
  let type = '';
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
    if (!match) {
      continue;
    }
    const [, key, value] = match;
    if (key === 'id' && value.trim().startsWith('"')) {
      id = value.trim().replace(/^"|"$/g, '');
    } else if (key === 'type') {
      type = value.trim().replace(/^"|"$/g, '');
    }
  }
  return { id, type };
};

const discoverOfficialPluginProjects = () => {
  const projects = [];

  const topLevelEntries = fs.readdirSync(workspaceRoot, { withFileTypes: true });
  for (const entry of topLevelEntries) {
    if (!entry.isDirectory()) {
      continue;
    }
    if (NON_PLUGIN_PROJECT_DIRS.has(entry.name)) {
      continue;
    }
    if (PLUGIN_COLLECTION_DIRS.includes(entry.name)) {
      continue;
    }
    const manifestPath = path.join(workspaceRoot, entry.name, 'manifest.yaml');
    if (!pathExists(manifestPath)) {
      continue;
    }
    projects.push(path.join(workspaceRoot, entry.name));
  }

  for (const collectionDir of PLUGIN_COLLECTION_DIRS) {
    const collectionPath = path.join(workspaceRoot, collectionDir);
    if (!pathExists(collectionPath)) {
      continue;
    }
    const entries = fs.readdirSync(collectionPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name === 'tests' || entry.name === '归档' || entry.name === 'node_modules') {
        continue;
      }
      const manifestPath = path.join(collectionPath, entry.name, 'manifest.yaml');
      if (!pathExists(manifestPath)) {
        continue;
      }
      projects.push(path.join(collectionPath, entry.name));
    }
  }

  return projects.sort();
};

const findCpkInDist = (projectDir) => {
  const distDir = path.join(projectDir, 'dist');
  if (!pathExists(distDir)) {
    return null;
  }
  const cpkFiles = fs.readdirSync(distDir).filter((name) => name.endsWith('.cpk'));
  if (cpkFiles.length === 0) {
    return null;
  }
  cpkFiles.sort((left, right) => right.localeCompare(left));
  return path.join(distDir, cpkFiles[0]);
};

const parseArgs = (argv) => {
  const options = { outputDir: null, skipBuild: false, listPlugins: false };
  for (const item of argv) {
    if (item.startsWith('--output=')) {
      options.outputDir = item.slice('--output='.length).trim();
    } else if (item === '--skip-build') {
      options.skipBuild = true;
    } else if (item === '--list-plugins') {
      options.listPlugins = true;
    }
  }
  return options;
};

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  const outputRoot = options.outputDir ? path.resolve(workspaceRoot, options.outputDir) : null;
  const cpkOutputDir = outputRoot ? path.join(outputRoot, 'cpk') : null;

  console.log('=== 薯片生态预发布打包 ===');
  console.log(`工作区：${workspaceRoot}`);

  const projects = discoverOfficialPluginProjects();
  console.log(`发现官方插件工程：${projects.length} 个`);

  const pluginSummary = [];
  for (const projectDir of projects) {
    const manifestPath = path.join(projectDir, 'manifest.yaml');
    const { id, type } = readYamlIdAndType(manifestPath);
    pluginSummary.push({ id, type, dir: projectDir });
  }

  for (const plugin of pluginSummary) {
    console.log(`  [${plugin.type}] ${plugin.id}  ${path.relative(workspaceRoot, plugin.dir)}`);
  }

  if (options.listPlugins) {
    return;
  }

  if (cpkOutputDir) {
    fs.mkdirSync(cpkOutputDir, { recursive: true });
  }

  const packagedPlugins = [];
  for (const plugin of pluginSummary) {
    if (!OFFICIAL_PLUGIN_TYPE_NAMES.includes(plugin.type)) {
      continue;
    }
    console.log(`\n--- 打包 ${plugin.id} ---`);
    if (!options.skipBuild) {
      runCommand('npm', ['run', 'build'], { cwd: plugin.dir });
      runCommand('npm', ['run', 'validate'], { cwd: plugin.dir });
    }
    runCommand('npm', ['run', 'package'], { cwd: plugin.dir });

    const cpkPath = findCpkInDist(plugin.dir);
    if (!cpkPath) {
      throw new Error(`插件 ${plugin.id} 未生成 .cpk 产物`);
    }
    if (cpkOutputDir) {
      const targetName = path.basename(cpkPath);
      fs.copyFileSync(cpkPath, path.join(cpkOutputDir, targetName));
      console.log(`  .cpk -> ${path.join(cpkOutputDir, targetName)}`);
    }
    packagedPlugins.push({ id: plugin.id, type: plugin.type, cpk: cpkPath });
  }

  console.log(`\n=== 插件打包完成：${packagedPlugins.length} 个 .cpk ===`);

  if (!options.skipBuild) {
    console.log('\n--- 构建 Host ---');
    runCommand('npm', ['run', 'build'], { cwd: hostProjectDir });
  }

  if (!outputRoot) {
    console.log('\n未指定 --output，跳过安装器构建。');
    return;
  }

  console.log('\n--- 构建 macOS 安装器 ---');
  const installerOutput = path.join(outputRoot, 'macos-installer');
  const args = [
    path.join(hostProjectDir, 'src', 'main', 'installer', 'cli.ts'),
    'macos',
    `--output=${installerOutput}`,
    '--skip-prerequisites'
  ];
  runCommand('npx', ['tsx', ...args], { cwd: hostProjectDir });

  console.log(`\n=== 预发布打包完成 ===`);
  console.log(`产物目录：${outputRoot}`);
  if (cpkOutputDir) {
    console.log(`插件包：${cpkOutputDir}`);
  }
  console.log(`安装器：${installerOutput}`);
};

main().catch((error) => {
  console.error(`\n打包失败：${error.message}`);
  process.exitCode = 1;
});

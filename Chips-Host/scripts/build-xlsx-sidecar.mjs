#!/usr/bin/env node
/**
 * xlsx-sidecar 引擎二进制构建与分发脚本。
 *
 * 职责：
 * 1. 在 GenOffice 上游源码目录（`OpenSourceProjectHandlingFolder/GenOffice/
 *    genoffice-main/apps/sheets/native/xlsx-engine`）执行 `cargo build --release`
 *    构建 `xlsx-sidecar` 二进制；
 * 2. 将产物复制到 `Chips-Host/resources/engines/xlsx-sidecar/<platform>-<arch>/`
 *    分发目录（或 `--out` 指定的目录）。
 *
 * 用法：
 *   node scripts/build-xlsx-sidecar.mjs                       # 宿主默认目标（darwin-arm64 等）
 *   node scripts/build-xlsx-sidecar.mjs --target x86_64-apple-darwin --out darwin-x64
 *   node scripts/build-xlsx-sidecar.mjs --skip-copy           # 只构建，不复制
 *
 * 说明：
 * - `--target <triple>` 传递给 cargo 的 `--target`（交叉构建）；
 * - `--out <dir>` 为 `resources/engines/xlsx-sidecar/` 下的相对目录名，
 *   缺省时按宿主 `process.platform`/`process.arch` 推导（win32-x64、linux-x64、
 *   darwin-arm64、darwin-x64）；
 * - 产物名：非 Windows 平台为 `xlsx-sidecar`，Windows 平台为 `xlsx-sidecar.exe`；
 * - registry 配置与上游验证过的命令保持一致（rsproxy sparse 索引）。
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const hostRoot = path.resolve(scriptDir, '..');
const workspaceRoot = path.resolve(hostRoot, '..');
const upstreamEngineDir = path.join(
  workspaceRoot,
  'OpenSourceProjectHandlingFolder',
  'GenOffice',
  'genoffice-main',
  'apps',
  'sheets',
  'native',
  'xlsx-engine',
);

const cargoRegistryArgs = [
  '--config', 'source.crates-io.replace-with="rsproxy"',
  '--config', 'source.rsproxy.registry="sparse+https://rsproxy.cn/index/"',
];

const parseArgs = (argv) => {
  const options = { target: undefined, out: undefined, skipCopy: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--target') {
      index += 1;
      options.target = argv[index];
    } else if (value === '--out') {
      index += 1;
      options.out = argv[index];
    } else if (value === '--skip-copy') {
      options.skipCopy = true;
    } else if (value === '--help' || value === '-h') {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${value}`);
    }
  }
  return options;
};

const defaultPlatformDir = () => {
  if (process.platform === 'darwin') {
    return process.arch === 'arm64' ? 'darwin-arm64' : 'darwin-x64';
  }
  if (process.platform === 'win32') {
    return process.arch === 'arm64' ? 'win32-arm64' : 'win32-x64';
  }
  return process.arch === 'arm64' ? 'linux-arm64' : 'linux-x64';
};

const builtBinaryPath = (targetTriple) => {
  const binaryName = process.platform === 'win32' || targetTriple?.startsWith('x86_64-pc-windows') || targetTriple?.includes('windows')
    ? 'xlsx-sidecar.exe'
    : 'xlsx-sidecar';
  return targetTriple
    ? path.join(upstreamEngineDir, 'target', targetTriple, 'release', binaryName)
    : path.join(upstreamEngineDir, 'target', 'release', binaryName);
};

const main = () => {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log('Usage: node scripts/build-xlsx-sidecar.mjs [--target <triple>] [--out <platform-dir>] [--skip-copy]');
    return;
  }
  if (!fs.existsSync(path.join(upstreamEngineDir, 'Cargo.toml'))) {
    throw new Error(`Upstream engine directory not found: ${upstreamEngineDir}`);
  }

  const buildArgs = [...cargoRegistryArgs, 'build', '--release', '--bin', 'xlsx-sidecar'];
  if (options.target) {
    buildArgs.push('--target', options.target);
  }
  console.log(`[build-xlsx-sidecar] cargo ${buildArgs.join(' ')}`);
  const build = spawnSync('cargo', buildArgs, {
    cwd: upstreamEngineDir,
    stdio: 'inherit',
  });
  if (build.error) {
    throw build.error;
  }
  if (build.status !== 0) {
    throw new Error(`cargo build failed with exit code ${build.status}`);
  }

  const built = builtBinaryPath(options.target);
  if (!fs.existsSync(built)) {
    throw new Error(`Built binary not found: ${built}`);
  }

  if (options.skipCopy) {
    console.log(`[build-xlsx-sidecar] built: ${built} (copy skipped)`);
    return;
  }

  const platformDirName = options.out ?? defaultPlatformDir();
  const outputDir = path.join(hostRoot, 'resources', 'engines', 'xlsx-sidecar', platformDirName);
  fs.mkdirSync(outputDir, { recursive: true });
  const outputBinaryName = path.basename(built);
  const outputPath = path.join(outputDir, outputBinaryName);
  fs.copyFileSync(built, outputPath);
  if (outputBinaryName !== 'xlsx-sidecar.exe') {
    fs.chmodSync(outputPath, 0o755);
  }
  console.log(`[build-xlsx-sidecar] distributed: ${outputPath}`);
};

try {
  main();
} catch (error) {
  console.error(`[build-xlsx-sidecar] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}

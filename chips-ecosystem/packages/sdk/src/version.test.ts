/**
 * 平台版本常量门禁（02-SDK-API规范 §10.1、代码组织规范 §3.4、核心接口规范 §3.4 与九）。
 *
 * 口径：`PLATFORM_VERSION` 与平台统一版本包（`@chips/bridge`、`@chips/host`、`@chips/sdk`、
 * `@chips/ui`）及全部 Rust crate 的声明版本同值，任一平台包发布时统一升版；
 * `@chips/antd` 跟随上游 antd 主版本，不参与平台统一版本（代码组织规范 §3.4 例外条款）。
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { PLATFORM_VERSION } from './version.js';

/** 仓库根目录（`src/` 上溯三级）。 */
const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

/** 参与平台统一版本的包目录（代码组织规范 §3.4 版本条目点名的四个包）。 */
const PLATFORM_PACKAGES = [
  'packages/sdk',
  'packages/bridge',
  'packages/host',
  'packages/ui',
] as const;

/** 语义化版本与预发布后缀（§10.1：依次使用 `-alpha.N`、`-beta.N`、`-rc.N`）。 */
const SEMVER_PATTERN = /^(\d+)\.(\d+)\.(\d+)(?:-(alpha|beta|rc)\.(\d+))?$/u;

/** Cargo `[workspace.package]` 段的版本声明。 */
const CARGO_VERSION_PATTERN = /^\[workspace\.package\][\s\S]*?^version\s*=\s*"([^"]+)"/mu;

/**
 * 读取包 `package.json` 的 `name` 与 `version`。
 *
 * @param dir - 相对仓库根的包目录
 * @returns 包名与版本
 */
function readPackageManifest(dir: string): { name: string; version: string } {
  const manifest: unknown = JSON.parse(readFileSync(`${REPO_ROOT}${dir}/package.json`, 'utf8'));
  if (typeof manifest !== 'object' || manifest === null || !('name' in manifest)) {
    throw new Error(`${dir}/package.json 缺少 name`);
  }
  const { name, version } = manifest as { name: unknown; version?: unknown };
  if (typeof name !== 'string' || typeof version !== 'string') {
    throw new Error(`${dir}/package.json 的 name 与 version 必须为字符串`);
  }
  return { name, version };
}

/**
 * 读取 Cargo 工作区清单的 `[workspace.package] version`。
 *
 * @param file - 相对仓库根的 Cargo 清单路径
 * @returns 工作区声明版本
 */
function readCargoWorkspaceVersion(file: string): string {
  const matched = CARGO_VERSION_PATTERN.exec(readFileSync(`${REPO_ROOT}${file}`, 'utf8'));
  const version = matched?.[1];
  if (version === undefined) {
    throw new Error(`${file} 缺少 [workspace.package] 的 version 声明`);
  }
  return version;
}

describe('PLATFORM_VERSION（02-SDK-API规范 §10.1）', () => {
  it('是合法的语义化版本，预发布后缀只允许 alpha / beta / rc', () => {
    expect(SEMVER_PATTERN.test(PLATFORM_VERSION)).toBe(true);
  });

  it('第一版发布前处于 0.x 起点区间', () => {
    const matched = SEMVER_PATTERN.exec(PLATFORM_VERSION);
    expect(matched).not.toBeNull();
    expect(matched?.[1]).toBe('0');
    expect(Number(matched?.[2])).toBeGreaterThanOrEqual(1);
  });

  it('与平台统一版本包的 package.json 同值，禁止版本漂移', () => {
    const names: string[] = [];
    for (const dir of PLATFORM_PACKAGES) {
      const manifest = readPackageManifest(dir);
      names.push(manifest.name);
      expect(manifest.version, manifest.name).toBe(PLATFORM_VERSION);
    }
    expect(names.sort()).toEqual([
      '@chips/bridge',
      '@chips/host',
      '@chips/sdk',
      '@chips/ui',
    ]);
  });

  it('与 Rust 工作区声明版本同值，全部 crate 继承同一 workspace 版本', () => {
    expect(readCargoWorkspaceVersion('Cargo.toml')).toBe(PLATFORM_VERSION);
    expect(readCargoWorkspaceVersion('packages/core-rust/Cargo.toml')).toBe(PLATFORM_VERSION);
  });

  it('内部依赖一律使用 workspace 协议，不写死版本号', () => {
    const manifest: unknown = JSON.parse(
      readFileSync(`${REPO_ROOT}packages/sdk/package.json`, 'utf8'),
    );
    if (typeof manifest !== 'object' || manifest === null || !('dependencies' in manifest)) {
      throw new Error('packages/sdk/package.json 缺少 dependencies');
    }
    const dependencies = (manifest as { dependencies: unknown }).dependencies;
    if (typeof dependencies !== 'object' || dependencies === null) {
      throw new Error('packages/sdk/package.json 的 dependencies 形状不合法');
    }
    for (const [name, range] of Object.entries(dependencies as Record<string, unknown>)) {
      expect(range, name).toBe('workspace:*');
    }
  });
});

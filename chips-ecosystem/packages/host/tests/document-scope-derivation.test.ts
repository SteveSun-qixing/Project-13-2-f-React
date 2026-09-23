/**
 * 文档挂载 scope 派生算法锁测（工单036 波 A2b-α，任务 #217 第 2 项）。
 *
 * 权威：《04.11》§11.3 派生规则 + 裁决I-⑤ 三细则（软链解析做 / 大小写折叠不做 /
 * 尾分隔符去除·根 `/` 例外）；OQ-1 40 hex 截断；OQ-7 `DOCUMENT_SCOPE_OWNER`。
 * 夹具全部运行时临时目录/符号链接自建自清，不落静态盘。
 */

import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import {
  DOCUMENT_SCOPE_HEX_LENGTH,
  DOCUMENT_SCOPE_ID_MAX_LENGTH,
  DOCUMENT_SCOPE_OWNER,
  canonicalizeDocumentPath,
  deriveDocumentScope,
  deriveDocumentScopeFromCanonical,
  documentScopePrefix,
  hashCanonicalDocumentPath,
  stripTrailingSeparators,
} from '../src/capabilities/document/scope-derivation.js';
import { DocumentCapabilityError } from '../src/capabilities/document/errors.js';

const tempRoot = mkdtempSync(join(realpathSync(tmpdir()), 'w217-derive-'));
const tempDirs: string[] = [];

function makeTempDir(name: string): string {
  const dir = join(tempRoot, name);
  tempDirs.push(dir);
  return dir;
}

afterAll(() => {
  rmSync(tempRoot, { recursive: true, force: true });
});

describe('scope 派生 · 裁决I-⑤ 三细则', () => {
  it('细则一（软链解析＝做）：指向同一物理根的两条路径派生同一 scope', () => {
    const target = makeTempDir('target.card');
    mkdirSyncShallow(target);
    const link = join(tempRoot, 'link.card');
    symlinkSync(target, link);
    expect(deriveDocumentScope(link, 'card')).toBe(deriveDocumentScope(target, 'card'));
  });

  it('细则三（尾分隔符＝去除）：/a/b 与 /a/b/ 同形；文件系统根为唯一例外', () => {
    expect(stripTrailingSeparators('/a/b')).toBe('/a/b');
    expect(stripTrailingSeparators('/a/b/')).toBe('/a/b');
    expect(stripTrailingSeparators('/a/b///')).toBe('/a/b');
    // 根例外：全分隔符路径归一为单形 `/`，不被剥成空串。
    expect(stripTrailingSeparators('/')).toBe('/');
    expect(stripTrailingSeparators('//')).toBe('/');
    const dir = makeTempDir('tail.card');
    mkdirSyncShallow(dir);
    expect(deriveDocumentScope(`${dir}/`, 'card')).toBe(deriveDocumentScope(dir, 'card'));
    expect(deriveDocumentScope(`${dir}///`, 'card')).toBe(deriveDocumentScope(dir, 'card'));
  });

  it('细则二（大小写折叠＝不做）：哈希输入取 canonical 原字节', () => {
    expect(hashCanonicalDocumentPath('/A/b')).not.toBe(hashCanonicalDocumentPath('/a/b'));
    expect(hashCanonicalDocumentPath('/A/b')).toBe(
      createHash('sha256').update('/A/b', 'utf8').digest('hex').slice(0, DOCUMENT_SCOPE_HEX_LENGTH),
    );
  });
});

describe('scope 派生 · 形状与算法锁定', () => {
  it('前缀按来源形分派：card→card-、box→box-', () => {
    expect(documentScopePrefix('card')).toBe('card-');
    expect(documentScopePrefix('box')).toBe('box-');
    const dir = makeTempDir('prefix.card');
    mkdirSyncShallow(dir);
    expect(deriveDocumentScope(dir, 'card').startsWith('card-')).toBe(true);
    expect(deriveDocumentScope(dir, 'box').startsWith('box-')).toBe(true);
  });

  it('结果字符集合与长度：hex 前缀形恒合 `[a-z][a-z0-9-]*` 且 ≤64（实为 45）', () => {
    const dir = makeTempDir('shape.box');
    mkdirSyncShallow(dir);
    const scope = deriveDocumentScope(dir, 'box');
    expect(scope).toMatch(/^[a-z][a-z0-9-]*$/u);
    expect(scope.length).toBeLessThanOrEqual(DOCUMENT_SCOPE_ID_MAX_LENGTH);
    expect(scope.length).toBe('box-'.length + DOCUMENT_SCOPE_HEX_LENGTH);
    expect(scope.slice(4)).toMatch(/^[0-9a-f]{40}$/u);
  });

  it('确定性：同 canonical 输入两次派生逐字节相等，且等于 sha256 前 40 hex 直算形', () => {
    const canonical = '/chips/fixture/deterministic.card';
    const first = deriveDocumentScopeFromCanonical(canonical, 'card');
    const second = deriveDocumentScopeFromCanonical(canonical, 'card');
    const expected = `card-${createHash('sha256').update(canonical, 'utf8').digest('hex').slice(0, 40)}`;
    expect(first).toBe(second);
    expect(first).toBe(expected);
  });

  it('DOCUMENT_SCOPE_OWNER 值锁（OQ-7 定案，绑定层与文档表三方同源）', () => {
    expect(DOCUMENT_SCOPE_OWNER).toBe('chips.official.document-service');
  });
});

describe('canonicalizeDocumentPath · fail-closed 臂', () => {
  function failureOf(run: () => unknown): DocumentCapabilityError {
    try {
      run();
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(DocumentCapabilityError);
      return error as DocumentCapabilityError;
    }
    throw new Error('expected failure');
  }

  it('非绝对路径拒收 RESOURCE_INVALID_URI', () => {
    expect(failureOf(() => canonicalizeDocumentPath('relative/x.card')).code).toBe('RESOURCE_INVALID_URI');
    expect(failureOf(() => canonicalizeDocumentPath('')).code).toBe('RESOURCE_INVALID_URI');
  });

  it('目标缺失拒收 RESOURCE_NOT_FOUND，文案零路径（《06.07》§7.1 不泄露口径）', () => {
    const missing = join(tempRoot, 'no-such-package.card');
    const error = failureOf(() => canonicalizeDocumentPath(missing));
    expect(error.code).toBe('RESOURCE_NOT_FOUND');
    expect(error.message).not.toContain('w217-derive-');
    expect(error.message).not.toContain(missing);
  });
});

/** 浅建目录（仅包根本身，内容物不影响派生）。 */
function mkdirSyncShallow(dir: string): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'manifest.yaml'), 'placeholder\n', 'utf8');
}

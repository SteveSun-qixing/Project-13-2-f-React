/**
 * `document:*` 摘要与指纹口径单测（`11-文档服务设计` §5.5 四口径 + §7.1 指纹基线 + §9.2 包内路径）。
 *
 * 覆盖：成员摘要 / 包内容摘要 / 文件摘要 / 快速指纹摘要的计算口径与不变量（升序、稳定、可复算）、
 * 源指纹等值比较、字节总量、包内路径安全规则逐项。
 */

import { describe, expect, it } from 'vitest';

import {
  comparePackagePath,
  canonicalizeSourceFingerprint,
  computeFileDigest,
  computePackageContentDigest,
  computeQuickFingerprintDigest,
  fingerprintTotalSize,
  isSafePackagePath,
  memberDigest,
  sha256Hex,
  sourceFingerprintsEqual,
  toDigestUrl,
} from '../src/capabilities/document/digest.js';
import type { IDigestMember, ISourceFingerprint } from '../src/capabilities/document/digest.js';

const ENCODER = new TextEncoder();

/** 便捷构造成员字节。 */
function member(packagePath: string, text: string): IDigestMember {
  return { packagePath, bytes: ENCODER.encode(text) };
}

/** 便捷构造源指纹。 */
function fingerprint(members: ISourceFingerprint['members']): ISourceFingerprint {
  return { members };
}

describe('comparePackagePath', () => {
  it('按 UTF-8 字节序升序比较包内路径', () => {
    expect(comparePackagePath('a.yaml', 'b.yaml')).toBeLessThan(0);
    expect(comparePackagePath('b.yaml', 'b.yaml')).toBe(0);
    expect(comparePackagePath('z.yaml', 'a.yaml')).toBeGreaterThan(0);
  });

  it('大写字母排在数字之后、小写字母之前（字节序而非字典序）', () => {
    expect(comparePackagePath('B.yaml', 'a.yaml')).toBeLessThan(0);
    expect(comparePackagePath('1.yaml', 'B.yaml')).toBeLessThan(0);
  });

  it('多字节字符按 UTF-8 字节比较', () => {
    expect(comparePackagePath('薯片.yaml', 'a.yaml')).toBeGreaterThan(0);
  });
});

describe('成员摘要与文件摘要', () => {
  it('成员摘要为不带前缀的 SHA-256 十六进制', () => {
    const bytes = ENCODER.encode('hello');
    expect(memberDigest(bytes)).toBe(sha256Hex(bytes));
    expect(memberDigest(bytes)).not.toMatch(/^sha256:/);
    expect(memberDigest(bytes)).toHaveLength(64);
  });

  it('文件摘要输出 sha256: 前缀形态', () => {
    expect(computeFileDigest(ENCODER.encode('hello'))).toBe(`sha256:${sha256Hex('hello')}`);
    expect(toDigestUrl('abc')).toBe('sha256:abc');
  });

  it('同字节同摘要、异字节异摘要（可复算）', () => {
    expect(computeFileDigest(ENCODER.encode('a'))).toBe(computeFileDigest(ENCODER.encode('a')));
    expect(computeFileDigest(ENCODER.encode('a'))).not.toBe(computeFileDigest(ENCODER.encode('b')));
  });
});

describe('computePackageContentDigest', () => {
  it('与成员枚举顺序无关（内部按路径升序）', () => {
    const a = [member('content/x.yaml', 'X'), member('structure.yaml', 'S')];
    const b = [member('structure.yaml', 'S'), member('content/x.yaml', 'X')];
    expect(computePackageContentDigest(a)).toBe(computePackageContentDigest(b));
  });

  it('尺寸参与拼接：内容改变即摘要改变', () => {
    const before = [member('structure.yaml', 'S')];
    const after = [member('structure.yaml', 'S2')];
    expect(computePackageContentDigest(before)).not.toBe(computePackageContentDigest(after));
  });

  it('成员增删改变摘要', () => {
    const two = [member('a.yaml', 'A'), member('b.yaml', 'B')];
    const one = [member('a.yaml', 'A')];
    expect(computePackageContentDigest(two)).not.toBe(computePackageContentDigest(one));
  });

  it('路径与尺寸同形歧义不误判（分隔符参与拼接）', () => {
    // `path` 含尺寸数字与不含尺寸的两种包不得碰撞：拼接使用 \0 分隔。
    const left = [member('a', 'x')];
    const right = [member('a\u00001\u0000', 'x')];
    expect(computePackageContentDigest(left)).not.toBe(computePackageContentDigest(right));
  });

  it('输出 sha256: 前缀', () => {
    expect(computePackageContentDigest([member('a.yaml', 'A')])).toMatch(/^sha256:[0-9a-f]{64}$/);
  });
});

describe('源指纹规范序列化与快速指纹摘要', () => {
  const base = fingerprint([
    { path: 'structure.yaml', size: 10, modifiedAtMs: 1, crc32: null },
    { path: 'content/a.yaml', size: 20, modifiedAtMs: 2, crc32: null },
  ]);

  it('成员按路径升序序列化（顺序无关）', () => {
    const reordered = fingerprint([
      { path: 'content/a.yaml', size: 20, modifiedAtMs: 2, crc32: null },
      { path: 'structure.yaml', size: 10, modifiedAtMs: 1, crc32: null },
    ]);
    expect(canonicalizeSourceFingerprint(base)).toBe(canonicalizeSourceFingerprint(reordered));
    expect(computeQuickFingerprintDigest(base)).toBe(computeQuickFingerprintDigest(reordered));
  });

  it('字段序固定且缺省 crc32 归一为 null', () => {
    // 端口来自非 TS 侧时可能缺省 `crc32`：规范序列化必须归一为 `null`，不得输出 `undefined`。
    const incomplete = { path: 'a.yaml', size: 1, modifiedAtMs: 2 } as ISourceFingerprint['members'][number];
    const canonical = canonicalizeSourceFingerprint(fingerprint([incomplete]));
    expect(JSON.parse(canonical)).toEqual([{ path: 'a.yaml', size: 1, modifiedAtMs: 2, crc32: null }]);
    expect(canonical.startsWith('[{"path"')).toBe(true);
  });

  it('归档态 crc32 参与指纹（同尺寸不同校验和可区分）', () => {
    const left = fingerprint([{ path: 'a.card', size: 5, modifiedAtMs: 1, crc32: 1 }]);
    const right = fingerprint([{ path: 'a.card', size: 5, modifiedAtMs: 1, crc32: 2 }]);
    expect(sourceFingerprintsEqual(left, right)).toBe(false);
  });

  it('修改时间变化即指纹变化（外部修改的判定依据）', () => {
    const later = fingerprint([{ path: 'a.yaml', size: 5, modifiedAtMs: 99, crc32: null }]);
    const earlier = fingerprint([{ path: 'a.yaml', size: 5, modifiedAtMs: 1, crc32: null }]);
    expect(sourceFingerprintsEqual(later, earlier)).toBe(false);
  });

  it('同指纹等值比较为真', () => {
    expect(sourceFingerprintsEqual(base, fingerprint([...base.members]))).toBe(true);
  });

  it('快速指纹摘要不读取资源字节：仅成员元数据变化才改变', () => {
    const sameMetadata = fingerprint(base.members.map((m) => ({ ...m })));
    expect(computeQuickFingerprintDigest(sameMetadata)).toBe(computeQuickFingerprintDigest(base));
    expect(computeQuickFingerprintDigest(base)).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it('字节总量按成员尺寸累加', () => {
    expect(fingerprintTotalSize(base)).toBe(30);
    expect(fingerprintTotalSize(fingerprint([]))).toBe(0);
  });
});

describe('isSafePackagePath', () => {
  it('接受常规包内路径', () => {
    for (const path of ['structure.yaml', 'content/abc1234567.yaml', 'a/b/c/d.yaml', '中文.yaml']) {
      expect(isSafePackagePath(path)).toBe(true);
    }
  });

  it('拒绝空路径与控制字符', () => {
    expect(isSafePackagePath('')).toBe(false);
    expect(isSafePackagePath('a\u0000b')).toBe(false);
    expect(isSafePackagePath('a\nb')).toBe(false);
    expect(isSafePackagePath('a\u007fb')).toBe(false);
  });

  it('拒绝绝对路径、反斜杠与空段', () => {
    expect(isSafePackagePath('/etc/passwd')).toBe(false);
    expect(isSafePackagePath('a\\b.yaml')).toBe(false);
    expect(isSafePackagePath('a//b.yaml')).toBe(false);
    expect(isSafePackagePath('a/')).toBe(false);
  });

  it('拒绝路径穿越段', () => {
    expect(isSafePackagePath('../evil.yaml')).toBe(false);
    expect(isSafePackagePath('a/../../b.yaml')).toBe(false);
    expect(isSafePackagePath('./a.yaml')).toBe(false);
  });

  it('拒绝超长路径', () => {
    expect(isSafePackagePath(`a/${'b'.repeat(4096)}`)).toBe(false);
  });
});

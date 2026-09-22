/**
 * 审计脱敏单点测试（《08.08》§8.5 三律逐臂；工单046 段二）。
 *
 * 权威对应：
 * - 条 1 不记录凭证值/文件内容/网络请求体 → 拾取闸（`sanitizeAuditEntry` 只出 16 契约字段）；
 * - 条 2 网络目标只记录 scheme、host 与 port → 裸 `http(s)` 与
 *   `chips-resource://external/...` 两形态降为 scheme+host[:port]；
 * - 条 3 路径属用户数据可入审计文件 → 文件系统路径原样保留（§8.3 样例同形）；
 * - URI query 脱敏沿用 `protocol/resource-uri.ts` 在册口径（External query 不入定位器、
 *   回写通道按《06》9.4 脱敏后审计）。
 */

import { describe, expect, it } from 'vitest';

import { sanitizeAuditEntry, sanitizeAuditUriValue } from '../src/audit/sanitize.js';
import { makeAuditEntry } from './helpers/audit-fixture.js';

describe('sanitizeAuditUriValue：§8.5 条 2 网络目标降形', () => {
  it('裸 https 目标：只留 scheme+host（默认端口省略），path/query/userinfo 全剥', () => {
    expect(sanitizeAuditUriValue('https://api.example.com/v1/documents?token=secret&x=1')).toBe(
      'https://api.example.com',
    );
    expect(sanitizeAuditUriValue('http://user:pass@host.example/a/b')).toBe('http://host.example');
  });

  it('裸 http 非默认端口保留（只记录 scheme、host 与 port 的字面口径）', () => {
    expect(sanitizeAuditUriValue('http://mirror.example:8080/repo/pkg.tgz?sig=abc')).toBe('http://mirror.example:8080');
  });

  it('external 资源 URI：降为 chips-resource://external/<scheme>/<host>[:<port>]（path 与 query 不入审计）', () => {
    expect(
      sanitizeAuditUriValue('chips-resource://external/https/download.example.com/files/a.bin?X-Amz-Credential=zzz'),
    ).toBe('chips-resource://external/https/download.example.com');
    expect(sanitizeAuditUriValue('chips-resource://external/http/cdn.example.com:8443/img')).toBe(
      'chips-resource://external/http/cdn.example.com:8443',
    );
  });

  it('非 external chips-resource 定位器：规范回写保 path、剥 query（resource-uri.ts:484 在册口径）', () => {
    expect(sanitizeAuditUriValue('chips-resource://platform/docs/a.card')).toBe(
      'chips-resource://platform/docs/a.card',
    );
    expect(sanitizeAuditUriValue('chips-resource://plugin-chips.official.editor/data/x.bin?v=3')).toBe(
      'chips-resource://plugin-chips.official.editor/data/x.bin',
    );
  });

  it('文件系统路径与非 URI 目标原样保留（§8.5 条 3 + §8.3 样例同形）', () => {
    expect(sanitizeAuditUriValue('/Users/user/Documents/chips')).toBe('/Users/user/Documents/chips');
    expect(sanitizeAuditUriValue('/Users/user/Desktop/draft.card')).toBe('/Users/user/Desktop/draft.card');
    expect(sanitizeAuditUriValue('example.com:8080')).toBe('example.com:8080');
    expect(sanitizeAuditUriValue('window-7')).toBe('window-7');
  });

  it('不可解析 URI 形态走保守兜底臂：剥 query/fragment 与 userinfo，绝不放行凭证腿', () => {
    // `http://ex ample/...` 过不了 WHATWG 解析 → 兜底臂：authority 内 userinfo 剥除、
    // query 剥除，剩余定位器主体保留。
    expect(sanitizeAuditUriValue('http://ex ample/a/b?token=abc')).toBe('http://ex ample/a/b');
    expect(sanitizeAuditUriValue('weird-scheme://user:pw@host/q#frag')).toBe('weird-scheme://host/q');
    expect(sanitizeAuditUriValue('chips-resource://platform/../evil?x=1')).toBe('chips-resource://platform/../evil');
  });
});

describe('sanitizeAuditEntry：拾取闸（§8.5 条 1：帧面只有 16 契约字段）', () => {
  it('三自由文本位过脱敏、其余字段照形拾取', () => {
    const entry = makeAuditEntry({
      action: 'deny',
      reason: 'out_of_scope',
      qualifier: 'https://target.example/secret-path?key=value',
      target: 'chips-resource://external/https/api.example.com:9000/items?token=t',
      resourceUri: 'chips-resource://platform/docs/report.card?share=abc',
    });
    const record = sanitizeAuditEntry(entry) as unknown as Record<string, unknown>;
    expect(record['qualifier']).toBe('https://target.example');
    expect(record['target']).toBe('chips-resource://external/https/api.example.com:9000');
    expect(record['resourceUri']).toBe('chips-resource://platform/docs/report.card');
    expect(record['reason']).toBe('out_of_scope');
  });

  it('越形状夹带键不入帧（凭证/内容/请求体形态零出现）', () => {
    const sneaky = {
      ...makeAuditEntry(),
      accessToken: 'leak',
      body: 'content',
    };
    const record = sanitizeAuditEntry(sneaky) as unknown as Record<string, unknown>;
    expect(Object.hasOwn(record, 'accessToken')).toBe(false);
    expect(Object.hasOwn(record, 'body')).toBe(false);
    expect(Object.keys(record)).toHaveLength(8); // 基准条目八字段恰齐
  });

  it('undefined 可选字段键不出现（§8.3 样例运行时条目无 source 腿同形）', () => {
    const record = sanitizeAuditEntry(makeAuditEntry()) as unknown as Record<string, unknown>;
    expect(Object.hasOwn(record, 'source')).toBe(false);
    expect(Object.hasOwn(record, 'sessionId')).toBe(false);
    expect(Object.hasOwn(record, 'reason')).toBe(false);
  });
});

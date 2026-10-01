import { describe, expect, it } from 'vitest';
import {
  DECLARED_COMMUNITY_HTTP_DOMAINS,
  DEFAULT_COMMUNITY_SERVER_URL,
  COMMUNITY_SERVER_BASE_URL_FULL_KEY,
  describeServerScope,
  extractHttpDomain,
  normalizeCommunityServerUrl,
  validateCommunityServerUrl,
} from '../src/domain/community/serverConfig';
import { createCommunityRuntime } from '../src/ui/runtime/communityRuntime';

describe('服务器基址归一（16-CC §5.3；旧仓 server-config 校验素材重写）', () => {
  it('仅接受 http/https 绝对 URL 并去除尾斜杠', () => {
    expect(normalizeCommunityServerUrl('https://www.chipscard.space')).toBe('https://www.chipscard.space');
    expect(normalizeCommunityServerUrl('https://www.chipscard.space/')).toBe('https://www.chipscard.space');
    expect(normalizeCommunityServerUrl('http://127.0.0.1:3000/')).toBe('http://127.0.0.1:3000');
    expect(normalizeCommunityServerUrl('  https://www.chipscard.space  ')).toBe('https://www.chipscard.space');
  });

  it('非法形态返回 null（协议不符、无法解析、空值）', () => {
    expect(normalizeCommunityServerUrl('ftp://www.chipscard.space')).toBeNull();
    expect(normalizeCommunityServerUrl('www.chipscard.space')).toBeNull();
    expect(normalizeCommunityServerUrl('')).toBeNull();
    expect(normalizeCommunityServerUrl('   ')).toBeNull();
  });

  it('权限域段提取：默认端口去除、非默认端口保留', () => {
    expect(extractHttpDomain('https://www.chipscard.space/api/v1')).toBe('www.chipscard.space');
    expect(extractHttpDomain('http://127.0.0.1:3000/api/v1')).toBe('127.0.0.1:3000');
    expect(extractHttpDomain('https://example.com:8443')).toBe('example.com:8443');
    expect(extractHttpDomain('no-url')).toBeNull();
  });
});

describe('设置页保存校验（16-CC §5.3 + §9.2 COMMUNITY_CLIENT_SERVER_UNSUPPORTED）', () => {
  it('命中已声明 network:http 域集合的地址通过并返回归一基址', () => {
    for (const domain of DECLARED_COMMUNITY_HTTP_DOMAINS) {
      const scheme = domain.includes('127.0.0.1') ? 'http' : 'https';
      const result = validateCommunityServerUrl(`${scheme}://${domain}`);
      expect(result).toEqual({ ok: true, url: `${scheme}://${domain}` });
    }
  });

  it('未声明域与格式非法一律拒绝并归在册错误码', () => {
    expect(validateCommunityServerUrl('https://evil.example.com')).toEqual({
      ok: false,
      code: 'COMMUNITY_CLIENT_SERVER_UNSUPPORTED',
    });
    expect(validateCommunityServerUrl('not-a-url')).toEqual({
      ok: false,
      code: 'COMMUNITY_CLIENT_SERVER_UNSUPPORTED',
    });
  });

  it('支持范围说明列出已声明域（§9.3 文案原则）', () => {
    const scope = describeServerScope();
    expect(scope).toContain('www.chipscard.space');
    expect(scope).toContain('http://127.0.0.1:3000');
  });
});

describe('窗口会话运行时（诚实降级：会话内存生效层，工单066 在册）', () => {
  it('默认基址为官方社区地址，生效层如实标记会话内存', () => {
    const runtime = createCommunityRuntime();
    expect(runtime.getServerBase()).toEqual({
      url: DEFAULT_COMMUNITY_SERVER_URL,
      layer: 'session-memory',
    });
  });

  it('保存合法地址即时生效；拒绝非法地址不改变生效值', () => {
    const runtime = createCommunityRuntime();
    const saved = runtime.saveServerBase('http://127.0.0.1:3000/');
    expect(saved).toEqual({
      ok: true,
      snapshot: { url: 'http://127.0.0.1:3000', layer: 'session-memory' },
    });
    expect(runtime.getServerBase().url).toBe('http://127.0.0.1:3000');

    const rejected = runtime.saveServerBase('https://evil.example.com');
    expect(rejected).toEqual({ ok: false, code: 'COMMUNITY_CLIENT_SERVER_UNSUPPORTED' });
    expect(runtime.getServerBase().url).toBe('http://127.0.0.1:3000');
  });

  it('会话如实呈现未登录（http/credential 域处理器缺位，不伪造登录态）', () => {
    const runtime = createCommunityRuntime();
    const session = runtime.getSession();
    expect(session.loggedIn).toBe(false);
    if (!session.loggedIn) {
      expect(session.reason).toContain('候前置件');
    }
  });

  it('配置键落在插件自身命名空间（16-CC §2.3/§5.3）', () => {
    expect(COMMUNITY_SERVER_BASE_URL_FULL_KEY).toBe(
      'plugins.chips.official.community-client.server.baseUrl',
    );
  });
});

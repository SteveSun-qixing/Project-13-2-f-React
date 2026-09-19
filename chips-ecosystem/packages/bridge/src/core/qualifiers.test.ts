import { describe, expect, it } from 'vitest';
import type { IPermissionGrant } from '../protocol/permission.js';
import {
  createPermissionEnvironment,
  DIRECTORY_VARIABLES,
  grantCovers,
  matchConfigQualifier,
  matchDomainQualifier,
  matchPathQualifier,
  matchResourceQualifier,
  matchesQualifier,
  matchUrlQualifier,
  matchWindowQualifier,
} from './qualifiers.js';

function createEnv(
  overrides: Partial<Parameters<typeof createPermissionEnvironment>[0]> = {},
): ReturnType<typeof createPermissionEnvironment> {
  return createPermissionEnvironment({
    platform: 'linux',
    directories: {
      userDocuments: '/home/u/Documents',
      userHome: '/home/u',
      temp: '/tmp',
    },
    ...overrides,
  });
}

function grant(base: string, qualifier?: string): IPermissionGrant {
  return {
    base,
    state: 'granted',
    source: 'enable',
    ...(qualifier !== undefined ? { qualifier } : {}),
  };
}

describe('目录变量与环境', () => {
  it('展开内置目录变量，缺失变量 fail-closed', () => {
    const env = createEnv();
    expect(DIRECTORY_VARIABLES).toHaveLength(9);
    expect(env.expandDirectoryVariable('${userDocuments}/chips')).toBe('/home/u/Documents/chips');
    expect(env.expandDirectoryVariable('${missing}/x')).toBeUndefined();
    expect(env.expandDirectoryVariable('/absolute/path')).toBe('/absolute/path');
    expect(env.realpath('/a/../b')).toBe('/a/../b');
  });

  it('可注入 realpath 与宿主接缝', () => {
    const env = createEnv({
      realpath: (path) => path.replace('/link', '/real'),
      pluginDataRoot: (pluginId) => `/data/${pluginId}`,
      isOwnResourceScope: () => true,
      documentScope: () => 'card-1',
    });
    expect(env.realpath('/link/a')).toBe('/real/a');
    expect(env.pluginDataRoot?.('p')).toBe('/data/p');
    expect(env.isOwnResourceScope?.(undefined as never, 'card-1')).toBe(true);
    expect(env.documentScope?.('d', undefined as never)).toBe('card-1');
  });
});

describe('matchPathQualifier', () => {
  it('目录前缀匹配且目录边界精确', () => {
    const env = createEnv();
    expect(matchPathQualifier('${userDocuments}', '${userDocuments}/chips/a.card', env)).toBe(true);
    expect(matchPathQualifier('${userDocuments}', '${userDocuments}', env)).toBe(true);
    expect(matchPathQualifier('${userDocuments}', '/home/u/DocumentsX/a', env)).toBe(false);
  });

  it('折叠 `.` 与 `..` 后越界即拒绝', () => {
    const env = createEnv();
    expect(matchPathQualifier('${userDocuments}/chips', '${userDocuments}/chips/./a', env)).toBe(true);
    expect(matchPathQualifier('${userDocuments}/chips', '${userDocuments}/chips/../secret', env)).toBe(
      false,
    );
  });

  it('macOS / Windows 大小写不敏感，Linux 敏感；变量缺失拒绝', () => {
    const mac = createEnv({ platform: 'darwin', directories: { userDocuments: '/Users/U/Documents' } });
    expect(matchPathQualifier('${userDocuments}', '/users/u/documents/a', mac)).toBe(true);
    const win = createEnv({ platform: 'win32', directories: { userDocuments: 'C:\\Users\\U\\Documents' } });
    expect(matchPathQualifier('${userDocuments}', 'c:\\users\\u\\documents\\a', win)).toBe(true);
    const linux = createEnv();
    expect(matchPathQualifier('${userDocuments}', '/home/u/documents/a', linux)).toBe(false);
    expect(matchPathQualifier('${userHome}', '/home/u/a', createEnv({ directories: {} }))).toBe(false);
  });
});

describe('matchDomainQualifier', () => {
  it('精确域与默认端口匹配', () => {
    expect(matchDomainQualifier('example.com', 'https://example.com/a')).toBe(true);
    expect(matchDomainQualifier('example.com', 'https://example.com:443/a')).toBe(true);
    expect(matchDomainQualifier('example.com', 'https://example.com:8443/a')).toBe(false);
    expect(matchDomainQualifier('example.com:8443', 'https://example.com:8443/a')).toBe(true);
    expect(matchDomainQualifier('https://example.com', 'https://example.com/a')).toBe(true);
    expect(matchDomainQualifier('https://example.com', 'http://example.com/a')).toBe(false);
  });

  it('通配符只匹配一个标签，裸域不匹配子域', () => {
    expect(matchDomainQualifier('*.example.com', 'https://api.example.com/a')).toBe(true);
    expect(matchDomainQualifier('*.example.com', 'https://example.com/a')).toBe(false);
    expect(matchDomainQualifier('example.com', 'https://api.example.com/a')).toBe(false);
    expect(matchDomainQualifier('*', 'http://localhost/a')).toBe(true);
    expect(matchDomainQualifier('*', 'https://example.com/a')).toBe(false);
  });

  it('IP 字面量必须精确，不支持通配与 CIDR', () => {
    expect(matchDomainQualifier('127.0.0.1', 'http://127.0.0.1/a')).toBe(true);
    expect(matchDomainQualifier('127.0.0.1', 'http://127.0.0.2/a')).toBe(false);
    expect(matchDomainQualifier('*.0.0.1', 'http://127.0.0.1/a')).toBe(false);
    expect(matchDomainQualifier('127.0.0.0/8', 'http://127.0.0.1/a')).toBe(false);
  });

  it('拒绝 userinfo、非 http(s) 目标与非法限定值', () => {
    expect(matchDomainQualifier('example.com', 'https://user:pass@example.com/a')).toBe(false);
    expect(matchDomainQualifier('example.com', 'ftp://example.com/a')).toBe(false);
    expect(matchDomainQualifier('user@example.com', 'https://example.com/a')).toBe(false);
    expect(matchDomainQualifier('example.com/path', 'https://example.com/a')).toBe(false);
    expect(matchDomainQualifier('example.com', 'not-a-url')).toBe(false);
  });
});

describe('matchUrlQualifier / matchWindowQualifier / matchConfigQualifier', () => {
  it('URL 限定支持 scheme 或 scheme://host', () => {
    expect(matchUrlQualifier('https', 'https://example.com/a')).toBe(true);
    expect(matchUrlQualifier('https', 'http://example.com/a')).toBe(false);
    expect(matchUrlQualifier('https://example.com', 'https://example.com/a')).toBe(true);
    expect(matchUrlQualifier('https://example.com', 'bad-url')).toBe(false);
  });

  it('窗口限定为模式匹配', () => {
    expect(matchWindowQualifier('editor-*', 'editor-1')).toBe(true);
    expect(matchWindowQualifier('editor-*', 'viewer-1')).toBe(false);
    expect(matchWindowQualifier('win.1', 'win.1')).toBe(true);
    expect(matchWindowQualifier('*', 'anything')).toBe(true);
  });

  it('配置命名空间精确匹配', () => {
    expect(matchConfigQualifier('plugins.p', 'plugins.p')).toBe(true);
    expect(matchConfigQualifier('plugins.p', 'plugins.p.sub')).toBe(false);
  });
});

describe('matchResourceQualifier', () => {
  it('按作用域与前缀匹配，支持 external 与裸 http 目标', () => {
    expect(matchResourceQualifier('card-1', 'chips-resource://card-1/a.png')).toBe(true);
    expect(matchResourceQualifier('card-1/images', 'chips-resource://card-1/images/a.png')).toBe(true);
    expect(matchResourceQualifier('card-1/images', 'chips-resource://card-1/videos/a.mp4')).toBe(false);
    expect(matchResourceQualifier('card-2', 'chips-resource://card-1/a.png')).toBe(false);
    expect(matchResourceQualifier('card-1/', 'chips-resource://card-1/a.png')).toBe(true);
    expect(matchResourceQualifier('external/https/example.com', 'https://example.com/a.png')).toBe(true);
    expect(matchResourceQualifier('external/https/example.com', 'chips-resource://card-1/a.png')).toBe(
      false,
    );
    expect(matchResourceQualifier('card-1', 'invalid-uri')).toBe(false);
  });
});

describe('matchesQualifier', () => {
  const env = createEnv();

  it('无目标权限：无限定值放行，限定值非法', () => {
    expect(matchesQualifier('menu:manage', undefined, undefined, env)).toBe(true);
    expect(matchesQualifier('menu:manage', 'x', undefined, env)).toBe(false);
  });

  it('可选限定值：缺省即基础权限放行', () => {
    expect(matchesQualifier('window:control', undefined, '1', env)).toBe(true);
    expect(matchesQualifier('window:control', 'editor-*', 'editor-1', env)).toBe(true);
    expect(matchesQualifier('window:control', 'editor-*', 'viewer-1', env)).toBe(false);
  });

  it('必需限定值缺少目标时拒绝', () => {
    expect(matchesQualifier('filesystem:read', '${userDocuments}', undefined, env)).toBe(false);
    expect(matchesQualifier('filesystem:read', undefined, '/x', env)).toBe(false);
  });
});

describe('grantCovers', () => {
  const env = createEnv();

  it('必需限定值权限的无限定值授权不覆盖具体目标；可选限定值权限可覆盖', () => {
    expect(grantCovers([grant('filesystem:read')], 'filesystem:read', '/anywhere', env)).toBe(false);
    expect(grantCovers([grant('window:control')], 'window:control', 'other-window', env)).toBe(true);
    expect(grantCovers([grant('filesystem:read')], 'filesystem:write', '/anywhere', env)).toBe(false);
  });

  it('限定值授权按目标匹配', () => {
    const grants = [grant('filesystem:read', '${userDocuments}/chips')];
    expect(grantCovers(grants, 'filesystem:read', '${userDocuments}/chips/a', env)).toBe(true);
    expect(grantCovers(grants, 'filesystem:read', '${userDocuments}/other/a', env)).toBe(false);
  });

  it('`domain:*` 通配授权覆盖同域全部基础权限', () => {
    expect(grantCovers([grant('resources:*')], 'resources:write', 'card-1/a', env)).toBe(true);
  });

  it('denied 授权不参与覆盖', () => {
    const denied: IPermissionGrant = { base: 'filesystem:read', state: 'denied', source: 'enable' };
    expect(grantCovers([denied], 'filesystem:read', '/a', env)).toBe(false);
  });
});

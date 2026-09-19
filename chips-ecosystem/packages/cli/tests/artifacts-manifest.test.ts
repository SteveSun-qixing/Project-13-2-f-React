/**
 * 插件清单解析与字段级校验（[插件清单规范] §二–§七、§九；[CLI 完整参考] §5.1、§5.2）。
 *
 * 断言面向文档契约：通过项、错误码与 `details.pointer`（§九）。
 */

import { describe, expect, it } from 'vitest';

import { ChipsError } from '../src/errors.js';
import type { IFileSystemPort } from '../src/args/filesystem.js';
import type {
  IManifestValidationInput,
  IManifestValidationResult,
} from '../src/artifacts/manifest.js';
import {
  parseManifestText,
  readManifestRole,
  validateManifest,
} from '../src/artifacts/manifest.js';
import {
  createDocumentedPermissionCatalog,
  type IPermissionCatalog,
} from '../src/artifacts/permission-catalog.js';
import { MemoryFileSystem } from './support/memory-file-system.js';

/** 包内成员：入口、渲染与清单引用的资源与 schema。 */
const DEFAULT_MEMBERS = [
  'manifest.yaml',
  'dist/index.js',
  'render.js',
  'assets/icons/hello.svg',
  'assets/icons/grid.svg',
  'assets/icons/viewer.svg',
  'assets/schemas/richtext.schema.json',
  'assets/schemas/grid.schema.json',
];

const GRID_SCHEMA = JSON.stringify({
  type: 'object',
  properties: { columns: { type: 'integer' } },
});
const RICHTTEXT_SCHEMA = JSON.stringify({ type: 'object', $defs: { color: { type: 'string' } } });

/** 远程 `$ref` 藏在数组子节点里：`$ref` 扫描必须下钻数组才能发现。 */
const REMOTE_REF_IN_ARRAY = JSON.stringify({
  type: 'object',
  anyOf: [{ $ref: 'https://example.com/y.json' }],
});
const REMOTE_REF_NESTED_IN_ARRAY = JSON.stringify({
  type: 'object',
  properties: { list: { type: 'array', items: [{ $ref: 'http://example.com/z.json' }] } },
});
/** 协议相对形态（`//host/path`）同样属远程引用。 */
const PROTOCOL_RELATIVE_REF_IN_ARRAY = JSON.stringify({
  type: 'object',
  allOf: [{ type: 'object' }, { $ref: '//example.com/x' }],
});
/** 数组子节点内的本地 `$ref` 与标量数组项都应正常放行。 */
const LOCAL_REF_IN_ARRAY = JSON.stringify({
  type: 'object',
  required: ['x'],
  allOf: [{ $ref: '#/$defs/color' }],
  $defs: { color: { type: 'string', enum: ['red', 'blue'] } },
});

/** 提供 schema 文件的内存文件系统（清单按包内相对路径读取 schema 内容）。 */
function schemaFileSystem(): IFileSystemPort {
  const fileSystem = new MemoryFileSystem();
  fileSystem.writeText('assets/schemas/grid.schema.json', GRID_SCHEMA);
  fileSystem.writeText('assets/schemas/richtext.schema.json', RICHTTEXT_SCHEMA);
  return fileSystem;
}

/** 写入单个 schema 内容的内存文件系统。 */
function schemaFileWith(content: string): IFileSystemPort {
  const fileSystem = new MemoryFileSystem();
  fileSystem.writeText('assets/schemas/richtext.schema.json', content);
  return fileSystem;
}

function appManifest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'chips.official.viewer',
    version: '1.0.0',
    type: 'app',
    name: '卡片查看器',
    runtime: { targets: ['host'] },
    ui: { surface: 'window' },
    ...overrides,
  };
}

function serviceManifest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'chips.service.clock',
    version: '1.0.0',
    type: 'service',
    name: '时钟服务',
    runtime: { targets: ['host'], background: true },
    ...overrides,
  };
}

function basecardManifest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'chips.basecard.hello',
    version: '1.0.0',
    type: 'basecard',
    name: '你好卡片',
    runtime: { targets: ['host'] },
    capabilities: {
      cardTypes: [
        {
          id: 'base.richtext',
          name: '富文本卡片',
          icon: 'assets/icons/hello.svg',
          extensions: ['.md'],
        },
      ],
    },
    ...overrides,
  };
}

function boxlayoutManifest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'chips.layout.grid',
    version: '1.0.0',
    type: 'boxlayout',
    name: '网格布局',
    runtime: { targets: ['host'] },
    capabilities: {
      layouts: [
        {
          id: 'chips.layout.grid',
          name: '网格布局',
          icon: 'assets/icons/grid.svg',
          configSchema: 'assets/schemas/grid.schema.json',
          schemaVersions: '>=1.0.0 <2.0.0',
        },
      ],
    },
    ...overrides,
  };
}

/** 去掉指定根字段后的清单副本：用于断言「必填字段缺失」分支。 */
function withoutField(manifest: Record<string, unknown>, field: string): Record<string, unknown> {
  const copy = { ...manifest };
  delete copy[field];
  return copy;
}

interface IFixture {
  readonly members?: readonly string[];
  readonly fileSystem?: IFileSystemPort;
  readonly platformVersion?: string;
  readonly packageVersion?: string;
  readonly catalog?: IPermissionCatalog;
}

function validate(manifest: unknown, fixture: IFixture = {}): IManifestValidationResult {
  const input: IManifestValidationInput = {
    manifest,
    members: new Set(fixture.members ?? DEFAULT_MEMBERS),
    catalog: fixture.catalog ?? createDocumentedPermissionCatalog(),
    ...(fixture.platformVersion === undefined ? {} : { platformVersion: fixture.platformVersion }),
    ...(fixture.packageVersion === undefined ? {} : { packageVersion: fixture.packageVersion }),
  };
  return validateManifest(input, fixture.fileSystem);
}

/** 执行一次校验并断言错误码与指针。 */
function expectFailure(run: () => unknown, code: string, pointer?: string): ChipsError {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(ChipsError);
    const normalized = error as ChipsError;
    expect(normalized.code).toBe(code);
    if (pointer !== undefined) {
      const details = normalized.details as { pointer?: string; stage?: string };
      expect(details.pointer).toBe(pointer);
      expect(details.stage).toBe('manifest');
    }
    return normalized;
  }
  throw new Error(`期望抛出 ${code}`);
}

describe('parseManifestText', () => {
  it('解析映射根节点', () => {
    expect(parseManifestText('id: chips.basecard.hello\nversion: 1.0.0\n')).toEqual({
      id: 'chips.basecard.hello',
      version: '1.0.0',
    });
  });

  it('根节点为序列或标量时拒绝', () => {
    expectFailure(() => parseManifestText('- a\n- b'), 'CPK_MANIFEST_INVALID');
    expectFailure(() => parseManifestText('只是一行文本'), 'CPK_MANIFEST_INVALID');
    expectFailure(() => parseManifestText(''), 'CPK_MANIFEST_INVALID');
  });

  it('YAML 语法错误归一为 CPK_MANIFEST_INVALID', () => {
    const error = expectFailure(
      () => parseManifestText('id: [未闭合\n  x: 1\n'),
      'CPK_MANIFEST_INVALID'
    );
    expect(error.message).toContain('YAML 解析失败');
  });
});

describe('readManifestRole', () => {
  it('缺少 manifest.yaml 返回 undefined', () => {
    expect(readManifestRole(new MemoryFileSystem(), '/pkg')).toBeUndefined();
  });

  it('识别四种角色且容忍目录尾部斜杠', () => {
    for (const type of ['basecard', 'boxlayout', 'app', 'service']) {
      const fileSystem = new MemoryFileSystem();
      fileSystem.writeText('/pkg/manifest.yaml', `id: chips.x.y\nversion: 1.0.0\ntype: ${type}\n`);
      expect(readManifestRole(fileSystem, '/pkg')).toBe(type);
      expect(readManifestRole(fileSystem, '/pkg/')).toBe(type);
    }
  });

  it('type 缺失或非法角色返回 undefined', () => {
    const fileSystem = new MemoryFileSystem();
    fileSystem.writeText('/pkg/manifest.yaml', 'id: chips.x.y\nversion: 1.0.0\ntype: widget\n');
    expect(readManifestRole(fileSystem, '/pkg')).toBeUndefined();
  });
});

describe('四角色清单通过校验（§8.1–§8.4）', () => {
  it('基础卡片插件', () => {
    const result = validate(
      {
        id: 'chips.basecard.richtext',
        version: '1.0.0',
        type: 'basecard',
        name: '富文本卡片',
        description: '以 Markdown 呈现与编辑的富文本卡片',
        author: '薯片官方',
        license: 'MIT',
        runtime: { targets: ['host'] },
        dependencies: [{ id: 'chips.service.markdown', version: '^1.0.0' }],
        permissions: ['resources:read'],
        capabilities: {
          cardTypes: [
            {
              id: 'base.richtext',
              name: '富文本卡片',
              description: 'Markdown 富文本内容',
              icon: 'assets/icons/hello.svg',
              extensions: ['.md'],
              configSchema: 'assets/schemas/richtext.schema.json',
              aliases: ['base.markdown'],
              exportFormats: [
                { id: 'html', name: 'HTML 片段', extension: '.html', mimeType: 'text/html' },
              ],
            },
          ],
        },
      },
      { fileSystem: schemaFileSystem() }
    );
    expect(result).toEqual({
      id: 'chips.basecard.richtext',
      version: '1.0.0',
      role: 'basecard',
      name: '富文本卡片',
      warnings: [],
    });
  });

  it('箱子布局插件', () => {
    const result = validate(
      {
        id: 'chips.layout.grid',
        version: '1.0.0',
        type: 'boxlayout',
        name: '网格布局',
        runtime: { targets: ['host'] },
        permissions: ['resources:read'],
        capabilities: {
          layouts: [
            {
              id: 'chips.layout.grid',
              name: '网格布局',
              icon: 'assets/icons/grid.svg',
              description: '自适应网格排列条目',
              configSchema: 'assets/schemas/grid.schema.json',
              schemaVersions: '>=1.0.0 <2.0.0',
            },
          ],
        },
      },
      { fileSystem: schemaFileSystem() }
    );
    expect(result.role).toBe('boxlayout');
  });

  it('应用插件（权限限定值与启动器）', () => {
    const result = validate(
      {
        id: 'chips.official.viewer',
        version: '1.0.0',
        type: 'app',
        name: '卡片查看器',
        runtime: { targets: ['host'], background: false },
        permissions: ['filesystem:read:${userDocuments}', 'window:control', 'notifications:send'],
        ui: {
          surface: 'window',
          launcher: {
            icon: 'assets/icons/viewer.svg',
            name: '卡片查看器',
            description: '打开并查看卡片',
          },
        },
        fileAssociations: [{ extensions: ['.card'], action: 'open' }],
      },
      { packageVersion: '1.0.0' }
    );
    expect(result.role).toBe('app');
    expect(result.version).toBe('1.0.0');
  });

  it('服务插件（健康检查与空权限）', () => {
    const result = validate(
      {
        id: 'chips.service.clock',
        version: '1.0.0',
        type: 'service',
        name: '时钟服务',
        runtime: { targets: ['host'], background: true },
        permissions: [],
        healthCheck: { interval: '30s', timeout: '5s' },
      },
      { platformVersion: '1.0.0' }
    );
    expect(result.role).toBe('service');
    expect(result.warnings).toEqual([]);
  });
});

describe('基础字段（§三）', () => {
  it('插件 ID 必须为反向域名', () => {
    for (const id of [
      'chips',
      'Chips.x.y',
      'chips..x',
      '-chips.x.y',
      'chips.x.y-',
      'chips.x y',
      'chips.x_y',
    ]) {
      expectFailure(() => validate(appManifest({ id })), 'CPK_MANIFEST_INVALID', 'id');
    }
    expect(validate(appManifest({ id: 'chips.official-2.viewer' })).id).toBe(
      'chips.official-2.viewer'
    );
  });

  it('version 必须为语义化版本', () => {
    expectFailure(
      () => validate(appManifest({ version: '1.2' })),
      'CPK_MANIFEST_INVALID',
      'version'
    );
    expectFailure(
      () => validate(appManifest({ version: 'v1.2.0' })),
      'CPK_MANIFEST_INVALID',
      'version'
    );
    expect(validate(appManifest({ version: '1.2.0-rc.1' })).version).toBe('1.2.0-rc.1');
  });

  it('type 必须为四角色之一', () => {
    expectFailure(() => validate(appManifest({ type: 'widget' })), 'CPK_MANIFEST_INVALID', 'type');
    expectFailure(() => validate(appManifest({ type: 3 })), 'CPK_MANIFEST_INVALID', 'type');
  });

  it('必填字段缺失与空串拒绝', () => {
    expectFailure(
      () => validate(withoutField(appManifest(), 'name')),
      'CPK_MANIFEST_INVALID',
      'name'
    );
    expectFailure(() => validate(appManifest({ name: '' })), 'CPK_MANIFEST_INVALID', 'name');
    expectFailure(
      () => validate(appManifest({ description: '' })),
      'CPK_MANIFEST_INVALID',
      'description'
    );
    expectFailure(() => validate(appManifest({ author: 1 })), 'CPK_MANIFEST_INVALID', 'author');
    expectFailure(() => validate(appManifest({ license: 1 })), 'CPK_MANIFEST_INVALID', 'license');
  });

  it('根节点必须是映射', () => {
    expectFailure(() => validate([]), 'CPK_MANIFEST_INVALID', '');
    expectFailure(() => validate('文本'), 'CPK_MANIFEST_INVALID', '');
    expectFailure(() => validate(null), 'CPK_MANIFEST_INVALID', '');
  });

  it('未登记字段拒绝（§二）', () => {
    expectFailure(() => validate(appManifest({ extra: 1 })), 'CPK_MANIFEST_INVALID', 'extra');
  });

  it('与源码 package.json 版本不一致拒绝（§3.2）', () => {
    expectFailure(
      () => validate(appManifest(), { packageVersion: '1.0.1' }),
      'CPK_MANIFEST_INVALID',
      'version'
    );
  });
});

describe('runtime（§四）', () => {
  it('缺失 runtime 拒绝', () => {
    expectFailure(
      () => validate(withoutField(appManifest(), 'runtime')),
      'CPK_MANIFEST_INVALID',
      'runtime'
    );
  });

  it('targets 不得为空、只允许 host、不得重复', () => {
    expectFailure(
      () => validate(appManifest({ runtime: { targets: [] } })),
      'CPK_MANIFEST_INVALID',
      'runtime.targets'
    );
    expectFailure(
      () => validate(appManifest({ runtime: { targets: ['host', 'renderer'] } })),
      'CPK_MANIFEST_INVALID',
      'runtime.targets[1]'
    );
    expectFailure(
      () => validate(appManifest({ runtime: { targets: ['host', 'host'] } })),
      'CPK_MANIFEST_INVALID',
      'runtime.targets[1]'
    );
    expectFailure(
      () => validate(appManifest({ runtime: 'host' })),
      'CPK_MANIFEST_INVALID',
      'runtime'
    );
    expectFailure(
      () => validate(appManifest({ runtime: { targets: ['host'], extra: 1 } })),
      'CPK_MANIFEST_INVALID',
      'runtime.extra'
    );
  });

  it('background: true 只允许 service', () => {
    expectFailure(
      () => validate(appManifest({ runtime: { targets: ['host'], background: true } })),
      'CPK_MANIFEST_INVALID',
      'runtime.background'
    );
    expectFailure(
      () => validate(appManifest({ runtime: { targets: ['host'], background: 'yes' } })),
      'CPK_MANIFEST_INVALID',
      'runtime.background'
    );
    expect(validate(serviceManifest()).role).toBe('service');
  });
});

describe('engines 门禁（§3.6）', () => {
  it('范围合法时通过', () => {
    expect(
      validate(appManifest({ engines: { chips: '>=1.0.0 <2.0.0' } }), { platformVersion: '1.4.0' })
    ).toBeTruthy();
    const result = validate(appManifest({ engines: { chips: '*' } }));
    expect(result.role).toBe('app');
    expect(Object.keys(result).sort()).toEqual(['id', 'name', 'role', 'version', 'warnings']);
  });

  it('范围语法非法拒绝', () => {
    expectFailure(
      () => validate(appManifest({ engines: { chips: '>=abc' } })),
      'CPK_MANIFEST_INVALID',
      'engines.chips'
    );
    expectFailure(
      () => validate(appManifest({ engines: { chips: '' } })),
      'CPK_MANIFEST_INVALID',
      'engines.chips'
    );
    expectFailure(
      () => validate(appManifest({ engines: {} })),
      'CPK_MANIFEST_INVALID',
      'engines.chips'
    );
    expectFailure(
      () => validate(appManifest({ engines: { chips: '*', node: '20' } })),
      'CPK_MANIFEST_INVALID',
      'engines.node'
    );
  });

  it('平台版本不满足返回 CPK_ENGINE_UNSUPPORTED', () => {
    const error = expectFailure(
      () => validate(appManifest({ engines: { chips: '^2.0.0' } }), { platformVersion: '1.4.0' }),
      'CPK_ENGINE_UNSUPPORTED'
    );
    expect(error.message).toContain('需要 ^2.0.0，当前 1.4.0');
  });

  it('平台版本不可解析时不做门禁', () => {
    expect(
      validate(appManifest({ engines: { chips: '^2.0.0' } }), { platformVersion: '开发构建' })
    ).toBeTruthy();
  });
});

describe('dependencies（§五）', () => {
  it('依赖 ID 与范围校验', () => {
    expectFailure(
      () => validate(appManifest({ dependencies: [{ id: 'chips', version: '^1.0.0' }] })),
      'CPK_MANIFEST_INVALID',
      'dependencies[0].id'
    );
    expectFailure(
      () =>
        validate(
          appManifest({ dependencies: [{ id: 'chips.official.viewer', version: '^1.0.0' }] })
        ),
      'CPK_MANIFEST_INVALID',
      'dependencies[0].id'
    );
    expectFailure(
      () => validate(appManifest({ dependencies: [{ id: 'chips.service.x', version: '>=abc' }] })),
      'CPK_MANIFEST_INVALID',
      'dependencies[0].version'
    );
    expectFailure(
      () =>
        validate(
          appManifest({ dependencies: [{ id: 'chips.service.x', version: '^1.0.0', extra: 1 }] })
        ),
      'CPK_MANIFEST_INVALID',
      'dependencies[0].extra'
    );
    expectFailure(
      () => validate(appManifest({ dependencies: 'x' })),
      'CPK_MANIFEST_INVALID',
      'dependencies'
    );
  });

  it('重复声明只给警告，不拒绝', () => {
    const result = validate(
      appManifest({
        dependencies: [
          { id: 'chips.service.markdown', version: '^1.0.0' },
          { id: 'chips.service.markdown', version: '^1.0.0' },
        ],
      })
    );
    expect(result.warnings).toEqual(['依赖重复声明：chips.service.markdown']);
  });
});

describe('permissions（§六）', () => {
  it('限定值规则与角色适用性', () => {
    expect(
      validate(serviceManifest({ permissions: ['filesystem:read:${userDocuments}'] })).role
    ).toBe('service');
    expectFailure(
      () => validate(serviceManifest({ permissions: ['filesystem:read'] })),
      'PERMISSION_INVALID'
    );
    expectFailure(
      () => validate(serviceManifest({ permissions: ['window:control'] })),
      'PERMISSION_ROLE_NOT_ALLOWED'
    );
    expectFailure(
      () => validate(serviceManifest({ permissions: ['filesystem:read:/etc/passwd'] })),
      'PERMISSION_INVALID'
    );
    expectFailure(
      () => validate(serviceManifest({ permissions: ['nope:read'] })),
      'PERMISSION_UNKNOWN'
    );
    expectFailure(
      () => validate(serviceManifest({ permissions: ['file:read'] })),
      'PERMISSION_UNKNOWN'
    );
    expectFailure(
      () =>
        validate(serviceManifest({ permissions: ['network:http', 'network:http:*.example.com'] })),
      'PERMISSION_INVALID'
    );
    expect(validate(serviceManifest({ permissions: ['network:http:*.example.com'] }))).toBeTruthy();
    expectFailure(
      () => validate(serviceManifest({ permissions: ['network:http:EXAMPLE.com'] })),
      'PERMISSION_INVALID'
    );
    expect(validate(serviceManifest({ permissions: ['config:read:platform'] }))).toBeTruthy();
    expectFailure(
      () => validate(serviceManifest({ permissions: ['config:read:plugins'] })),
      'PERMISSION_INVALID'
    );
    expectFailure(
      () => validate(serviceManifest({ permissions: ['config:read'] })),
      'PERMISSION_INVALID'
    );
    expect(validate(serviceManifest({ permissions: ['resources:read'] }))).toBeTruthy();
    expect(validate(serviceManifest({ permissions: ['resources:read:cards'] }))).toBeTruthy();
    expectFailure(
      () => validate(serviceManifest({ permissions: ['resources:read:*'] })),
      'PERMISSION_INVALID'
    );
    expect(validate(appManifest({ permissions: ['menu:manage'] }))).toBeTruthy();
    expectFailure(
      () => validate(appManifest({ permissions: ['menu:manage:anything'] })),
      'PERMISSION_INVALID'
    );
    expectFailure(
      () => validate(serviceManifest({ permissions: ['shell:external'] })),
      'PERMISSION_ROLE_NOT_ALLOWED'
    );
    expect(
      validate(appManifest({ permissions: ['shell:external:https://example.com'] }))
    ).toBeTruthy();
    expectFailure(
      () => validate(appManifest({ permissions: ['shell:external:example.com'] })),
      'PERMISSION_INVALID'
    );
    expectFailure(
      () => validate(appManifest({ permissions: ['filesystem:read:a:b'] })),
      'PERMISSION_INVALID'
    );
    expect(
      validate(serviceManifest({ permissions: ['network:http:example.com:8080'] }))
    ).toBeTruthy();
    expectFailure(
      () => validate(basecardManifest({ permissions: ['window:control'] })),
      'PERMISSION_ROLE_NOT_ALLOWED'
    );
    expect(validate(basecardManifest({ permissions: ['resources:read'] }))).toBeTruthy();
  });

  it('权限集合非数组拒绝', () => {
    expectFailure(
      () => validate(serviceManifest({ permissions: 'resources:read' })),
      'CPK_MANIFEST_INVALID',
      'permissions'
    );
  });

  it('自定义目录可登记卡片类型与能力 ID', () => {
    expectFailure(
      () =>
        validate(basecardManifest(), {
          catalog: createDocumentedPermissionCatalog({ cardTypeIds: ['base.image'] }),
        }),
      'CPK_MANIFEST_INVALID',
      'capabilities.cardTypes[0].id'
    );
  });
});

describe('capabilities：basecard（§7.1、§7.2）', () => {
  it('basecard 必须声明 cardTypes', () => {
    expectFailure(
      () => validate(basecardManifest({ capabilities: undefined })),
      'CPK_MANIFEST_INVALID',
      'capabilities'
    );
    expectFailure(
      () => validate(basecardManifest({ capabilities: { cardTypes: [] } })),
      'CPK_MANIFEST_INVALID',
      'capabilities.cardTypes'
    );
    expectFailure(
      () =>
        validate(
          basecardManifest({ capabilities: { layouts: [{ id: 'chips.layout.a', name: 'A' }] } })
        ),
      'CPK_MANIFEST_INVALID',
      'capabilities.cardTypes'
    );
  });

  it('cardTypes 与 layouts 互斥且只能出现在 basecard / boxlayout', () => {
    expectFailure(
      () =>
        validate(
          basecardManifest({
            capabilities: {
              cardTypes: [{ id: 'base.a', name: 'A' }],
              layouts: [{ id: 'chips.layout.a' }],
            },
          })
        ),
      'CPK_MANIFEST_INVALID',
      'capabilities'
    );
    expectFailure(
      () => validate(appManifest({ capabilities: { cardTypes: [] } })),
      'CPK_MANIFEST_INVALID',
      'capabilities'
    );
    expectFailure(
      () => validate(serviceManifest({ capabilities: { layouts: [] } })),
      'CPK_MANIFEST_INVALID',
      'capabilities'
    );
  });

  it('卡片类型 ID 文法与唯一性', () => {
    expectFailure(
      () =>
        validate(basecardManifest({ capabilities: { cardTypes: [{ id: '1bad.id', name: 'A' }] } })),
      'CPK_MANIFEST_INVALID',
      'capabilities.cardTypes[0].id'
    );
    expectFailure(
      () =>
        validate(
          basecardManifest({ capabilities: { cardTypes: [{ id: 'base.Bad_Id', name: 'A' }] } })
        ),
      'CPK_MANIFEST_INVALID',
      'capabilities.cardTypes[0].id'
    );
    expectFailure(
      () =>
        validate(
          basecardManifest({
            capabilities: {
              cardTypes: [
                { id: 'base.richtext', name: 'A' },
                { id: 'base.richtext', name: 'B' },
              ],
            },
          })
        ),
      'CPK_MANIFEST_INVALID',
      'capabilities.cardTypes[1].id'
    );
  });

  it('卡片类型字段：名称必填、结构非法、未登记字段', () => {
    expectFailure(
      () => validate(basecardManifest({ capabilities: { cardTypes: ['文本'] } })),
      'CPK_MANIFEST_INVALID',
      'capabilities.cardTypes[0]'
    );
    expectFailure(
      () => validate(basecardManifest({ capabilities: { cardTypes: [{ id: 'base.richtext' }] } })),
      'CPK_MANIFEST_INVALID',
      'capabilities.cardTypes[0].name'
    );
    expectFailure(
      () =>
        validate(
          basecardManifest({
            capabilities: { cardTypes: [{ id: 'base.richtext', name: 'A', extra: 1 }] },
          })
        ),
      'CPK_MANIFEST_INVALID',
      'capabilities.cardTypes[0].extra'
    );
    expectFailure(
      () =>
        validate(
          basecardManifest({
            capabilities: { cardTypes: [{ id: 'base.richtext', name: 'A', description: 3 }] },
          })
        ),
      'CPK_MANIFEST_INVALID',
      'capabilities.cardTypes[0].description'
    );
  });

  it('图标必须是 assets/ 内的图片且存在（§2.6）', () => {
    expectFailure(
      () =>
        validate(
          basecardManifest({
            capabilities: {
              cardTypes: [{ id: 'base.richtext', name: 'A', icon: 'icons/hello.svg' }],
            },
          })
        ),
      'CPK_MANIFEST_INVALID',
      'capabilities.cardTypes[0].icon'
    );
    expectFailure(
      () =>
        validate(
          basecardManifest({
            capabilities: {
              cardTypes: [{ id: 'base.richtext', name: 'A', icon: '/assets/x.svg' }],
            },
          })
        ),
      'CPK_MANIFEST_INVALID',
      'capabilities.cardTypes[0].icon'
    );
    expectFailure(
      () =>
        validate(
          basecardManifest({
            capabilities: {
              cardTypes: [{ id: 'base.richtext', name: 'A', icon: '../assets/x.svg' }],
            },
          })
        ),
      'CPK_MANIFEST_INVALID',
      'capabilities.cardTypes[0].icon'
    );
    expectFailure(
      () =>
        validate(
          basecardManifest({
            capabilities: {
              cardTypes: [{ id: 'base.richtext', name: 'A', icon: 'file://assets/x.svg' }],
            },
          })
        ),
      'CPK_MANIFEST_INVALID',
      'capabilities.cardTypes[0].icon'
    );
    expectFailure(
      () =>
        validate(
          basecardManifest({
            capabilities: {
              cardTypes: [{ id: 'base.richtext', name: 'A', icon: 'assets\\x.svg' }],
            },
          })
        ),
      'CPK_MANIFEST_INVALID',
      'capabilities.cardTypes[0].icon'
    );
    expectFailure(
      () =>
        validate(
          basecardManifest({
            capabilities: {
              cardTypes: [{ id: 'base.richtext', name: 'A', icon: 'assets/icons/missing.svg' }],
            },
          })
        ),
      'CPK_MANIFEST_INVALID',
      'capabilities.cardTypes[0].icon'
    );
    expectFailure(
      () =>
        validate(
          basecardManifest({
            capabilities: {
              cardTypes: [
                { id: 'base.richtext', name: 'A', icon: 'assets/schemas/grid.schema.json' },
              ],
            },
          })
        ),
      'CPK_MANIFEST_INVALID',
      'capabilities.cardTypes[0].icon'
    );
    expectFailure(
      () =>
        validate(
          basecardManifest({
            capabilities: { cardTypes: [{ id: 'base.richtext', name: 'A', icon: 1 }] },
          })
        ),
      'CPK_MANIFEST_INVALID',
      'capabilities.cardTypes[0].icon'
    );
  });

  it('configSchema 需为存在且合法的 JSON Schema', () => {
    const withSchema = (fileSystem: IFileSystemPort): unknown =>
      validate(
        basecardManifest({
          capabilities: {
            cardTypes: [
              {
                id: 'base.richtext',
                name: 'A',
                configSchema: 'assets/schemas/richtext.schema.json',
              },
            ],
          },
        }),
        { fileSystem }
      );
    expect(withSchema(schemaFileSystem())).toBeTruthy();
    expectFailure(
      () =>
        validate(
          basecardManifest({
            capabilities: {
              cardTypes: [
                { id: 'base.richtext', name: 'A', configSchema: 'assets/schemas/missing.json' },
              ],
            },
          })
        ),
      'CPK_MANIFEST_INVALID',
      'capabilities.cardTypes[0].configSchema'
    );
    expectFailure(
      () => withSchema(schemaFileWith('{不是 JSON')),
      'CPK_MANIFEST_INVALID',
      'capabilities.cardTypes[0].configSchema'
    );
    expectFailure(
      () => withSchema(schemaFileWith('[1,2]')),
      'CPK_MANIFEST_INVALID',
      'capabilities.cardTypes[0].configSchema'
    );
    expectFailure(
      () => withSchema(schemaFileWith(JSON.stringify({ type: 'array' }))),
      'CPK_MANIFEST_INVALID',
      'capabilities.cardTypes[0].configSchema'
    );
    expectFailure(
      () =>
        withSchema(
          schemaFileWith(
            JSON.stringify({
              type: 'object',
              properties: { x: { $ref: 'https://example.com/x.json' } },
            })
          )
        ),
      'CPK_MANIFEST_INVALID',
      'capabilities.cardTypes[0].configSchema'
    );
    expect(
      withSchema(
        schemaFileWith(
          JSON.stringify({
            type: 'object',
            properties: { x: { $ref: '#/$defs/color' } },
            $defs: { color: { type: 'string' } },
          })
        )
      )
    ).toBeTruthy();
  });

  it('configSchema 的 $ref 扫描需下钻数组节点（§7.2 禁远程引用）', () => {
    const withSchema = (content: string): unknown =>
      validate(
        basecardManifest({
          capabilities: {
            cardTypes: [
              {
                id: 'base.richtext',
                name: 'A',
                configSchema: 'assets/schemas/richtext.schema.json',
              },
            ],
          },
        }),
        { fileSystem: schemaFileWith(content) }
      );
    expectFailure(
      () => withSchema(REMOTE_REF_IN_ARRAY),
      'CPK_MANIFEST_INVALID',
      'capabilities.cardTypes[0].configSchema'
    );
    expectFailure(
      () => withSchema(REMOTE_REF_NESTED_IN_ARRAY),
      'CPK_MANIFEST_INVALID',
      'capabilities.cardTypes[0].configSchema'
    );
    expectFailure(
      () => withSchema(PROTOCOL_RELATIVE_REF_IN_ARRAY),
      'CPK_MANIFEST_INVALID',
      'capabilities.cardTypes[0].configSchema'
    );
    expect(withSchema(LOCAL_REF_IN_ARRAY)).toBeTruthy();
  });

  it('扩展名与别名文法', () => {
    expectFailure(
      () =>
        validate(
          basecardManifest({
            capabilities: { cardTypes: [{ id: 'base.richtext', name: 'A', extensions: ['md'] }] },
          })
        ),
      'CPK_MANIFEST_INVALID',
      'capabilities.cardTypes[0].extensions'
    );
    expectFailure(
      () =>
        validate(
          basecardManifest({
            capabilities: { cardTypes: [{ id: 'base.richtext', name: 'A', extensions: [1] }] },
          })
        ),
      'CPK_MANIFEST_INVALID',
      'capabilities.cardTypes[0].extensions'
    );
    expectFailure(
      () =>
        validate(
          basecardManifest({
            capabilities: {
              cardTypes: [{ id: 'base.richtext', name: 'A', aliases: ['base.BAD'] }],
            },
          })
        ),
      'CPK_MANIFEST_INVALID',
      'capabilities.cardTypes[0].aliases'
    );
    expectFailure(
      () =>
        validate(
          basecardManifest({
            capabilities: { cardTypes: [{ id: 'base.richtext', name: 'A', aliases: [1] }] },
          })
        ),
      'CPK_MANIFEST_INVALID',
      'capabilities.cardTypes[0].aliases'
    );
    expect(
      validate(
        basecardManifest({
          capabilities: {
            cardTypes: [{ id: 'base.richtext', name: 'A', aliases: ['RichTextCard'] }],
          },
        })
      )
    ).toBeTruthy();
    expectFailure(
      () =>
        validate(
          basecardManifest({
            capabilities: { cardTypes: [{ id: 'base.richtext', name: 'A', extensions: ['.MD'] }] },
          })
        ),
      'CPK_MANIFEST_INVALID',
      'capabilities.cardTypes[0].extensions'
    );
  });

  it('exportFormats 四字段齐备', () => {
    expectFailure(
      () =>
        validate(
          basecardManifest({
            capabilities: {
              cardTypes: [{ id: 'base.richtext', name: 'A', exportFormats: [{ id: 'html' }] }],
            },
          })
        ),
      'CPK_MANIFEST_INVALID',
      'capabilities.cardTypes[0].exportFormats[].name'
    );
    expectFailure(
      () =>
        validate(
          basecardManifest({
            capabilities: {
              cardTypes: [
                {
                  id: 'base.richtext',
                  name: 'A',
                  exportFormats: [
                    { id: 'html', name: 'H', extension: '.html', mimeType: 'text/html', extra: 1 },
                  ],
                },
              ],
            },
          })
        ),
      'CPK_MANIFEST_INVALID',
      'capabilities.cardTypes[0].exportFormats[].extra'
    );
  });
});

describe('capabilities：boxlayout（§7.3）', () => {
  it('boxlayout 必须声明 capabilities.layouts', () => {
    expectFailure(
      () => validate(boxlayoutManifest({ capabilities: {} })),
      'CPK_MANIFEST_INVALID',
      'capabilities.layouts'
    );
    expectFailure(
      () =>
        validate(
          boxlayoutManifest({ capabilities: { cardTypes: [{ id: 'base.richtext', name: 'A' }] } })
        ),
      'CPK_MANIFEST_INVALID',
      'capabilities.layouts'
    );
  });

  it('布局类型 ID 必须为 chips.layout.<name>', () => {
    const badId = boxlayoutManifest({
      capabilities: {
        layouts: [
          {
            id: 'grid',
            name: '网格',
            configSchema: 'assets/schemas/grid.schema.json',
            schemaVersions: '*',
          },
        ],
      },
    });
    expectFailure(
      () => validate(badId, { fileSystem: schemaFileSystem() }),
      'CPK_MANIFEST_INVALID',
      'capabilities.layouts[0].id'
    );
    const layout = (id: string): Record<string, unknown> => ({
      id,
      name: '网格',
      configSchema: 'assets/schemas/grid.schema.json',
      schemaVersions: '*',
    });
    expectFailure(
      () =>
        validate(
          boxlayoutManifest({
            capabilities: { layouts: [layout('chips.layout.a'), layout('chips.layout.a')] },
          }),
          {
            fileSystem: schemaFileSystem(),
          }
        ),
      'CPK_MANIFEST_INVALID',
      'capabilities.layouts[1].id'
    );
    expectFailure(
      () => validate(boxlayoutManifest({ capabilities: { layouts: [] } })),
      'CPK_MANIFEST_INVALID',
      'capabilities.layouts'
    );
    expectFailure(
      () => validate(boxlayoutManifest({ capabilities: { layouts: ['x'] } })),
      'CPK_MANIFEST_INVALID',
      'capabilities.layouts[0]'
    );
  });

  it('configSchema 与 schemaVersions 必填且范围合法', () => {
    expectFailure(
      () =>
        validate(
          boxlayoutManifest({
            capabilities: { layouts: [{ id: 'chips.layout.grid', name: '网格' }] },
          })
        ),
      'CPK_MANIFEST_INVALID',
      'capabilities.layouts[0].configSchema'
    );
    expectFailure(
      () =>
        validate(
          boxlayoutManifest({
            capabilities: {
              layouts: [
                {
                  id: 'chips.layout.grid',
                  name: '网格',
                  configSchema: 'assets/schemas/grid.schema.json',
                },
              ],
            },
          })
        ),
      'CPK_MANIFEST_INVALID',
      'capabilities.layouts[0].schemaVersions'
    );
    expectFailure(
      () =>
        validate(
          boxlayoutManifest({
            capabilities: {
              layouts: [
                {
                  id: 'chips.layout.grid',
                  name: '网格',
                  configSchema: 'assets/schemas/grid.schema.json',
                  schemaVersions: '>=abc',
                },
              ],
            },
          })
        ),
      'CPK_MANIFEST_INVALID',
      'capabilities.layouts[0].schemaVersions'
    );
  });

  it('布局图标必须是图片且已登记目录生效', () => {
    expectFailure(
      () =>
        validate(
          boxlayoutManifest({
            capabilities: {
              layouts: [
                {
                  id: 'chips.layout.grid',
                  name: '网格',
                  icon: 'assets/schemas/grid.schema.json',
                  configSchema: 'assets/schemas/grid.schema.json',
                  schemaVersions: '1.0.0',
                },
              ],
            },
          })
        ),
      'CPK_MANIFEST_INVALID',
      'capabilities.layouts[0].icon'
    );
    expectFailure(
      () =>
        validate(boxlayoutManifest(), {
          fileSystem: schemaFileSystem(),
          catalog: createDocumentedPermissionCatalog({ layoutTypeIds: ['chips.layout.flow'] }),
        }),
      'CPK_MANIFEST_INVALID',
      'capabilities.layouts[0].id'
    );
  });
});

describe('ui（§7.4）', () => {
  it('app 必须声明 ui，其他角色不得声明', () => {
    expectFailure(() => validate(withoutField(appManifest(), 'ui')), 'CPK_MANIFEST_INVALID', 'ui');
    expectFailure(
      () => validate(basecardManifest({ ui: { surface: 'window' } })),
      'CPK_MANIFEST_INVALID',
      'ui'
    );
  });

  it('surface 取值与 launcher 字段', () => {
    for (const surface of ['window', 'desktop', 'tray']) {
      expect(validate(appManifest({ ui: { surface } })).role).toBe('app');
    }
    expectFailure(
      () => validate(appManifest({ ui: { surface: 'panel' } })),
      'CPK_MANIFEST_INVALID',
      'ui.surface'
    );
    expectFailure(() => validate(appManifest({ ui: {} })), 'CPK_MANIFEST_INVALID', 'ui.surface');
    expectFailure(() => validate(appManifest({ ui: 'window' })), 'CPK_MANIFEST_INVALID', 'ui');
    expectFailure(
      () =>
        validate(
          appManifest({ ui: { surface: 'window', launcher: { icon: 'assets/icons/missing.svg' } } })
        ),
      'CPK_MANIFEST_INVALID',
      'ui.launcher.icon'
    );
    expectFailure(
      () => validate(appManifest({ ui: { surface: 'window', launcher: { name: 1 } } })),
      'CPK_MANIFEST_INVALID',
      'ui.launcher.name'
    );
    expectFailure(
      () => validate(appManifest({ ui: { surface: 'window', launcher: { description: 1 } } })),
      'CPK_MANIFEST_INVALID',
      'ui.launcher.description'
    );
    expectFailure(
      () => validate(appManifest({ ui: { surface: 'window', launcher: { extra: 1 } } })),
      'CPK_MANIFEST_INVALID',
      'ui.launcher.extra'
    );
  });
});

describe('fileAssociations（§7.5）', () => {
  it('只允许 app / service 声明', () => {
    expectFailure(
      () =>
        validate(basecardManifest({ fileAssociations: [{ extensions: ['.md'], action: 'open' }] })),
      'CPK_MANIFEST_INVALID',
      'fileAssociations'
    );
  });

  it('扩展名与 MIME 至少一项非空', () => {
    expectFailure(
      () => validate(appManifest({ fileAssociations: [{ extensions: [''], action: 'open' }] })),
      'CPK_MANIFEST_INVALID',
      'fileAssociations[0]'
    );
    expect(
      validate(appManifest({ fileAssociations: [{ extensions: ['', '.card'], action: 'open' }] }))
    ).toBeTruthy();
    expect(
      validate(
        appManifest({
          fileAssociations: [
            { extensions: [], mimeTypes: ['application/x-chips-card'], action: 'open' },
          ],
        })
      )
    ).toBeTruthy();
  });

  it('扩展名文法与重复、MIME 文法、tier 与 action', () => {
    expectFailure(
      () =>
        validate(appManifest({ fileAssociations: [{ extensions: ['.CARD'], action: 'open' }] })),
      'CPK_MANIFEST_INVALID',
      'fileAssociations[0].extensions[0]'
    );
    expectFailure(
      () =>
        validate(
          appManifest({ fileAssociations: [{ extensions: ['.card', '.card'], action: 'open' }] })
        ),
      'CPK_MANIFEST_INVALID',
      'fileAssociations[0].extensions[1]'
    );
    expectFailure(
      () => validate(appManifest({ fileAssociations: [{ extensions: 3, action: 'open' }] })),
      'CPK_MANIFEST_INVALID',
      'fileAssociations[0].extensions'
    );
    expectFailure(
      () =>
        validate(
          appManifest({
            fileAssociations: [{ extensions: ['.card'], mimeTypes: ['*/*'], action: 'open' }],
          })
        ),
      'CPK_MANIFEST_INVALID',
      'fileAssociations[0].mimeTypes[0]'
    );
    expectFailure(
      () =>
        validate(
          appManifest({
            fileAssociations: [{ extensions: ['.card'], mimeTypes: [1], action: 'open' }],
          })
        ),
      'CPK_MANIFEST_INVALID',
      'fileAssociations[0].mimeTypes[0]'
    );
    expect(
      validate(
        appManifest({
          fileAssociations: [{ extensions: ['.card'], mimeTypes: ['text/*'], action: 'open' }],
        })
      )
    ).toBeTruthy();
    expectFailure(
      () =>
        validate(
          appManifest({
            fileAssociations: [{ extensions: ['.card'], tier: 'secondary', action: 'open' }],
          })
        ),
      'CPK_MANIFEST_INVALID',
      'fileAssociations[0].tier'
    );
    expect(
      validate(
        appManifest({
          fileAssociations: [{ extensions: ['.card'], tier: 'primary', action: 'open' }],
        })
      )
    ).toBeTruthy();
    expectFailure(
      () =>
        validate(
          appManifest({ fileAssociations: [{ extensions: ['.card'], action: 'open', extra: 1 }] })
        ),
      'CPK_MANIFEST_INVALID',
      'fileAssociations[0].extra'
    );
    expectFailure(
      () =>
        validate(
          appManifest({
            fileAssociations: [{ extensions: ['.card'], tier: 'primary', action: 'print' }],
          })
        ),
      'CPK_MANIFEST_INVALID',
      'fileAssociations[0].action'
    );
    expectFailure(
      () => validate(appManifest({ fileAssociations: [{ extensions: ['.card'] }] })),
      'CPK_MANIFEST_INVALID',
      'fileAssociations[0].action'
    );
    expectFailure(
      () => validate(appManifest({ fileAssociations: 'x' })),
      'CPK_MANIFEST_INVALID',
      'fileAssociations'
    );
  });
});

describe('deepLinks（§7.4）', () => {
  it('只允许 app 声明', () => {
    expectFailure(
      () => validate(serviceManifest({ deepLinks: [{ scheme: 'chips', host: 'viewer' }] })),
      'CPK_MANIFEST_INVALID',
      'deepLinks'
    );
  });

  it('保留 scheme 与重复声明拒绝', () => {
    expectFailure(
      () => validate(appManifest({ deepLinks: [{ scheme: 'https', host: 'x.dev' }] })),
      'CPK_MANIFEST_INVALID',
      'deepLinks[0].scheme'
    );
    expectFailure(
      () =>
        validate(
          appManifest({
            deepLinks: [
              { scheme: 'chipsviewer', host: 'open' },
              { scheme: 'chipsviewer', host: 'open' },
            ],
          })
        ),
      'CPK_MANIFEST_INVALID',
      'deepLinks[1]'
    );
    expect(
      validate(
        appManifest({
          deepLinks: [
            { scheme: 'chipsviewer', host: 'open', pathPattern: '/card/*' },
            { scheme: 'chipsviewer', host: 'box' },
          ],
        })
      )
    ).toBeTruthy();
    expectFailure(
      () => validate(appManifest({ deepLinks: [{ scheme: 'chipsviewer', host: 1 }] })),
      'CPK_MANIFEST_INVALID',
      'deepLinks[0].host'
    );
    expectFailure(
      () => validate(appManifest({ deepLinks: 'x' })),
      'CPK_MANIFEST_INVALID',
      'deepLinks'
    );
  });
});

describe('healthCheck（§7.5）', () => {
  it('只允许 service 声明', () => {
    expectFailure(
      () => validate(appManifest({ healthCheck: { interval: '30s', timeout: '5s' } })),
      'CPK_MANIFEST_INVALID',
      'healthCheck'
    );
  });

  it('缺省 interval 30s / timeout 5s', () => {
    expect(validate(serviceManifest({ healthCheck: {} }))).toBeTruthy();
  });

  it('时长文法与相互约束', () => {
    expect(
      validate(serviceManifest({ healthCheck: { interval: '1m', timeout: '9000ms' } }))
    ).toBeTruthy();
    expectFailure(
      () => validate(serviceManifest({ healthCheck: { interval: '30' } })),
      'CPK_MANIFEST_INVALID',
      'healthCheck.interval'
    );
    expectFailure(
      () => validate(serviceManifest({ healthCheck: { interval: 30000 } })),
      'CPK_MANIFEST_INVALID',
      'healthCheck.interval'
    );
    expectFailure(
      () => validate(serviceManifest({ healthCheck: { timeout: '5x' } })),
      'CPK_MANIFEST_INVALID',
      'healthCheck.timeout'
    );
    expectFailure(
      () => validate(serviceManifest({ healthCheck: { interval: '500ms', timeout: '100ms' } })),
      'CPK_MANIFEST_INVALID',
      'healthCheck.interval'
    );
    expectFailure(
      () => validate(serviceManifest({ healthCheck: { interval: '5s', timeout: '5s' } })),
      'CPK_MANIFEST_INVALID',
      'healthCheck.timeout'
    );
    expectFailure(
      () => validate(serviceManifest({ healthCheck: { interval: '30s', extra: 1 } })),
      'CPK_MANIFEST_INVALID',
      'healthCheck.extra'
    );
  });
});

describe('cli.commands（[CLI 完整参考] §5.1）', () => {
  function appCli(commands: readonly unknown[]): { commands: Record<string, unknown>[] } {
    return {
      commands: commands.map((command) => ({
        commandPath: ['viewer', 'open'],
        commandId: 'viewer:open',
        title: '打开卡片',
        target: { type: 'app', pluginId: 'chips.official.viewer' },
        ...(typeof command === 'object' && command !== null ? command : {}),
      })),
    };
  }

  it('只允许 app / service 声明，commands 非空', () => {
    expectFailure(
      () => validate(basecardManifest({ cli: { commands: [] } })),
      'CPK_MANIFEST_INVALID',
      'cli'
    );
    expectFailure(
      () => validate(appManifest({ cli: { commands: [] } })),
      'CPK_MANIFEST_INVALID',
      'cli.commands'
    );
    expectFailure(() => validate(appManifest({ cli: 'x' })), 'CPK_MANIFEST_INVALID', 'cli');
    expectFailure(
      () => validate(appManifest({ cli: { commands: [{}], extra: 1 } })),
      'CPK_MANIFEST_INVALID',
      'cli.extra'
    );
  });

  it('合法的服务目标命令声明', () => {
    const manifest = serviceManifest({
      cli: {
        commands: [
          {
            commandPath: 'clock',
            title: '读取时钟',
            description: '读取统一时钟',
            examples: ['chips clock now'],
            permissions: ['resources:read'],
            target: { type: 'service', pluginId: 'chips.service.clock', capability: 'system:info' },
            output: { mode: 'json', json: 'supported', artifacts: ['output.files'] },
            conflict: { priority: 10, namespace: 'clock' },
          },
        ],
      },
    });
    expect(validate(manifest).role).toBe('service');
  });

  it('commandPath 文法、固定根与插件内唯一', () => {
    expectFailure(
      () =>
        validate(
          appManifest({
            cli: {
              commands: [
                { title: 'A', target: { type: 'app', pluginId: 'chips.official.viewer' } },
              ],
            },
          })
        ),
      'CPK_MANIFEST_INVALID',
      'cli.commands[0].commandPath'
    );
    expectFailure(
      () => validate(appManifest({ cli: appCli([{ commandPath: [] }]) })),
      'CPK_MANIFEST_INVALID',
      'cli.commands[0].commandPath'
    );
    expectFailure(
      () => validate(appManifest({ cli: appCli([{ commandPath: ['Bad Path'] }]) })),
      'CPK_MANIFEST_INVALID',
      'cli.commands[0].commandPath'
    );
    expectFailure(
      () => validate(appManifest({ cli: appCli([{ commandPath: ['plugin', 'x'] }]) })),
      'CPK_MANIFEST_INVALID',
      'cli.commands[0].commandPath'
    );
    expectFailure(
      () =>
        validate(
          appManifest({
            cli: {
              commands: [
                ...appCli([{}]).commands,
                ...appCli([{}]).commands.map((command: Record<string, unknown>) => ({
                  ...command,
                  commandPath: ['VIEWER', 'OPEN'],
                })),
              ],
            },
          })
        ),
      'CPK_MANIFEST_INVALID',
      'cli.commands[1].commandPath'
    );
  });

  it('target 必须等于角色与自身 ID', () => {
    expectFailure(
      () =>
        validate(
          appManifest({
            cli: appCli([{ target: { type: 'service', pluginId: 'chips.official.viewer' } }]),
          })
        ),
      'CPK_MANIFEST_INVALID',
      'cli.commands[0].target.type'
    );
    expectFailure(
      () =>
        validate(
          appManifest({ cli: appCli([{ target: { type: 'app', pluginId: 'chips.other' } }]) })
        ),
      'CPK_MANIFEST_INVALID',
      'cli.commands[0].target.pluginId'
    );
    expectFailure(
      () => validate(appManifest({ cli: appCli([{ target: 'main' }]) })),
      'CPK_MANIFEST_INVALID',
      'cli.commands[0].target'
    );
    expectFailure(
      () => validate(appManifest({ cli: appCli([{ title: 1 }]) })),
      'CPK_MANIFEST_INVALID',
      'cli.commands[0].title'
    );
    expectFailure(
      () => validate(appManifest({ cli: appCli([{ description: 1 }]) })),
      'CPK_MANIFEST_INVALID',
      'cli.commands[0].description'
    );
    expectFailure(
      () => validate(appManifest({ cli: appCli([{ examples: [1] }]) })),
      'CPK_MANIFEST_INVALID',
      'cli.commands[0].examples'
    );
    expectFailure(
      () => validate(appManifest({ cli: appCli([{ permissions: ['nope:read'] }]) })),
      'PERMISSION_UNKNOWN'
    );
    expectFailure(
      () => validate(appManifest({ cli: appCli([{ extraField: 1 }]) })),
      'CPK_MANIFEST_INVALID',
      'cli.commands[0].extraField'
    );
  });

  it('app 目标 commandId 与 surface 约束', () => {
    expectFailure(
      () =>
        validate(
          appManifest({
            cli: {
              commands: [
                {
                  commandPath: ['viewer', 'open'],
                  title: '打开卡片',
                  target: { type: 'app', pluginId: 'chips.official.viewer' },
                },
              ],
            },
          })
        ),
      'CPK_MANIFEST_INVALID',
      'cli.commands[0].commandId'
    );
    expectFailure(
      () => validate(appManifest({ cli: appCli([{ commandId: 'viewer-open' }]) })),
      'CPK_MANIFEST_INVALID',
      'cli.commands[0].commandId'
    );
    expectFailure(
      () =>
        validate(
          appManifest({
            cli: appCli([
              {
                target: {
                  type: 'app',
                  pluginId: 'chips.official.viewer',
                  capability: 'system:info',
                },
              },
            ]),
          })
        ),
      'CPK_MANIFEST_INVALID',
      'cli.commands[0].target.capability'
    );
    expectFailure(
      () =>
        validate(
          appManifest({
            cli: appCli([
              {
                target: {
                  type: 'app',
                  pluginId: 'chips.official.viewer',
                  surface: { reuse: 'sometimes' },
                },
              },
            ]),
          })
        ),
      'CPK_MANIFEST_INVALID',
      'cli.commands[0].target.surface.reuse'
    );
    expectFailure(
      () =>
        validate(
          appManifest({
            cli: appCli([
              {
                target: {
                  type: 'app',
                  pluginId: 'chips.official.viewer',
                  surface: { open: 'yes' },
                },
              },
            ]),
          })
        ),
      'CPK_MANIFEST_INVALID',
      'cli.commands[0].target.surface.open'
    );
    expectFailure(
      () =>
        validate(
          appManifest({
            cli: appCli([
              {
                target: {
                  type: 'app',
                  pluginId: 'chips.official.viewer',
                  surface: { focus: 'yes' },
                },
              },
            ]),
          })
        ),
      'CPK_MANIFEST_INVALID',
      'cli.commands[0].target.surface.focus'
    );
    expectFailure(
      () =>
        validate(
          appManifest({
            cli: appCli([
              { target: { type: 'app', pluginId: 'chips.official.viewer', surface: { extra: 1 } } },
            ]),
          })
        ),
      'CPK_MANIFEST_INVALID',
      'cli.commands[0].target.surface.extra'
    );
    expect(
      validate(
        appManifest({
          cli: appCli([
            {
              target: {
                type: 'app',
                pluginId: 'chips.official.viewer',
                surface: { open: true, focus: false, reuse: 'always' },
              },
            },
          ]),
        })
      )
    ).toBeTruthy();
  });

  it('service 目标禁止 commandId / surface / job，capability 需合法', () => {
    const serviceCli = (extra: Record<string, unknown>): Record<string, unknown> => ({
      commands: [
        {
          commandPath: ['clock', 'now'],
          title: '读取时钟',
          target: { type: 'service', pluginId: 'chips.service.clock', capability: 'system:info' },
          ...extra,
        },
      ],
    });
    expect(validate(serviceManifest({ cli: serviceCli({}) }))).toBeTruthy();
    expectFailure(
      () => validate(serviceManifest({ cli: serviceCli({ commandId: 'clock:now' }) })),
      'CPK_MANIFEST_INVALID',
      'cli.commands[0].commandId'
    );
    expectFailure(
      () => validate(serviceManifest({ cli: serviceCli({ job: { wait: true } }) })),
      'CPK_MANIFEST_INVALID',
      'cli.commands[0].job'
    );
    expectFailure(
      () =>
        validate(
          serviceManifest({
            cli: serviceCli({
              target: {
                type: 'service',
                pluginId: 'chips.service.clock',
                capability: 'system:info',
                surface: { open: true },
              },
            }),
          })
        ),
      'CPK_MANIFEST_INVALID',
      'cli.commands[0].target.surface'
    );
    expectFailure(
      () =>
        validate(
          serviceManifest({
            cli: serviceCli({ target: { type: 'service', pluginId: 'chips.service.clock' } }),
          })
        ),
      'CPK_MANIFEST_INVALID',
      'cli.commands[0].target.capability'
    );
    expectFailure(
      () =>
        validate(
          serviceManifest({
            cli: serviceCli({
              target: {
                type: 'service',
                pluginId: 'chips.service.clock',
                capability: 'system_info',
              },
            }),
          })
        ),
      'CPK_MANIFEST_INVALID',
      'cli.commands[0].target.capability'
    );
    expectFailure(
      () =>
        validate(serviceManifest({ cli: serviceCli({}) }), {
          catalog: createDocumentedPermissionCatalog({ capabilityIds: ['file:read'] }),
        }),
      'CPK_MANIFEST_INVALID',
      'cli.commands[0].target.capability'
    );
  });

  it('output 与 job、conflict 字段取值', () => {
    expectFailure(
      () => validate(appManifest({ cli: appCli([{ output: { mode: 'yaml' } }]) })),
      'CPK_MANIFEST_INVALID',
      'cli.commands[0].output.mode'
    );
    expectFailure(
      () => validate(appManifest({ cli: appCli([{ output: { json: 'sometimes' } }]) })),
      'CPK_MANIFEST_INVALID',
      'cli.commands[0].output.json'
    );
    expectFailure(
      () => validate(appManifest({ cli: appCli([{ output: { artifacts: 'x' } }]) })),
      'CPK_MANIFEST_INVALID',
      'cli.commands[0].output.artifacts'
    );
    expectFailure(
      () => validate(appManifest({ cli: appCli([{ output: { extra: 1 } }]) })),
      'CPK_MANIFEST_INVALID',
      'cli.commands[0].output.extra'
    );
    expectFailure(
      () => validate(appManifest({ cli: appCli([{ job: { wait: 'yes' } }]) })),
      'CPK_MANIFEST_INVALID',
      'cli.commands[0].job.wait'
    );
    expectFailure(
      () => validate(appManifest({ cli: appCli([{ job: { cancelOnInterrupt: 1 } }]) })),
      'CPK_MANIFEST_INVALID',
      'cli.commands[0].job.cancelOnInterrupt'
    );
    expectFailure(
      () => validate(appManifest({ cli: appCli([{ job: { extra: 1 } }]) })),
      'CPK_MANIFEST_INVALID',
      'cli.commands[0].job.extra'
    );
    expectFailure(
      () => validate(appManifest({ cli: appCli([{ conflict: { priority: '高' } }]) })),
      'CPK_MANIFEST_INVALID',
      'cli.commands[0].conflict.priority'
    );
    expectFailure(
      () => validate(appManifest({ cli: appCli([{ conflict: { namespace: 1 } }]) })),
      'CPK_MANIFEST_INVALID',
      'cli.commands[0].conflict.namespace'
    );
    expect(
      validate(appManifest({ cli: appCli([{ job: { wait: false, cancelOnInterrupt: true } }]) }))
    ).toBeTruthy();
  });
});

describe('cli.commands 参数声明（§5.2）', () => {
  function withOptions(options: readonly unknown[]): Record<string, unknown> {
    return {
      commands: [
        {
          commandPath: ['viewer', 'open'],
          commandId: 'viewer:open',
          title: '打开卡片',
          target: { type: 'app', pluginId: 'chips.official.viewer' },
          options,
        },
      ],
    };
  }

  function withArguments(args: readonly unknown[]): Record<string, unknown> {
    return {
      commands: [
        {
          commandPath: ['viewer', 'open'],
          commandId: 'viewer:open',
          title: '打开卡片',
          target: { type: 'app', pluginId: 'chips.official.viewer' },
          arguments: args,
        },
      ],
    };
  }

  it('参数名文法、唯一性与未知字段', () => {
    expectFailure(
      () => validate(appManifest({ cli: withOptions([{ name: 'A 选项', type: 'string' }]) })),
      'CPK_MANIFEST_INVALID',
      'cli.commands[0].options[0].name'
    );
    expectFailure(
      () => validate(appManifest({ cli: withOptions([{ name: 1, type: 'string' }]) })),
      'CPK_MANIFEST_INVALID',
      'cli.commands[0].options[0].name'
    );
    expectFailure(
      () =>
        validate(
          appManifest({
            cli: withOptions([
              { name: 'path', type: 'string' },
              { name: 'path', type: 'string' },
            ]),
          })
        ),
      'CPK_MANIFEST_INVALID',
      'cli.commands[0].options[1].name'
    );
    expectFailure(
      () =>
        validate(appManifest({ cli: withOptions([{ name: 'path', type: 'string', extra: 1 }]) })),
      'CPK_MANIFEST_INVALID',
      'cli.commands[0].options[0].extra'
    );
    expect(
      validate(appManifest({ cli: withOptions([{ name: 'Output', type: 'string' }]) }))
    ).toBeTruthy();
  });

  it('参数类型必须是 11 种之一', () => {
    expectFailure(
      () => validate(appManifest({ cli: withOptions([{ name: 'path' }]) })),
      'CPK_MANIFEST_INVALID',
      'cli.commands[0].options[0].type'
    );
    const types: readonly string[] = [
      'string',
      'stringList',
      'number',
      'integer',
      'boolean',
      'enum',
      'path',
      'json',
      'jsonFile',
      'text',
      'textFile',
    ];
    types.forEach((type, index) => {
      const choices = type === 'enum' ? ['a'] : undefined;
      expect(
        validate(
          appManifest({
            cli: withOptions([
              { name: `param-${index}`, type, ...(choices === undefined ? {} : { choices }) },
            ]),
          })
        )
      ).toBeTruthy();
    });
    expect(types).toHaveLength(11);
    expectFailure(
      () => validate(appManifest({ cli: withOptions([{ name: 'path', type: 'date' }]) })),
      'CPK_MANIFEST_INVALID',
      'cli.commands[0].options[0].type'
    );
  });

  it('短名唯一且为单字符', () => {
    expectFailure(
      () =>
        validate(
          appManifest({
            cli: withOptions([
              { name: 'path', type: 'string', short: 'p' },
              { name: 'mode', type: 'string', short: 'p' },
            ]),
          })
        ),
      'CPK_MANIFEST_INVALID',
      'cli.commands[0].options[1].short'
    );
    expectFailure(
      () =>
        validate(
          appManifest({ cli: withOptions([{ name: 'path', type: 'string', short: 'pp' }]) })
        ),
      'CPK_MANIFEST_INVALID',
      'cli.commands[0].options[0].short'
    );
    expect(
      validate(appManifest({ cli: withOptions([{ name: 'path', type: 'string', short: '9' }]) }))
    ).toBeTruthy();
  });

  it('position 只属于位置参数且唯一', () => {
    expectFailure(
      () =>
        validate(
          appManifest({ cli: withOptions([{ name: 'path', type: 'string', position: 0 }]) })
        ),
      'CPK_MANIFEST_INVALID',
      'cli.commands[0].options[0].position'
    );
    expect(
      validate(appManifest({ cli: withArguments([{ name: 'path', type: 'string' }]) }))
    ).toBeTruthy();
    expectFailure(
      () =>
        validate(
          appManifest({
            cli: withArguments([
              { name: 'a', type: 'string', position: 1 },
              { name: 'b', type: 'string', position: 1 },
            ]),
          })
        ),
      'CPK_MANIFEST_INVALID',
      'cli.commands[0].arguments[1].position'
    );
    expectFailure(
      () =>
        validate(
          appManifest({ cli: withArguments([{ name: 'a', type: 'string', position: -1 }]) })
        ),
      'CPK_MANIFEST_INVALID',
      'cli.commands[0].arguments[0].position'
    );
    expectFailure(
      () =>
        validate(
          appManifest({ cli: withArguments([{ name: 'a', type: 'string', position: 1.5 }]) })
        ),
      'CPK_MANIFEST_INVALID',
      'cli.commands[0].arguments[0].position'
    );
    expectFailure(
      () => validate(appManifest({ cli: withArguments(['文本']) })),
      'CPK_MANIFEST_INVALID',
      'cli.commands[0].arguments[0]'
    );
  });

  it('mapsTo 必须是点分标识符', () => {
    expect(
      validate(
        appManifest({ cli: withOptions([{ name: 'path', type: 'string', mapsTo: 'target.path' }]) })
      )
    ).toBeTruthy();
    expectFailure(
      () =>
        validate(
          appManifest({ cli: withOptions([{ name: 'path', type: 'string', mapsTo: 'a-b' }]) })
        ),
      'CPK_MANIFEST_INVALID',
      'cli.commands[0].options[0].mapsTo'
    );
    expectFailure(
      () =>
        validate(appManifest({ cli: withOptions([{ name: 'path', type: 'string', mapsTo: 1 }]) })),
      'CPK_MANIFEST_INVALID',
      'cli.commands[0].options[0].mapsTo'
    );
  });

  it('enum 必须携带非空 choices', () => {
    expectFailure(
      () => validate(appManifest({ cli: withOptions([{ name: 'mode', type: 'enum' }]) })),
      'CPK_MANIFEST_INVALID',
      'cli.commands[0].options[0].choices'
    );
    expectFailure(
      () =>
        validate(appManifest({ cli: withOptions([{ name: 'mode', type: 'enum', choices: [] }]) })),
      'CPK_MANIFEST_INVALID',
      'cli.commands[0].options[0].choices'
    );
    expectFailure(
      () =>
        validate(appManifest({ cli: withOptions([{ name: 'mode', type: 'enum', choices: 'x' }]) })),
      'CPK_MANIFEST_INVALID',
      'cli.commands[0].options[0].choices'
    );
  });

  it('validation 字段与正则合法性', () => {
    expect(
      validate(
        appManifest({
          cli: withOptions([
            {
              name: 'path',
              type: 'string',
              validation: { min: 1, max: 2, minLength: 1, maxLength: 2, pattern: '^a' },
            },
          ]),
        })
      )
    ).toBeTruthy();
    expectFailure(
      () =>
        validate(
          appManifest({
            cli: withOptions([
              {
                name: 'path',
                type: 'string',
                validation: { pattern: '([' },
              },
            ]),
          })
        ),
      'CPK_MANIFEST_INVALID',
      'cli.commands[0].options[0].validation.pattern'
    );
    expectFailure(
      () =>
        validate(
          appManifest({
            cli: withOptions([{ name: 'path', type: 'string', validation: { extra: 1 } }]),
          })
        ),
      'CPK_MANIFEST_INVALID',
      'cli.commands[0].options[0].validation.extra'
    );
    expectFailure(
      () =>
        validate(
          appManifest({
            cli: withOptions([{ name: 'path', type: 'string', validation: { pattern: 1 } }]),
          })
        ),
      'CPK_MANIFEST_INVALID',
      'cli.commands[0].options[0].validation.pattern'
    );
  });

  it('path 规则约束（§5.2）', () => {
    expect(
      validate(
        appManifest({
          cli: withOptions([
            {
              name: 'out',
              type: 'path',
              path: {
                kind: 'file',
                role: 'output',
                exists: false,
                create: true,
                extensions: ['.md'],
                overwrite: 'rename',
              },
            },
          ]),
        })
      )
    ).toBeTruthy();
    expectFailure(
      () =>
        validate(
          appManifest({ cli: withOptions([{ name: 'p', type: 'path', path: { role: 'middle' } }]) })
        ),
      'CPK_MANIFEST_INVALID',
      'cli.commands[0].options[0].path.role'
    );
    expectFailure(
      () =>
        validate(
          appManifest({
            cli: withOptions([{ name: 'p', type: 'path', path: { overwrite: 'fail' } }]),
          })
        ),
      'CPK_MANIFEST_INVALID',
      'cli.commands[0].options[0].path.overwrite'
    );
    expectFailure(
      () =>
        validate(
          appManifest({
            cli: withOptions([
              { name: 'p', type: 'path', path: { role: 'output', overwrite: 'sometimes' } },
            ]),
          })
        ),
      'CPK_MANIFEST_INVALID',
      'cli.commands[0].options[0].path.overwrite'
    );
    expectFailure(
      () =>
        validate(
          appManifest({
            cli: withOptions([{ name: 'p', type: 'string', path: { role: 'output' } }]),
          })
        ),
      'CPK_MANIFEST_INVALID',
      'cli.commands[0].options[0].path.role'
    );
    expectFailure(
      () =>
        validate(
          appManifest({ cli: withOptions([{ name: 'p', type: 'path', path: { extra: 1 } }]) })
        ),
      'CPK_MANIFEST_INVALID',
      'cli.commands[0].options[0].path.extra'
    );
  });

  it('batch 规则约束（§5.2）', () => {
    expectFailure(
      () => validate(appManifest({ cli: withOptions([{ name: 'p', type: 'string', batch: {} }]) })),
      'CPK_MANIFEST_INVALID',
      'cli.commands[0].options[0].batch'
    );
    expect(
      validate(
        appManifest({
          cli: withOptions([
            { name: 'list', type: 'textFile', batch: { format: 'lines', itemType: 'value' } },
          ]),
        })
      )
    ).toBeTruthy();
    expectFailure(
      () =>
        validate(
          appManifest({
            cli: withOptions([{ name: 'list', type: 'textFile', batch: { format: 'json-array' } }]),
          })
        ),
      'CPK_MANIFEST_INVALID',
      'cli.commands[0].options[0].batch.format'
    );
    expectFailure(
      () =>
        validate(
          appManifest({
            cli: withOptions([{ name: 'list', type: 'jsonFile', batch: { format: 'lines' } }]),
          })
        ),
      'CPK_MANIFEST_INVALID',
      'cli.commands[0].options[0].batch.format'
    );
    expectFailure(
      () =>
        validate(
          appManifest({
            cli: withOptions([
              { name: 'list', type: 'jsonFile', batch: { itemPath: { kind: 'file' } } },
            ]),
          })
        ),
      'CPK_MANIFEST_INVALID',
      'cli.commands[0].options[0].batch.itemPath'
    );
    expectFailure(
      () =>
        validate(
          appManifest({
            cli: withOptions([{ name: 'list', type: 'jsonFile', batch: { extra: 1 } }]),
          })
        ),
      'CPK_MANIFEST_INVALID',
      'cli.commands[0].options[0].batch.extra'
    );
    expect(
      validate(
        appManifest({
          cli: withOptions([
            {
              name: 'list',
              type: 'jsonFile',
              batch: {
                format: 'json-array',
                itemType: 'path',
                itemPath: { kind: 'file', role: 'input' },
              },
            },
          ]),
        })
      )
    ).toBeTruthy();
  });

  it('ui 控件登记', () => {
    expect(
      validate(
        appManifest({
          cli: withOptions([
            {
              name: 'mode',
              type: 'enum',
              choices: ['a'],
              ui: {
                control: 'select',
                choices: ['a'],
                min: 0,
                max: 1,
                step: 1,
                placeholder: '选择',
              },
            },
          ]),
        })
      )
    ).toBeTruthy();
    expectFailure(
      () =>
        validate(
          appManifest({
            cli: withOptions([
              { name: 'mode', type: 'enum', choices: ['a'], ui: { control: 'combobox' } },
            ]),
          })
        ),
      'CPK_MANIFEST_INVALID',
      'cli.commands[0].options[0].ui.control'
    );
    expectFailure(
      () =>
        validate(
          appManifest({
            cli: withOptions([{ name: 'mode', type: 'enum', choices: ['a'], ui: { extra: 1 } }]),
          })
        ),
      'CPK_MANIFEST_INVALID',
      'cli.commands[0].options[0].ui.extra'
    );
  });
});

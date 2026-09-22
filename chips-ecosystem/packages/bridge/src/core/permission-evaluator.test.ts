import { describe, expect, it } from 'vitest';
import type { IPermissionTargetRule } from '../protocol/capability-contracts.js';
import type { ISessionSnapshot } from '../protocol/session.js';
import { createPermissionEnvironment } from './qualifiers.js';
import {
  evaluatePermissions,
  extractTargets,
  grantsFromSnapshot,
  toAuditRecord,
  type IPermissionEvaluationInput,
} from './permission-evaluator.js';

const ENV = createPermissionEnvironment({
  platform: 'linux',
  directories: { userDocuments: '/home/u/Documents' },
  pluginDataRoot: (pluginId) => `/data/plugins/${pluginId}`,
  isOwnResourceScope: (session, scope) => scope === `plugin-${session.pluginId}`,
});

function snapshot(overrides: Partial<ISessionSnapshot> = {}): ISessionSnapshot {
  return Object.freeze({
    sessionId: 's1',
    pluginId: 'editor',
    windowId: 7,
    frameId: 0,
    grantedPermissions: new Set<string>(),
    openedDocuments: new Set<string>(),
    state: 'active' as const,
    permissionVersion: 0,
    ...overrides,
  });
}

function request(overrides: Partial<IPermissionEvaluationInput> = {}): IPermissionEvaluationInput {
  const session = overrides.session ?? snapshot();
  return {
    capabilityId: 'file:read',
    requiredPermissions: ['filesystem:read'],
    targetRules: [],
    input: {},
    scope: {
      sessionId: session.sessionId,
      pluginId: session.pluginId,
      scopeVersion: session.permissionVersion,
      grants: grantsFromSnapshot(session),
    },
    session,
    ...overrides,
  };
}

describe('grantsFromSnapshot', () => {
  it('把权限快照转换为结构化授权记录并跳过非法项', () => {
    const grants = grantsFromSnapshot(
      snapshot({
        grantedPermissions: new Set([
          'filesystem:read',
          'filesystem:write:${userDocuments}/chips',
          'bad',
        ]),
      })
    );
    expect(grants).toEqual([
      { base: 'filesystem:read', state: 'granted', source: 'enable' },
      {
        base: 'filesystem:write',
        state: 'granted',
        source: 'enable',
        qualifier: '${userDocuments}/chips',
      },
    ]);
  });
});

describe('extractTargets', () => {
  it('无目标字段返回 undefined', () => {
    expect(extractTargets({ permission: 'menu:manage', targetFields: [] }, {})).toBeUndefined();
  });

  it('提取字符串与数值目标，支持嵌套路径', () => {
    expect(
      extractTargets({ permission: 'filesystem:read', targetFields: ['path'] }, { path: '/a' })
    ).toEqual(['/a']);
    expect(
      extractTargets({ permission: 'window:control', targetFields: ['windowId'] }, { windowId: 3 })
    ).toEqual(['3']);
    expect(
      extractTargets(
        { permission: 'resources:read', targetFields: ['resource.uri'] },
        {
          resource: { uri: 'chips-resource://card-1/a' },
        }
      )
    ).toEqual(['chips-resource://card-1/a']);
  });

  it('目标缺失或类型非法时 fail-closed', () => {
    const rule: IPermissionTargetRule = { permission: 'filesystem:read', targetFields: ['path'] };
    expect(extractTargets(rule, {})).toBeUndefined();
    expect(extractTargets(rule, { path: '' })).toBeUndefined();
    expect(extractTargets(rule, { path: 1.5 })).toEqual(['1.5']);
    expect(extractTargets(rule, { path: Number.NaN })).toBeUndefined();
    expect(extractTargets(rule, null)).toBeUndefined();
    expect(
      extractTargets(
        { permission: 'file:move', targetFields: ['source', 'target'] },
        { source: '/a' }
      )
    ).toBeUndefined();
  });
});

describe('evaluatePermissions 判定', () => {
  it('无所需权限直接放行', () => {
    const result = evaluatePermissions(request({ requiredPermissions: [] }), ENV);
    expect(result.allowed).toBe(true);
    expect(result.decision).toEqual({ allowed: true, permission: '' });
  });

  it('基础权限精确命中放行（无目标权限）', () => {
    const result = evaluatePermissions(
      request({
        capabilityId: 'clipboard:read',
        requiredPermissions: ['clipboard:access'],
        session: snapshot({ grantedPermissions: new Set(['clipboard:access']) }),
      }),
      ENV
    );
    expect(result.allowed).toBe(true);
  });

  it('限定值覆盖调用目标才放行，超出作用域拒绝并给出 out_of_scope', () => {
    const withGrant = (target: string): IPermissionEvaluationInput =>
      request({
        targetRules: [{ permission: 'filesystem:read', targetFields: ['path'] }],
        input: { path: target },
        session: snapshot({
          grantedPermissions: new Set(['filesystem:read:${userDocuments}/chips']),
        }),
      });
    expect(evaluatePermissions(withGrant('${userDocuments}/chips/a.card'), ENV).allowed).toBe(true);
    const denied = evaluatePermissions(withGrant('${userDocuments}/other/a.card'), ENV);
    expect(denied.allowed).toBe(false);
    expect(denied.error).toMatchObject({ code: 'BRIDGE_PERMISSION_DENIED' });
    expect(denied.error?.details).toMatchObject({
      capabilityId: 'file:read',
      permission: 'filesystem:read',
      required: ['filesystem:read'],
      missing: ['filesystem:read'],
      reason: 'out_of_scope',
      target: '${userDocuments}/other/a.card',
    });
  });

  it('无授权为 not_granted，存在 denied 记录为 revoked', () => {
    const notGranted = evaluatePermissions(request(), ENV);
    expect(notGranted.decision.reason).toBe('not_granted');
    const revoked = evaluatePermissions(
      request({
        session: snapshot({ grantedPermissions: new Set() }),
        scope: {
          sessionId: 's1',
          pluginId: 'editor',
          scopeVersion: 0,
          grants: [{ base: 'filesystem:read', state: 'denied', source: 'settings' }],
        },
      }),
      ENV
    );
    expect(revoked.decision.reason).toBe('revoked');
    expect(revoked.error?.details).toMatchObject({ granted: [], missing: ['filesystem:read'] });
  });

  it('按能力声明顺序短路，缺失列表包含全部未满足权限', () => {
    const result = evaluatePermissions(
      request({
        capabilityId: 'file:copy',
        requiredPermissions: ['filesystem:read', 'filesystem:write'],
        session: snapshot({ grantedPermissions: new Set(['filesystem:read']) }),
      }),
      ENV
    );
    expect(result.allowed).toBe(false);
    expect(result.decision.permission).toBe('filesystem:write');
    expect(result.error?.details).toMatchObject({
      missing: ['filesystem:write'],
      granted: ['filesystem:read'],
    });
  });

  it('`domain:*` 通配授权覆盖基础权限', () => {
    const result = evaluatePermissions(
      request({ session: snapshot({ grantedPermissions: new Set(['filesystem:*']) }) }),
      ENV
    );
    expect(result.allowed).toBe(true);
  });
});

describe('evaluatePermissions 免权限范围', () => {
  it('插件私有数据目录：读写删除均免权限', () => {
    for (const [capabilityId, permission] of [
      ['file:read', 'filesystem:read'],
      ['file:write', 'filesystem:write'],
      ['file:delete', 'filesystem:delete'],
    ] as const) {
      const result = evaluatePermissions(
        request({
          capabilityId,
          requiredPermissions: [permission],
          targetRules: [{ permission, targetFields: ['path'] }],
          input: { path: '/data/plugins/editor/notes/a.md' },
        }),
        ENV
      );
      expect(result.allowed).toBe(true);
    }
  });

  it('自身配置命名空间读写免权限，其他命名空间不放行', () => {
    const own = evaluatePermissions(
      request({
        capabilityId: 'config:set',
        requiredPermissions: ['config:write'],
        targetRules: [{ permission: 'config:write', targetFields: ['namespace'] }],
        input: { namespace: 'plugins.editor' },
      }),
      ENV
    );
    expect(own.allowed).toBe(true);
    const other = evaluatePermissions(
      request({
        capabilityId: 'config:set',
        requiredPermissions: ['config:write'],
        targetRules: [{ permission: 'config:write', targetFields: ['namespace'] }],
        input: { namespace: 'plugins.other' },
      }),
      ENV
    );
    expect(other.allowed).toBe(false);
  });

  it('自身与平台资源作用域只读免权限，写入不免', () => {
    const ownRead = evaluatePermissions(
      request({
        capabilityId: 'resource:read',
        requiredPermissions: ['resources:read'],
        targetRules: [{ permission: 'resources:read', targetFields: ['uri'] }],
        input: { uri: 'chips-resource://plugin-editor/icon.png' },
      }),
      ENV
    );
    expect(ownRead.allowed).toBe(true);
    const platformRead = evaluatePermissions(
      request({
        capabilityId: 'resource:read',
        requiredPermissions: ['resources:read'],
        targetRules: [{ permission: 'resources:read', targetFields: ['uri'] }],
        input: { uri: 'chips-resource://platform/frame.html' },
      }),
      ENV
    );
    expect(platformRead.allowed).toBe(true);
    const ownWrite = evaluatePermissions(
      request({
        capabilityId: 'resource:write',
        requiredPermissions: ['resources:write'],
        targetRules: [{ permission: 'resources:write', targetFields: ['uri'] }],
        input: { uri: 'chips-resource://plugin-editor/icon.png' },
      }),
      ENV
    );
    expect(ownWrite.allowed).toBe(false);
  });

  it('自身窗口免 window:control 判定', () => {
    const result = evaluatePermissions(
      request({
        capabilityId: 'window:focus',
        requiredPermissions: ['window:control'],
        targetRules: [{ permission: 'window:control', targetFields: ['windowId'] }],
        input: { windowId: 7 },
      }),
      ENV
    );
    expect(result.allowed).toBe(true);
    const other = evaluatePermissions(
      request({
        capabilityId: 'window:focus',
        requiredPermissions: ['window:control'],
        targetRules: [{ permission: 'window:control', targetFields: ['windowId'] }],
        input: { windowId: 8 },
        session: snapshot({ grantedPermissions: new Set(['window:control']) }),
      }),
      ENV
    );
    expect(other.allowed).toBe(true);
  });

  it('会话内已打开文档读取免重复校验', () => {
    const allowed = evaluatePermissions(
      request({
        capabilityId: 'document:read',
        requiredPermissions: ['resources:read'],
        input: { documentId: 'card-1' },
        session: snapshot({ openedDocuments: new Set(['card-1']) }),
      }),
      ENV
    );
    expect(allowed.allowed).toBe(true);
    const denied = evaluatePermissions(
      request({
        capabilityId: 'document:read',
        requiredPermissions: ['resources:read'],
        input: { documentId: 'card-2' },
        session: snapshot({ openedDocuments: new Set(['card-1']) }),
      }),
      ENV
    );
    expect(denied.allowed).toBe(false);
  });
});

describe('toAuditRecord', () => {
  const CONTEXT = {
    id: '01J8Z0M4N6Q7R8S9T0V1W2X3Y4',
    timestamp: '2026-09-19T10:20:31.482Z',
    traceId: 't-3b91',
    requestId: 'r-5c02',
    pluginVersion: '1.2.3',
  } as const;

  it('放行条目：action=allow、actor=system、permission=required 声明序首项（§8.2 补注）', () => {
    const allowedInput = request({
      session: snapshot({ grantedPermissions: new Set(['filesystem:read']) }),
    });
    expect(toAuditRecord(allowedInput, evaluatePermissions(allowedInput, ENV), CONTEXT)).toEqual({
      id: CONTEXT.id,
      timestamp: CONTEXT.timestamp,
      action: 'allow',
      actor: 'system',
      pluginId: 'editor',
      pluginVersion: '1.2.3',
      sessionId: 's1',
      permission: 'filesystem:read',
      capabilityId: 'file:read',
      traceId: 't-3b91',
      requestId: 'r-5c02',
    });
  });

  it('拒绝条目：action=deny、permission=首个缺失项、携 reason/target 与横切键', () => {
    const deniedInput = request({
      targetRules: [{ permission: 'filesystem:read', targetFields: ['path'] }],
      input: { path: '/secret/a' },
    });
    const entry = toAuditRecord(deniedInput, evaluatePermissions(deniedInput, ENV), CONTEXT);
    expect(entry).toEqual({
      id: CONTEXT.id,
      timestamp: CONTEXT.timestamp,
      action: 'deny',
      actor: 'system',
      pluginId: 'editor',
      pluginVersion: '1.2.3',
      sessionId: 's1',
      permission: 'filesystem:read',
      capabilityId: 'file:read',
      target: '/secret/a',
      reason: 'not_granted',
      traceId: 't-3b91',
      requestId: 'r-5c02',
    });
    expect(entry.source).toBeUndefined();
    expect(entry.qualifier).toBeUndefined();
    expect(entry.resourceUri).toBeUndefined();
  });
});

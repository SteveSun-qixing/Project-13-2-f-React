import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

/**
 * E2E 文档接线模块交付形状随动锁（工单070 收口批）。
 *
 * 宿主 E2E 入口（`packages/host/src/main/e2e-app.ts` `resolveE2EDocumentWiring()`，构建
 * 产物 `dist/main/e2e-app.js`）对 `tests/e2e/host-wiring/e2e-document-wiring.cjs` 的
 * 交付成员闸是 fail-closed 面：`guardSessionSource`、`resourcePorts.scope` 的
 * `normalizeSource` / `unregisterScope` / `localPathOf` / `scopeRootOf`（工单036 波 B2
 * #241 点位三消费臂扩员）与 `resourcePorts.storage.readFileBytes` 任一缺位，宿主进程
 * 启动即失败（工单070 缺陷形态：闸面扩员而本替身未随动，金链路 E2E 与性能真测宿主
 * 三臂整批被阻，且只能在真进程启动时才暴露）。
 *
 * 本锁在纯 Node 侧镜像宿主闸的期望全集（成员存在性逐项对齐 + 交付键集恰等），并锁
 * 两枚点位三消费臂的登记码语义——宿主波端口扩员而 tests/ 面未随动的漂移，从此在
 * `pnpm --filter @chips/e2e test` 即红，不必等真进程启动失败。
 */

/** 接线模块装载（CJS；经 `createRequire` 走真实文件，不经打包转换）。 */
const wiringModulePath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'host-wiring',
  'e2e-document-wiring.cjs'
);

/** 归一产物（替身交付 `IResolvedDocumentSource` 的 W2 归档面投影）。 */
interface ResolvedSourceSurface {
  readonly managedUri: string;
  readonly localPath: string;
  readonly form: string;
}

/** 作用域登记回执（`IDocumentScopeRegistration` 投影）。 */
interface ScopeRegistrationSurface {
  readonly nativeSession: number;
}

/** 作用域端口替身的测试面（五成员；工单036 波 A2b + 波 B2 全集）。 */
interface ScopePortSurface {
  normalizeSource(source: string): Promise<ResolvedSourceSurface>;
  registerScope(input: {
    readonly documentId: string;
    readonly managedUri: string;
    readonly kind: 'card' | 'box';
  }): Promise<ScopeRegistrationSurface>;
  unregisterScope(input: {
    readonly documentId: string;
    readonly managedUri: string;
  }): Promise<void>;
  localPathOf(managedUri: string, nativeSession: number): Promise<string>;
  scopeRootOf(managedUri: string): string | null;
}

/** 受控写端口替身的测试面（三成员；`commit` / `listMembers` 为 W3 前的诚实拒绝臂）。 */
interface StoragePortSurface {
  commit(): Promise<never>;
  listMembers(): Promise<never>;
  readFileBytes(localPath: string): Promise<Uint8Array>;
}

/** 接线模块工厂交付形状。 */
interface WiringShape {
  readonly guardSessionSource: () => unknown;
  readonly resourcePorts: {
    readonly scope: ScopePortSurface;
    readonly storage: StoragePortSurface;
  };
}

/** 接线模块导出面。 */
interface WiringModule {
  readonly createE2EDocumentWiring: () => WiringShape;
  readonly DOCUMENT_ROOT_ENV: string;
  readonly MANAGED_SCOPE: string;
}

const wiringModule = createRequire(import.meta.url)(wiringModulePath) as WiringModule;

/** 归一/取回语义锁用的受管引用样例（与替身登记形 `chips-resource://<scope>/<名>` 同构）。 */
const MANAGED_URI_PATTERN = /^chips-resource:\/\/e2e-workspace\/[A-Za-z0-9%._~-]+\.card$/;

let workspaceRoot: string | null = null;
let previousRootEnv: string | undefined;

afterEach(async () => {
  if (workspaceRoot !== null) {
    await rm(workspaceRoot, { recursive: true, force: true });
    workspaceRoot = null;
  }
  if (previousRootEnv === undefined) {
    delete process.env[wiringModule.DOCUMENT_ROOT_ENV];
  } else {
    process.env[wiringModule.DOCUMENT_ROOT_ENV] = previousRootEnv;
  }
});

/** 装配一次性受控工作区根并置环境变量（含一枚归档态卡片文件）。 */
async function useWorkspaceRoot(): Promise<{ root: string; cardPath: string }> {
  previousRootEnv = process.env[wiringModule.DOCUMENT_ROOT_ENV];
  const root = await mkdtemp(path.join(tmpdir(), 'chips-e2e-wiring-'));
  workspaceRoot = root;
  const cardPath = path.join(root, 'fixture.card');
  await writeFile(cardPath, 'e2e wiring shape lock fixture\n');
  process.env[wiringModule.DOCUMENT_ROOT_ENV] = root;
  return { root, cardPath };
}

describe('E2E 文档接线模块交付形状（工单070 随动锁）', () => {
  it('交付键集恰等于宿主 E2E 入口成员闸的期望全集（波 B2 #241 面）', () => {
    expect(Object.keys(wiringModule).sort(), '模块导出面').toEqual([
      'DOCUMENT_ROOT_ENV',
      'MANAGED_SCOPE',
      'createE2EDocumentWiring',
    ]);

    const wiring = wiringModule.createE2EDocumentWiring();
    expect(Object.keys(wiring).sort(), '注入项顶层键集').toEqual([
      'guardSessionSource',
      'resourcePorts',
    ]);
    expect(Object.keys(wiring.resourcePorts).sort(), '资源侧端口两位（scope / storage）').toEqual([
      'scope',
      'storage',
    ]);
    expect(
      Object.keys(wiring.resourcePorts.scope).sort(),
      'scope 五成员恰等（normalizeSource / registerScope / unregisterScope / localPathOf / scopeRootOf）'
    ).toEqual([
      'localPathOf',
      'normalizeSource',
      'registerScope',
      'scopeRootOf',
      'unregisterScope',
    ]);
    expect(
      Object.keys(wiring.resourcePorts.storage).sort(),
      'storage 三成员恰等（commit / listMembers / readFileBytes）'
    ).toEqual(['commit', 'listMembers', 'readFileBytes']);

    // 宿主 `resolveE2EDocumentWiring()` 闸判据的逐项镜像（7 成员存在性，fail-closed 面）。
    expect(typeof wiring.guardSessionSource).toBe('function');
    expect(typeof wiring.resourcePorts.scope.normalizeSource).toBe('function');
    expect(typeof wiring.resourcePorts.scope.unregisterScope).toBe('function');
    expect(typeof wiring.resourcePorts.scope.localPathOf).toBe('function');
    expect(typeof wiring.resourcePorts.scope.scopeRootOf).toBe('function');
    expect(typeof wiring.resourcePorts.storage.readFileBytes).toBe('function');
  });

  it('点位三消费臂：归一入账 → 挂载 → localPathOf 会话绑定闸取回 → scopeRootOf 基址合形', async () => {
    const { cardPath } = await useWorkspaceRoot();
    const scope = wiringModule.createE2EDocumentWiring().resourcePorts.scope;

    const resolved = await scope.normalizeSource(`file://${cardPath}`);
    expect(resolved.managedUri).toMatch(MANAGED_URI_PATTERN);
    expect(resolved.localPath).toBe(cardPath);
    expect(resolved.form).toBe('archive');

    // 挂载前：作用域已在册（归一入账）但无会话绑定 → 路径不交付（归属闸口径）。
    await expect(scope.localPathOf(resolved.managedUri, 1)).rejects.toMatchObject({
      code: 'RESOURCE_PERMISSION_DENIED',
    });
    // 作用域根查询在挂载前即按在册事实合形（生产 ledger 同口径）。
    expect(scope.scopeRootOf(resolved.managedUri)).toBe('chips-resource://e2e-workspace/');

    const registration = await scope.registerScope({
      documentId: 'E2eWiringLk',
      managedUri: resolved.managedUri,
      kind: 'card',
    });
    await expect(scope.localPathOf(resolved.managedUri, registration.nativeSession)).resolves.toBe(
      cardPath
    );

    // 会话绑定闸：未绑定的会话号取回拒绝（登记码在册，不泄露路径）。
    await expect(
      scope.localPathOf(resolved.managedUri, registration.nativeSession + 1)
    ).rejects.toMatchObject({ code: 'RESOURCE_PERMISSION_DENIED' });
    // 未在册的受管引用：同生产适配器 `RESOURCE_NOT_FOUND`（陈旧绑定形）。
    await expect(
      scope.localPathOf('chips-resource://e2e-workspace/unopened-e2e-ghost.card', 1)
    ).rejects.toMatchObject({ code: 'RESOURCE_NOT_FOUND' });
    expect(scope.scopeRootOf('chips-resource://e2e-workspace/unopened-e2e-ghost.card')).toBeNull();
  });

  it('作用域登记：归一前置闸、幂等复用臂与真冲突拒绝、注销销账收口', async () => {
    const { cardPath } = await useWorkspaceRoot();
    const scope = wiringModule.createE2EDocumentWiring().resourcePorts.scope;

    // 未经 normalizeSource 归一的受管引用不挂载（生产适配器同码同形）。
    await expect(
      scope.registerScope({
        documentId: 'E2eWiringLk',
        managedUri: 'chips-resource://e2e-workspace/ghost.card',
        kind: 'card',
      })
    ).rejects.toMatchObject({ code: 'RESOURCE_INVALID_URI' });

    const resolved = await scope.normalizeSource(`file://${cardPath}`);
    const first = await scope.registerScope({
      documentId: 'E2eWiringLk',
      managedUri: resolved.managedUri,
      kind: 'card',
    });
    const second = await scope.registerScope({
      documentId: 'E2eWiringLk',
      managedUri: resolved.managedUri,
      kind: 'card',
    });
    expect(second.nativeSession, '幂等复用臂回执同一登记序号').toBe(first.nativeSession);
    await expect(
      scope.registerScope({
        documentId: 'E2eOtherDoc',
        managedUri: resolved.managedUri,
        kind: 'card',
      })
    ).rejects.toMatchObject({ code: 'RESOURCE_ALREADY_EXISTS' });

    await scope.unregisterScope({ documentId: 'E2eWiringLk', managedUri: resolved.managedUri });
    // 销账收口：作用域根查询回落 `null`、路径取回按 `RESOURCE_NOT_FOUND` 拒绝
    // （生产「已随注销销账的引用」口径）；重复注销已达、不另造通道。
    expect(scope.scopeRootOf(resolved.managedUri)).toBeNull();
    await expect(scope.localPathOf(resolved.managedUri, first.nativeSession)).rejects.toMatchObject(
      {
        code: 'RESOURCE_NOT_FOUND',
      }
    );
    await expect(
      scope.unregisterScope({ documentId: 'E2eWiringLk', managedUri: resolved.managedUri })
    ).resolves.toBeUndefined();
  });
});

/**
 * 真 `chips-native.node` 产物装载闸（金链路刀7 段A / 任务 #114）。
 *
 * 权威：《03-核心接口规范》§6.4/§8.6（文档解析域与元信息导出名、ABI 递增规则）、
 * 《06-文档解析器设计》§12.1/§12.2、`packages/native/abi/export-surface.json`
 * （56 项在册导出面，波 A1 任务 #209 三资源名补登 50→53、波 B 任务 #231
 * 两换算名补登 53→55、点位五 D1 任务 #244 `resourceGrantSession` 补登 55→56，与 `abi.rs` /
 * `types/chips-native.d.ts` 三方锁由
 * `packages/native/scripts/check-abi.mjs` 单点锁定）。
 *
 * @remarks
 * - 与既有各闸的分工：三方锁（source 面）与 `document-native-parser-adapter.test.ts`
 *   A/B 组（常量与替身装载闸）不构成对**已构建产物**的断言；本套件消费真实
 *   `packages/host/native/chips-native.node`（`*.node` 不入库，构建脚本
 *   `packages/native/scripts/build-native.mjs` 落位），锁定
 *   「产物导出面 = 契约面 = 宿主装载闸」三者对齐——刀4/工单036 在册的
 *   「当前部署产物缺解析域名 ⇒ `surface-mismatch` 诚实回退」即由本闸终结；
 *   工单036 波 C3 起产物闸判据随扩表面翻 59（解析域 18 + 资源域 25 含提交链两名），
 *   并增真机探针⑥（changeset 提交链：真会话授权 + 真目录挂载 + 包级两相提交落盘）。
 * - 生产解析路径复算：断言装载闸消费的正是宿主运行时经
 *   {@link defaultNativeDocumentParserModulePath}（`platformRoot = dist/renderer`）
 *   推导出的同一文件，杜绝「闸测一份、运行时装另一份」的落位漂移。
 * - 判据与 `app-smoke.test.ts` 同族旗标：默认跳过（`npx vitest run` 不要求构建产物）；
 *   `CHIPS_HOST_SMOKE=1`（承载闸）或 `CHIPS_E2E_REQUIRE_APP=1`（金链路 E2E 转正闸）
 *   任一在位即必跑，fail-closed——产物缺失/面缺位一律红，不降级为告警。
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { loadNativeBridgeBinding, NATIVE_BRIDGE_ABI_VERSION } from '../../src/main/native-bridge.js';
import {
  NATIVE_DOCUMENT_PARSER_ABI_VERSION,
  NATIVE_DOCUMENT_PARSER_REQUIRED_EXPORTS,
  defaultNativeDocumentParserModulePath,
  loadNativeDocumentParserBinding,
} from '../../src/capabilities/document/adapters/native-parser-module.js';

const GATE_ENABLED = process.env.CHIPS_HOST_SMOKE === '1' || process.env.CHIPS_E2E_REQUIRE_APP === '1';
const describeGate = GATE_ENABLED ? describe : describe.skip;

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const ecosystemRoot = resolve(packageRoot, '..', '..');

/** 生产 platformRoot（与 `src/main/app.ts` 的 `dist/renderer` 落位同形）。 */
const productionPlatformRoot = join(packageRoot, 'dist', 'renderer');

/** 宿主运行时实际解析的产物路径（装载闸推导值，非硬编码）。 */
const derivedArtifactPath = defaultNativeDocumentParserModulePath(productionPlatformRoot);

/** 产物物理落位（构建脚本 `copy-native.mjs` 的落点）。 */
const artifactPath = join(packageRoot, 'native', 'chips-native.node');

/** `packages/native/abi/export-surface.json` 原文（56 项在册导出面权威镜像）。 */
function readExportSurface(): { abiVersion: number; exports: { name: string }[] } {
  const surfacePath = join(ecosystemRoot, 'packages', 'native', 'abi', 'export-surface.json');
  return JSON.parse(readFileSync(surfacePath, 'utf8')) as {
    abiVersion: number;
    exports: { name: string }[];
  };
}

function requireArtifact(modulePath: string): Record<string, unknown> {
  const requireCjs = createRequire(import.meta.url);
  return requireCjs(modulePath) as Record<string, unknown>;
}

describeGate('真 chips-native.node 产物装载闸（CHIPS_HOST_SMOKE / CHIPS_E2E_REQUIRE_APP）', () => {
  it('判据①：产物存在且即宿主运行时生产解析路径所指（落位零漂移）', () => {
    expect(derivedArtifactPath).toBe(artifactPath);
    expect(existsSync(artifactPath), `原生产物缺失：${artifactPath}（先执行 pnpm --filter @chips/native build）`).toBe(
      true,
    );
  });

  it('判据②：解析域装载闸 available，18 必备名逐项在位且为函数（含 C3 存储序列化名）', () => {
    const binding = loadNativeDocumentParserBinding(artifactPath);
    expect(binding.status, `解析域装载失败：${binding.status === 'unavailable' ? binding.detail : ''}`).toBe(
      'available',
    );
    if (binding.status !== 'available') {
      return;
    }
    expect(binding.abiVersion).toBe(NATIVE_DOCUMENT_PARSER_ABI_VERSION);
    expect(binding.coreVersion.length).toBeGreaterThan(0);
    const moduleValue = requireArtifact(artifactPath);
    for (const name of NATIVE_DOCUMENT_PARSER_REQUIRED_EXPORTS) {
      expect(typeof moduleValue[name], `必备导出缺位或非函数：${name}`).toBe('function');
    }
    expect(NATIVE_DOCUMENT_PARSER_REQUIRED_EXPORTS.length).toBe(18);
  });

  it('判据③：Bridge 域装载闸同产物 available（同一 .node 内核单例）', () => {
    const bridge = loadNativeBridgeBinding(artifactPath);
    expect(bridge.status, `Bridge 域装载失败：${bridge.status === 'unavailable' ? bridge.detail : ''}`).toBe(
      'available',
    );
    if (bridge.status === 'available') {
      expect(bridge.abiVersion).toBe(NATIVE_BRIDGE_ABI_VERSION);
    }
  });

  it('判据④：产物导出面与 export-surface.json 逐项一致（59 项全等，零多余零缺位）', () => {
    const surface = readExportSurface();
    expect(surface.abiVersion).toBe(NATIVE_DOCUMENT_PARSER_ABI_VERSION);
    expect(surface.abiVersion).toBe(NATIVE_BRIDGE_ABI_VERSION);
    const surfaceNames = surface.exports.map((entry) => entry.name).sort();
    expect(surfaceNames.length).toBe(59);
    const moduleValue = requireArtifact(artifactPath);
    const artifactNames = Object.keys(moduleValue).sort();
    expect(artifactNames).toEqual(surfaceNames);
    for (const name of surfaceNames) {
      expect(typeof moduleValue[name], `导出非函数：${name}`).toBe('function');
    }
  });

  it('判据⑤：真解析功能探针——openCard 真实夹具 → metadata/revision → close', async () => {
    const cardFixture = join(ecosystemRoot, 'tests', 'e2e', 'fixtures', 'cards', 'e2e-minimal.card');
    expect(existsSync(cardFixture), `夹具缺失：${cardFixture}`).toBe(true);
    const native = requireArtifact(artifactPath);
    const openCard = native.openCard as (path: string) => Promise<unknown>;
    const documentMetadata = native.documentMetadata as (
      handle: unknown,
    ) => Promise<{ kind: string; value: Record<string, unknown> }>;
    const documentRevision = native.documentRevision as (
      handle: unknown,
    ) => Promise<{ indexDigest: string; source: { members: unknown[] } }>;
    const documentClose = native.documentClose as (handle: unknown) => Promise<void>;
    const handle = await openCard(cardFixture);
    expect(handle).toBeTruthy();
    const metadata = await documentMetadata(handle);
    expect(metadata.kind).toBe('card');
    expect(String(metadata.value.card_id)).toBe('E2eCardRt1');
    const revision = await documentRevision(handle);
    expect(revision.indexDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(revision.source.members.length).toBeGreaterThan(0);
    await documentClose(handle);
    // 幂等关闭（§12.2 GC 终结器兜底同语义）。
    await documentClose(handle);
  });

  it('判据⑥（工单036 波 C3）：真机 changeset 提交链——授权会话 + 目录挂载 + 包级两相提交真落盘', async () => {
    const native = requireArtifact(artifactPath);
    const openSession = native.resourceOpenSession as (kind: string, owner: string) => number;
    const grantSession = native.resourceGrantSession as (sessionId: number, permissions: string[]) => void;
    const mountDirectory = native.resourceMountDirectory as (
      sessionId: number,
      scope: string,
      path: string,
      owner: string,
      writable: boolean,
    ) => Promise<string>;
    const commitChangeset = native.resourceCommitChangeset as (
      sessionId: number,
      scope: string,
      members: { path: string; bytes: Uint8Array }[],
      removals: string[],
    ) => Promise<{ uri: string; size: number }[]>;
    const closeSession = native.resourceCloseSession as (sessionId: number) => void;

    const scratchRoot = mkdtempSync(join(tmpdir(), 'chips-native-changeset-'));
    try {
      // 受控提交链落点闸：缺父目录以 RESOURCE_NOT_FOUND 拒绝（《04.04》§4.8 在册口径），
      // 探针预建 content/ 父目录（真实链路由 document:create 受控写口建树）。
      mkdirSync(join(scratchRoot, 'content'), { recursive: true });
      writeFileSync(join(scratchRoot, 'meta.yaml'), 'name: 真机闸\n', 'utf8');
      const sessionId = openSession('document', 'chips.official.document-service');
      grantSession(sessionId, ['resources:write']);
      const scope = await mountDirectory(
        sessionId,
        'card-smoke-probe-scope',
        scratchRoot,
        'chips.official.document-service',
        true,
      );
      expect(scope).toBe('card-smoke-probe-scope');
      // 两成员 + 一删除一包事务（C2a-2 两相语义的真机探针）。
      const views = await commitChangeset(
        sessionId,
        scope,
        [
          { path: 'meta.yaml', bytes: new TextEncoder().encode('name: 真机闸换代\n') },
          { path: 'content/Cd1eFg2Hi3.yaml', bytes: new TextEncoder().encode('card_type: base.text\n') },
        ],
        [],
      );
      expect(views).toHaveLength(2);
      expect(readFileSync(join(scratchRoot, 'meta.yaml'), 'utf8')).toBe('name: 真机闸换代\n');
      expect(readFileSync(join(scratchRoot, 'content/Cd1eFg2Hi3.yaml'), 'utf8')).toBe('card_type: base.text\n');
      // 意图账终结：事务收口后零 `.chips-tmp-`/`.j` 残留（C2a-1 单通道收口）。
      const leftovers = readdirSync(scratchRoot).filter((name) => name.startsWith('.chips-tmp-'));
      expect(leftovers).toEqual([]);
      closeSession(sessionId);
    } finally {
      rmSync(scratchRoot, { recursive: true, force: true });
    }
  });
});

/**
 * §11.3 资源域导出镜像与装载闸契约锁（W3-P0-1 段三宿主接线波，任务 #194 交付③ / #196 收口）。
 *
 * 权威：《04-资源管理设计》§11.3「Neon 导出」表（15 行逐字，表行序即镜像序）；
 * 三方表文本锁 = §11.3 文档表原文 ↔ `native-resource-module.ts` 镜像常量与类型化注入面
 * ↔ `packages/native` 在册导出表（`abi/export-surface.json` 与 `types/chips-native.d.ts`）
 * （刀2 A 组母型：源码/文档纯文本比对，零 import 编译依赖、零 fabricate）。
 *
 * @remarks
 * - 资源域导出面（34→49）由 Rust 侧波次交付（#195 触顶链 → #199 段三主体收口批
 *   a82bbbd6b 落位）；**本波禁改 `packages/native` 面**，对在册导出表的互锁采「空集
 *   （未落位）或恰等 15 名镜像」两态判据——落位即自动收紧为逐字互锁，漂移（部分落位 /
 *   自造名）即红；
 * - 装载闸对「产物在位」的现态（49 导出、资源域 15 名在册）实测闸判判 available 并
 *   交付 15 函数消费面（落位即收紧，主翻正批随 #199 交回承接执行，生产判定逻辑零改动，
 *   见该臂注记）；产物缺位形态判 `module-missing`，任一形态绝不交付半截消费面；
 * - 装载闸 fail-closed 四分面（`module-missing` / `load-failed` / `surface-mismatch` /
 *   `abi-mismatch`）经 CJS 替身夹具全臂锁定（`broken.js` / `not-object.js` 为域无关
 *   共用夹具，其余为资源域替身夹具，测试注入替身仅限 `tests/` 面——工单036 §六）。
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  NATIVE_RESOURCE_ABI_VERSION,
  NATIVE_RESOURCE_REQUIRED_EXPORTS,
  NATIVE_RESOURCE_REQUIRED_META_EXPORTS,
  NATIVE_RESOURCE_SURFACE_EXPORTS,
  defaultNativeResourceModulePath,
  loadNativeResourceBinding,
} from '../src/capabilities/document/adapters/native-resource-module.js';
import { defaultNativeDocumentParserModulePath } from '../src/capabilities/document/adapters/native-parser-module.js';

/** 测试夹具目录（装载闸经 `createRequire` 加载 CJS 替身，模拟 `.node` 边界）。 */
const fixturePath = (name: string): string =>
  fileURLToPath(new URL(`./fixtures/native-binding/${name}`, import.meta.url));

/** 读取工作区文档库/邻包源文件原文（不建立依赖边）。 */
function readWorkspaceSource(relativeFromTests: string): string {
  return readFileSync(fileURLToPath(new URL(relativeFromTests, import.meta.url)), 'utf8');
}

/** 从契约文档原文提取「Neon 导出」表首列反引号函数名（表行均以 `` | `name` | `` 起头）。 */
function parseExportTableNames(markdown: string): string[] {
  const names: string[] = [];
  for (const line of markdown.split('\n')) {
    const matched = /^\|\s*`([A-Za-z][A-Za-z0-9]*)`\s*\|/.exec(line);
    if (matched?.[1] !== undefined) {
      names.push(matched[1]);
    }
  }
  return names;
}

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** 现态旧构建产物替身夹具的点名全序（`resource-stale-no-surface.js` 缺位集）。 */
const ALL_FIFTEEN = [...NATIVE_RESOURCE_SURFACE_EXPORTS];

/* ------------------------------------------------------------------ *
 * A 组：§11.3 三方表文本锁（文档 ↔ 宿主镜像 ↔ native 在册导出表）
 * ------------------------------------------------------------------ */

describe('§11.3 三方表文本锁：文档表原文 ↔ 镜像常量 ↔ native 导出表', () => {
  const resourceDoc = readWorkspaceSource(
    '../../../../薯片生态文档库/01-架构设计/01-子系统设计/04.11-04-资源管理设计-十一、Rust ResourceManager 与 Neon 暴露.md',
  );
  const moduleSource = readWorkspaceSource('../src/capabilities/document/adapters/native-resource-module.ts');
  const manifest = JSON.parse(readWorkspaceSource('../../native/abi/export-surface.json')) as {
    abiVersion: number;
    exports: { name: string }[];
  };
  const declaration = readWorkspaceSource('../../native/types/chips-native.d.ts');

  it('§11.3 表原文 15 行导出名与镜像常量逐项逐序一致（表行序即数组序，面漂移即翻红）', () => {
    const section = resourceDoc.slice(resourceDoc.indexOf('### 11.3'), resourceDoc.indexOf('### 11.4'));
    expect(section.length).toBeGreaterThan(0);
    expect(parseExportTableNames(section)).toEqual(ALL_FIFTEEN);
    expect(ALL_FIFTEEN.length).toBe(15);
  });

  it('装载闸必备全集 = 元信息两项 + 资源域 15 名，共 17 项且序一致', () => {
    expect(NATIVE_RESOURCE_REQUIRED_META_EXPORTS).toEqual(['coreVersion', 'coreAbiVersion']);
    expect(NATIVE_RESOURCE_REQUIRED_EXPORTS).toEqual([...NATIVE_RESOURCE_REQUIRED_META_EXPORTS, ...ALL_FIFTEEN]);
    expect(NATIVE_RESOURCE_REQUIRED_EXPORTS.length).toBe(17);
  });

  it('类型化注入面 `INativeResourceModule` 的 15 个方法名与镜像常量逐项逐序一致（禁第二套名）', () => {
    const interfaceBlock = moduleSource.slice(
      moduleSource.indexOf('export interface INativeResourceModule'),
      moduleSource.indexOf('/** 装载失败原因'),
    );
    expect(interfaceBlock.length).toBeGreaterThan(0);
    const declared = [...interfaceBlock.matchAll(/^ {2}(resource[A-Za-z]+)\(/gm)].map((m) => m[1]);
    expect(declared).toEqual(ALL_FIFTEEN);
  });

  it('宿主期望资源域 ABI 与 export-surface.json 的 abiVersion 等值（单一内核一个 ABI 计数，§8.6）', () => {
    expect(manifest.abiVersion).toBe(NATIVE_RESOURCE_ABI_VERSION);
  });

  it('native 在册导出表互锁：resource* 名集现态为空（#195 未落位在册事实）或恰等 15 名镜像（落位即收紧，漂移即红）', () => {
    const names = manifest.exports.map((entry) => entry.name).filter((name) => /^resource[A-Z]/.test(name));
    if (names.length === 0) {
      // 现态留痕：部署导出表 34 项零资源名（任务 #194 M0 勘察结论①），闸锁按 §11.3 权威字面钉死。
      expect(manifest.exports.length).toBe(34);
    } else {
      expect(names).toEqual(ALL_FIFTEEN);
    }
    const declaredNames = [...declaration.matchAll(/^export function (resource[A-Za-z]+)\(/gm)].map((m) => m[1]);
    if (declaredNames.length === 0) {
      expect(declaredNames).toEqual([]);
    } else {
      expect(declaredNames).toEqual(ALL_FIFTEEN);
    }
  });
});

/* ------------------------------------------------------------------ *
 * B 组：装载闸 fail-closed 四分面（CJS 替身夹具）
 * ------------------------------------------------------------------ */

describe('§11.3 装载闸：loadNativeResourceBinding（fail-closed 四分面）', () => {
  it('可用面：17 项在位且 ABI 等值 → available，交付 15 函数类型化消费面', () => {
    const binding = loadNativeResourceBinding(fixturePath('resource-available.js'));
    expect(binding.status).toBe('available');
    if (binding.status === 'available') {
      expect(binding.coreVersion).toBe('0.1.0');
      expect(binding.abiVersion).toBe(NATIVE_RESOURCE_ABI_VERSION);
      expect(binding.modulePath).toBe(fixturePath('resource-available.js'));
      for (const name of ALL_FIFTEEN) {
        expect(typeof (binding.resource as unknown as Record<string, unknown>)[name]).toBe('function');
      }
    }
  });

  it('module-missing：产物文件不存在，不加载不猜测', () => {
    const missingPath = fixturePath('resource-does-not-exist.node');
    expect(existsSync(missingPath)).toBe(false);
    const binding = loadNativeResourceBinding(missingPath);
    expect(binding.status).toBe('unavailable');
    if (binding.status === 'unavailable') {
      expect(binding.reason).toBe('module-missing');
      expect(binding.modulePath).toBe(missingPath);
    }
  });

  it('load-failed：加载抛错 / 导出非对象两臂', () => {
    const broken = loadNativeResourceBinding(fixturePath('broken.js'));
    expect(broken.status).toBe('unavailable');
    if (broken.status === 'unavailable') {
      expect(broken.reason).toBe('load-failed');
      expect(broken.detail).toContain('模拟原生产物损坏');
    }
    const notObject = loadNativeResourceBinding(fixturePath('not-object.js'));
    expect(notObject.status).toBe('unavailable');
    if (notObject.status === 'unavailable') {
      expect(notObject.reason).toBe('load-failed');
      expect(notObject.detail).toBe('原生绑定模块导出的不是对象');
    }
  });

  it('surface-mismatch：十五名全缺位 → 逐项点名（表行序 join，防静默降级）', () => {
    const binding = loadNativeResourceBinding(fixturePath('resource-stale-no-surface.js'));
    expect(binding.status).toBe('unavailable');
    if (binding.status === 'unavailable') {
      expect(binding.reason).toBe('surface-mismatch');
      expect(binding.detail).toContain(`：${ALL_FIFTEEN.join('、')}（`);
      for (const name of ALL_FIFTEEN) {
        expect(binding.detail).toContain(name);
      }
    }
  });

  it('surface-mismatch：仅缺末位一名 → 点名恰只含该名（在位名不混入）', () => {
    const binding = loadNativeResourceBinding(fixturePath('resource-stale-14.js'));
    expect(binding.status).toBe('unavailable');
    if (binding.status === 'unavailable') {
      expect(binding.reason).toBe('surface-mismatch');
      expect(binding.detail).toContain('：resourceRegisterTempScope（');
      expect(binding.detail).not.toContain('resourceOpen');
    }
  });

  it('surface-mismatch：元信息调用抛错 / coreVersion 非空串校验两臂', () => {
    const throws = loadNativeResourceBinding(fixturePath('resource-meta-throws.js'));
    expect(throws.status).toBe('unavailable');
    if (throws.status === 'unavailable') {
      expect(throws.reason).toBe('surface-mismatch');
      expect(throws.detail).toContain('元信息导出调用失败');
    }
    const invalid = loadNativeResourceBinding(fixturePath('resource-version-invalid.js'));
    expect(invalid.status).toBe('unavailable');
    if (invalid.status === 'unavailable') {
      expect(invalid.reason).toBe('surface-mismatch');
      expect(invalid.detail).toBe('coreVersion() 未返回非空字符串');
    }
  });

  it('abi-mismatch：ABI 返回值不等 / 非整数两臂（签名变化递增口径，§8.6）', () => {
    const drift = loadNativeResourceBinding(fixturePath('resource-abi-drift.js'));
    expect(drift.status).toBe('unavailable');
    if (drift.status === 'unavailable') {
      expect(drift.reason).toBe('abi-mismatch');
      expect(drift.detail).toContain('coreAbiVersion()=2');
      expect(drift.detail).toContain(`宿主期望 ${String(NATIVE_RESOURCE_ABI_VERSION)}`);
    }
    const fraction = loadNativeResourceBinding(fixturePath('resource-abi-fraction.js'));
    expect(fraction.status).toBe('unavailable');
    if (fraction.status === 'unavailable') {
      expect(fraction.reason).toBe('abi-mismatch');
      expect(fraction.detail).toBe('coreAbiVersion() 未返回整数');
    }
  });
});

/* ------------------------------------------------------------------ *
 * C 组：真实部署产物现态 fail-closed 留痕（生产恒缺省臂在册形态）
 * ------------------------------------------------------------------ */

describe('§11.3 现态部署产物装载闸（生产恒缺省臂，任务 #194 M0 结论①实测锁）', () => {
  /** 产物物理落位（构建脚本 `copy-native.mjs` 落点，与解析域 / Bridge 域同一文件，§11.5）。 */
  const artifactPath = join(packageRoot, 'native', 'chips-native.node');

  it('生产路径推导互证：资源域默认路径 = 解析域默认路径 = 物理落位（单一内核，禁落位漂移）', () => {
    const productionPlatformRoot = join(packageRoot, 'dist', 'renderer');
    expect(defaultNativeResourceModulePath(productionPlatformRoot)).toBe(artifactPath);
    expect(defaultNativeResourceModulePath(productionPlatformRoot)).toBe(
      defaultNativeDocumentParserModulePath(productionPlatformRoot),
    );
  });

  it(
    '落位即收紧：产物在位（49 导出在册，含资源域 15 名）则必判 available 并交付 15 函数消费面；' +
      '缺位则判 module-missing——任一形态绝不交付半截消费面',
    () => {
      // 本臂原锁「resource* 导出未落位」现态事实（任务 #194 M0 结论①），部署产物翻正位
      // （34→49，#199 段三主体收口批 a82bbbd6b 交付、导出面重建）后按预登记口径改断
      // available 收紧形（候翻正注记在册）；生产判定逻辑零改动。
      const binding = loadNativeResourceBinding(artifactPath);
      if (existsSync(artifactPath)) {
        expect(binding.status).toBe('available');
        if (binding.status === 'available') {
          expect(binding.abiVersion).toBe(NATIVE_RESOURCE_ABI_VERSION);
          for (const name of ALL_FIFTEEN) {
            expect(typeof (binding.resource as unknown as Record<string, unknown>)[name]).toBe('function');
          }
        }
      } else {
        expect(binding.status).toBe('unavailable');
        if (binding.status === 'unavailable') {
          expect(binding.reason).toBe('module-missing');
        }
      }
    },
  );
});

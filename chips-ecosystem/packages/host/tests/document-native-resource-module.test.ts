/**
 * §11.3 资源域导出镜像与装载闸契约锁（W3-P0-1 段三宿主接线波，任务 #194 交付③ / #196 收口；
 * 波 A2a 任务 #212 三名补登落册翻正；波 B 任务 #231 两换算名补登 18→20 名随动；
 * 点位五 D1 任务 #244 补登 `resourceGrantSession` 至 21 名，宿主镜像随动经 #241/#245/#247
 * 三波未竟，由红案清零波任务 #248 落地；工单036 波 C3 补登
 * `resourceCommitChangeset` / `resourceRebuildArchive` 两名至 23 名（落文前两名以
 * 「镜像尾段」形态入闸，文档表原文对既有 21 名维持前缀锁）；文档库主批落文后
 * （§11.3 表扩至 23 行），W4-C3 宿主随动波把文档表原文锁机械复原为恰等锁
 * （表 23 行 ↔ 镜像全集 23 名逐项逐序恰等，前缀锁形态退役）。
 *
 * 权威：《04-资源管理设计》§11.3「Neon 导出」表（23 行逐字，表行序即镜像全集序；
 * 第 21 行文档面随动已由工单053 D1 文档波任务 #246 落位，C3 尾段两名文档面已随
 * 主批落文在册，本表文本锁以恰等形现行在册）；
 * 三方表文本锁 = §11.3 文档表原文 ↔ `native-resource-module.ts` 镜像常量与类型化注入面
 * ↔ `packages/native` 在册导出表（`abi/export-surface.json` 与 `types/chips-native.d.ts`）
 * （刀2 A 组母型：源码/文档纯文本比对，零 import 编译依赖、零 fabricate）。
 *
 * @remarks
 * - 资源域导出面（34→49→50→53→55→56）由 Rust 侧波次交付（#195 触顶链 → #199 段三主体收口批
 *   a82bbbd6b 落位 15 名、波 A1 任务 #209 提交 554f761ff 补登挂载 / 注销三名至 18 名、波 B
 *   任务 #231 补登 `managedUri ↔ localPath` 双向换算两名至 20 名、点位五 D1 任务 #244
 *   提交 9fa04e900 补登 `resourceGrantSession` 至 21 名）；
 *   **宿主镜像禁改 `packages/native` 面**，对在册导出表的互锁按预登记口径收紧为
 *   「恰等 21 名镜像」单态判据（本波 #212 执行收紧，「空集（未落位）」历史臂随落位事实
 *   退役）——漂移（部分落位 / 自造名）即红；
 * - 装载闸对「产物在位」的现态（56 导出、资源域 21 名在册）实测闸判判 available 并
 *   交付 21 函数消费面（落位即收紧，本波 A2a 承接 #199 交回执行，生产判定分支结构零改动，
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
  NATIVE_RESOURCE_STORAGE_EXPORTS,
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

/** §11.3 主表面二十一名镜像全序（装载闸逐项点名的域序基线；旧构建替身夹具的点名全序 = `resource-stale-no-surface.js` 缺位集）。 */
const ALL_SURFACE_NAMES = [...NATIVE_RESOURCE_SURFACE_EXPORTS];
/** 波 C3 补登的包级受控提交链两名（域尾追加序，已随主批落文入 §11.3 表第 22/23 行）。 */
const ALL_STORAGE_NAMES = [...NATIVE_RESOURCE_STORAGE_EXPORTS];
/** §11.3 文档表 23 行的恰等镜像（21 + 2 = 23 名，接口方法与消费面判据的同一序列）。 */
const ALL_MODULE_NAMES = [...ALL_SURFACE_NAMES, ...ALL_STORAGE_NAMES];

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

  it('§11.3 表原文 23 行导出名与镜像全集逐项逐序恰等（表行序即数组序；W4-C3 随动波机械复原）', () => {
    // 切割窗口止于「JS 投影形状冻结表」小节（#204 臂③扩表：两投影逐字段行
    // 同为 `| \`字段\` |` 形态，不截断即误捕冻结表字段名——导出表本体判据不变；
    // 恰等语义不变：文档表原文与镜像全集逐字一致，C3 尾段两名已随主批落文入表）。
    const section = resourceDoc.slice(resourceDoc.indexOf('### 11.3'), resourceDoc.indexOf('#### JS 投影形状冻结表'));
    expect(section.length).toBeGreaterThan(0);
    expect(parseExportTableNames(section)).toEqual(ALL_MODULE_NAMES);
    expect(ALL_SURFACE_NAMES.length).toBe(21);
    expect(ALL_MODULE_NAMES.length).toBe(23);
  });

  it('装载闸必备全集 = 元信息两项 + 资源域 21 名 + 波 C3 提交链两名，共 25 项且序一致', () => {
    expect(NATIVE_RESOURCE_REQUIRED_META_EXPORTS).toEqual(['coreVersion', 'coreAbiVersion']);
    expect(NATIVE_RESOURCE_STORAGE_EXPORTS).toEqual(['resourceCommitChangeset', 'resourceRebuildArchive']);
    expect(NATIVE_RESOURCE_REQUIRED_EXPORTS).toEqual([
      ...NATIVE_RESOURCE_REQUIRED_META_EXPORTS,
      ...ALL_SURFACE_NAMES,
      ...ALL_STORAGE_NAMES,
    ]);
    expect(NATIVE_RESOURCE_REQUIRED_EXPORTS.length).toBe(25);
  });

  it('类型化注入面 `INativeResourceModule` 的 23 个方法名与镜像全集逐项逐序一致（禁第二套名）', () => {
    const interfaceBlock = moduleSource.slice(
      moduleSource.indexOf('export interface INativeResourceModule'),
      moduleSource.indexOf('/** 装载失败原因'),
    );
    expect(interfaceBlock.length).toBeGreaterThan(0);
    const declared = [...interfaceBlock.matchAll(/^ {2}(resource[A-Za-z]+)\(/gm)].map((m) => m[1]);
    expect(declared).toEqual(ALL_MODULE_NAMES);
  });

  it('宿主期望资源域 ABI 与 export-surface.json 的 abiVersion 等值（单一内核一个 ABI 计数，§8.6）', () => {
    expect(manifest.abiVersion).toBe(NATIVE_RESOURCE_ABI_VERSION);
  });

  it('§11.3 JS 投影形状冻结表两表字段 ↔ 宿主镜像两形逐名逐序一致（#204 臂③权威解码、#205/#206 翻正收口锁）', () => {
    const freezeSection = resourceDoc.slice(
      resourceDoc.indexOf('#### JS 投影形状冻结表'),
      resourceDoc.indexOf('### 11.4'),
    );
    expect(freezeSection.length).toBeGreaterThan(0);
    const secondTable = freezeSection.indexOf('**表二');
    expect(secondTable).toBeGreaterThan(0);
    const entryTable = parseExportTableNames(freezeSection.slice(0, secondTable));
    const streamTable = parseExportTableNames(freezeSection.slice(secondTable));
    expect(entryTable).toEqual(['name', 'isDirectory', 'size', 'modifiedUnixSeconds']);
    expect(streamTable).toEqual(['id', 'uri', 'append', 'commit', 'abort']);

    // 表行序即声明序：两镜像接口成员名逐字互锁（冻结表为唯一解码权威，漂移即红）。
    const members = (block: string): string[] =>
      [...block.matchAll(/^ {2}(?:readonly )?([A-Za-z]+)[(:]/gm)].map((m) => m[1] as string);
    const streamStart = moduleSource.indexOf('export interface INativeWriteStreamHandle {');
    const streamBlock = moduleSource.slice(streamStart, moduleSource.indexOf('\n}', streamStart));
    expect(members(streamBlock)).toEqual(streamTable);
    const entryStart = moduleSource.indexOf('export interface INativeDirectoryEntry {');
    const entryBlock = moduleSource.slice(entryStart, moduleSource.indexOf('\n}', entryStart));
    expect(members(entryBlock)).toEqual(entryTable);
  });

  it('native 在册导出表互锁（落位收紧单态，波 A2a 任务 #212 / 波 B 任务 #231 / D1 任务 #244 随动、工单036 波 C3 提交链两名随动）：resource* 名集恰等 23 名镜像，d.ts 声明同序', () => {
    // 「空集（未落位）」历史臂按 #199/#209 预登记口径随三名落位事实退役（收紧非放宽：
    // 两态判据的单态化即原注记「落位即自动收紧」的执行形态；漂移即红）。
    const names = manifest.exports.map((entry) => entry.name).filter((name) => /^resource[A-Z]/.test(name));
    expect(names).toEqual(ALL_MODULE_NAMES);
    const declaredNames = [...declaration.matchAll(/^export function (resource[A-Za-z]+)\(/gm)].map((m) => m[1]);
    expect(declaredNames).toEqual(ALL_MODULE_NAMES);
  });
});

/* ------------------------------------------------------------------ *
 * B 组：装载闸 fail-closed 四分面（CJS 替身夹具）
 * ------------------------------------------------------------------ */

describe('§11.3 装载闸：loadNativeResourceBinding（fail-closed 四分面）', () => {
  it('可用面：25 项在位且 ABI 等值 → available，交付 23 函数类型化消费面', () => {
    const binding = loadNativeResourceBinding(fixturePath('resource-available.js'));
    expect(binding.status).toBe('available');
    if (binding.status === 'available') {
      expect(binding.coreVersion).toBe('0.1.0');
      expect(binding.abiVersion).toBe(NATIVE_RESOURCE_ABI_VERSION);
      expect(binding.modulePath).toBe(fixturePath('resource-available.js'));
      for (const name of ALL_MODULE_NAMES) {
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

  it('surface-mismatch：二十一名全缺位 → 逐项点名（表行序 join，防静默降级）', () => {
    const binding = loadNativeResourceBinding(fixturePath('resource-stale-no-surface.js'));
    expect(binding.status).toBe('unavailable');
    if (binding.status === 'unavailable') {
      expect(binding.reason).toBe('surface-mismatch');
      expect(binding.detail).toContain(`：${ALL_SURFACE_NAMES.join('、')}（`);
      for (const name of ALL_SURFACE_NAMES) {
        expect(binding.detail).toContain(name);
      }
    }
  });

  it('surface-mismatch：仅缺中间一名 → 点名恰只含该名（在位名——含 C3 尾段两名——不混入）', () => {
    // 夹具 `resource-stale-20.js` 复刻「缺 `resourceGrantSession`、C3 尾段两名在位」的
    // 部分漂移面（工厂已随波 C3 扩面）：点名粒度锁 = 缺位点名恰只含缺位名。
    const binding = loadNativeResourceBinding(fixturePath('resource-stale-20.js'));
    expect(binding.status).toBe('unavailable');
    if (binding.status === 'unavailable') {
      expect(binding.reason).toBe('surface-mismatch');
      expect(binding.detail).toContain('：resourceGrantSession（');
      expect(binding.detail).not.toContain('resourceOpen');
      expect(binding.detail).not.toContain('resourceCommitChangeset');
      expect(binding.detail).not.toContain('resourceRebuildArchive');
    }
  });

  it('surface-mismatch：仅缺 C3 提交链两名 → 点名恰只含该两名（工单036 波 C3 补登闸粒度锁）', () => {
    const binding = loadNativeResourceBinding(fixturePath('resource-stale-22.js'));
    expect(binding.status).toBe('unavailable');
    if (binding.status === 'unavailable') {
      expect(binding.reason).toBe('surface-mismatch');
      expect(binding.detail).toContain('resourceCommitChangeset');
      expect(binding.detail).toContain('resourceRebuildArchive');
      expect(binding.detail).not.toContain('resourceGrantSession');
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
    '落位即收紧：产物在位（59 导出在册，含资源域 23 名）则必判 available 并交付 23 函数消费面；' +
      '缺位则判 module-missing——任一形态绝不交付半截消费面',
    () => {
      // 本臂原锁「resource* 导出未落位」现态事实（任务 #194 M0 结论①），部署产物翻正位
      // （34→49，#199 段三主体收口批 a82bbbd6b 交付；49→50→53，audit 域与波 A1 三补名
      // 随批落位；53→55，波 B 任务 #231 两换算名补登；55→56，点位五 D1 任务 #244 提交
      // 9fa04e900 补登 `resourceGrantSession`）后按预登记口径改断 available 收紧形
      // （候翻正注记在册，本波 #212 承接执行清单补登）；生产判定分支结构零改动。
      const binding = loadNativeResourceBinding(artifactPath);
      if (existsSync(artifactPath)) {
        expect(binding.status).toBe('available');
        if (binding.status === 'available') {
          expect(binding.abiVersion).toBe(NATIVE_RESOURCE_ABI_VERSION);
          for (const name of ALL_SURFACE_NAMES) {
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

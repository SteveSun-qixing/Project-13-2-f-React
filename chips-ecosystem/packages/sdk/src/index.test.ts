import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as sdk from './index.js';
import { ChipsBridge } from './client/chips-bridge.js';
import { ChipsError } from './errors.js';

/** 主入口所在的运行时根目录（`src/`，带尾分隔符）。 */
const SRC_DIR = fileURLToPath(new URL('.', import.meta.url));

/** 一条 `import` / `export ... from` 说明符。 */
interface Specifier {
  /** 被引用的模块说明符。 */
  readonly specifier: string;
  /** 是否会在编译产物里留下真实依赖（`import type` / `export type` 为 false）。 */
  readonly runtime: boolean;
}

/** 递归收集目录下指定后缀的文件路径，按路径排序。 */
function collectFiles(dir: string, suffix: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = `${dir}/${entry}`;
    if (statSync(full).isDirectory()) {
      found.push(...collectFiles(full, suffix));
      continue;
    }
    if (entry.endsWith(suffix)) {
      found.push(full);
    }
  }
  return found.sort();
}

/** 读取 `src/` 下随包发布的源码文件（排除 `*.test.ts`）。 */
function shippedSources(): readonly { readonly path: string; readonly text: string }[] {
  return collectFiles(SRC_DIR, '.ts')
    .filter((path) => !path.endsWith('.test.ts'))
    .map((path) => ({ path, text: readFileSync(path, 'utf8') }));
}

/** 去掉块注释与行注释，避免文档示例被当成真实依赖。 */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
}

/** 取文件里的全部模块说明符，并标注是否为运行时依赖。 */
function specifiersOf(text: string): Specifier[] {
  const cleaned = stripComments(text);
  const pattern = /\b(import|export)\b([^;]*?)from\s*['"]([^'"]+)['"]|\bimport\s*['"]([^'"]+)['"]/g;
  const found: Specifier[] = [];
  for (const match of cleaned.matchAll(pattern)) {
    const bare = match[4];
    if (bare !== undefined) {
      found.push({ specifier: bare, runtime: true });
      continue;
    }
    const clause = match[2];
    const specifier = match[3];
    if (clause === undefined || specifier === undefined) {
      continue;
    }
    found.push({ specifier, runtime: !/^\s*type\b/.test(clause) });
  }
  return found;
}

/** 取文件里的运行时依赖说明符。 */
function runtimeSpecifiers(text: string): string[] {
  return specifiersOf(text)
    .filter((item) => item.runtime)
    .map((item) => item.specifier);
}

describe('@chips/sdk 主入口值导出面（02-SDK-API规范 §2.2）', () => {
  it('值导出恰好为文档列出的六项，且无默认导出', () => {
    expect(Object.keys(sdk).sort()).toEqual([
      'ChipsBridge',
      'ChipsError',
      'chips',
      'createClient',
      'isChipsError',
      'toChipsError',
    ]);
    expect('default' in sdk).toBe(false);
  });

  it('各值导出种类与文档一致', () => {
    expect(typeof sdk.createClient).toBe('function');
    expect(typeof sdk.isChipsError).toBe('function');
    expect(typeof sdk.toChipsError).toBe('function');
    expect(typeof sdk.ChipsBridge).toBe('function');
    expect(typeof sdk.ChipsError).toBe('function');
    expect(sdk.chips).toBeInstanceOf(ChipsBridge);
    expect(Object.getOwnPropertyNames(ChipsBridge.prototype).sort()).toEqual([
      'constructor',
      'request',
      'resource',
      'subscribe',
    ]);
  });

  it('导出的 ChipsError 与 errors 模块同源', () => {
    expect(sdk.ChipsError).toBe(ChipsError);
    const error = new sdk.ChipsError({
      code: 'DOCUMENT_NOT_OPEN',
      message: '文档会话不存在或已关闭',
    });
    expect(sdk.isChipsError(error)).toBe(true);
    expect(sdk.toChipsError(error)).toBe(error);
  });

  it('开发期工具与契约常量不从主入口导出', () => {
    const entry = sdk as Record<string, unknown>;
    for (const name of [
      'createMockBridge',
      'installMockBridge',
      'uninstallMockBridge',
      'assertChipsError',
      'MOCK_ERROR_CODES',
      'PLATFORM_VERSION',
      'Capability',
      'ERROR_CODES',
    ]) {
      expect(entry[name], name).toBeUndefined();
    }
  });
});

describe('@chips/sdk 入口的依赖边界（§11 约束 2、§2.2 末段）', () => {
  const sources = shippedSources();

  it('随包发布的源码文件非空，且不含 @chips/bridge 的运行时导入', () => {
    expect(sources.length).toBeGreaterThan(10);
    for (const { path, text } of sources) {
      expect(runtimeSpecifiers(text), path).not.toContain('@chips/bridge');
    }
    // 正向对照：类型层确实以 import type 从 @chips/bridge 取形状
    expect(specifiersOf(readFileSync(`${SRC_DIR}types/bridge.ts`, 'utf8'))).toEqual([
      { specifier: '@chips/bridge', runtime: false },
      { specifier: '@chips/bridge', runtime: false },
    ]);
  });

  it('主入口只引入全局声明、客户端与错误模型三个运行时依赖', () => {
    const text = readFileSync(`${SRC_DIR}index.ts`, 'utf8');
    expect(runtimeSpecifiers(text)).toEqual(['./global.js', './client/index.js', './errors.js']);
    expect(text).not.toContain('./testing');
  });

  it('CLI 扩展与 manifest 类型以 export type 进入主入口，不新增运行时依赖（§2.2、§2.1 规则）', () => {
    const text = readFileSync(`${SRC_DIR}index.ts`, 'utf8');
    const typeOnly = specifiersOf(text)
      .filter((item) => !item.runtime)
      .map((item) => item.specifier);
    // CLI 扩展的 8 个命令类型、CliTaskApi 与 15 个 manifest 类型全部走编译期说明符
    expect(typeOnly).toContain('./types/cli/command.js');
    expect(typeOnly).toContain('./types/cli/task.js');
    expect(typeOnly).toContain('./scaffold/index.js');
    // manifest 的单点定义在 @chips/scaffold：主入口既不以运行时、也不以值形式引入该包
    expect(typeOnly).not.toContain('@chips/scaffold');
    expect(runtimeSpecifiers(text)).not.toContain('./scaffold/index.js');
  });

  it('内部说明符一律写成带 .js 后缀的 ESM 形式（代码组织规范 §7）', () => {
    for (const { path, text } of sources) {
      for (const { specifier } of specifiersOf(text)) {
        if (specifier.startsWith('.')) {
          expect(specifier, `${path} -> ${specifier}`).toMatch(/\.js$/);
        }
      }
    }
  });

  it('全局声明只声明 window.chips（§4、§9.2）', () => {
    const text = readFileSync(`${SRC_DIR}global.ts`, 'utf8');
    expect(text).toContain('interface Window');
    expect(text).toContain('chips: IChipsBridge');
    expect(runtimeSpecifiers(text)).toEqual([]);
    expect(sdk.chips).toBeInstanceOf(ChipsBridge);
  });
});

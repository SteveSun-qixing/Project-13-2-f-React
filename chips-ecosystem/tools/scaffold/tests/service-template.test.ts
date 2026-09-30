import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as ts from 'typescript';
import { deriveAssetSlug } from '../src/validate.js';
import { CANONICAL_OPTIONS, canonicalPlan, fileMap, readFile } from './support/fixtures.js';

/**
 * G2 收口：服务插件多形态模板契约测试（W4 row6）。
 *
 * 判据对齐权威面：
 * - 《06-服务插件开发指南》§七：Bridge 能力注册形态与可离线编译 schema 子集；
 * - 《04-能力契约规范》§八：IContentCapabilityDescriptor 描述符与 contracts/ 契约包；
 * - 《15-文件处理契约》§3.7：阶段化进度与单调百分比、AbortSignal 取消、幂等清理。
 */

const SERVICE_PLUGIN_ID = CANONICAL_OPTIONS.service.pluginId;
const SERVICE_SLUG = deriveAssetSlug(SERVICE_PLUGIN_ID);

/** JSON Schema 2020-12 方言标识。 */
const SCHEMA_2020_12 = 'https://json-schema.org/draft/2020-12/schema';

const CONTRACT_PATHS = [
  'contracts/descriptor.schema.json',
  'contracts/convert.input.schema.json',
  'contracts/convert.output.schema.json',
] as const;

/** 提取生成源码中的字符串常量值（模板串与契约文件一致性判定用）。 */
function expectStringConstant(source: string, name: string): string {
  const match = new RegExp(`const ${name} = '([^']+)'`).exec(source);
  expect(match, `生成源码缺少常量 ${name}`).not.toBeNull();
  return match?.[1] ?? '';
}

/** 提取生成源码中的数字常量值。 */
function expectNumberConstant(source: string, name: string): number {
  const match = new RegExp(`const ${name} = (\\d+)`).exec(source);
  expect(match, `生成源码缺少常量 ${name}`).not.toBeNull();
  return Number(match?.[1]);
}

/** 2020-12 可离线编译子集判定（04-能力契约规范 §7.4 校验项 5 的镜像）。 */
function assertOfflineCompilableSubset(
  path: string,
  schema: {
    $schema?: unknown;
    type?: unknown;
    additionalProperties?: unknown;
    required?: unknown;
    properties?: unknown;
  }
): void {
  expect(schema.$schema, `${path} 的 $schema 必须是 2020-12`).toBe(SCHEMA_2020_12);
  expect(schema.type, `${path} 顶层必须为 object`).toBe('object');
  expect(schema.additionalProperties, `${path} 顶层必须关闭追加属性`).toBe(false);
  const serialized = JSON.stringify(schema);
  expect(serialized, `${path} 不得携带远程 $ref`).not.toContain('"$ref":"http');
  const propertyNames = new Set(Object.keys((schema.properties as object) ?? {}));
  for (const required of (schema.required as readonly string[]) ?? []) {
    expect(propertyNames.has(required), `${path} required 引用未声明属性：${required}`).toBe(true);
  }
}

describe('service 模板多形态样例（G2）', () => {
  const plan = canonicalPlan('service');
  const files = fileMap(plan);
  const indexTs = readFile(plan, 'src/index.ts');

  it('生成物包含能力契约包三件与配置 schema', () => {
    const paths = plan.files.map((file) => file.path);
    for (const path of CONTRACT_PATHS) {
      expect(paths, `缺少契约文件 ${path}`).toContain(path);
    }
    expect(paths).toContain('assets/schemas/config.schema.json');
    expect(plan.template.files).toContain('contracts/descriptor.schema.json');
  });

  it('契约 schema 均为 2020-12 方言且满足可离线编译子集', () => {
    for (const path of CONTRACT_PATHS) {
      const schema = JSON.parse(readFile(plan, path)) as Record<string, unknown>;
      assertOfflineCompilableSubset(path, schema);
    }
    const descriptor = JSON.parse(readFile(plan, 'contracts/descriptor.schema.json')) as {
      'x-chips-contract'?: unknown;
      'x-chips-error-codes'?: { codes?: readonly { code?: string }[] };
    };
    expect(String(descriptor['x-chips-contract'])).toContain('IContentCapabilityDescriptor');
    const codes = (descriptor['x-chips-error-codes']?.codes ?? []).map((item) => item.code);
    expect(codes).toContain('CONTENT_INPUT_INVALID');
    expect(codes).toContain('BRIDGE_CANCELLED');
    for (const path of [
      'contracts/convert.input.schema.json',
      'contracts/convert.output.schema.json',
    ]) {
      const schema = JSON.parse(readFile(plan, path)) as { 'x-chips-schema-version'?: unknown };
      expect(schema['x-chips-schema-version'], `${path} 缺少 schema 版本标记`).toBe(1);
    }
  });

  it('描述符 schema 的 const 与入口常量、manifest 身份逐字一致', () => {
    const descriptor = JSON.parse(readFile(plan, 'contracts/descriptor.schema.json')) as {
      properties: Record<string, { const?: unknown; items?: { const?: unknown } }>;
    };
    const props = descriptor.properties;
    expect(props.id?.const).toBe(expectStringConstant(indexTs, 'CONTENT_CAPABILITY_ID'));
    expect(props.service?.const).toBe(expectStringConstant(indexTs, 'CORDIS_SERVICE_NAME'));
    expect(props.provider?.const).toBe(SERVICE_PLUGIN_ID);
    expect(props.contractPackage?.const).toBe(`${SERVICE_PLUGIN_ID}/contracts`);
    expect(props.operations?.items?.const).toBe('convert');
    expect(props.maxInlineInputBytes?.const).toBe(
      expectNumberConstant(indexTs, 'MAX_INLINE_INPUT_BYTES')
    );
    expect(props.id?.const).toBe(`content-${SERVICE_SLUG}.convert`);
  });

  it('输入/输出 schema 字段与入口类型面一致', () => {
    const input = JSON.parse(readFile(plan, 'contracts/convert.input.schema.json')) as {
      properties: { text?: { maxLength?: number }; chunkSize?: { default?: number } };
    };
    const output = JSON.parse(readFile(plan, 'contracts/convert.output.schema.json')) as {
      required: readonly string[];
      properties: Record<string, { type?: string }>;
    };
    expect(input.properties.text?.maxLength).toBe(
      expectNumberConstant(indexTs, 'MAX_INLINE_INPUT_BYTES')
    );
    expect(input.properties.chunkSize?.default).toBe(
      expectNumberConstant(indexTs, 'DEFAULT_CHUNK_SIZE')
    );
    for (const field of ['chunks', 'processedChars', 'processedBytes', 'durationMs', 'warnings']) {
      expect(Object.keys(output.properties), `输出 schema 缺少 ${field}`).toContain(field);
      expect(indexTs, `入口类型缺少 ${field}`).toContain(`readonly ${field}:`);
    }
    for (const field of ['text', 'chunkSize']) {
      expect(indexTs, `入口类型缺少 ${field}`).toMatch(new RegExp(`readonly ${field}\\??:`));
    }
  });

  it('入口骨架呈现 Bridge 能力、Cordis 服务与异步 job 编排形态', () => {
    // Cordis 内容处理服务（04-能力契约规范 §8.1）。
    expect(indexTs).toContain('ctx.provide(CORDIS_SERVICE_NAME');
    // Bridge 能力注册（06-服务插件开发指南 §7.2、§7.3）。
    expect(indexTs).toContain('ctx.registerCapability(');
    expect(indexTs).toContain("concurrency: 'serial'");
    expect(indexTs).toContain('maxQueue: 16');
    expect(indexTs).toContain('permissions: []');
    // 异步 job 编排：阶段化进度、单调守卫、取消令牌与幂等清理。
    for (const stage of ['prepare', 'transform', 'cleanup', 'completed']) {
      expect(indexTs, `缺少阶段 ${stage}`).toContain(`'${stage}'`);
    }
    expect(indexTs).toContain('onProgress');
    expect(indexTs).toContain('signal?.aborted');
    expect(indexTs).toContain('Math.max(this.lastPercent');
    expect(indexTs).toContain('BRIDGE_CANCELLED');
    expect(indexTs).toContain('CONTENT_INPUT_INVALID');
    expect(indexTs).toContain('finally');
    expect(indexTs).toContain('discardPendingChunks(pendingChunkBytes)');
    // 可逆生命周期与配置面。
    expect(indexTs).toContain('ctx.config.watch(');
    expect(indexTs).toContain('ctx.effect(');
    expect(indexTs).toContain('export default new ServicePlugin()');
  });

  it('生成源码不携带 Node 内置模块导入（G9）', () => {
    for (const [path, content] of files) {
      if (path.endsWith('.ts')) {
        expect(content, `${path} 存在 node: 导入`).not.toMatch(/from 'node:/);
        expect(content, `${path} 存在 require 调用`).not.toMatch(/\brequire\(/);
      }
    }
  });

  it('生成物对真实 @chips/sdk 类型自洽（语义诊断为空）', async () => {
    const workspaceRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
    const scaffoldRoot = join(workspaceRoot, 'tools', 'scaffold');
    const tempRoot = await mkdtemp(join(tmpdir(), 'chips-scaffold-service-gen-'));
    try {
      for (const file of plan.files) {
        const target = join(tempRoot, file.path);
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, file.content, 'utf8');
      }
      const program = ts.createProgram({
        rootNames: [join(tempRoot, 'src', 'index.ts'), join(tempRoot, 'tests', 'service.test.ts')],
        options: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ESNext,
          moduleResolution: ts.ModuleResolutionKind.Bundler,
          lib: ['lib.es2022.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
          strict: true,
          noUnusedLocals: true,
          noUnusedParameters: true,
          noImplicitReturns: true,
          noFallthroughCasesInSwitch: true,
          noUncheckedIndexedAccess: true,
          exactOptionalPropertyTypes: true,
          skipLibCheck: true,
          baseUrl: workspaceRoot,
          paths: {
            '@chips/sdk': ['packages/sdk/src/index'],
            '@chips/bridge': ['packages/bridge/src/index'],
            vitest: [join(scaffoldRoot, 'node_modules', 'vitest')],
          },
          typeRoots: [join(scaffoldRoot, 'node_modules', '@types')],
          types: ['node'],
        },
      });
      const messages = ts.getPreEmitDiagnostics(program).map((diagnostic) => {
        const origin = diagnostic.file ? `${diagnostic.file.fileName}:` : '';
        return origin + ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
      });
      expect(messages, '生成物存在类型诊断').toEqual([]);
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  }, 120_000);
});

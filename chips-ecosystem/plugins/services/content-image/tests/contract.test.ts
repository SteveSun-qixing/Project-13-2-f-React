/**
 * 契约面与红线机检断言：描述符与随包 JSON 一致、schema 方言、错误码词表、
 * service 角色布局与零 UI / 零 Node 导入面。
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  CONTENT_CAPABILITY_ID,
  CORDIS_SERVICE_NAME,
  MAX_IMAGE_BYTES,
  PROVIDER_PLUGIN_ID,
  pickColorsCapabilityDescriptor,
} from '../src/descriptor.js';
import * as errorSurface from '../src/errors.js';
import { createPickColorsService } from '../src/service.js';

const packageRoot = new URL('..', import.meta.url).pathname;
const schemaPath = (name: string): string => join(packageRoot, 'assets', 'schemas', name);
const readSchema = (name: string): Record<string, unknown> =>
  JSON.parse(readFileSync(schemaPath(name), 'utf8')) as Record<string, unknown>;

const sourceFiles = (dir: string): string[] =>
  readdirSync(join(packageRoot, dir), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
    .map((entry) => `${dir}/${entry.name}`);

describe('提供方契约描述符', () => {
  it('TS 描述符与随包 descriptor.json 全等', () => {
    const shipped: unknown = JSON.parse(readFileSync(schemaPath('descriptor.json'), 'utf8'));
    expect(shipped).toEqual(pickColorsCapabilityDescriptor);
  });

  it('标识三元组取 canonical 能力 ID 与本包提供方', () => {
    expect(pickColorsCapabilityDescriptor.id).toBe('content-image.pick-colors');
    expect(pickColorsCapabilityDescriptor.id).toBe(CONTENT_CAPABILITY_ID);
    expect(pickColorsCapabilityDescriptor.service).toBe(CORDIS_SERVICE_NAME);
    expect(pickColorsCapabilityDescriptor.provider).toBe(PROVIDER_PLUGIN_ID);
    expect(pickColorsCapabilityDescriptor.operations).toEqual(['pickColors']);
    expect(pickColorsCapabilityDescriptor.maxInlineInputBytes).toBe(MAX_IMAGE_BYTES);
    expect(pickColorsCapabilityDescriptor.streaming).toEqual({ input: false, output: false });
  });

  it('descriptor.schema.json 为 2020-12 封闭对象并覆盖九字段', () => {
    const schema = readSchema('descriptor.schema.json');
    expect(schema['$schema']).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(schema.additionalProperties).toBe(false);
    expect(schema.required).toEqual([
      'id',
      'service',
      'provider',
      'operations',
      'sourceFormats',
      'targetFormats',
      'streaming',
      'maxInlineInputBytes',
      'contractPackage',
    ]);
  });

  it('canonical 标识三元组实测通过描述符 schema 的字段文法', () => {
    const properties = readSchema('descriptor.schema.json').properties as Record<
      string,
      Record<string, unknown>
    >;
    const patternOf = (field: string): RegExp => new RegExp(String(properties[field]?.pattern));
    expect(patternOf('id').test(CONTENT_CAPABILITY_ID)).toBe(true);
    expect(patternOf('service').test(CORDIS_SERVICE_NAME)).toBe(true);
    expect(patternOf('provider').test(PROVIDER_PLUGIN_ID)).toBe(true);
    expect(CORDIS_SERVICE_NAME).toBe('content-image');
    expect(PROVIDER_PLUGIN_ID).toBe('chips.service.content-image');
  });

  it('契约先行不冒充接线：登记实例只有 pick-colors，服务面只有 pickColors', () => {
    const shippedInstances = readdirSync(join(packageRoot, 'assets', 'schemas'))
      .filter((name) => name.endsWith('.json') && !name.endsWith('.schema.json'))
      .sort();
    expect(shippedInstances).toEqual(['descriptor.json']);

    const service = createPickColorsService({
      engine: {
        id: 'shape-probe',
        decode: () => Promise.reject(new Error('形状探针不参与解码')),
      },
    });
    expect(Object.keys(service).sort()).toEqual(['capabilityId', 'pickColors']);
  });

  it('normalize / transcode 两能力零实现面（无操作符、无端口接线）', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles('src')) {
      const text = readFileSync(join(packageRoot, file), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '');
      for (const token of [
        'normalize(',
        'transcode(',
        'NORMALIZE_OPERATION',
        'TRANSCODE_OPERATION',
      ]) {
        if (text.includes(token)) {
          offenders.push(`${file} -> ${token}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('输入 / 输出 schema', () => {
  it('图像族三能力六件契约全为 2020-12 封闭对象', () => {
    for (const name of [
      'pick-colors.input.schema.json',
      'pick-colors.output.schema.json',
      'normalize.input.schema.json',
      'normalize.output.schema.json',
      'transcode.input.schema.json',
      'transcode.output.schema.json',
    ]) {
      const schema = readSchema(name);
      expect(schema['$schema'], name).toBe('https://json-schema.org/draft/2020-12/schema');
      expect(schema.type, name).toBe('object');
      expect(schema.additionalProperties, name).toBe(false);
      expect(schema.$id, name).toBe(`chips.service.content-image/assets/schemas/${name}`);
    }
  });

  it('三能力输入首字段一律是二进制图像字节（禁 base64、禁路径）', () => {
    for (const name of [
      'pick-colors.input.schema.json',
      'normalize.input.schema.json',
      'transcode.input.schema.json',
    ]) {
      const schema = readSchema(name);
      const properties = schema.properties as Record<string, Record<string, unknown>>;
      expect((schema.required as string[])[0], name).toBe('image');
      expect(properties.image?.type, name).toBeUndefined();
      expect(properties.image?.['x-chips-binary'], name).toBe(MAX_IMAGE_BYTES);
      const text = JSON.stringify(schema);
      expect(text, name).not.toMatch(/base64"?\s*:\s*true/);
      expect(text, name).not.toMatch(/"(imagePath|filePath|sourcePath|path)"/);
    }
  });

  it('normalize 输出：PNG 字节 + 像素尺寸（§8.4 输入→输出列）', () => {
    const schema = readSchema('normalize.output.schema.json');
    const properties = schema.properties as Record<string, Record<string, unknown>>;
    expect(schema.required).toEqual(['image', 'format', 'width', 'height']);
    expect(properties.format).toMatchObject({ const: 'png' });
    expect(properties.image?.['x-chips-binary']).toBe(MAX_IMAGE_BYTES);
    expect(properties.width).toMatchObject({ type: 'integer', minimum: 1 });
    expect(properties.height).toMatchObject({ type: 'integer', minimum: 1 });
  });

  it('transcode：目标格式在输入侧、产出格式与尺寸在输出侧（§8.4 输入→输出列）', () => {
    const input = readSchema('transcode.input.schema.json');
    const output = readSchema('transcode.output.schema.json');
    const inputProps = input.properties as Record<string, Record<string, unknown>>;
    const outputProps = output.properties as Record<string, Record<string, unknown>>;

    expect(input.required).toEqual(['image', 'targetFormat']);
    expect(inputProps.targetFormat).toMatchObject({ type: 'string', minLength: 1 });
    expect(inputProps.maxWidth).toMatchObject({ type: 'integer', minimum: 1 });
    expect(inputProps.maxHeight).toMatchObject({ type: 'integer', minimum: 1 });
    expect(output.required).toEqual(['image', 'format', 'width', 'height']);
    expect(outputProps.format).toMatchObject({ type: 'string', minLength: 1 });
    expect(outputProps.format?.const).toBeUndefined();
  });

  it('输入：图像字节走二进制扩展，标量字段有界', () => {
    const schema = readSchema('pick-colors.input.schema.json');
    const properties = schema.properties as Record<string, Record<string, unknown>>;

    expect(schema.required).toEqual(['image']);
    expect(properties.image?.type).toBeUndefined();
    expect(properties.image?.['x-chips-binary']).toBe(MAX_IMAGE_BYTES);
    expect(properties.sampleSize).toMatchObject({ minimum: 48, maximum: 160, default: 96 });
    expect(properties.sourceKey).toMatchObject({ minLength: 1, maxLength: 512 });
    expect(JSON.stringify(schema)).not.toMatch(/base64"?\s*:\s*true/);
  });

  it('输出：颜色文法、调色板上下界与元数据封闭形状', () => {
    const schema = readSchema('pick-colors.output.schema.json');
    const properties = schema.properties as Record<string, Record<string, unknown>>;
    const palette = properties.palette as Record<string, unknown>;
    const metadata = properties.metadata as Record<string, Record<string, unknown>>;
    const metadataProps = metadata.properties as Record<string, Record<string, unknown>>;

    expect(schema.required).toEqual(['backgroundColor', 'accentColor', 'palette', 'metadata']);
    expect(properties.backgroundColor?.pattern).toBe('^#[0-9a-fA-F]{6}$');
    expect(palette.minItems).toBe(2);
    expect(palette.maxItems).toBe(8);
    expect(metadata.additionalProperties).toBe(false);
    expect(metadataProps.image?.additionalProperties).toBe(false);
    expect(JSON.stringify(schema)).not.toContain('imagePath');
    expect(JSON.stringify(schema)).not.toContain('"source"');
  });
});

describe('错误码词表', () => {
  it('只暴露已登记码族与 details.reason 常量', () => {
    const codes = Object.entries(errorSurface)
      .filter(([key]) => /^[A-Z][A-Z0-9_]*$/.test(key))
      .map(([, value]) => value as string)
      .sort();

    expect(codes).toEqual([
      'BRIDGE_CANCELLED',
      'DECODED_SAMPLE_INVALID',
      'FORMAT_UNSUPPORTED',
      'IMAGE_ANALYSIS_FAILED',
      'IMAGE_DECODE_FAILED',
      'IMAGE_EMPTY',
      'IMAGE_INPUT_UNSUPPORTED',
      'INPUT_TOO_LARGE',
      'PIXEL_SOURCE_UNBOUND',
    ]);
  });

  it('旧 COLOR_PICKER_ 码在产线码面零残留（仅允许出现在注释迁移映射表里）', () => {
    const stripComments = (text: string): string =>
      text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    const hits = sourceFiles('src')
      .map((file) => ({ file, code: stripComments(readFileSync(join(packageRoot, file), 'utf8')) }))
      .filter(({ code }) => code.includes('COLOR_PICKER_'))
      .map(({ file }) => file);
    expect(hits).toEqual([]);
  });
});

describe('service 角色布局与红线导入面', () => {
  it('manifest 声明 service 角色、空权限与能力归属按实收窄', () => {
    const manifest = readFileSync(join(packageRoot, 'manifest.yaml'), 'utf8');
    expect(manifest).toContain('id: chips.service.content-image');
    expect(manifest).toContain('type: service');
    expect(manifest).toContain('permissions: []');
    expect(manifest).toContain(CONTENT_CAPABILITY_ID);
    // service 角色不得声明 capabilities（02-插件清单规范 §7：只有 basecard / boxlayout 可声明）
    expect(manifest).not.toContain('capabilities:');
    // 未实现能力不进清单面（W4 §9.1 并行闸 3：禁假接线）
    expect(manifest).not.toContain('content-image.normalize');
    expect(manifest).not.toContain('content-image.transcode');
    expect(manifest).not.toContain('chips.service.colorpicker');
  });

  it('包内 schema 面齐备：三能力六件输入输出 + 描述符实例与 schema', () => {
    const schemaFiles = readdirSync(join(packageRoot, 'assets', 'schemas')).sort();
    expect(schemaFiles).toEqual([
      'descriptor.json',
      'descriptor.schema.json',
      'normalize.input.schema.json',
      'normalize.output.schema.json',
      'pick-colors.input.schema.json',
      'pick-colors.output.schema.json',
      'transcode.input.schema.json',
      'transcode.output.schema.json',
    ]);
  });

  it('service 角色不携带渲染入口', () => {
    expect(existsSync(join(packageRoot, 'render.js'))).toBe(false);
  });

  it('零 UI、零 Node、零原生图像依赖导入', () => {
    const forbidden = [
      'antd',
      '@chips/ui',
      '@chips/antd',
      'react',
      'node:',
      'sharp',
      '@chips/bridge',
      '@chips/host',
      'electron',
    ];
    const offenders: string[] = [];
    for (const file of sourceFiles('src')) {
      const text = readFileSync(join(packageRoot, file), 'utf8');
      for (const token of forbidden) {
        if (new RegExp(`from\\s+'${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(text)) {
          offenders.push(`${file} -> ${token}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('源码只经 @chips/sdk 正式链路取值', () => {
    const externalModules = new Set<string>();
    for (const file of sourceFiles('src')) {
      const text = readFileSync(join(packageRoot, file), 'utf8');
      for (const match of text.matchAll(/from\s+'([^']+)'/g)) {
        const specifier = match[1] ?? '';
        if (!specifier.startsWith('.')) {
          externalModules.add(specifier);
        }
      }
    }
    expect(Array.from(externalModules).sort()).toEqual(['@chips/sdk']);
  });
});

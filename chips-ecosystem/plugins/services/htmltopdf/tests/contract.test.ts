/**
 * 契约面与包形机检断言：登记描述符与随包 descriptor.schema.json 逐字段一致、
 * 错误码词表与 x-chips-error-codes 逐字一致、警告码与 x-chips-warning-codes 一致、
 * schema 方言与边界常量、manifest 服务角色与权限最小化、package.json 包形。
 * 事实源：04-能力契约规范 §8.3/§8.4/§8.6 与包内 contracts/ 提供方契约分件。
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  CONTENT_CAPABILITY_ID,
  CORDIS_SERVICE_NAME,
  DEFAULT_MARGIN_MM,
  MAX_ASSET_PATH_LENGTH,
  MAX_HTML_BYTES,
  MAX_INLINE_INPUT_BYTES,
  MAX_MARGIN_MM,
  MAX_PAGE_COUNT,
  MAX_PRINT_SCALE,
  MAX_TEMPLATE_LENGTH,
  MIN_MARGIN_MM,
  MIN_PRINT_SCALE,
  PROVIDER_PLUGIN_ID,
  htmlToPdfCapabilityDescriptor,
} from '../src/descriptor.js';
import * as errorSurface from '../src/errors.js';
import { WARN_PAGE_OVERFLOW_KEEP_BLOCK } from '../src/pagination.js';

const packageRoot = fileURLToPath(new URL('..', import.meta.url));

function readJson(relative: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(packageRoot, relative), 'utf-8')) as Record<string, unknown>;
}

const properties = (schema: Record<string, unknown>): Record<string, Record<string, unknown>> =>
  schema['properties'] as Record<string, Record<string, unknown>>;

describe('内容处理能力登记描述符（§8.3/§8.4）', () => {
  it('描述符七元组取 canonical 能力 ID 与本包提供方，恰为两段点号文法', () => {
    expect(htmlToPdfCapabilityDescriptor.id).toBe('content-converter.html-to-pdf');
    expect(htmlToPdfCapabilityDescriptor.id).toBe(CONTENT_CAPABILITY_ID);
    expect(htmlToPdfCapabilityDescriptor.service).toBe('content-html-to-pdf');
    expect(htmlToPdfCapabilityDescriptor.service).toBe(CORDIS_SERVICE_NAME);
    expect(htmlToPdfCapabilityDescriptor.provider).toBe('chips.service.htmltopdf');
    expect(htmlToPdfCapabilityDescriptor.provider).toBe(PROVIDER_PLUGIN_ID);
    expect(String(htmlToPdfCapabilityDescriptor.id)).toMatch(/^content-[a-z0-9-]+\.[a-z0-9-]+$/);
    expect(String(htmlToPdfCapabilityDescriptor.service)).toMatch(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/);
  });

  it('操作、来源/目标格式、流式与输入上限如实登记', () => {
    expect(htmlToPdfCapabilityDescriptor.operations).toEqual(['htmlToPdf']);
    expect(htmlToPdfCapabilityDescriptor.sourceFormats).toEqual(['html-directory']);
    expect(htmlToPdfCapabilityDescriptor.targetFormats).toEqual(['pdf']);
    expect(htmlToPdfCapabilityDescriptor.streaming).toEqual({ input: false, output: false });
    expect(htmlToPdfCapabilityDescriptor.maxInlineInputBytes).toBe(MAX_INLINE_INPUT_BYTES);
    expect(htmlToPdfCapabilityDescriptor.contractPackage).toBe('chips.service.htmltopdf/contracts');
  });

  it('TS 描述符与随包 descriptor.schema.json 的 const 逐字段一致', () => {
    const schema = readJson('contracts/descriptor.schema.json');
    const props = properties(schema);
    expect(schema.additionalProperties).toBe(false);
    expect(props['id']?.['const']).toBe(htmlToPdfCapabilityDescriptor.id);
    expect(props['service']?.['const']).toBe(htmlToPdfCapabilityDescriptor.service);
    expect(props['provider']?.['const']).toBe(htmlToPdfCapabilityDescriptor.provider);
    expect(
      (props['operations']?.['items'] as Record<string, unknown>)['const']
    ).toBe(htmlToPdfCapabilityDescriptor.operations[0]);
    expect(
      (props['sourceFormats']?.['items'] as Record<string, unknown>)['const']
    ).toBe(htmlToPdfCapabilityDescriptor.sourceFormats[0]);
    expect(
      (props['targetFormats']?.['items'] as Record<string, unknown>)['const']
    ).toBe(htmlToPdfCapabilityDescriptor.targetFormats[0]);
    const streaming = props['streaming']?.['properties'] as Record<string, Record<string, unknown>>;
    expect(streaming['input']?.['const']).toBe(false);
    expect(streaming['output']?.['const']).toBe(false);
    expect(props['maxInlineInputBytes']?.['const']).toBe(htmlToPdfCapabilityDescriptor.maxInlineInputBytes);
    expect(props['contractPackage']?.['const']).toBe(htmlToPdfCapabilityDescriptor.contractPackage);
  });

  it('运行时上限常量与描述符口径一致', () => {
    expect(MAX_HTML_BYTES).toBe(8 * 1024 * 1024);
    expect(MAX_INLINE_INPUT_BYTES).toBe(32 * 1024 * 1024);
    expect(MAX_PAGE_COUNT).toBe(10000);
    expect(MAX_ASSET_PATH_LENGTH).toBe(256);
    expect(MIN_MARGIN_MM).toBe(0);
    expect(MAX_MARGIN_MM).toBe(50);
    expect(DEFAULT_MARGIN_MM).toBe(10);
    expect(MIN_PRINT_SCALE).toBe(0.1);
    expect(MAX_PRINT_SCALE).toBe(2);
    expect(MAX_TEMPLATE_LENGTH).toBe(4096);
  });
});

describe('错误码词表（§8.6 与 x-chips-error-codes 逐字）', () => {
  it('错误面导出的码集与随包契约声明完全一致', () => {
    const schema = readJson('contracts/descriptor.schema.json');
    const declared = schema['x-chips-error-codes'] as {
      codes: readonly { code: string; retryable: boolean }[];
    };
    expect(declared.codes.map((item) => item.code)).toEqual([
      'CONVERTER_INPUT_UNSUPPORTED',
      'CONVERTER_RENDER_FAILED',
      'CONVERTER_OUTPUT_TOO_LARGE',
      'BRIDGE_CANCELLED',
      'BRIDGE_TIMEOUT',
    ]);
    const exportedCodes = (
      Object.values(errorSurface).filter((value) => typeof value === 'string') as string[]
    ).sort();
    expect(exportedCodes).toEqual(
      [
        'CONVERTER_INPUT_UNSUPPORTED',
        'CONVERTER_RENDER_FAILED',
        'CONVERTER_OUTPUT_TOO_LARGE',
        'BRIDGE_CANCELLED',
        'BRIDGE_TIMEOUT',
        'RENDER_CARRIER_UNBOUND',
      ].sort()
    );
  });

  it('retryable 语义：仅 BRIDGE_TIMEOUT 通道码可重试', () => {
    const schema = readJson('contracts/descriptor.schema.json');
    const declared = schema['x-chips-error-codes'] as {
      codes: readonly { code: string; retryable: boolean }[];
    };
    for (const item of declared.codes) {
      expect(item.retryable).toBe(item.code === 'BRIDGE_TIMEOUT');
    }
  });

  it('CONVERTER_* 码形合法且不复用禁用前缀', () => {
    for (const code of [
      errorSurface.CONVERTER_INPUT_UNSUPPORTED,
      errorSurface.CONVERTER_RENDER_FAILED,
      errorSurface.CONVERTER_OUTPUT_TOO_LARGE,
    ]) {
      expect(code).toMatch(/^CONVERTER_[A-Z_]+$/);
      expect(code.startsWith('BRIDGE_')).toBe(false);
      expect(code.startsWith('FILE_')).toBe(false);
      expect(code.startsWith('RESOURCE_')).toBe(false);
      expect(code.startsWith('DOCUMENT_')).toBe(false);
    }
  });

  it('警告码与 x-chips-warning-codes 登记一致', () => {
    const schema = readJson('contracts/descriptor.schema.json');
    const declared = schema['x-chips-warning-codes'] as { codes: readonly { code: string }[] };
    expect(declared.codes.map((item) => item.code)).toEqual([WARN_PAGE_OVERFLOW_KEEP_BLOCK]);
  });
});

describe('输入/输出/选项 schema 方言与边界', () => {
  it('三份能力 schema 均为 2020-12 封闭对象且带 schema 版本', () => {
    for (const file of [
      'contracts/html-to-pdf.input.schema.json',
      'contracts/html-to-pdf.output.schema.json',
      'contracts/html-to-pdf.options.schema.json',
    ]) {
      const schema = readJson(file);
      expect(schema['$schema']).toBe('https://json-schema.org/draft/2020-12/schema');
      expect(schema['x-chips-schema-version']).toBe(1);
      expect(schema['type']).toBe('object');
      expect(schema['additionalProperties']).toBe(false);
    }
  });

  it('描述符 schema 以 x-chips-contract 锚定 §8.3 描述符契约', () => {
    const schema = readJson('contracts/descriptor.schema.json');
    expect(schema['$schema']).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(schema['x-chips-contract']).toBe(
      'IContentCapabilityDescriptor（04-能力契约规范 §8.3）'
    );
    expect(schema['type']).toBe('object');
    expect(schema['additionalProperties']).toBe(false);
  });

  it('输入 schema：html 必填非空，blocks 项必填 id/heightPx 且 heightPx 恒正', () => {
    const input = readJson('contracts/html-to-pdf.input.schema.json');
    expect(input['required']).toEqual(['html']);
    const props = properties(input);
    expect(props['html']?.['minLength']).toBe(1);
    const blocksItems = (props['blocks']?.['items'] ?? {}) as Record<string, unknown>;
    expect(blocksItems['required']).toEqual(['id', 'heightPx']);
    const blockProps = properties(blocksItems);
    expect(blockProps['id']?.['minLength']).toBe(1);
    expect(blockProps['id']?.['maxLength']).toBe(256);
    expect(blockProps['heightPx']?.['exclusiveMinimum']).toBe(0);
    expect(blockProps['keepTogether']?.['default']).toBe(false);
  });

  it('输出 schema：必填回执字段与 diagnostics 面，页数上限与常量一致', () => {
    const output = readJson('contracts/html-to-pdf.output.schema.json');
    expect(output['required']).toEqual(['bytes', 'pageCount', 'pageSizeMm', 'marginMm']);
    const props = properties(output);
    expect(props['pageCount']?.['maximum']).toBe(MAX_PAGE_COUNT);
    expect(props['pageCount']?.['exclusiveMinimum']).toBe(0);
    const diagnostics = props['diagnostics'] as Record<string, unknown>;
    expect(diagnostics['required']).toEqual(['engineId', 'assetCount', 'printableAreaMm']);
    expect((properties(diagnostics)['paginationHintPageCount'] ?? {})['type']).toEqual([
      'integer',
      'null',
    ]);
  });

  it('选项 schema：枚举、边界与缺省值与实现常量逐字一致', () => {
    const options = readJson('contracts/html-to-pdf.options.schema.json');
    const props = properties(options);
    expect(props['pageSize']?.['enum']).toEqual(['A4', 'A3', 'Letter', 'Legal']);
    expect(props['pageSize']?.['default']).toBe('A4');
    expect(props['landscape']?.['default']).toBe(false);
    expect(props['printBackground']?.['default']).toBe(true);
    expect(props['preferCSSPageSize']?.['default']).toBe(false);
    expect(props['scale']?.['minimum']).toBe(MIN_PRINT_SCALE);
    expect(props['scale']?.['maximum']).toBe(MAX_PRINT_SCALE);
    expect(props['scale']?.['default']).toBe(1);
    const margins = properties(props['margins'] as Record<string, unknown>);
    for (const side of ['top', 'right', 'bottom', 'left']) {
      expect(margins[side]?.['minimum']).toBe(MIN_MARGIN_MM);
      expect(margins[side]?.['maximum']).toBe(MAX_MARGIN_MM);
      expect(margins[side]?.['default']).toBe(DEFAULT_MARGIN_MM);
    }
    const headerFooter = properties(props['headerFooter'] as Record<string, unknown>);
    expect(headerFooter['enabled']?.['default']).toBe(false);
    expect(headerFooter['headerTemplate']?.['minLength']).toBe(1);
    expect(headerFooter['headerTemplate']?.['maxLength']).toBe(MAX_TEMPLATE_LENGTH);
    expect(headerFooter['footerTemplate']?.['maxLength']).toBe(MAX_TEMPLATE_LENGTH);
    expect(headerFooter['headerHeightMm']?.['minimum']).toBe(MIN_MARGIN_MM);
    expect(headerFooter['headerHeightMm']?.['maximum']).toBe(MAX_MARGIN_MM);
    expect(headerFooter['headerHeightMm']?.['default']).toBe(DEFAULT_MARGIN_MM);
    expect(headerFooter['footerHeightMm']?.['default']).toBe(DEFAULT_MARGIN_MM);
  });
});

describe('manifest 与包形', () => {
  const manifest = readFileSync(join(packageRoot, 'manifest.yaml'), 'utf-8');

  it('服务角色、host 目标、健康检查声明齐备，权限最小化为空表', () => {
    expect(manifest).toContain('id: chips.service.htmltopdf');
    expect(manifest).toContain('version: 0.1.0');
    expect(manifest).toContain('type: service');
    expect(manifest).toContain('- host');
    expect(manifest).toContain('healthCheck:');
    expect(manifest).toContain('permissions: []');
    const listItems = manifest
      .split('\n')
      .filter((line) => line.trim().startsWith('- '))
      .map((line) => line.trim().slice(2));
    expect(listItems).toEqual(['host']);
  });

  it('服务包不声明 UI 面（不出现 ui/render/cardTypes/layout 字段）', () => {
    expect(manifest).not.toMatch(/^ui:/m);
    expect(manifest).not.toMatch(/render\.js/m);
    expect(manifest).not.toMatch(/cardTypes:/m);
    expect(manifest).not.toMatch(/layouts:/m);
  });

  it('package.json 与 manifest 版本一致，运行时依赖仅 @chips/sdk', () => {
    const pkg = readJson('package.json');
    expect(pkg['version']).toBe('0.1.0');
    expect(pkg['private']).toBe(true);
    expect(pkg['type']).toBe('module');
    expect(pkg['dependencies']).toEqual({ '@chips/sdk': 'workspace:*' });
    expect((pkg['scripts'] as Record<string, string>)['test']).toBe('vitest run');
    expect((pkg['scripts'] as Record<string, string>)['typecheck']).toBe('tsc -p tsconfig.json --noEmit');
  });
});

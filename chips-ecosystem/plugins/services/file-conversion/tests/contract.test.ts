/**
 * 契约面一致性断言：输入/输出 schema、错误码词表与依赖声明逐项锁定
 * （错误码事实源：@chips/sdk 生成词表；编排能力 ID 不在册的缺口如实呈现，不伪造登记面）。
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  CARD_TO_HTML_CAPABILITY_ID,
  FILE_CONVERSION_PLUGIN_ID,
  FILE_CONVERSION_SERVICE_NAME,
  FILE_CONVERSION_CAPABILITY_ID,
  HTML_TO_IMAGE_CAPABILITY_ID,
  HTML_TO_PDF_CAPABILITY_ID,
} from '../src/descriptor.js';
import { REGISTERED_CONVERTER_ERROR_CODES } from '../src/errors.js';

const packageRoot = fileURLToPath(new URL('..', import.meta.url));

function readJson(relative: string): Record<string, unknown> {
  return JSON.parse(readFileSync(`${packageRoot}${relative}`, 'utf-8')) as Record<string, unknown>;
}

describe('服务身份（能力 ID 在册性核对结论的机检锁定）', () => {
  it('链路腿能力 ID 均为 §8.4 在册项（content-converter 族两段点号形式）', () => {
    for (const capabilityId of [CARD_TO_HTML_CAPABILITY_ID, HTML_TO_PDF_CAPABILITY_ID, HTML_TO_IMAGE_CAPABILITY_ID]) {
      expect(capabilityId).toMatch(/^content-[a-z0-9-]+\.[a-z0-9-]+$/);
    }
    expect(CARD_TO_HTML_CAPABILITY_ID).toBe('content-converter.card-to-html');
    expect(HTML_TO_PDF_CAPABILITY_ID).toBe('content-converter.html-to-pdf');
    expect(HTML_TO_IMAGE_CAPABILITY_ID).toBe('content-converter.html-to-image');
  });

  it('编排能力 §8.4 在册：descriptor.json 八字段与登记行一致（RFC B1 案转正，2026-10-01）', () => {
    expect(FILE_CONVERSION_SERVICE_NAME).toMatch(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/);
    expect(FILE_CONVERSION_SERVICE_NAME.startsWith('content-')).toBe(true);
    expect(FILE_CONVERSION_PLUGIN_ID).toMatch(/^chips\.service\.[a-z0-9-]+$/);
    expect(FILE_CONVERSION_SERVICE_NAME).not.toBe('content-converter');
    // §8.4 正表登记行 ↔ 描述符逐字段恰等（04-能力契约规范 §8.4：content-file-conversion.convert）
    const descriptor = readJson('contracts/descriptor.json');
    expect(descriptor).toEqual({
      id: 'content-file-conversion.convert',
      service: 'content-file-conversion',
      provider: 'chips.service.file-conversion',
      operations: ['convert'],
      sourceFormats: ['card', 'html'],
      targetFormats: ['html', 'pdf', 'image'],
      streaming: { input: false, output: false },
      maxInlineInputBytes: 8388608,
      contractPackage: 'chips.service.file-conversion/contracts',
    });
    expect(FILE_CONVERSION_CAPABILITY_ID).toBe(descriptor.id);
    expect(FILE_CONVERSION_CAPABILITY_ID).toMatch(/^content-[a-z0-9-]+\.[a-z0-9-]+$/);
  });
});

describe('输入/输出 schema', () => {
  it('顶层为 object 且显式 additionalProperties: false（E4 §5 子集）', () => {
    const input = readJson('contracts/file-convert.input.schema.json');
    const output = readJson('contracts/file-convert.output.schema.json');
    expect(input['type']).toBe('object');
    expect(input['additionalProperties']).toBe(false);
    expect(output['type']).toBe('object');
    expect(output['additionalProperties']).toBe(false);
  });

  it('来源/目标枚举与请求链路域一致', () => {
    const input = readJson('contracts/file-convert.input.schema.json');
    const properties = input['properties'] as Record<string, Record<string, unknown>>;
    const sourceType = (properties.source as { properties: Record<string, unknown> }).properties['type'];
    const targetType = (properties.target as { properties: Record<string, unknown> }).properties['type'];
    expect((sourceType as { enum: string[] }).enum).toEqual(['card', 'html']);
    expect((targetType as { enum: string[] }).enum).toEqual(['html', 'pdf', 'image']);
  });

  it('已废弃的 locale/themeId 不进契约（随 task030 废弃）；pdf 选项字段名与提供方契约对齐', () => {
    const input = readJson('contracts/file-convert.input.schema.json');
    const text = JSON.stringify(input);
    expect(text.includes('locale')).toBe(false);
    expect(text.includes('themeId')).toBe(false);
    const properties = input['properties'] as Record<string, Record<string, unknown>>;
    const pdf = (
      (properties.options as { properties: Record<string, unknown> }).properties['pdf'] as {
        properties: Record<string, unknown>;
      }
    ).properties;
    expect(pdf['margins']).toBeDefined();
    expect(pdf['marginMm']).toBeUndefined();
  });

  it('回执 pipeline 逐腿登记能力 ID / 服务名 / 原子操作', () => {
    const output = readJson('contracts/file-convert.output.schema.json');
    const properties = output['properties'] as Record<string, Record<string, unknown>>;
    const pipelineItems = (properties.pipeline as { items: { required: string[] } }).items.required;
    expect(pipelineItems).toEqual(['capability', 'service', 'operation']);
    const artifactTypes = (
      ((properties.artifacts as { items: { properties: Record<string, unknown> } }).items.properties['type'] as {
        enum: string[];
      })
    ).enum;
    expect(artifactTypes).toEqual(['html-zip', 'html-directory', 'pdf', 'image']);
  });
});

describe('manifest 依赖声明与权限最小化', () => {
  const manifest = readFileSync(`${packageRoot}manifest.yaml`, 'utf-8');

  it('静态声明三个提供方插件依赖（02-插件清单规范 §五）', () => {
    expect(manifest).toContain('id: chips.service.cardtohtml');
    expect(manifest).toContain('id: chips.service.htmltopdf');
    expect(manifest).toContain('id: chips.service.htmltoimage');
  });

  it('权限最小化：仅 file:* 域所需的 filesystem 三权限，无 resources:read', () => {
    expect(manifest).toContain('- filesystem:read');
    expect(manifest).toContain('- filesystem:write');
    expect(manifest).toContain('- filesystem:delete');
    expect(manifest.includes('resources:read')).toBe(false);
    expect(manifest).toContain('type: service');
    expect(manifest).toContain('targets: [host]');
  });
});

describe('错误码词表（禁新增码）', () => {
  it('错误面只使用在册 CONVERTER_* 三码与 BRIDGE_CANCELLED 通道码', () => {
    expect(REGISTERED_CONVERTER_ERROR_CODES).toEqual([
      'CONVERTER_INPUT_UNSUPPORTED',
      'CONVERTER_RENDER_FAILED',
      'CONVERTER_OUTPUT_TOO_LARGE',
    ]);
    for (const code of REGISTERED_CONVERTER_ERROR_CODES) {
      expect(code).toMatch(/^CONVERTER_[A-Z_]+$/);
    }
  });
});

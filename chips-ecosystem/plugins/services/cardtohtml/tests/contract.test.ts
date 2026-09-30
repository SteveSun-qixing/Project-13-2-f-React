/**
 * 契约面一致性断言：登记描述符、输入/输出 schema 与错误码词表逐项锁定
 * （事实源：04-能力契约规范 §8.3/§8.4/§8.6 与包内 contracts/）。
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { CONVERTER_ERROR_CODES } from '../src/errors.js';
import { CONTENT_CONVERTER_SERVICE_NAME } from '../src/plugin.js';
import type { CardToHtmlWarningCode } from '../src/types.js';

const packageRoot = fileURLToPath(new URL('..', import.meta.url));

function readJson(relative: string): Record<string, unknown> {
  return JSON.parse(readFileSync(`${packageRoot}${relative}`, 'utf-8')) as Record<string, unknown>;
}

describe('内容处理能力登记描述符（§8.3）', () => {
  const descriptor = readJson('contracts/descriptor.json');

  it('能力 ID 与服务名与官方登记表一致，能力 ID 恰为两段点号形式', () => {
    expect(descriptor['id']).toBe('content-converter.card-to-html');
    expect(descriptor['service']).toBe(CONTENT_CONVERTER_SERVICE_NAME);
    expect(String(descriptor['id'])).toMatch(/^content-[a-z0-9-]+\.[a-z0-9-]+$/);
    expect(String(descriptor['service'])).toMatch(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/);
  });

  it('操作、来源/目标格式与流式能力如实登记', () => {
    expect(descriptor['operations']).toEqual(['cardToHtml']);
    expect(descriptor['sourceFormats']).toEqual(['card']);
    expect(descriptor['targetFormats']).toEqual(['html']);
    expect(descriptor['streaming']).toEqual({ input: false, output: false });
    expect(descriptor['provider']).toBe('chips.service.cardtohtml');
    expect(descriptor['contractPackage']).toBe('chips.service.cardtohtml/contracts');
  });
});

describe('输入/输出 schema', () => {
  it('顶层为 object 且显式 additionalProperties: false（E4 §5 子集）', () => {
    const input = readJson('contracts/card-to-html.input.schema.json');
    const output = readJson('contracts/card-to-html.output.schema.json');
    expect(input['type']).toBe('object');
    expect(input['additionalProperties']).toBe(false);
    expect(output['type']).toBe('object');
    expect(output['additionalProperties']).toBe(false);
  });

  it('输入 schema 接受目录态与压缩态（压缩态在运行时诚实拒绝，不缩契约面）', () => {
    const input = readJson('contracts/card-to-html.input.schema.json');
    // 字段位于顶层 `properties` 下（能力契约规范 §5.2：顶层 type: object）。
    const output = (input['properties'] as Record<string, unknown>)['output'] as Record<string, unknown>;
    const packageMode = output['properties'] as Record<string, unknown>;
    const mode = packageMode['packageMode'] as Record<string, unknown>;
    expect(mode['enum']).toEqual(['directory', 'zip']);
  });

  it('输出 schema 只声明目录态，警告码枚举与类型单一事实源一致', () => {
    const output = readJson('contracts/card-to-html.output.schema.json');
    expect((output['properties'] as Record<string, unknown>)['packageMode']).toMatchObject({
      enum: ['directory'],
    });
    const warningItems = (
      (output['properties'] as Record<string, unknown>)['warnings'] as Record<string, unknown>
    )['items'] as Record<string, unknown>;
    const warningCodes = (
      (warningItems['properties'] as Record<string, unknown>)['code'] as Record<string, unknown>
    )['enum'] as string[];
    const declared: readonly CardToHtmlWarningCode[] = [
      'CONVERTER_ASSETS_SKIPPED',
      'CONVERTER_RESOURCE_MISSING',
      'CONVERTER_NODE_UNAVAILABLE',
      'CONVERTER_MANIFEST_SKIPPED',
    ];
    expect(warningCodes).toEqual([...declared]);
  });
});

describe('错误码词表（禁新增码）', () => {
  it('错误面只使用 §8.6 在册 CONVERTER_* 三码，码形合法', () => {
    const codes = Object.values(CONVERTER_ERROR_CODES);
    expect(codes).toEqual([
      'CONVERTER_INPUT_UNSUPPORTED',
      'CONVERTER_RENDER_FAILED',
      'CONVERTER_OUTPUT_TOO_LARGE',
    ]);
    for (const code of codes) {
      expect(code).toMatch(/^CONVERTER_[A-Z_]+$/);
      expect(code.startsWith('BRIDGE_')).toBe(false);
      expect(code.startsWith('FILE_')).toBe(false);
      expect(code.startsWith('RESOURCE_')).toBe(false);
      expect(code.startsWith('DOCUMENT_')).toBe(false);
    }
  });
});

describe('manifest 与包形', () => {
  const manifest = readFileSync(`${packageRoot}manifest.yaml`, 'utf-8');

  it('服务角色、host 目标、后台与健康检查声明齐备，权限最小化', () => {
    expect(manifest).toContain('id: chips.service.cardtohtml');
    expect(manifest).toContain('type: service');
    // host 目标按清单规范 §4.1 统一流式形态登记；块序列行只允许权限清单，
    // 供下方 permissionLines 做权限最小化断言。
    expect(manifest).toContain('targets: [host]');
    expect(manifest).toContain('background: true');
    expect(manifest).toContain('healthCheck:');
    const permissionLines = manifest
      .split('\n')
      .filter((line) => line.trim().startsWith('- '))
      .map((line) => line.trim().slice(2));
    expect(permissionLines).toEqual([
      'resources:read',
      'filesystem:read',
      'filesystem:write',
      'filesystem:delete',
    ]);
  });

  it('服务包不声明 UI 面（不出现 render/ui/layout/cardTypes 字段）', () => {
    expect(manifest).not.toMatch(/^ui:/m);
    expect(manifest).not.toMatch(/render\.js/m);
    expect(manifest).not.toMatch(/cardTypes:/m);
    expect(manifest).not.toMatch(/layouts:/m);
  });

  it('package.json 与 manifest 版本一致', () => {
    const pkg = readJson('package.json');
    expect(pkg['version']).toBe('0.1.0');
    expect(manifest).toContain('version: 0.1.0');
  });
});

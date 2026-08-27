/**
 * 布局文档 CSP 与 srcdoc 高度上报脚本 hash 的一致性契约测试
 *
 * 背景：布局文档 CSP 的 script-src 包含 @chips/ui EmbeddedDocumentFrame 注入的
 * 高度上报脚本的 sha256 hash（box-service 的 SRCDOC_HEIGHT_REPORT_SCRIPT_SHA256）。
 * 该 hash 与 @chips/ui 脚本内容强耦合，本测试从 @chips/ui 源码提取脚本字面量，
 * 重新拼接计算 hash，断言与 Host 常量一致——@chips/ui 脚本内容一旦变化，
 * 本测试失败并提示同步更新 Host 常量。
 */

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const boxServiceSourcePath = path.resolve(__dirname, '../../packages/box-service/src/box-service.ts');
const uiSourcePath = path.resolve(__dirname, '../../../Chips-Ui/src/components/EmbeddedDocumentFrame.tsx');

const extractHeightReportHash = async (): Promise<string> => {
  const source = await fs.readFile(boxServiceSourcePath, 'utf-8');
  const match = source.match(/const SRCDOC_HEIGHT_REPORT_SCRIPT_SHA256 = '([^']+)'/);
  expect(match, 'box-service 应导出 SRCDOC_HEIGHT_REPORT_SCRIPT_SHA256 常量').toBeTruthy();
  return match![1]!;
};

const buildScriptFromUiSource = async (): Promise<string> => {
  const source = await fs.readFile(uiSourcePath, 'utf-8');

  const typeMatch = source.match(/const HEIGHT_REPORT_TYPE = "([^"]+)"/);
  expect(typeMatch, 'EmbeddedDocumentFrame 应定义 HEIGHT_REPORT_TYPE 常量').toBeTruthy();
  const heightReportType = typeMatch![1]!;
  expect(heightReportType).toBe('chips.embedded-frame:height');

  // 提取 buildHeightReporterScript 内的 script 数组字面量
  const scriptMatch = source.match(/const script = \[([\s\S]*?)\n  \]\.join/);
  expect(scriptMatch, 'EmbeddedDocumentFrame 应包含 buildHeightReporterScript 的 script 数组').toBeTruthy();

  const items: string[] = [];
  for (const match of scriptMatch![1]!.matchAll(/"((?:[^"\\]|\\.)*)"/g)) {
    items.push(JSON.parse(`"${match[1]}"`) as string);
  }

  let script = items.join('');
  // 源码中 `{ type: '" + HEIGHT_REPORT_TYPE + "'` 是运行时变量拼接：
  // 提取后的字面量中 type 值位置为空，需插入实际常量值
  const fixed = script.replace(
    "postMessage({ type: '', height: height }",
    `postMessage({ type: '${heightReportType}', height: height }`,
  );
  expect(fixed, '拼接结果应包含高度上报消息类型').toContain(heightReportType);
  return fixed;
};

describe('布局文档 CSP 高度上报脚本 hash 契约', () => {
  it('Host CSP hash 与 @chips/ui 实际注入脚本内容一致', async () => {
    const hostHash = await extractHeightReportHash();
    const scriptContent = await buildScriptFromUiSource();

    const computedHash = `sha256-${crypto.createHash('sha256').update(scriptContent, 'utf8').digest('base64')}`;
    expect(computedHash, `@chips/ui 高度上报脚本内容变化，需同步更新 Host SRCDOC_HEIGHT_REPORT_SCRIPT_SHA256（当前 ${hostHash}，实际 ${computedHash}）`).toBe(hostHash);
  });

  it('布局文档与布局编辑器文档 CSP 均引用该 hash 常量', async () => {
    const source = await fs.readFile(boxServiceSourcePath, 'utf-8');
    const cspLines = source
      .split('\n')
      .filter((line) => line.includes('Content-Security-Policy') && line.includes('script-src'));
    expect(cspLines.length).toBeGreaterThanOrEqual(2);

    for (const line of cspLines) {
      expect(line).toContain('${SRCDOC_HEIGHT_REPORT_SCRIPT_SHA256}');
      const scriptSrc = line.match(/script-src ([^;]+);/)?.[1] ?? '';
      expect(scriptSrc).not.toContain("'unsafe-inline'");
    }
  });
});
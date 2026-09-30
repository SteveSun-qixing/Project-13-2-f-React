/**
 * 转换计划纯函数测试：旧 planner 算法语义逐字迁移的全分支钉死
 * （请求归一 / 目标格式校验 / 包形态归一 / 中间 HTML 选项解析 / 链路规划与暂存路径派生）。
 */

import { describe, expect, it } from 'vitest';

import { isChipsError } from '@chips/sdk';

import { normalizeRequest, planConversion, resolveHtmlSource } from '../src/planner.js';
import type { IFileConvertRequest, INormalizedConvertRequest } from '../src/types.js';

const baseRequest: IFileConvertRequest = {
  source: { type: 'card', path: '/workspace/demo.card' },
  target: { type: 'html' },
  output: { path: '/workspace/out/demo.html' },
};

function catchOf(run: () => unknown): unknown {
  try {
    run();
    return undefined;
  } catch (error) {
    return error;
  }
}

function reasonOf(error: unknown): unknown {
  return isChipsError(error) ? (error.details as { reason?: string } | undefined)?.reason : undefined;
}

function reasonWhenRun(run: () => unknown): unknown {
  return reasonOf(catchOf(run));
}

describe('normalizeRequest（请求归一与校验）', () => {
  it('非对象与缺失 source/target/output 逐项拒绝', () => {
    expect(reasonWhenRun(() => normalizeRequest(undefined))).toBe('input-not-object');
    expect(
      reasonWhenRun(() => normalizeRequest({ target: { type: 'pdf' }, output: { path: '/o' } }))
    ).toBe('source-required');
    expect(
      reasonWhenRun(() => normalizeRequest({ source: { type: 'card', path: '/a' }, output: { path: '/o' } }))
    ).toBe('target-required');
    expect(
      reasonWhenRun(() => normalizeRequest({ source: { type: 'card', path: '/a' }, target: { type: 'pdf' } }))
    ).toBe('output-required');
  });

  it('来源与目标类型枚举校验', () => {
    expect(
      reasonWhenRun(() => normalizeRequest({ ...baseRequest, source: { type: 'box', path: '/a' } }))
    ).toBe('source-type-unsupported');
    expect(
      reasonWhenRun(() => normalizeRequest({ ...baseRequest, target: { type: 'docx' } }))
    ).toBe('target-type-unsupported');
  });

  it('来源与输出路径必填且按 trim 归一', () => {
    expect(
      reasonWhenRun(() => normalizeRequest({ ...baseRequest, source: { type: 'card', path: '   ' } }))
    ).toBe('source-path-required');
    expect(reasonWhenRun(() => normalizeRequest({ ...baseRequest, output: { path: '' } }))).toBe(
      'output-path-required'
    );
    const normalized = normalizeRequest({
      ...baseRequest,
      source: { type: 'card', path: ' /workspace/demo.card ' },
      output: { path: ' /workspace/out/demo.html ' },
    });
    expect(normalized.source.path).toBe('/workspace/demo.card');
    expect(normalized.output.path).toBe('/workspace/out/demo.html');
  });

  it('html → html 链路拒绝', () => {
    expect(
      reasonWhenRun(() =>
        normalizeRequest({
          source: { type: 'html', path: '/a' },
          target: { type: 'html' },
          output: { path: '/b' },
        })
      )
    ).toBe('html-to-html-unsupported');
  });

  it('overwrite 归一：缺省 false、真值保留', () => {
    expect(normalizeRequest(baseRequest).output.overwrite).toBe(false);
    expect(normalizeRequest({ ...baseRequest, output: { path: '/o', overwrite: true } }).output.overwrite).toBe(true);
    expect(
      normalizeRequest({
        ...baseRequest,
        output: { path: '/o', overwrite: 'yes' } as unknown as IFileConvertRequest['output'],
      }).output.overwrite
    ).toBe(false);  });

  it('包形态归一：pdf/image 目标强制 directory；html 目标缺省 zip、显式值保留', () => {
    expect(normalizeRequest({ ...baseRequest, target: { type: 'pdf' } }).options.html.packageMode).toBe('directory');
    expect(normalizeRequest({ ...baseRequest, target: { type: 'image' } }).options.html.packageMode).toBe('directory');
    expect(normalizeRequest(baseRequest).options.html.packageMode).toBe('zip');
    expect(
      normalizeRequest({ ...baseRequest, options: { html: { packageMode: 'directory' } } }).options.html.packageMode
    ).toBe('directory');
  });

  it('非法包形态拒绝（叶面枚举在编排层前置校验）', () => {
    expect(
      reasonWhenRun(() => normalizeRequest({ ...baseRequest, options: { html: { packageMode: 'rar' } } }))
    ).toBe('package-mode-unsupported');
  });

  it('html 目标显式 includeAssets=false 在归一结果中保留', () => {
    const normalized = normalizeRequest({ ...baseRequest, options: { html: { includeAssets: false } } });
    expect(normalized.options.html.includeAssets).toBe(false);
  });
});

describe('resolveHtmlSource（HTML 来源形态解析）', () => {
  it('文件形态：目录取父目录、入口取末段', () => {
    expect(resolveHtmlSource('/workspace/site/index.html', true)).toEqual({
      htmlDir: '/workspace/site',
      entryFile: 'index.html',
    });
    expect(resolveHtmlSource('C:\\site\\page.htm', true)).toEqual({ htmlDir: 'C:\\site', entryFile: 'page.htm' });
  });

  it('目录形态：整目录即来源、无入口覆写', () => {
    expect(resolveHtmlSource('/workspace/site', false)).toEqual({ htmlDir: '/workspace/site' });
  });
});

describe('planConversion（链路规划）', () => {
  it('card → html：单步规划、包形态随请求、产物腿带暂存与终路径', () => {
    const plan = planConversion(
      normalizeRequest({
        ...baseRequest,
        output: { path: '/workspace/out/demo.html', overwrite: true },
        options: { html: { includeAssets: false }, pdf: { pageSize: 'A3' } },
      }),
      undefined
    );
    expect(plan.steps).toHaveLength(1);
    const step = plan.steps[0];
    expect(step?.kind).toBe('card-to-html');
    expect(step?.capability).toBe('content-converter.card-to-html');
    expect(step?.service).toBe('content-converter');
    expect(step?.operation).toBe('cardToHtml');
    expect(step?.stage).toBe('render-html');
    expect(step?.outputKind).toBe('html-zip');
    expect(step?.publishArtifact).toBe(true);
    if (step?.kind !== 'card-to-html') throw new TypeError('unreachable');
    expect(step.finalOutputPath).toBe('/workspace/out/demo.html');
    expect(step.input.source).toBe('/workspace/demo.card');
    expect(step.input.output.packageMode).toBe('zip');
    expect(step.input.output.overwrite).toBe(true);
    // 暂存终路径：输出同级 `.chips-file-conversion-output-<uuid>/final/<basename>`
    expect(step.input.output.path.startsWith('/workspace/out/.chips-file-conversion-output-')).toBe(true);
    expect(step.input.output.path.endsWith('/final/demo.html')).toBe(true);
    expect(plan.stagedFinalOutputPath).toBe(step.input.output.path);
    expect(plan.stagedFinalOutputDir?.endsWith('/final')).toBe(true);
    // options：显式 includeAssets=false 保留（compactRecord 只滤 undefined）
    expect(step.input.options).toEqual({ includeAssets: false });
    expect(plan.stagedBackupOutputDir).toBe(`${plan.temporaryHtmlRoot}/backup`);
    expect(plan.stagedBackupOutputPath).toBe(`${plan.temporaryHtmlRoot}/backup/demo.html`);
  });

  it('card → html 目录态：outputKind 与 options 缺省 undefined', () => {
    const plan = planConversion(
      normalizeRequest({ ...baseRequest, options: { html: { packageMode: 'directory' } } }),
      undefined
    );
    const step = plan.steps[0];
    expect(step?.outputKind).toBe('html-directory');
    if (step?.kind !== 'card-to-html') throw new TypeError('unreachable');
    expect(step.input.options).toBeUndefined();
  });

  it('card → pdf：两步链路，中间 HTML 强制目录态且资源/清单开启，PDF 腿产物落暂存', () => {
    const plan = planConversion(
      normalizeRequest({
        source: { type: 'card', path: '/workspace/demo.card' },
        target: { type: 'pdf' },
        output: { path: '/workspace/out/demo.pdf' },
        options: { pdf: { pageSize: 'A4', landscape: true, printBackground: false, marginMm: { top: 12 } } },
      }),
      undefined
    );
    expect(plan.steps).toHaveLength(2);
    const htmlStep = plan.steps[0];
    const pdfStep = plan.steps[1];
    expect(htmlStep?.kind).toBe('card-to-html');
    expect(htmlStep?.publishArtifact).toBe(false);
    if (htmlStep?.kind !== 'card-to-html') throw new TypeError('unreachable');
    expect(htmlStep.input.output.packageMode).toBe('directory');
    expect(htmlStep.input.output.overwrite).toBe(true);
    expect(htmlStep.input.output.path).toBe(plan.temporaryHtmlDir);
    expect(htmlStep.input.options).toEqual({ includeAssets: true, includeManifest: true });
    expect(htmlStep.input.output.path.startsWith('/workspace/out/.chips-file-conversion-')).toBe(true);
    expect(htmlStep.input.output.path.endsWith('/html')).toBe(true);

    expect(pdfStep?.kind).toBe('html-to-pdf');
    expect(pdfStep?.capability).toBe('content-converter.html-to-pdf');
    expect(pdfStep?.service).toBe('content-html-to-pdf');
    expect(pdfStep?.operation).toBe('htmlToPdf');
    expect(pdfStep?.stage).toBe('render-pdf');
    expect(pdfStep?.outputKind).toBe('pdf');
    expect(pdfStep?.publishArtifact).toBe(true);
    if (pdfStep?.kind !== 'html-to-pdf') throw new TypeError('unreachable');
    expect(pdfStep.htmlPackage).toEqual({ htmlDir: plan.temporaryHtmlDir });
    expect(pdfStep.outputPath).toBe(plan.stagedFinalOutputPath);
    expect(pdfStep.finalOutputPath).toBe('/workspace/out/demo.pdf');
    expect(pdfStep.options).toEqual({
      pageSize: 'A4',
      landscape: true,
      printBackground: false,
      margins: { top: 12 },
    });
    expect(plan.stagedFinalOutputDir).toBe(`${plan.temporaryHtmlRoot}/final`);
    expect(plan.stagedBackupOutputDir).toBe(`${plan.temporaryHtmlRoot}/backup`);
    expect(plan.stagedBackupOutputPath).toBe(`${plan.temporaryHtmlRoot}/backup/demo.pdf`);
  });

  it('card → image：两步链路走 html-to-image 腿且图片选项随请求', () => {
    const plan = planConversion(
      normalizeRequest({
        source: { type: 'card', path: '/workspace/demo.card' },
        target: { type: 'image' },
        output: { path: '/workspace/out/demo.png' },
        options: { image: { format: 'jpeg', width: 800, scaleFactor: 2, background: 'white' } },
      }),
      undefined
    );
    const imageStep = plan.steps[1];
    expect(imageStep?.kind).toBe('html-to-image');
    expect(imageStep?.capability).toBe('content-converter.html-to-image');
    expect(imageStep?.service).toBe('content-html-to-image');
    expect(imageStep?.operation).toBe('htmlToImage');
    expect(imageStep?.stage).toBe('render-image');
    if (imageStep?.kind !== 'html-to-image') throw new TypeError('unreachable');
    expect(imageStep.options).toEqual({ format: 'jpeg', width: 800, scaleFactor: 2, background: 'white' });
  });

  it('html → pdf：单步规划、来源目录与入口进入计划、暂存根为输出根前缀', () => {
    const plan = planConversion(
      normalizeRequest({
        source: { type: 'html', path: '/workspace/site' },
        target: { type: 'pdf' },
        output: { path: '/workspace/out/site.pdf' },
        options: { pdf: { pageSize: 'Legal' } },
      }),
      { htmlDir: '/workspace/site' }
    );
    expect(plan.steps).toHaveLength(1);
    const step = plan.steps[0];
    expect(step?.kind).toBe('html-to-pdf');
    if (step?.kind !== 'html-to-pdf') throw new TypeError('unreachable');
    expect(step.htmlPackage).toEqual({ htmlDir: '/workspace/site' });
    expect(step.outputPath).toBe(plan.stagedFinalOutputPath);
    expect(step.finalOutputPath).toBe('/workspace/out/site.pdf');
    expect(step.options).toEqual({ pageSize: 'Legal' });
    expect(plan.temporaryHtmlRoot?.startsWith('/workspace/out/.chips-file-conversion-output-')).toBe(true);
  });

  it('html → pdf 文件来源：入口文件进入计划', () => {
    const plan = planConversion(
      normalizeRequest({
        source: { type: 'html', path: '/workspace/site/page.html' },
        target: { type: 'pdf' },
        output: { path: '/workspace/out/page.pdf' },
      }),
      resolveHtmlSource('/workspace/site/page.html', true)
    );
    const step = plan.steps[0];
    if (step?.kind !== 'html-to-pdf') throw new TypeError('unreachable');
    expect(step.htmlPackage).toEqual({ htmlDir: '/workspace/site', entryFile: 'page.html' });
  });

  it('html → image：单步规划', () => {
    const plan = planConversion(
      normalizeRequest({
        source: { type: 'html', path: '/workspace/site' },
        target: { type: 'image' },
        output: { path: '/workspace/out/site.png' },
        options: { image: { format: 'webp' } },
      }),
      { htmlDir: '/workspace/site' }
    );
    const step = plan.steps[0];
    expect(step?.kind).toBe('html-to-image');
    if (step?.kind !== 'html-to-image') throw new TypeError('unreachable');
    expect(step.options).toEqual({ format: 'webp' });
    expect(step.publishArtifact).toBe(true);
  });

  it('html 链路缺归一来源时拒绝（不变量守卫）', () => {
    const request: INormalizedConvertRequest = normalizeRequest({
      source: { type: 'html', path: '/workspace/site' },
      target: { type: 'pdf' },
      output: { path: '/workspace/out/site.pdf' },
    });
    expect(reasonWhenRun(() => planConversion(request, undefined))).toBe('html-source-required');
  });
});

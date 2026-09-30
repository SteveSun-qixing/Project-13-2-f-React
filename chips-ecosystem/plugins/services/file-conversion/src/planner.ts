/**
 * 转换计划纯函数：旧 planner（Chips-FileConversion-Plugin/src/planner.ts）算法语义
 * 逐字迁移——路径解析、请求归一、目标格式校验、包形态归一、中间 HTML 选项解析、
 * 链路规划与暂存路径派生。零平台依赖、零 IO。
 *
 * 相对旧面的两处登记适配（详见 W4 迁移日志）：
 * 1. buildCardToHtmlOptions 不再透传 locale / themeId（主题与多语言系统随 task030 废弃）；
 * 2. buildHtmlToPdfOptions 的 marginMm 字段按 content-converter.html-to-pdf 提供方契约
 *    改名为 margins（字段语义与缺省口径不变）。
 * 旧面错误码映射：CONVERTER_INPUT_INVALID → 在册码 CONVERTER_INPUT_UNSUPPORTED +
 * details.reason（cardtohtml 判例）；旧 CONVERTER_PIPELINE_NOT_FOUND 终局守卫同口径。
 */

import { inputUnsupported, INPUT_UNSUPPORTED_REASONS } from './errors.js';
import { basename, dirname, joinPath } from './paths.js';
import { STAGING_HTML_ROOT_PREFIX, STAGING_OUTPUT_ROOT_PREFIX } from './descriptor.js';
import type {
  FileTargetType,
  HtmlPackageMode,
  IConversionPlan,
  IFileConvertRequest,
  INormalizedConvertRequest,
  INormalizedHtmlSource,
  IPlannedCardToHtmlStep,
  IPlannedHtmlToPdfStep,
  IPlannedHtmlToImageStep,
  IPlannedStep,
  IPdfRenderOptions,
  IImageRenderOptions,
} from './types.js';

const CARD_TO_HTML_SERVICE = 'content-converter';
const HTML_TO_PDF_SERVICE = 'content-html-to-pdf';
const HTML_TO_IMAGE_SERVICE = 'content-html-to-image';

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const createUuid = (): string => {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return `fallback-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
};

const normalizePackageMode = (
  rawPackageMode: unknown,
  targetType: FileTargetType
): HtmlPackageMode => {
  if (targetType === 'pdf' || targetType === 'image') {
    return 'directory';
  }
  return rawPackageMode === 'zip' || rawPackageMode === 'directory' ? rawPackageMode : 'zip';
};

const resolveIntermediateHtmlOptions = (
  targetType: FileTargetType,
  htmlOptions: NonNullable<IFileConvertRequest['options']>['html']
): IIntermediateHtmlOptions => {
  if (targetType === 'pdf' || targetType === 'image') {
    return {
      includeAssets: true,
      includeManifest: true,
    };
  }

  return {
    ...(htmlOptions?.includeAssets !== undefined ? { includeAssets: htmlOptions.includeAssets } : {}),
    ...(htmlOptions?.includeManifest !== undefined ? { includeManifest: htmlOptions.includeManifest } : {}),
  };
};

interface IIntermediateHtmlOptions {
  readonly includeAssets?: boolean;
  readonly includeManifest?: boolean;
}

const compactRecord = <T extends Record<string, unknown>>(record: T): Partial<T> => {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== undefined)
  ) as Partial<T>;
};

const buildCardToHtmlOptions = (
  htmlOptions: IIntermediateHtmlOptions
): Record<string, unknown> | undefined => {
  const options = compactRecord({
    includeAssets: htmlOptions.includeAssets,
    includeManifest: htmlOptions.includeManifest,
  });

  return Object.keys(options).length > 0 ? options : undefined;
};

const buildHtmlToPdfOptions = (request: INormalizedConvertRequest): IPdfRenderOptions | undefined => {
  const pdf = request.options.pdf;
  if (!pdf) {
    return undefined;
  }
  const options = compactRecord({
    pageSize: pdf.pageSize,
    landscape: pdf.landscape,
    printBackground: pdf.printBackground,
    margins: pdf.marginMm,
  });

  return Object.keys(options).length > 0 ? options : undefined;
};

const buildHtmlToImageOptions = (request: INormalizedConvertRequest): IImageRenderOptions | undefined => {  const image = request.options.image;
  if (!image) {
    return undefined;
  }
  const options = compactRecord({
    format: image.format,
    width: image.width,
    height: image.height,
    scaleFactor: image.scaleFactor,
    background: image.background,
  });

  return Object.keys(options).length > 0 ? options : undefined;
};

/** 请求归一与校验（旧 normalizeRequest 语义；形状守卫按运行时入口收窄）。 */
export const normalizeRequest = (request: unknown): INormalizedConvertRequest => {
  if (!isRecord(request)) {
    throw inputUnsupported('转换请求必须为对象。', INPUT_UNSUPPORTED_REASONS.inputNotObject);
  }
  if (!isRecord(request.source)) {
    throw inputUnsupported('转换请求缺少 source 对象。', INPUT_UNSUPPORTED_REASONS.sourceRequired);
  }
  if (!isRecord(request.target)) {
    throw inputUnsupported('转换请求缺少 target 对象。', INPUT_UNSUPPORTED_REASONS.targetRequired);
  }
  if (!isRecord(request.output)) {
    throw inputUnsupported('转换请求缺少 output 对象。', INPUT_UNSUPPORTED_REASONS.outputRequired);
  }

  const sourceType = request.source.type as IFileConvertRequest['source']['type'];
  const targetType = request.target.type as IFileConvertRequest['target']['type'];
  const sourcePath = typeof request.source.path === 'string' ? request.source.path.trim() : '';
  const outputPath = typeof request.output.path === 'string' ? request.output.path.trim() : '';

  if (sourceType !== 'card' && sourceType !== 'html') {
    throw inputUnsupported(
      '转换请求 source.type 只接受 card 或 html。',
      INPUT_UNSUPPORTED_REASONS.sourceTypeUnsupported
    );
  }
  if (targetType !== 'html' && targetType !== 'pdf' && targetType !== 'image') {
    throw inputUnsupported(
      '转换请求 target.type 只接受 html、pdf 或 image。',
      INPUT_UNSUPPORTED_REASONS.targetTypeUnsupported
    );
  }
  if (sourcePath.length === 0) {
    throw inputUnsupported(
      '转换请求 source.path 为必填路径。',
      INPUT_UNSUPPORTED_REASONS.sourcePathRequired
    );
  }
  if (outputPath.length === 0) {
    throw inputUnsupported(
      '转换请求 output.path 为必填路径。',
      INPUT_UNSUPPORTED_REASONS.outputPathRequired
    );
  }
  if (sourceType === 'html' && targetType === 'html') {
    throw inputUnsupported(
      'html → html 不是支持的转换链路。',
      INPUT_UNSUPPORTED_REASONS.htmlToHtmlUnsupported
    );
  }

  const rawOptions = isRecord(request.options) ? request.options : {};
  const rawHtmlOptions = isRecord(rawOptions.html) ? rawOptions.html : {};
  const rawPackageMode = rawHtmlOptions.packageMode;
  if (rawPackageMode !== undefined && rawPackageMode !== 'zip' && rawPackageMode !== 'directory') {
    throw inputUnsupported(
      '转换请求 options.html.packageMode 只接受 zip 或 directory。',
      INPUT_UNSUPPORTED_REASONS.packageModeUnsupported
    );
  }

  const pdf = isRecord(rawOptions.pdf)
    ? (rawOptions.pdf as INormalizedConvertRequest['options']['pdf'])
    : undefined;
  const image = isRecord(rawOptions.image)
    ? (rawOptions.image as INormalizedConvertRequest['options']['image'])
    : undefined;

  return {
    source: {
      type: sourceType,
      path: sourcePath,
    },
    target: {
      type: targetType,
    },
    output: {
      path: outputPath,
      overwrite: request.output.overwrite === true,
    },
    options: {
      html: {
        ...(rawHtmlOptions as NonNullable<IFileConvertRequest['options']>['html']),
        packageMode: normalizePackageMode(rawPackageMode, targetType),
      },
      ...(pdf !== undefined ? { pdf } : {}),
      ...(image !== undefined ? { image } : {}),
    },
  };
};

/** HTML 来源形态解析（旧 resolveHtmlSource 逐字迁移）。 */
export const resolveHtmlSource = (sourcePath: string, isFile: boolean): INormalizedHtmlSource => {
  if (!isFile) {
    return { htmlDir: sourcePath };
  }

  return {
    htmlDir: dirname(sourcePath),
    entryFile: basename(sourcePath),
  };
};

const createTemporaryHtmlRoot = (outputPath: string): string => {
  return joinPath(dirname(outputPath), `${STAGING_HTML_ROOT_PREFIX}${createUuid()}`);
};

const createTemporaryOutputRoot = (outputPath: string): string => {
  return joinPath(dirname(outputPath), `${STAGING_OUTPUT_ROOT_PREFIX}${createUuid()}`);
};

const getStagedBackupOutputPath = (temporaryRoot: string, outputPath: string): string => {
  return joinPath(temporaryRoot, 'backup', basename(outputPath));
};

const getStagedFinalOutputPath = (temporaryRoot: string, outputPath: string): string => {
  return joinPath(temporaryRoot, 'final', basename(outputPath));
};

/** 链路规划（旧 planConversion 分支结构逐字迁移；暂存路径族字段名一致）。 */
export const planConversion = (
  request: INormalizedConvertRequest,
  htmlSource: INormalizedHtmlSource | undefined
): IConversionPlan => {
  const steps: IPlannedStep[] = [];
  const htmlOptions = resolveIntermediateHtmlOptions(request.target.type, request.options.html);
  const cardToHtmlOptions = buildCardToHtmlOptions(htmlOptions);
  const htmlToPdfOptions = buildHtmlToPdfOptions(request);
  const htmlToImageOptions = buildHtmlToImageOptions(request);
  const targetIsFinalArtifact = request.target.type === 'html' || request.source.type === 'html';
  const temporaryOutputRoot = targetIsFinalArtifact
    ? createTemporaryOutputRoot(request.output.path)
    : undefined;
  const stagedBackupOutputDir = temporaryOutputRoot
    ? joinPath(temporaryOutputRoot, 'backup')
    : undefined;
  const stagedBackupOutputPath = temporaryOutputRoot
    ? getStagedBackupOutputPath(temporaryOutputRoot, request.output.path)
    : undefined;
  const stagedOutputDir = temporaryOutputRoot ? joinPath(temporaryOutputRoot, 'final') : undefined;
  const stagedOutputPath = temporaryOutputRoot
    ? getStagedFinalOutputPath(temporaryOutputRoot, request.output.path)
    : undefined;

  if (request.source.type === 'card' && request.target.type === 'html') {
    const cardToHtmlStep: IPlannedCardToHtmlStep = {
      kind: 'card-to-html',
      capability: 'content-converter.card-to-html',
      service: CARD_TO_HTML_SERVICE,
      operation: 'cardToHtml',
      stage: 'render-html',
      outputKind: request.options.html.packageMode === 'directory' ? 'html-directory' : 'html-zip',
      publishArtifact: true,
      finalOutputPath: request.output.path,
      input: {
        source: request.source.path,
        output: {
          path: stagedOutputPath ?? request.output.path,
          packageMode: request.options.html.packageMode,
          overwrite: request.output.overwrite,
        },
        ...(cardToHtmlOptions ? { options: cardToHtmlOptions } : {}),
      },
    };
    steps.push(cardToHtmlStep);
    return {
      request,
      steps,
      ...(temporaryOutputRoot !== undefined ? { temporaryHtmlRoot: temporaryOutputRoot } : {}),
      ...(stagedBackupOutputDir !== undefined ? { stagedBackupOutputDir } : {}),
      ...(stagedBackupOutputPath !== undefined ? { stagedBackupOutputPath } : {}),
      ...(stagedOutputDir !== undefined ? { stagedFinalOutputDir: stagedOutputDir } : {}),
      ...(stagedOutputPath !== undefined ? { stagedFinalOutputPath: stagedOutputPath } : {}),
    };
  }

  if (request.source.type === 'html') {
    if (!htmlSource) {
      throw inputUnsupported(
        'html 链路规划需要归一化 HTML 来源。',
        INPUT_UNSUPPORTED_REASONS.htmlSourceRequired
      );
    }

    if (request.target.type === 'pdf') {
      const pdfStep: IPlannedHtmlToPdfStep = {
        kind: 'html-to-pdf',
        capability: 'content-converter.html-to-pdf',
        service: HTML_TO_PDF_SERVICE,
        operation: 'htmlToPdf',
        stage: 'render-pdf',
        outputKind: 'pdf',
        publishArtifact: true,
        htmlPackage: {
          htmlDir: htmlSource.htmlDir,
          ...(htmlSource.entryFile !== undefined ? { entryFile: htmlSource.entryFile } : {}),
        },
        outputPath: stagedOutputPath ?? request.output.path,
        finalOutputPath: request.output.path,
        ...(htmlToPdfOptions ? { options: htmlToPdfOptions } : {}),
      };
      steps.push(pdfStep);
      return {
        request,
        steps,
        ...(temporaryOutputRoot !== undefined ? { temporaryHtmlRoot: temporaryOutputRoot } : {}),
        ...(stagedBackupOutputDir !== undefined ? { stagedBackupOutputDir } : {}),
        ...(stagedBackupOutputPath !== undefined ? { stagedBackupOutputPath } : {}),
        ...(stagedOutputDir !== undefined ? { stagedFinalOutputDir: stagedOutputDir } : {}),
        ...(stagedOutputPath !== undefined ? { stagedFinalOutputPath: stagedOutputPath } : {}),
      };
    }

    if (request.target.type === 'image') {
      const imageStep: IPlannedHtmlToImageStep = {
        kind: 'html-to-image',
        capability: 'content-converter.html-to-image',
        service: HTML_TO_IMAGE_SERVICE,
        operation: 'htmlToImage',
        stage: 'render-image',
        outputKind: 'image',
        publishArtifact: true,
        htmlPackage: {
          htmlDir: htmlSource.htmlDir,
          ...(htmlSource.entryFile !== undefined ? { entryFile: htmlSource.entryFile } : {}),
        },
        outputPath: stagedOutputPath ?? request.output.path,
        finalOutputPath: request.output.path,
        ...(htmlToImageOptions ? { options: htmlToImageOptions } : {}),
      };
      steps.push(imageStep);
      return {
        request,
        steps,
        ...(temporaryOutputRoot !== undefined ? { temporaryHtmlRoot: temporaryOutputRoot } : {}),
        ...(stagedBackupOutputDir !== undefined ? { stagedBackupOutputDir } : {}),
        ...(stagedBackupOutputPath !== undefined ? { stagedBackupOutputPath } : {}),
        ...(stagedOutputDir !== undefined ? { stagedFinalOutputDir: stagedOutputDir } : {}),
        ...(stagedOutputPath !== undefined ? { stagedFinalOutputPath: stagedOutputPath } : {}),
      };
    }
  }

  const temporaryHtmlRoot = createTemporaryHtmlRoot(request.output.path);
  const temporaryHtmlDir = joinPath(temporaryHtmlRoot, 'html');
  const stagedHtmlBackupOutputDir = joinPath(temporaryHtmlRoot, 'backup');
  const stagedHtmlBackupOutputPath = getStagedBackupOutputPath(temporaryHtmlRoot, request.output.path);
  const stagedFinalOutputDir = joinPath(temporaryHtmlRoot, 'final');
  const stagedFinalOutputPath = getStagedFinalOutputPath(temporaryHtmlRoot, request.output.path);

  const intermediateHtmlStep: IPlannedCardToHtmlStep = {
    kind: 'card-to-html',
    capability: 'content-converter.card-to-html',
    service: CARD_TO_HTML_SERVICE,
    operation: 'cardToHtml',
    stage: 'render-html',
    outputKind: 'html-directory',
    publishArtifact: false,
    finalOutputPath: request.output.path,
    input: {
      source: request.source.path,
      output: {
        path: temporaryHtmlDir,
        packageMode: 'directory',
        overwrite: true,
      },
      ...(cardToHtmlOptions ? { options: cardToHtmlOptions } : {}),
    },
  };
  steps.push(intermediateHtmlStep);

  if (request.target.type === 'pdf') {
    const pdfStep: IPlannedHtmlToPdfStep = {
      kind: 'html-to-pdf',
      capability: 'content-converter.html-to-pdf',
      service: HTML_TO_PDF_SERVICE,
      operation: 'htmlToPdf',
      stage: 'render-pdf',
      outputKind: 'pdf',
      publishArtifact: true,
      htmlPackage: { htmlDir: temporaryHtmlDir },
      outputPath: stagedFinalOutputPath,
      finalOutputPath: request.output.path,
      ...(htmlToPdfOptions ? { options: htmlToPdfOptions } : {}),
    };
    steps.push(pdfStep);
    return {
      request,
      steps,
      temporaryHtmlDir,
      temporaryHtmlRoot,
      stagedBackupOutputDir: stagedHtmlBackupOutputDir,
      stagedBackupOutputPath: stagedHtmlBackupOutputPath,
      stagedFinalOutputDir,
      stagedFinalOutputPath,
    };
  }

  if (request.target.type === 'image') {
    const imageStep: IPlannedHtmlToImageStep = {
      kind: 'html-to-image',
      capability: 'content-converter.html-to-image',
      service: HTML_TO_IMAGE_SERVICE,
      operation: 'htmlToImage',
      stage: 'render-image',
      outputKind: 'image',
      publishArtifact: true,
      htmlPackage: { htmlDir: temporaryHtmlDir },
      outputPath: stagedFinalOutputPath,
      finalOutputPath: request.output.path,
      ...(htmlToImageOptions ? { options: htmlToImageOptions } : {}),
    };
    steps.push(imageStep);
    return {
      request,
      steps,
      temporaryHtmlDir,
      temporaryHtmlRoot,
      stagedBackupOutputDir: stagedHtmlBackupOutputDir,
      stagedBackupOutputPath: stagedHtmlBackupOutputPath,
      stagedFinalOutputDir,
      stagedFinalOutputPath,
    };
  }

  throw inputUnsupported('没有匹配该转换请求的链路。', INPUT_UNSUPPORTED_REASONS.pipelineNotFound, {
    sourceType: request.source.type,
    targetType: request.target.type,
  });
};

/** 计划回执的链路腿视图（结果回执 pipeline 面数据源）。 */
export const toPipelineLeg = (step: IPlannedStep): {
  capability: string;
  service: string;
  operation: string;
} => {
  return { capability: step.capability, service: step.service, operation: step.operation };
};

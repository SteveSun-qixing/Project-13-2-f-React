/**
 * 转换编排执行器：按计划回执逐腿编排兄弟服务。
 *
 * 服务互调正式面：兄弟服务端口由 `ctx.inject` 注入（manifest dependencies 静态声明
 * 提供方插件，06-服务插件开发指南 §4.1），本模块不 import 兄弟插件任何内部模块。
 * 链路：取消检查 → 存在性预检 → 暂存区就绪 → 逐腿执行（card-to-html 路径世界 /
 * html 渲染腿读包装配纯内存输入）→ 产物存在性复核 → 提交（overwrite 先备份、
 * 失败回滚，旧 commitStagedFinalOutput 语义）→ finally 尽力清理暂存根。
 * 错误面：在册 CONVERTER_* 三码 + 通道码 BRIDGE_CANCELLED；提供方与平台 ChipsError
 * 原样透传（直连消费方按原码分支）；非 ChipsError 归一为 CONVERTER_RENDER_FAILED。
 * 取消面：同族 IConverterCallContext.signal（安全点检查 + 透传提供方）；
 * 旧 job 进度/轮询面在新 IServiceContext 无对应成员（缺口如实登记，见 W4 迁移日志）。
 */

import type { IFileConversionDependencies, IFileConversionService } from './types.js';
import type {
  IConversionPlan,
  IConverterCallContext,
  IFileConvertArtifact,
  IFileConvertResult,
  IFileConvertWarning,
  IFilePort,
  IPlannedCardToHtmlStep,
  IPlannedHtmlToPdfStep,
  IPlannedHtmlToImageStep,
  IPlannedStep,
  ISiblingPorts,
  INormalizedConvertRequest,
} from './types.js';
import { basename } from './paths.js';
import { normalizeRequest, planConversion, toPipelineLeg } from './planner.js';
import { assertSourceExists, readHtmlPackage, resolveHtmlSourceShape } from './ports.js';
import {
  cancelled,
  inputUnsupported,
  isChipsErrorLike,
  INPUT_UNSUPPORTED_REASONS,
  RENDER_FAILED_REASONS,
  renderFailed,
} from './errors.js';

const OUTPUT_CAPABILITY = 'content-file-conversion';

const throwIfCancelled = (signal: AbortSignal | undefined): void => {
  if (signal?.aborted) {
    throw cancelled('文件转换调用已被取消。', { capability: OUTPUT_CAPABILITY });
  }
};

/** 目标父目录（与旧算法分隔符探测口径一致）。 */
const parentOf = (outputPath: string): string => {
  const trimmed = outputPath.replace(/[\\/]+$/, '');
  const index = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'));
  if (index < 0) {
    return '.';
  }
  return index === 0 ? trimmed.slice(0, 1) : trimmed.slice(0, index);
};

const isFileSystemRoot = (outputPath: string): boolean => {
  return outputPath === '/' || /^[A-Za-z]:[\\/]?$/.test(outputPath);
};

/** 输出可写预检（旧 assertFinalOutputWritable 语义；file:stat 缺位以父目录列举收口）。 */
const assertFinalOutputWritable = async (
  file: IFilePort,
  outputPath: string,
  overwrite: boolean
): Promise<void> => {
  if (isFileSystemRoot(outputPath)) {
    throw inputUnsupported('输出路径不能为文件系统根。', INPUT_UNSUPPORTED_REASONS.outputPathRoot, {
      outputPath,
    });
  }
  if (overwrite) {
    return;
  }
  let parentEntries: readonly string[];
  try {
    parentEntries = await file.listDirectory(parentOf(outputPath));
  } catch {
    // 父目录不存在或不可列举：目标必然不存在，放行（发布腿按平台在册码如实失败）。
    return;
  }
  const name = basename(outputPath);
  if (parentEntries.some((entry) => basename(entry) === name)) {
    throw inputUnsupported('输出目标已存在且未请求覆盖。', INPUT_UNSUPPORTED_REASONS.outputExists, {
      outputPath,
    });
  }
};

const collectWarnings = (value: unknown): readonly IFileConvertWarning[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item) => {
    if (typeof item !== 'object' || item === null) {
      return [];
    }
    const record = item as Record<string, unknown>;
    if (typeof record.code !== 'string' || typeof record.message !== 'string') {
      return [];
    }
    return [
      {
        code: record.code,
        message: record.message,
        ...(typeof record.details !== 'undefined' ? { details: record.details } : {}),
      },
    ];
  });
};

/** 规范化兄弟服务错误：ChipsError 原样透传，其余归一为 CONVERTER_RENDER_FAILED。 */
const toSiblingError = (step: IPlannedStep, error: unknown): unknown => {
  if (isChipsErrorLike(error)) {
    return error;
  }
  const message = error instanceof Error ? error.message : String(error);
  return renderFailed(`链路腿在执行过程中失败：${step.capability}。`, {
    capability: step.capability,
    reason: RENDER_FAILED_REASONS.siblingFailed,
    cause: message.slice(0, 200),
  });
};

/** 渲染腿产物复核：目录腿直列目录、文件腿按父目录列举成员判定（file:stat 缺位口径）。 */
const assertArtifactExists = async (
  file: IFilePort,
  checkPath: string,
  artifactType: IFileConvertArtifact['type']
): Promise<void> => {
  if (artifactType === 'html-directory') {
    try {
      await file.listDirectory(checkPath);
      return;
    } catch {
      throw renderFailed('提供方未产出其声明的目录态产物。', {
        reason: RENDER_FAILED_REASONS.artifactMissing,
        artifactType,
      });
    }
  }

  let parentEntries: readonly string[];
  try {
    parentEntries = await file.listDirectory(parentOf(checkPath));
  } catch {
    parentEntries = [];
  }
  const name = basename(checkPath);
  if (!parentEntries.some((entry) => basename(entry) === name)) {
    throw renderFailed('提供方未产出其声明的产物文件。', {
      reason: RENDER_FAILED_REASONS.artifactMissing,
      artifactType,
    });
  }
};

interface ILegOutcome {
  readonly artifact: IFileConvertArtifact;
  readonly warnings: readonly IFileConvertWarning[];
  readonly htmlPackage?: { readonly htmlDir: string; readonly entryFile?: string };
}

const runCardToHtmlStep = async (
  deps: IFileConversionDependencies,
  step: IPlannedCardToHtmlStep,
  call: IConverterCallContext | undefined
): Promise<ILegOutcome> => {
  throwIfCancelled(call?.signal);
  let output;
  try {
    output = await deps.siblings.cardConverter.cardToHtml(step.input);
  } catch (error) {
    throw toSiblingError(step, error);
  }
  const htmlPackage = {
    htmlDir: output.outputPath,
    ...(output.entryFile !== undefined ? { entryFile: output.entryFile } : {}),
  };
  const artifact: IFileConvertArtifact = {
    type: step.outputKind,
    path: step.finalOutputPath,
    ...(output.entryFile !== undefined ? { entryFile: output.entryFile } : {}),
    mimeType: step.outputKind === 'html-zip' ? 'application/zip' : 'text/html',
  };
  await assertArtifactExists(deps.file, step.input.output.path, step.outputKind);
  return { artifact, warnings: collectWarnings(output.warnings), htmlPackage };
};

const runHtmlToPdfStep = async (
  deps: IFileConversionDependencies,
  step: IPlannedHtmlToPdfStep,
  call: IConverterCallContext | undefined,
  htmlPackageOverride: { readonly htmlDir: string; readonly entryFile?: string } | undefined
): Promise<ILegOutcome> => {
  throwIfCancelled(call?.signal);
  const pack = await readHtmlPackage(deps.file, htmlPackageOverride ?? step.htmlPackage);
  throwIfCancelled(call?.signal);

  let output;
  try {
    output = await deps.siblings.htmlToPdf.htmlToPdf({ html: pack.html, assets: pack.assets }, step.options, call);
  } catch (error) {
    throw toSiblingError(step, error);
  }
  throwIfCancelled(call?.signal);

  if (!(output.bytes instanceof Uint8Array)) {
    throw renderFailed('HTML 转 PDF 提供方返回了无效的输出。', {
      capability: step.capability,
      reason: RENDER_FAILED_REASONS.invalidRenderOutput,
    });
  }
  if (output.bytes.byteLength === 0) {
    throw renderFailed('HTML 转 PDF 提供方返回了空数据。', {
      capability: step.capability,
      reason: RENDER_FAILED_REASONS.emptyRenderOutput,
    });
  }

  await deps.file.writeBytes(step.outputPath, output.bytes);
  await assertArtifactExists(deps.file, step.outputPath, 'pdf');
  const artifact: IFileConvertArtifact = {
    type: 'pdf',
    path: step.finalOutputPath,
    mimeType: 'application/pdf',
  };
  return { artifact, warnings: collectWarnings(output.warnings) };
};

const runHtmlToImageStep = async (
  deps: IFileConversionDependencies,
  step: IPlannedHtmlToImageStep,
  call: IConverterCallContext | undefined,
  htmlPackageOverride: { readonly htmlDir: string; readonly entryFile?: string } | undefined
): Promise<ILegOutcome> => {
  throwIfCancelled(call?.signal);
  const pack = await readHtmlPackage(deps.file, htmlPackageOverride ?? step.htmlPackage);
  throwIfCancelled(call?.signal);

  let output;
  try {
    output = await deps.siblings.htmlToImage.htmlToImage({ html: pack.html, assets: pack.assets }, step.options, call);
  } catch (error) {
    throw toSiblingError(step, error);
  }
  throwIfCancelled(call?.signal);

  if (!(output.bytes instanceof Uint8Array)) {
    throw renderFailed('HTML 转图片提供方返回了无效的输出。', {
      capability: step.capability,
      reason: RENDER_FAILED_REASONS.invalidRenderOutput,
    });
  }
  if (output.bytes.byteLength === 0) {
    throw renderFailed('HTML 转图片提供方返回了空数据。', {
      capability: step.capability,
      reason: RENDER_FAILED_REASONS.emptyRenderOutput,
    });
  }

  await deps.file.writeBytes(step.outputPath, output.bytes);
  await assertArtifactExists(deps.file, step.outputPath, 'image');
  const artifact: IFileConvertArtifact = {
    type: 'image',
    path: step.finalOutputPath,
    mimeType: `image/${output.format ?? 'png'}`,
  };
  return { artifact, warnings: collectWarnings(output.warnings) };
};

/** 提交暂存终件（旧 commitStagedFinalOutput 语义：先备份旧产物、发布失败回滚还原）。 */
const commitStagedFinalOutput = async (deps: IFileConversionDependencies, plan: IConversionPlan): Promise<void> => {
  if (!plan.stagedFinalOutputPath) {
    return;
  }
  const file = deps.file;
  const outputPath = plan.request.output.path;

  let backupCreated = false;
  if (plan.request.output.overwrite) {
    let exists = false;
    try {
      const parentEntries = await file.listDirectory(parentOf(outputPath));
      exists = parentEntries.some((entry) => basename(entry) === basename(outputPath));
    } catch {
      exists = false;
    }
    if (exists) {
      if (!plan.stagedBackupOutputPath) {
        throw renderFailed('覆盖发布需要暂存备份路径。', { outputPath });
      }
      try {
        await file.movePath(outputPath, plan.stagedBackupOutputPath);
      } catch (error) {
        deps.logger.error('备份旧产物失败，发布中止。', error, { outputPath });
        throw error;
      }
      backupCreated = true;
    }
  }

  try {
    await file.movePath(plan.stagedFinalOutputPath, outputPath);
  } catch (error) {
    if (backupCreated && plan.stagedBackupOutputPath) {
      try {
        await file.movePath(plan.stagedBackupOutputPath, outputPath);
      } catch (restoreError) {
        deps.logger.error('发布失败后还原旧产物失败。', restoreError, {
          outputPath,
          backupPath: plan.stagedBackupOutputPath,
        });
      }
    }
    throw error;
  }
};

/** 创建 content-file-conversion Cordis 服务对象（编排角色无在册 capabilityId，见 descriptor.ts）。 */
export function createFileConversionService(dependencies: IFileConversionDependencies): IFileConversionService {
  const siblings: ISiblingPorts | undefined = dependencies?.siblings;
  if (
    typeof siblings !== 'object' ||
    siblings === null ||
    typeof siblings.cardConverter?.cardToHtml !== 'function' ||
    typeof siblings.htmlToPdf?.htmlToPdf !== 'function' ||
    typeof siblings.htmlToImage?.htmlToImage !== 'function' ||
    typeof dependencies.file?.listDirectory !== 'function' ||
    typeof dependencies.logger !== 'object' ||
    dependencies.logger === null
  ) {
    throw new TypeError('文件转换编排装配缺失：必须提供兄弟服务端口、文件端口与日志面。');
  }
  const deps = dependencies;

  return {
    async convert(request: unknown, call?: IConverterCallContext): Promise<IFileConvertResult> {
      const signal = call?.signal;
      throwIfCancelled(signal);

      const normalized: INormalizedConvertRequest = normalizeRequest(request);
      throwIfCancelled(signal);

      await assertSourceExists(deps.file, normalized.source.path);
      await assertFinalOutputWritable(deps.file, normalized.output.path, normalized.output.overwrite);

      const htmlSource =
        normalized.source.type === 'html'
          ? await resolveHtmlSourceShape(deps.file, normalized.source.path)
          : undefined;
      const plan = planConversion(normalized, htmlSource);

      deps.logger.info('文件转换链路已规划。', {
        sourceType: normalized.source.type,
        targetType: normalized.target.type,
        stepCount: plan.steps.length,
      });

      for (const stagingDir of [plan.temporaryHtmlRoot, plan.stagedFinalOutputDir, plan.stagedBackupOutputDir]) {
        if (stagingDir !== undefined) {
          await deps.file.makeDirectory(stagingDir);
        }
      }

      const artifacts: IFileConvertArtifact[] = [];
      const warnings: IFileConvertWarning[] = [];
      try {
        let htmlPackageOverride: { readonly htmlDir: string; readonly entryFile?: string } | undefined;
        for (const step of plan.steps) {
          const outcome =
            step.kind === 'card-to-html'
              ? await runCardToHtmlStep(deps, step, call)
              : step.kind === 'html-to-pdf'
                ? await runHtmlToPdfStep(deps, step, call, htmlPackageOverride)
                : await runHtmlToImageStep(deps, step, call, htmlPackageOverride);
          if (outcome.htmlPackage !== undefined) {
            htmlPackageOverride = outcome.htmlPackage;
          }
          warnings.push(...outcome.warnings);
          // 产物回执只收录发布腿（中间 HTML 目录随清理删除，不进产物清单——旧面
          // 把已删除的中间目录计入 artifacts，属回执语义校正，见 W4 迁移日志）。
          if (step.publishArtifact) {
            artifacts.push(outcome.artifact);
          }
        }

        await commitStagedFinalOutput(deps, plan);
        deps.logger.info('文件转换链路已完成。', {
          sourceType: normalized.source.type,
          targetType: normalized.target.type,
          outputPath: normalized.output.path,
        });

        return {
          sourceType: plan.request.source.type,
          targetType: plan.request.target.type,
          outputPath: plan.request.output.path,
          artifacts,
          pipeline: plan.steps.map(toPipelineLeg),
          ...(warnings.length > 0 ? { warnings } : {}),
        };
      } finally {
        if (plan.temporaryHtmlRoot) {
          try {
            await deps.file.deletePath(plan.temporaryHtmlRoot, true);
          } catch {
            deps.logger.warn('清理暂存根失败（尽力清理，不改变操作结果）。', {
              temporaryHtmlRoot: plan.temporaryHtmlRoot,
            });
          }
        }
      }
    },
  };
}

/**
 * 服务实现：`ctx.provide('markdown', service)` 提供的 Cordis 服务方法面。
 *
 * 入口职责链：取消检查 → 输入校验（形状 / 未知键 / 长度上限）→ 引擎执行 →
 * 非预期异常兜底。服务为纯处理：不接触文件、网络、配置与权限系统；
 * 输入输出均为结构化克隆兼容值。
 */

import { ChipsError } from '@chips/sdk';
import { cancelled, internalFailure, invalidInput } from './errors.js';
import {
  DEFAULT_ENGINE_OPTIONS,
  ENGINE_OPTION_KEYS,
  renderHtmlToSafeHtml,
  type IEngineOptions,
} from './engine.js';
import { parseToDocument } from './blocks.js';
import { MAX_MARKDOWN_INPUT_LENGTH } from './limits.js';
import type {
  IMarkdownCallContext,
  IMarkdownParseInput,
  IMarkdownParseOutput,
  IMarkdownRenderInput,
  IMarkdownRenderOutput,
  IMarkdownRenderOptions,
  IMarkdownService,
} from './types.js';

/** 在安全点检查取消：取消语义优先于输入校验。 */
function throwIfCancelled(context: IMarkdownCallContext | undefined): void {
  if (context?.signal?.aborted === true) {
    throw cancelled();
  }
}

/** 校验并归一渲染选项；未知键一律拒绝，选项面不允许静默扩张。 */
function normalizeOptions(raw: IMarkdownRenderOptions | undefined): IEngineOptions {
  if (raw === undefined) {
    return DEFAULT_ENGINE_OPTIONS;
  }
  if (typeof raw !== 'object' || raw === null) {
    throw invalidInput('Markdown 渲染选项必须为对象');
  }
  for (const key of Object.keys(raw)) {
    if (!ENGINE_OPTION_KEYS.includes(key)) {
      throw invalidInput(`Markdown 渲染选项包含未知键：${key}`);
    }
  }
  for (const key of ENGINE_OPTION_KEYS) {
    const value = (raw as Record<string, unknown>)[key];
    if (value !== undefined && typeof value !== 'boolean') {
      throw invalidInput(`Markdown 渲染选项 ${key} 必须为布尔值`);
    }
  }
  return {
    breaks: raw.breaks === true,
    linkify: raw.linkify === true,
    typographer: raw.typographer === true,
  };
}

/** 校验通用输入（源文 + 选项），返回引擎执行所需形态（`IMarkdownParseInput` 即 `IMarkdownRenderInput` 的别名，联合无增量）。 */
function validateInput(input: IMarkdownRenderInput): {
  markdown: string;
  options: IEngineOptions;
} {
  if (typeof input !== 'object' || input === null) {
    throw invalidInput('Markdown 输入必须为对象');
  }
  if (typeof input.markdown !== 'string') {
    throw invalidInput('Markdown 源文必须为字符串');
  }
  if (input.markdown.length > MAX_MARKDOWN_INPUT_LENGTH) {
    throw invalidInput('Markdown 源文超过长度上限', {
      length: input.markdown.length,
      maxLength: MAX_MARKDOWN_INPUT_LENGTH,
    });
  }
  return { markdown: input.markdown, options: normalizeOptions(input.options) };
}

/** 创建服务方法面对象（Cordis 服务体）。全路径以 Promise 表达：校验失败同样以 rejected Promise 返回，不同步抛出。 */
export function createMarkdownService(): IMarkdownService {
  return {
    renderHtml(
      input: IMarkdownRenderInput,
      context?: IMarkdownCallContext
    ): Promise<IMarkdownRenderOutput> {
      try {
        throwIfCancelled(context);
        const request = validateInput(input);
        return Promise.resolve({
          html: renderHtmlToSafeHtml(request.markdown, request.options),
        });
      } catch (error) {
        return Promise.reject(wrapEngineError(error));
      }
    },

    parseBlocks(
      input: IMarkdownParseInput,
      context?: IMarkdownCallContext
    ): Promise<IMarkdownParseOutput> {
      try {
        throwIfCancelled(context);
        const request = validateInput(input);
        return Promise.resolve({ document: parseToDocument(request.markdown, request.options) });
      } catch (error) {
        return Promise.reject(wrapEngineError(error));
      }
    },
  };
}

/** 非预期异常兜底：本服务自身抛出的 ChipsError 原样透传，其余归一为 BRIDGE_INTERNAL。 */
function wrapEngineError(error: unknown): ChipsError {
  if (error instanceof ChipsError) {
    return error;
  }
  return internalFailure();
}

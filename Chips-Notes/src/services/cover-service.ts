/**
 * 封面能力服务（chips.module.cover 消费层）
 * @module services/cover-service
 * @description
 * task034 M5：封面生成/比例能力归属共享模块 `chips.module.cover`，
 * 本模块优先通过 `client.module.invoke` 消费模块能力；模块未安装/不可用时
 * 回退到内置实现（语义与模块一致，鲁棒优先原则）。
 */

import { getChipsClient } from './bridge-client';
import {
    createDefaultCoverHtml as createDefaultCoverHtmlFallback,
    createImageCoverHtml as createImageCoverHtmlFallback,
    normalizeCoverRatio as normalizeCoverRatioFallback,
} from '../utils/card-cover';

const COVER_HTML_CAPABILITY = 'cover.html.generate';
const COVER_RATIO_CAPABILITY = 'cover.ratio';

export interface CoverHtmlGenerationResult {
    html: string;
    source: 'module' | 'fallback';
}

async function invokeCoverMethod<T>(capability: string, method: string, input: unknown): Promise<T | null> {
    try {
        const result = await getChipsClient().module.invoke({
            capability,
            method,
            input: (input ?? {}) as Record<string, unknown>,
        });
        if (result.mode === 'sync') {
            return result.output as T;
        }
        return null;
    } catch {
        return null;
    }
}

/** 生成默认封面 HTML（模块优先）。 */
export async function fetchDefaultCoverHtml(name: string): Promise<CoverHtmlGenerationResult> {
    const result = await invokeCoverMethod<string>(COVER_HTML_CAPABILITY, 'createDefaultHtml', { name });
    if (result) {
        return { html: result, source: 'module' };
    }
    return { html: createDefaultCoverHtmlFallback(name), source: 'fallback' };
}

/** 生成图片封面 HTML（模块优先）。 */
export async function fetchImageCoverHtml(imageSrc: string): Promise<CoverHtmlGenerationResult> {
    const result = await invokeCoverMethod<string>(COVER_HTML_CAPABILITY, 'createImageHtml', { imageSrc });
    if (result) {
        return { html: result, source: 'module' };
    }
    return { html: createImageCoverHtmlFallback(imageSrc), source: 'fallback' };
}

/** 收集封面 HTML 资源引用（模块优先）。 */
export async function collectCoverReferences(html: string): Promise<string[] | null> {
    return invokeCoverMethod<string[]>(COVER_HTML_CAPABILITY, 'collectReferences', { html });
}

/** 规范化封面比例（模块优先；同步调用方使用本地等价实现）。 */
export async function normalizeCoverRatioFromModule(value: unknown): Promise<string | null> {
    const result = await invokeCoverMethod<string>(COVER_RATIO_CAPABILITY, 'normalize', { value });
    if (result) {
        return result;
    }
    return typeof value === 'string'
        ? normalizeCoverRatioFallback(value)
        : normalizeCoverRatioFallback(undefined);
}

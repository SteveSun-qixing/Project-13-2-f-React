/**
 * 本地 ↔ 网络资源卡片改写与还原（《16-卡片传输协议》§4.3 改写规则、§4.5 还原规则的纯函数化）。
 *
 * 迁移自旧 `Chips-CommunityUploader-Plugin` 的 `card-rewrite.ts`（矩阵裁决：不单列插件，
 * 作为实现材料迁入本客户端领域层）；按协议权威逐条对齐并清除旧形态：
 * - 改写确定性：相同输入产生相同输出；同一资源的引用在所有出现位置得到同一 URL（§4.1）；
 * - 改写只改变资源引用形态，不改变字段语义、卡片结构、`card_id` 与格式版本（§4.1）；
 * - `content/*.yaml` 一般字符串值命中映射整体替换并保留后缀；结构化资源字段
 *   `source: file` + `file_path` 命中时改写为 `source: url` + `url` 并移除 `file_path`；
 * - 富文本（`base.richtext`）文件化正文 `content_source: file` + `content_file` 命中文本
 *   资源时改写为 `content_source: inline` + `content_text` 并移除 `content_file`（§4.3）；
 *   旧 `RichTextCard` 类型别名不入本面（ADR-010 零兼容，与 rte G-5 对照口径同源）；
 * - `.card/cover.html` 替换全部 `="…"` 属性值与 `url(…)` 内的包内引用，保留引号与后缀，
 *   其余 HTML 字节不改（§4.3）；
 * - `.card/metadata.yaml`、`.card/structure.yaml` 不改写（§4.3）；
 * - YAML 改写为「解析 → 改写 → 重新序列化」，格式化归一允许、语义不变（§4.3）；
 * - 还原只接受计划与恢复清单中的映射，未命中的 URL 原样保留，不得猜测（§4.5）；
 * - 改写失败（YAML 无法解析）必须整体失败：上传侧 `CARD_TRANSFER_UPLOAD_FAILED`、
 *   还原侧 `CARD_TRANSFER_RESTORE_FAILED`，`details.reason` 给出具体项（§4.3）。
 *
 * 本模块为纯函数：输入输出均为文本与映射，不做任何 I/O。
 */

import { parse, stringify } from 'yaml';
import {
  resolveCardResourceCandidates,
  splitReferenceSuffix,
  type CardRelativePath,
} from './cardPaths';

/** 富文本卡片类型（01-卡片文件格式 §6.6；旧 `RichTextCard` 别名按 ADR-010 不再识别）。 */
const RICHTEXT_CARD_TYPE = 'base.richtext';

/** cover.html 引用解析的源文件定位：封面相对引用相对 `.card/` 目录解析（01 §7.2）。 */
const COVER_HTML_SOURCE_PATH: CardRelativePath = '.card/cover.html';

/** 改写失败（上传侧；`details.reason` 给出具体项，§4.3）。 */
export class CardRewriteError extends Error {
  public readonly code: 'CARD_TRANSFER_UPLOAD_FAILED' | 'CARD_TRANSFER_RESTORE_FAILED';
  public readonly reason: string;

  public constructor(
    code: 'CARD_TRANSFER_UPLOAD_FAILED' | 'CARD_TRANSFER_RESTORE_FAILED',
    reason: string,
  ) {
    super(`卡片资源改写失败：${reason}`);
    this.name = 'CardRewriteError';
    this.code = code;
    this.reason = reason;
  }
}

/** 资源相对路径 → 已发布对象 URL 的改写映射（§4.3 改写规则的映射来源）。 */
export type ResourceUrlMap = ReadonlyMap<CardRelativePath, string>;

/** 对象 URL → 原始资源相对路径的还原映射（§4.5 第 4 步的映射来源）。 */
export type NetworkPathMap = ReadonlyMap<string, CardRelativePath>;

/** 富文本正文文本资源映射：候选路径 → `.md` 原文（上传改写内联用，§4.3 富文本行）。 */
export type RichTextTextResourceMap = ReadonlyMap<CardRelativePath, string>;

/** 富文本内联还原映射：`content/*.yaml` 配置路径 → 原始 `.md` 相对路径（§4.5 第 5 步）。 */
export type RichTextContentFileMap = ReadonlyMap<CardRelativePath, CardRelativePath>;

function resolveReferenceUrl(
  rawReference: string,
  urlMap: ResourceUrlMap,
  sourceFilePath: CardRelativePath,
): string | undefined {
  const { path, suffix } = splitReferenceSuffix(rawReference);
  for (const candidate of resolveCardResourceCandidates(path, sourceFilePath)) {
    const url = urlMap.get(candidate);
    if (url !== undefined) {
      return `${url}${suffix}`;
    }
  }
  return undefined;
}

function resolveOriginalPath(
  rawReference: string,
  pathMap: NetworkPathMap,
): string | undefined {
  const { path, suffix } = splitReferenceSuffix(rawReference);
  const originalPath = pathMap.get(path);
  return originalPath === undefined ? undefined : `${originalPath}${suffix}`;
}

function rewriteValue(
  value: unknown,
  urlMap: ResourceUrlMap,
  sourceFilePath: CardRelativePath,
  textResourceMap: RichTextTextResourceMap,
): unknown {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    const cardType = typeof record['card_type'] === 'string' ? record['card_type'].trim() : '';
    const contentSource =
      typeof record['content_source'] === 'string' ? record['content_source'].trim() : '';
    const rawContentFile = typeof record['content_file'] === 'string' ? record['content_file'] : undefined;

    // 富文本文件化正文：content_source: file + content_file → content_source: inline + content_text。
    if (cardType === RICHTEXT_CARD_TYPE && contentSource === 'file' && rawContentFile !== undefined) {
      const markdown = resolveCardResourceCandidates(rawContentFile, sourceFilePath)
        .map((candidate) => textResourceMap.get(candidate))
        .find((item): item is string => typeof item === 'string');
      if (markdown !== undefined) {
        const result: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(record)) {
          if (key === 'content_source') {
            result[key] = 'inline';
            continue;
          }
          if (key === 'content_file') {
            continue;
          }
          result[key] = rewriteValue(val, urlMap, sourceFilePath, textResourceMap);
        }
        result['content_text'] = markdown;
        return result;
      }
    }

    // 结构化资源字段：source: file + file_path 命中 → source: url + url，移除 file_path。
    const source = record['source'];
    const rawFilePath = typeof record['file_path'] === 'string' ? record['file_path'] : undefined;
    const url = rawFilePath === undefined ? undefined : resolveReferenceUrl(rawFilePath, urlMap, sourceFilePath);
    if (source === 'file' && url !== undefined) {
      const result: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(record)) {
        if (key === 'source') {
          result[key] = 'url';
          continue;
        }
        if (key === 'file_path') {
          continue;
        }
        result[key] = rewriteValue(val, urlMap, sourceFilePath, textResourceMap);
      }
      result['url'] = url;
      return result;
    }
  }

  if (typeof value === 'string') {
    return resolveReferenceUrl(value, urlMap, sourceFilePath) ?? value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => rewriteValue(item, urlMap, sourceFilePath, textResourceMap));
  }

  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      result[key] = rewriteValue(val, urlMap, sourceFilePath, textResourceMap);
    }
    return result;
  }

  return value;
}

function restoreValue(
  value: unknown,
  pathMap: NetworkPathMap,
  sourceFilePath: CardRelativePath,
  richTextContentFileMap: RichTextContentFileMap,
): unknown {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    const cardType = typeof record['card_type'] === 'string' ? record['card_type'].trim() : '';
    const contentSource =
      typeof record['content_source'] === 'string' ? record['content_source'].trim() : '';
    const rawContentText = typeof record['content_text'] === 'string' ? record['content_text'] : undefined;

    // 富文本内联正文还原：有原始 content_file 映射时 content_source: inline → file。
    if (cardType === RICHTEXT_CARD_TYPE && contentSource === 'inline' && rawContentText !== undefined) {
      const originalContentFile = richTextContentFileMap.get(sourceFilePath);
      if (originalContentFile !== undefined) {
        const result: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(record)) {
          if (key === 'content_source') {
            result[key] = 'file';
            continue;
          }
          if (key === 'content_text') {
            continue;
          }
          result[key] = restoreValue(val, pathMap, sourceFilePath, richTextContentFileMap);
        }
        result['content_file'] = originalContentFile;
        return result;
      }
    }

    // 结构化资源字段还原：source: url + url 命中 → source: file + file_path。
    const source = record['source'];
    const rawUrl = typeof record['url'] === 'string' ? record['url'] : undefined;
    const originalPath = rawUrl === undefined ? undefined : resolveOriginalPath(rawUrl, pathMap);
    if (source === 'url' && originalPath !== undefined) {
      const result: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(record)) {
        if (key === 'source') {
          result[key] = 'file';
          continue;
        }
        if (key === 'url') {
          continue;
        }
        result[key] = restoreValue(val, pathMap, sourceFilePath, richTextContentFileMap);
      }
      result['file_path'] = originalPath;
      return result;
    }
  }

  if (typeof value === 'string') {
    return resolveOriginalPath(value, pathMap) ?? value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => restoreValue(item, pathMap, sourceFilePath, richTextContentFileMap));
  }

  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      result[key] = restoreValue(val, pathMap, sourceFilePath, richTextContentFileMap);
    }
    return result;
  }

  return value;
}

/**
 * 收集富文本文件化正文的候选资源路径（§4.3 富文本行：上传前读取 `.md` 原文、登记恢复清单）。
 * 非富文本、非文件化正文或无 `content_file` 的配置返回空表。
 */
export function collectFileBackedRichTextResourcePaths(
  yamlText: string,
  sourceFilePath: CardRelativePath,
): readonly CardRelativePath[] {
  let parsed: unknown;
  try {
    parsed = parse(yamlText);
  } catch {
    throw new CardRewriteError('CARD_TRANSFER_UPLOAD_FAILED', `YAML 无法解析：${sourceFilePath}`);
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return [];
  }

  const record = parsed as Record<string, unknown>;
  const cardType = typeof record['card_type'] === 'string' ? record['card_type'].trim() : '';
  const contentSource =
    typeof record['content_source'] === 'string' ? record['content_source'].trim() : '';
  const contentFile = typeof record['content_file'] === 'string' ? record['content_file'].trim() : '';
  if (cardType !== RICHTEXT_CARD_TYPE || contentSource !== 'file' || contentFile.length === 0) {
    return [];
  }

  return resolveCardResourceCandidates(contentFile, sourceFilePath);
}

/**
 * 上传改写一张 `content/*.yaml`（§4.3）：解析 → 逐值改写 → 重新序列化；
 * YAML 无法解析时抛 `CARD_TRANSFER_UPLOAD_FAILED`（整体失败，不提交半个网络资源卡片）。
 */
export function rewriteCardConfigYaml(
  yamlText: string,
  urlMap: ResourceUrlMap,
  sourceFilePath: CardRelativePath,
  textResourceMap: RichTextTextResourceMap,
): string {
  let parsed: unknown;
  try {
    parsed = parse(yamlText);
  } catch {
    throw new CardRewriteError('CARD_TRANSFER_UPLOAD_FAILED', `YAML 无法解析：${sourceFilePath}`);
  }
  const rewritten = rewriteValue(parsed, urlMap, sourceFilePath, textResourceMap);
  return stringify(rewritten, { indent: 2 });
}

/**
 * 下载还原一张 `content/*.yaml`（§4.5 第 5 步）：解析 → 逐值逆改写 → 重新序列化；
 * 只接受映射内的还原，未命中 URL 原样保留。
 */
export function restoreCardConfigYaml(
  yamlText: string,
  pathMap: NetworkPathMap,
  sourceFilePath: CardRelativePath,
  richTextContentFileMap: RichTextContentFileMap,
): string {
  let parsed: unknown;
  try {
    parsed = parse(yamlText);
  } catch {
    throw new CardRewriteError('CARD_TRANSFER_RESTORE_FAILED', `YAML 无法解析：${sourceFilePath}`);
  }
  const restored = restoreValue(parsed, pathMap, sourceFilePath, richTextContentFileMap);
  return stringify(restored, { indent: 2 });
}

function rewriteCoverReferences(
  coverHtml: string,
  resolve: (reference: string) => string | undefined,
): string {
  let result = coverHtml;
  // 属性值形态：`="…"`（保留引号与后缀；其余 HTML 字节不改，§4.3 cover.html 行）。
  result = result.replace(/=(["'])([^"']+)\1/g, (match, quote: string, value: string) => {
    const resolved = resolve(value);
    return resolved === undefined ? match : `=${quote}${resolved}${quote}`;
  });
  // CSS 形态：`url(…)`（引号可有可无，保留原引号风格）。
  result = result.replace(/url\((["']?)([^)"']+)\1\)/g, (match, quote: string, value: string) => {
    const resolved = resolve(value);
    return resolved === undefined ? match : `url(${quote}${resolved}${quote})`;
  });
  return result;
}

/**
 * 上传改写 `.card/cover.html`（§4.3）：`="…"` 属性值与 `url(…)` 内的包内引用替换为
 * 对象 URL；相对引用相对 `.card/` 目录解析（`./cardcover/x.png` → `.card/cardcover/x.png`）。
 */
export function rewriteCoverHtml(coverHtml: string, urlMap: ResourceUrlMap): string {
  return rewriteCoverReferences(coverHtml, (reference) =>
    resolveReferenceUrl(reference, urlMap, COVER_HTML_SOURCE_PATH),
  );
}

/** 下载还原 `.card/cover.html`（§4.5 第 6 步）：命中映射的 URL 还原为原始相对路径。 */
export function restoreCoverHtml(coverHtml: string, pathMap: NetworkPathMap): string {
  return rewriteCoverReferences(coverHtml, (reference) => resolveOriginalPath(reference, pathMap));
}

import * as fs from 'fs';
import * as path from 'path';
import type { ResourceFile } from '../types/card.js';

const RICHTEXT_CARD_TYPES = new Set(['RichTextCard', 'base.richtext']);

function normalizeResourcePath(resourcePath: string): string {
  return path.posix.normalize(resourcePath.replace(/\\/g, '/').trim()).replace(/^\.\/+/, '');
}

function resolveResourcePath(resourcePath: string, sourceFilePath: string): string[] {
  const normalizedInputPath = resourcePath.trim();
  if (!normalizedInputPath) {
    return [];
  }

  const candidates: string[] = [];
  const rootCandidate = normalizeResourcePath(normalizedInputPath.replace(/^\/+/, ''));
  if (rootCandidate && !rootCandidate.startsWith('../')) {
    candidates.push(rootCandidate);
  }

  if (!normalizedInputPath.startsWith('/')) {
    const sourceDir = path.posix.dirname(sourceFilePath);
    const relativeCandidate = normalizeResourcePath(path.posix.join(sourceDir, normalizedInputPath));
    if (relativeCandidate && !relativeCandidate.startsWith('../')) {
      candidates.push(relativeCandidate);
    }
  }

  return [...new Set(candidates)];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isFileBackedRichText(value: Record<string, unknown>): boolean {
  const cardType = typeof value.card_type === 'string' ? value.card_type.trim() : '';
  const contentSource = typeof value.content_source === 'string' ? value.content_source.trim() : '';
  return RICHTEXT_CARD_TYPES.has(cardType) && contentSource === 'file';
}

export interface InlineRichTextResult {
  contentMap: Map<string, Record<string, unknown>>;
  uploadResourceFiles: ResourceFile[];
}

/**
 * 社区服务器发布链路不保留富文本作者态 markdown 资源文件。
 * 若富文本节点采用 file 模式，先把 markdown 内容吸收到 content YAML 中，
 * 再继续统一资源上传与 HTML 转换。
 */
export function inlineFileBackedRichTextContent(
  contentMap: Map<string, Record<string, unknown>>,
  resourceFiles: ResourceFile[],
): InlineRichTextResult {
  const resourceByPath = new Map(resourceFiles.map((file) => [normalizeResourcePath(file.relativePath), file]));
  const inlinedMarkdownPaths = new Set<string>();
  const nextContentMap = new Map<string, Record<string, unknown>>();

  for (const [id, content] of contentMap) {
    if (!isRecord(content) || !isFileBackedRichText(content)) {
      nextContentMap.set(id, content);
      continue;
    }

    const rawContentFile = typeof content.content_file === 'string' ? content.content_file : '';
    const candidateContentFiles = resolveResourcePath(rawContentFile, `content/${id}.yaml`);
    if (candidateContentFiles.length === 0) {
      throw new Error(`RichText node ${id} is missing content_file`);
    }

    const markdownResource = candidateContentFiles
      .map((candidatePath) => resourceByPath.get(candidatePath))
      .find((item): item is ResourceFile => Boolean(item));
    if (!markdownResource) {
      throw new Error(`RichText markdown resource not found: ${candidateContentFiles[0]}`);
    }

    const markdown = fs.readFileSync(markdownResource.absolutePath, 'utf-8');
    const nextContent: Record<string, unknown> = {
      ...content,
      content_source: 'inline',
      content_text: markdown,
    };
    delete nextContent.content_file;

    nextContentMap.set(id, nextContent);
    inlinedMarkdownPaths.add(normalizeResourcePath(markdownResource.relativePath));
  }

  return {
    contentMap: nextContentMap,
    uploadResourceFiles: resourceFiles.filter(
      (file) => !inlinedMarkdownPaths.has(normalizeResourcePath(file.relativePath)),
    ),
  };
}

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { and, eq, inArray, ne } from 'drizzle-orm';
import { db } from '../db/client.js';
import { cards } from '../db/schema/cards.js';
import { unpackCard } from './card-unpack.js';
import { uploadResourcesToCdn } from './cdn-upload.js';
import { replaceContentUrls, replaceCoverHtmlUrls } from './url-replace.js';
import { Bucket, type PublicBucketName } from '../storage/buckets.js';
import { buildObjectUrl, uploadFile } from '../storage/s3.js';
import { hostIntegration } from '../services/host-integration.js';
import { inlineFileBackedRichTextContent } from './richtext-inline.js';
import { env } from '../config/env.js';
import { mapWithConcurrency } from '../utils/async.js';

function writeYamlFile(filePath: string, value: unknown): void {
  fs.writeFileSync(filePath, yaml.dump(value, { noRefs: true }), 'utf-8');
}

function persistRewrittenCard(params: {
  tempDir: string;
  contentMap: Map<string, Record<string, unknown>>;
  coverHtml?: string;
  removableFiles: Array<{ absolutePath: string }>;
}): void {
  const { tempDir, contentMap, coverHtml, removableFiles } = params;

  for (const [id, content] of contentMap) {
    writeYamlFile(path.join(tempDir, 'content', `${id}.yaml`), content);
  }

  if (coverHtml !== undefined) {
    fs.writeFileSync(path.join(tempDir, '.card', 'cover.html'), coverHtml, 'utf-8');
  }

  for (const resourceFile of removableFiles) {
    fs.rmSync(resourceFile.absolutePath, { force: true });
  }
}

function listFilesRecursive(rootDir: string): string[] {
  const files: string[] = [];
  const stack = [rootDir];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }

    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolutePath);
        continue;
      }

      if (entry.isFile()) {
        files.push(path.relative(rootDir, absolutePath).split(path.sep).join('/'));
      }
    }
  }

  files.sort();
  return files;
}

function readYamlFile<T>(filePath: string): T {
  const raw = fs.readFileSync(filePath, 'utf-8');
  return yaml.load(raw) as T;
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function escapeHtmlText(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function injectHeadLink(params: {
  html: string;
  href: string;
  relation: 'cover' | 'content';
}): string {
  const linkTag = `<link rel="alternate" href="${escapeHtmlAttribute(params.href)}" data-chips-related="${params.relation}">`;

  if (/<\/head>/i.test(params.html)) {
    return params.html.replace(/<\/head>/i, `  ${linkTag}\n</head>`);
  }

  return `${linkTag}\n${params.html}`;
}

function createDefaultCoverHtml(title: string): string {
  const safeTitle = escapeHtmlText(title);

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${safeTitle}</title>
    <style>
      :root {
        color-scheme: light;
      }

      * {
        box-sizing: border-box;
      }

      html,
      body {
        margin: 0;
        width: 100%;
        min-height: 100%;
      }

      body {
        min-height: 100vh;
        display: grid;
        place-items: stretch;
        background:
          radial-gradient(circle at 18% 18%, rgba(255, 255, 255, 0.72), transparent 30%),
          radial-gradient(circle at 82% 24%, rgba(255, 215, 146, 0.58), transparent 34%),
          linear-gradient(155deg, #fff3dd 0%, #ffd59a 44%, #ffb768 100%);
        color: #1f1408;
        font-family: "SF Pro Display", "PingFang SC", "Helvetica Neue", sans-serif;
      }

      .chips-card-cover {
        min-height: 100vh;
        display: grid;
        place-items: end stretch;
        padding: clamp(18px, 5vw, 32px);
      }

      .chips-card-cover__title {
        margin: 0;
        font-size: clamp(28px, 7vw, 54px);
        line-height: 0.96;
        letter-spacing: -0.05em;
        text-wrap: balance;
        text-shadow: 0 12px 28px rgba(255, 255, 255, 0.28);
      }
    </style>
  </head>
  <body>
    <main class="chips-card-cover">
      <h1 class="chips-card-cover__title">${safeTitle}</h1>
    </main>
  </body>
</html>`;
}

function shouldFallbackToDefaultCover(coverHtml: string | undefined): boolean {
  if (!coverHtml) {
    return true;
  }

  const normalized = coverHtml.replace(/\s+/g, ' ').trim();
  return !normalized;
}

function writeHtmlFile(filePath: string, html: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, html, 'utf-8');
}

async function uploadDirectoryFiles(params: {
  rootDir: string;
  relativePaths: string[];
  bucket: PublicBucketName;
  keyPrefix: string;
}): Promise<Map<string, string>> {
  const uploadedUrls = new Map<string, string>();

  await mapWithConcurrency(
    params.relativePaths,
    env.CARD_PIPELINE_HTML_UPLOAD_CONCURRENCY,
    async (relativePath) => {
      const absolutePath = path.join(params.rootDir, relativePath);
      const url = await uploadFile({
        bucket: params.bucket,
        key: `${params.keyPrefix}/${relativePath}`,
        filePath: absolutePath,
      });
      uploadedUrls.set(relativePath, url);
    },
  );

  return uploadedUrls;
}

/**
 * 卡片上传处理流水线编排器
 *
 * 执行顺序：
 *   1. 解包
 *   2. 将 file 模式富文本 markdown 资源吸收到 content YAML
 *   3. 上传剩余卡片资源到 CDN
 *   4. 替换 content / cover 内资源链接
 *   5. 删除原始本地资源并重新打包为新的 .card
 *   6. 删除原始上传包
 *   7. 通过正式文件转换模块输出 HTML 目录
 *   8. 单独导出封面 HTML 产物
 *   9. 上传内容 HTML 与封面 HTML
 *  10. 更新数据库
 *  11. finally 清理临时目录
 */
export async function runCardPipeline(params: {
  cardFilePath: string;
  cardDbId: string;
  userId: string;
}): Promise<void> {
  const { cardFilePath, cardDbId, userId } = params;

  let tempDir: string | null = null;
  let rewrittenCardPath: string | null = null;
  let htmlOutputDir: string | null = null;
  let coverOutputDir: string | null = null;
  let originalCardRemoved = false;

  try {
    console.log(`[Pipeline] Starting for card ${cardDbId}...`);
    await db
      .update(cards)
      .set({ status: 'processing', updatedAt: new Date() })
      .where(eq(cards.id, cardDbId));

    console.log(`[Pipeline] Step 1: Unpacking ${cardFilePath}...`);
    const unpackResult = await unpackCard(cardFilePath);
    tempDir = unpackResult.tempDir;

    const duplicate = await db.query.cards.findFirst({
      where: and(
        eq(cards.userId, userId),
        eq(cards.cardFileId, unpackResult.metadata.id),
        ne(cards.id, cardDbId),
        inArray(cards.status, ['pending', 'processing']),
      ),
    });

    if (duplicate) {
      throw new Error(`Duplicate card upload detected for card file id ${unpackResult.metadata.id}`);
    }

    console.log(`[Pipeline] Step 2: Inlining file-backed richtext markdown resources...`);
    const normalizedRichText = inlineFileBackedRichTextContent(
      unpackResult.contentMap,
      unpackResult.resourceFiles,
    );

    console.log(`[Pipeline] Step 3: Uploading resources for card ${cardDbId}...`);
    const cdnUrlMap = await uploadResourcesToCdn(normalizedRichText.uploadResourceFiles, userId, cardDbId);

    console.log(`[Pipeline] Step 4: Rewriting card resource URLs...`);
    const replacedContentMap = replaceContentUrls(normalizedRichText.contentMap, cdnUrlMap);
    const replacedCoverHtml = unpackResult.coverHtml
      ? replaceCoverHtmlUrls(unpackResult.coverHtml, cdnUrlMap)
      : undefined;

    console.log(`[Pipeline] Step 5: Repacking rewritten card...`);
    persistRewrittenCard({
      tempDir,
      contentMap: replacedContentMap,
      coverHtml: replacedCoverHtml,
      removableFiles: unpackResult.resourceFiles,
    });

    rewrittenCardPath = path.join(os.tmpdir(), `ccps-card-repacked-${cardDbId}.card`);
    await hostIntegration.packCard(tempDir, rewrittenCardPath);

    fs.rmSync(cardFilePath, { force: true });
    originalCardRemoved = true;

    console.log(`[Pipeline] Step 7: Converting rewritten card through file conversion plugin...`);
    htmlOutputDir = path.join(os.tmpdir(), `ccps-card-html-${cardDbId}`);
    const convertResult = await hostIntegration.convertCardToHtml({
      cardFile: rewrittenCardPath,
      outputPath: htmlOutputDir,
      overwrite: true,
    });

    const htmlRootDir = convertResult.outputPath;
    const htmlFiles = listFilesRecursive(htmlRootDir);
    const contentIndexKey = `${userId}/${cardDbId}/index.html`;
    const coverIndexKey = `cards/${userId}/${cardDbId}/index.html`;
    const contentHtmlUrl = buildObjectUrl(Bucket.CARD_HTML, contentIndexKey);
    const coverHtmlUrl = buildObjectUrl(Bucket.COVERS, coverIndexKey);

    const contentIndexPath = path.join(htmlRootDir, 'index.html');
    if (fs.existsSync(contentIndexPath)) {
      const indexHtml = fs.readFileSync(contentIndexPath, 'utf-8');
      fs.writeFileSync(
        contentIndexPath,
        injectHeadLink({
          html: indexHtml,
          href: coverHtmlUrl,
          relation: 'cover',
        }),
        'utf-8',
      );
    }

    console.log(`[Pipeline] Step 8: Creating standalone cover HTML output...`);
    coverOutputDir = path.join(os.tmpdir(), `ccps-card-cover-${cardDbId}`);
    const coverSourceHtml = shouldFallbackToDefaultCover(replacedCoverHtml)
      ? createDefaultCoverHtml(String(unpackResult.metadata.name))
      : (replacedCoverHtml as string);

    writeHtmlFile(
      path.join(coverOutputDir, 'index.html'),
      injectHeadLink({
        html: coverSourceHtml,
        href: contentHtmlUrl,
        relation: 'content',
      }),
    );

    console.log(`[Pipeline] Step 9: Uploading converted HTML directory to CDN...`);
    const htmlUrls = await uploadDirectoryFiles({
      rootDir: htmlRootDir,
      relativePaths: htmlFiles,
      bucket: Bucket.CARD_HTML,
      keyPrefix: `${userId}/${cardDbId}`,
    });
    const indexHtmlUrl = htmlUrls.get('index.html') ?? '';

    console.log(`[Pipeline] Step 9: Uploading standalone cover HTML output...`);
    const coverFiles = listFilesRecursive(coverOutputDir);
    const coverUrls = await uploadDirectoryFiles({
      rootDir: coverOutputDir,
      relativePaths: coverFiles,
      bucket: Bucket.COVERS,
      keyPrefix: `cards/${userId}/${cardDbId}`,
    });
    const coverUrl = coverUrls.get('index.html') ?? null;

    const repackedMetadata = readYamlFile<Record<string, unknown>>(path.join(tempDir, '.card', 'metadata.yaml'));
    const repackedStructure = readYamlFile<Record<string, unknown>>(path.join(tempDir, '.card', 'structure.yaml'));

    console.log(`[Pipeline] Step 10: Updating database status to ready for card ${cardDbId}...`);
    await db
      .update(cards)
      .set({
        cardFileId: String(repackedMetadata.id ?? unpackResult.metadata.id),
        title: String(repackedMetadata.name ?? unpackResult.metadata.name),
        htmlUrl: indexHtmlUrl,
        coverUrl,
        coverRatio: typeof repackedMetadata.cover_ratio === 'string'
          ? repackedMetadata.cover_ratio
          : null,
        cardMetadata: repackedMetadata,
        cardStructure: repackedStructure,
        status: 'ready',
        errorMessage: null,
        updatedAt: new Date(),
      })
      .where(eq(cards.id, cardDbId));

    console.log(`[Pipeline] Successfully processed card ${cardDbId}`);
  } catch (err: unknown) {
    console.error(`[Pipeline] Error processing card ${cardDbId}:`, err);
    const errorMessage =
      err instanceof Error
        ? err.message
        : typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message?: unknown }).message)
          : JSON.stringify(err, null, 2);

    try {
      await db
        .update(cards)
        .set({ status: 'error', errorMessage, updatedAt: new Date() })
        .where(eq(cards.id, cardDbId));
    } catch (dbErr) {
      console.error('Failed to update card error status:', dbErr);
    }
  } finally {
    if (tempDir) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (cleanupErr) {
        console.error('Failed to clean up temp directory:', cleanupErr);
      }
    }

    if (rewrittenCardPath) {
      try {
        fs.rmSync(rewrittenCardPath, { force: true });
      } catch {
        // ignore
      }
    }

    if (htmlOutputDir) {
      try {
        fs.rmSync(htmlOutputDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }

    if (coverOutputDir) {
      try {
        fs.rmSync(coverOutputDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }

    if (!originalCardRemoved) {
      try {
        fs.rmSync(cardFilePath, { force: true });
      } catch {
        // ignore
      }
    }
  }
}

import { uploadFile } from '../storage/s3';
import { Bucket } from '../storage/buckets';
import type { ResourceFile } from '../types/card';
import { env } from '../config/env';
import { mapWithConcurrency } from '../utils/async';

export interface CdnUploadResult {
  /** 相对路径 → CDN URL */
  urlMap: Map<string, string>;
}

/**
 * 并发上传资源文件到 MinIO，返回卡片内规范相对路径 → CDN URL 的映射表
 */
export async function uploadResourcesToCdn(
  resourceFiles: ResourceFile[],
  userId: string,
  cardDbId: string,
): Promise<Map<string, string>> {
  const urlMap = new Map<string, string>();

  await mapWithConcurrency(
    resourceFiles,
    env.CARD_PIPELINE_ASSET_UPLOAD_CONCURRENCY,
    async (file) => {
      const key = `${userId}/${cardDbId}/${file.relativePath}`;
      const url = await uploadFile({
        bucket: Bucket.CARD_RESOURCES,
        key,
        filePath: file.absolutePath,
      });
      urlMap.set(file.relativePath, url);
    },
  );

  return urlMap;
}

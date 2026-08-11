import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
} from '@aws-sdk/client-s3';
import { getS3Client } from './s3';
import { PRIVATE_BUCKETS, PUBLIC_BUCKETS, STORAGE_BUCKETS, type BucketName } from './buckets';
import { env } from '../config/env';

/**
 * 构建 S3 公开读 bucket policy（MinIO 兼容）
 */
function buildPublicReadPolicy(bucketName: string): string {
  return JSON.stringify({
    Version: '2012-10-17',
    Statement: [
      {
        Sid: 'PublicRead',
        Effect: 'Allow',
        Principal: '*',
        Action: ['s3:GetObject'],
        Resource: [`arn:aws:s3:::${bucketName}/*`],
      },
    ],
  });
}

/**
 * 确保 bucket 存在；公开读策略由调用方按 bucket 类型单独设置。
 */
async function ensureBucket(bucketName: BucketName | string): Promise<void> {
  const s3 = getS3Client();

  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucketName }));
    // bucket 已存在，无需操作
  } catch (err: unknown) {
    const error = err as { name?: string; $metadata?: { httpStatusCode?: number } };
    const isNotFound =
      error.name === 'NotFound' ||
      error.name === 'NoSuchBucket' ||
      error.$metadata?.httpStatusCode === 404;

    if (!isNotFound) throw err;

    // 创建 bucket
    await s3.send(new CreateBucketCommand({ Bucket: bucketName }));

    console.info(`Storage bucket created: ${bucketName}`);
  }
}

async function ensurePublicReadPolicy(bucketName: BucketName | string): Promise<void> {
  const s3 = getS3Client();
  await s3.send(
    new PutBucketPolicyCommand({
      Bucket: bucketName,
      Policy: buildPublicReadPolicy(bucketName),
    }),
  );
}

/**
 * 服务启动时初始化所有必要的 bucket
 */
export async function initStorageBuckets(): Promise<void> {
  console.info('Initializing storage buckets...');
  const bucketNames = env.S3_BUCKET_NAME ? [env.S3_BUCKET_NAME, ...PRIVATE_BUCKETS] : STORAGE_BUCKETS;
  await Promise.all(bucketNames.map(ensureBucket));
  const publicBucketNames = env.S3_BUCKET_NAME ? [env.S3_BUCKET_NAME] : PUBLIC_BUCKETS;
  await Promise.all(publicBucketNames.map(ensurePublicReadPolicy));
  console.info(`Storage buckets ready: ${bucketNames.join(', ')}`);
}

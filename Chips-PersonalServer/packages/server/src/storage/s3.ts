import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { pipeline } from 'stream/promises';
import { env } from '../config/env';
import { PRIVATE_BUCKETS, PUBLIC_BUCKETS, type BucketName, type PublicBucketName } from './buckets';

let s3Instance: S3Client | null = null;

function trimTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function toStorageTarget(bucket: string, key: string): { bucket: string; key: string } {
  if (!env.S3_BUCKET_NAME || (PRIVATE_BUCKETS as readonly string[]).includes(bucket)) {
    return { bucket, key };
  }

  return {
    bucket: env.S3_BUCKET_NAME,
    key: `${bucket}/${key}`,
  };
}

export function getPublicBucketBaseUrl(bucket: PublicBucketName): string {
  if (env.S3_PUBLIC_URL) {
    return `${trimTrailingSlash(env.S3_PUBLIC_URL)}/${bucket}`;
  }

  // 开发态直连对象存储，避免生成依赖 80 端口反向代理的失效 URL。
  if (env.NODE_ENV === 'development') {
    return `${trimTrailingSlash(env.S3_ENDPOINT)}/${bucket}`;
  }

  return `${trimTrailingSlash(env.BASE_URL)}/cdn/${bucket}`;
}

function isPublicBucket(bucket: string): bucket is PublicBucketName {
  return (PUBLIC_BUCKETS as readonly string[]).includes(bucket);
}

export function getS3Client(): S3Client {
  if (!s3Instance) {
    s3Instance = new S3Client({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY,
        secretAccessKey: env.S3_SECRET_KEY,
      },
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
      // 七牛云 S3 兼容接口会把 AWS SDK 默认流式校验的 aws-chunked
      // 编码头持久化为对象元数据，浏览器直连公开域名时会误按该编码解码。
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  }
  return s3Instance;
}

/**
 * 上传文件到对象存储
 * @returns 对象的公开访问 URL
 */
export async function uploadFile(params: {
  bucket: BucketName | string;
  key: string;
  filePath: string;
  contentType?: string;
}): Promise<string> {
  const { bucket, key, filePath, contentType } = params;
  const s3 = getS3Client();
  const target = toStorageTarget(bucket, key);

  const fileStream = fs.createReadStream(filePath);
  const stat = fs.statSync(filePath);

  const detectedContentType = contentType ?? detectContentType(filePath);

  await s3.send(
    new PutObjectCommand({
      Bucket: target.bucket,
      Key: target.key,
      Body: fileStream,
      ContentLength: stat.size,
      ContentType: detectedContentType,
    }),
  );

  if (!isPublicBucket(bucket)) {
    return '';
  }

  return buildObjectUrl(bucket, key);
}

/**
 * 上传流到对象存储。
 */
export async function uploadStream(params: {
  bucket: BucketName | string;
  key: string;
  stream: NodeJS.ReadableStream;
  contentLength: number;
  contentType?: string;
}): Promise<string> {
  const s3 = getS3Client();
  const target = toStorageTarget(params.bucket, params.key);

  await s3.send(
    new PutObjectCommand({
      Bucket: target.bucket,
      Key: target.key,
      Body: params.stream as any,
      ContentLength: params.contentLength,
      ContentType: params.contentType ?? 'application/octet-stream',
    }),
  );

  if (!isPublicBucket(params.bucket)) {
    return '';
  }

  return buildObjectUrl(params.bucket, params.key);
}

/**
 * 下载对象存储文件到本地路径。
 */
export async function downloadFile(params: {
  bucket: string;
  key: string;
  filePath: string;
}): Promise<void> {
  const s3 = getS3Client();
  const target = toStorageTarget(params.bucket, params.key);
  const response = await s3.send(
    new GetObjectCommand({
      Bucket: target.bucket,
      Key: target.key,
    }),
  );

  if (!response.Body) {
    throw new Error(`Storage object has no body: ${params.bucket}/${params.key}`);
  }

  fs.mkdirSync(path.dirname(params.filePath), { recursive: true });
  await pipeline(response.Body as NodeJS.ReadableStream, fs.createWriteStream(params.filePath));
}

/**
 * 获取对象读取流。
 */
export async function getObjectStream(params: {
  bucket: string;
  key: string;
  range?: string;
}): Promise<{
  body: NodeJS.ReadableStream;
  contentType?: string;
  contentLength?: number;
  contentRange?: string;
  acceptRanges?: string;
  etag?: string;
  lastModified?: Date;
  statusCode?: number;
}> {
  const s3 = getS3Client();
  const target = toStorageTarget(params.bucket, params.key);
  const response = await s3.send(
    new GetObjectCommand({
      Bucket: target.bucket,
      Key: target.key,
      Range: params.range,
    }),
  );

  if (!response.Body) {
    throw new Error(`Storage object has no body: ${params.bucket}/${params.key}`);
  }

  return {
    body: response.Body as NodeJS.ReadableStream,
    contentType: response.ContentType,
    contentLength: response.ContentLength,
    contentRange: response.ContentRange,
    acceptRanges: response.AcceptRanges,
    etag: response.ETag,
    lastModified: response.LastModified,
    statusCode: response.$metadata.httpStatusCode,
  };
}

/**
 * 上传 Buffer / string 内容到对象存储
 * @returns 对象的公开访问 URL
 */
export async function uploadBuffer(params: {
  bucket: BucketName | string;
  key: string;
  body: Buffer | string;
  contentType: string;
}): Promise<string> {
  const { bucket, key, body, contentType } = params;
  const s3 = getS3Client();
  const target = toStorageTarget(bucket, key);

  const buffer = typeof body === 'string' ? Buffer.from(body, 'utf-8') : body;

  await s3.send(
    new PutObjectCommand({
      Bucket: target.bucket,
      Key: target.key,
      Body: buffer,
      ContentLength: buffer.byteLength,
      ContentType: contentType,
    }),
  );

  if (!isPublicBucket(bucket)) {
    return '';
  }

  return buildObjectUrl(bucket, key);
}

/**
 * 删除单个对象
 */
export async function deleteObject(bucket: string, key: string): Promise<void> {
  const s3 = getS3Client();
  const target = toStorageTarget(bucket, key);
  await s3.send(new DeleteObjectCommand({ Bucket: target.bucket, Key: target.key }));
}

/**
 * 批量删除指定前缀下的所有对象（用于清理卡片资源）
 */
export async function deleteObjectsByPrefix(bucket: string, prefix: string): Promise<void> {
  const s3 = getS3Client();
  const target = toStorageTarget(bucket, prefix);

  let continuationToken: string | undefined;

  do {
    const list = await s3.send(
      new ListObjectsV2Command({
        Bucket: target.bucket,
        Prefix: target.key,
        ContinuationToken: continuationToken,
      }),
    );

    const objects = list.Contents ?? [];
    if (objects.length > 0) {
      await s3.send(
        new DeleteObjectsCommand({
          Bucket: target.bucket,
          Delete: {
            Objects: objects.map((o) => ({ Key: o.Key! })),
            Quiet: true,
          },
        }),
      );
    }

    continuationToken = list.IsTruncated ? list.NextContinuationToken : undefined;
  } while (continuationToken);
}

/**
 * 检查对象是否存在
 */
export async function objectExists(bucket: string, key: string): Promise<boolean> {
  const s3 = getS3Client();
  const target = toStorageTarget(bucket, key);
  try {
    await s3.send(new HeadObjectCommand({ Bucket: target.bucket, Key: target.key }));
    return true;
  } catch (err: unknown) {
    if ((err as { name?: string }).name === 'NotFound') return false;
    throw err;
  }
}

/**
 * 读取对象元信息。
 */
export async function headObject(params: {
  bucket: string;
  key: string;
}): Promise<{
  contentLength?: number;
  contentType?: string;
  etag?: string;
  lastModified?: Date;
  metadata?: Record<string, string>;
  checksumSha256?: string;
}> {
  const s3 = getS3Client();
  const target = toStorageTarget(params.bucket, params.key);
  const response = await s3.send(new HeadObjectCommand({ Bucket: target.bucket, Key: target.key }));
  return {
    contentLength: response.ContentLength,
    contentType: response.ContentType,
    etag: response.ETag,
    lastModified: response.LastModified,
    metadata: response.Metadata,
    checksumSha256: response.ChecksumSHA256,
  };
}

/**
 * 构造对象公开访问 URL
 * 生产环境优先使用对象存储自定义 HTTPS 域名。
 */
export function buildObjectUrl(bucket: PublicBucketName, key: string): string {
  return `${getPublicBucketBaseUrl(bucket)}/${key}`;
}

function encodeUriPathSegment(segment: string): string {
  return encodeURIComponent(segment).replace(/[!'()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function encodeCanonicalPath(pathname: string): string {
  const normalized = pathname.replace(/\/+/g, '/');
  return normalized
    .split('/')
    .map((segment) => encodeUriPathSegment(segment))
    .join('/')
    .replace(/^([^/])/, '/$1');
}

/**
 * 序列化预签名 query。
 *
 * 签名计算与最终 URL 必须使用同一套编码与排序：
 * - 编码：`encodeURIComponent`（空格 → `%20`），不能使用 `URLSearchParams.toString()`
 *   （空格 → `+`），否则含空格的参数值（如 `response-content-disposition`）会导致签名校验失败；
 * - 排序：AWS SigV4 要求按参数名 ASCII 字节序升序（`Array.prototype.sort`），
 *   不能用 `localeCompare`（locale 排序会把小写字母排在部分大写前，导致签名不匹配）。
 */
function serializeSignedQuery(query: URLSearchParams): string {
  return [...query.entries()]
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
}

function hmac(key: Buffer | string, value: string): Buffer {
  return crypto.createHmac('sha256', key).update(value, 'utf-8').digest();
}

function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value, 'utf-8').digest('hex');
}

function toAmzDate(date: Date): { amzDate: string; dateStamp: string } {
  const iso = date.toISOString().replace(/[:-]|\.\d{3}/g, '');
  return {
    amzDate: iso,
    dateStamp: iso.slice(0, 8),
  };
}

function buildSigningKey(dateStamp: string): Buffer {
  const dateKey = hmac(`AWS4${env.S3_SECRET_KEY}`, dateStamp);
  const regionKey = hmac(dateKey, env.S3_REGION);
  const serviceKey = hmac(regionKey, 's3');
  return hmac(serviceKey, 'aws4_request');
}

function buildPresignTarget(bucket: string, key: string): { url: URL; host: string; canonicalPath: string } {
  const target = toStorageTarget(bucket, key);
  const endpoint = new URL(env.S3_ENDPOINT);
  const endpointPath = endpoint.pathname === '/' ? '' : endpoint.pathname.replace(/\/$/, '');

  if (env.S3_FORCE_PATH_STYLE) {
    const canonicalPath = `${endpointPath}/${target.bucket}/${target.key}`;
    return {
      url: new URL(`${endpoint.origin}${canonicalPath}`),
      host: endpoint.host,
      canonicalPath: encodeCanonicalPath(canonicalPath),
    };
  }

  const host = `${target.bucket}.${endpoint.host}`;
  const canonicalPath = `${endpointPath}/${target.key}`;
  const url = new URL(`${endpoint.protocol}//${host}${canonicalPath}`);
  return {
    url,
    host,
    canonicalPath: encodeCanonicalPath(canonicalPath),
  };
}

/**
 * 创建 S3 兼容 PUT 预签名 URL。
 */
export function createPresignedPutUrl(params: {
  bucket: BucketName | string;
  key: string;
  contentType: string;
  expiresInSeconds: number;
  headers?: Record<string, string>;
}): { url: string; method: 'PUT'; headers: Record<string, string>; publicUrl: string } {
  const now = new Date();
  const { amzDate, dateStamp } = toAmzDate(now);
  const credentialScope = `${dateStamp}/${env.S3_REGION}/s3/aws4_request`;
  const target = buildPresignTarget(params.bucket, params.key);
  const headers = Object.fromEntries(
    Object.entries({
      'content-type': params.contentType,
      ...(params.headers ?? {}),
    }).map(([key, value]) => [key.toLowerCase(), value.trim()]),
  );
  const signedHeaderNames = [...new Set([...Object.keys(headers), 'host'])].sort();
  const signedHeaders = signedHeaderNames.join(';');
  const query = new URLSearchParams({
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${env.S3_ACCESS_KEY}/${credentialScope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(params.expiresInSeconds),
    'X-Amz-SignedHeaders': signedHeaders,
  });

  const canonicalQuery = serializeSignedQuery(query);
  const canonicalHeaders = signedHeaderNames
    .map((headerName) => {
      const value = headerName === 'host' ? target.host : headers[headerName] ?? '';
      return `${headerName}:${value.replace(/\s+/g, ' ')}\n`;
    })
    .join('');
  const canonicalRequest = [
    'PUT',
    target.canonicalPath,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    'UNSIGNED-PAYLOAD',
  ].join('\n');
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');
  const signature = crypto
    .createHmac('sha256', buildSigningKey(dateStamp))
    .update(stringToSign, 'utf-8')
    .digest('hex');

  query.set('X-Amz-Signature', signature);
  target.url.search = serializeSignedQuery(query);

  return {
    url: target.url.toString(),
    method: 'PUT',
    headers,
    publicUrl: isPublicBucket(params.bucket) ? buildObjectUrl(params.bucket, params.key) : '',
  };
}

/**
 * 创建 S3 兼容 GET 预签名 URL。
 *
 * 下载链路只把临时读取地址交给客户端，文件字节仍由对象存储/CDN 承担。
 */
export function createPresignedGetUrl(params: {
  bucket: BucketName | string;
  key: string;
  expiresInSeconds: number;
  responseContentDisposition?: string;
}): { url: string; method: 'GET'; headers: Record<string, string>; expiresInSeconds: number } {
  const now = new Date();
  const { amzDate, dateStamp } = toAmzDate(now);
  const credentialScope = `${dateStamp}/${env.S3_REGION}/s3/aws4_request`;
  const target = buildPresignTarget(params.bucket, params.key);
  const signedHeaders = 'host';
  const query = new URLSearchParams({
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${env.S3_ACCESS_KEY}/${credentialScope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(params.expiresInSeconds),
    'X-Amz-SignedHeaders': signedHeaders,
  });

  if (params.responseContentDisposition) {
    query.set('response-content-disposition', params.responseContentDisposition);
  }

  const canonicalQuery = serializeSignedQuery(query);
  const canonicalHeaders = `host:${target.host}\n`;
  const canonicalRequest = [
    'GET',
    target.canonicalPath,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    'UNSIGNED-PAYLOAD',
  ].join('\n');
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');
  const signature = crypto
    .createHmac('sha256', buildSigningKey(dateStamp))
    .update(stringToSign, 'utf-8')
    .digest('hex');

  query.set('X-Amz-Signature', signature);
  target.url.search = serializeSignedQuery(query);

  return {
    url: target.url.toString(),
    method: 'GET',
    headers: {},
    expiresInSeconds: params.expiresInSeconds,
  };
}

/**
 * 从 URL 中解析出 bucket 和 key（用于删除时比对）
 */
export function parseObjectUrl(url: string): { bucket: string; key: string } | null {
  const prefixes = [trimTrailingSlash(env.BASE_URL) + '/cdn/'];

  if (env.S3_PUBLIC_URL) {
    prefixes.unshift(trimTrailingSlash(env.S3_PUBLIC_URL) + '/');
  }

  if (env.NODE_ENV === 'development') {
    prefixes.push(trimTrailingSlash(env.S3_ENDPOINT) + '/');
  }

  for (const prefix of prefixes) {
    if (!url.startsWith(prefix)) {
      continue;
    }

    const rest = url.slice(prefix.length);
    const slashIdx = rest.indexOf('/');
    if (slashIdx === -1) {
      return null;
    }

    return {
      bucket: rest.slice(0, slashIdx),
      key: rest.slice(slashIdx + 1),
    };
  }

  return null;
}

/**
 * 根据文件扩展名检测 Content-Type
 */
function detectContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mov': 'video/quicktime',
    '.mp3': 'audio/mpeg',
    '.ogg': 'audio/ogg',
    '.wav': 'audio/wav',
    '.flac': 'audio/flac',
    '.aac': 'audio/aac',
    '.pdf': 'application/pdf',
    '.card': 'application/vnd.chips.card+zip',
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.yaml': 'application/yaml; charset=utf-8',
    '.yml': 'application/yaml; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8',
    '.vtt': 'text/vtt; charset=utf-8',
    '.srt': 'application/x-subrip; charset=utf-8',
  };
  return map[ext] ?? 'application/octet-stream';
}

/**
 * 计算文件的 SHA-256 哈希（用于完整性验证）
 */
export async function sha256File(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

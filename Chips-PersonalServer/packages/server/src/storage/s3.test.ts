import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const REQUIRED_ENV = {
  NODE_ENV: 'production',
  PORT: '3000',
  HOST: '0.0.0.0',
  BASE_URL: 'https://www.chipscard.space',
  DATABASE_URL: 'postgresql://user:password@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379',
  S3_ENDPOINT: 'https://s3.ap-southeast-1.qiniucs.com',
  S3_ACCESS_KEY: 'access-key',
  S3_SECRET_KEY: 'secret-key',
  S3_REGION: 'ap-southeast-1',
  S3_FORCE_PATH_STYLE: 'true',
  JWT_SECRET: '12345678901234567890123456789012',
};

async function loadStorage(
  overrides: Record<string, string | undefined> = {},
  sendResponses: Array<Record<string, unknown>> = [],
) {
  vi.resetModules();
  vi.doUnmock('@aws-sdk/client-s3');

  const sentCommands: Array<{ input: Record<string, unknown> }> = [];

  vi.doMock('@aws-sdk/client-s3', () => {
    async function drainBody(body: unknown): Promise<void> {
      if (!body || typeof body !== 'object' || !(Symbol.asyncIterator in body)) {
        return;
      }

      for await (const chunk of body as AsyncIterable<unknown>) {
        void chunk;
        // Keep the mock aligned with the real S3 client, which consumes upload streams before resolving.
      }
    }

    class S3Client {
      config: Record<string, unknown>;

      constructor(config: Record<string, unknown>) {
        this.config = config;
      }

      async send(command: { input: Record<string, unknown> }) {
        sentCommands.push(command);
        await drainBody(command.input.Body);
        return Promise.resolve(sendResponses.shift() ?? {});
      }
    }

    class Command {
      input: Record<string, unknown>;

      constructor(input: Record<string, unknown>) {
        this.input = input;
      }
    }

    return {
      S3Client,
      PutObjectCommand: Command,
      DeleteObjectCommand: Command,
      DeleteObjectsCommand: Command,
      ListObjectsV2Command: Command,
      HeadObjectCommand: Command,
      GetObjectCommand: Command,
    };
  });

  for (const [key, value] of Object.entries(REQUIRED_ENV)) {
    vi.stubEnv(key, value);
  }

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      vi.unstubAllEnvs();
      for (const [requiredKey, requiredValue] of Object.entries(REQUIRED_ENV)) {
        if (requiredKey !== key) {
          vi.stubEnv(requiredKey, requiredValue);
        }
      }
      continue;
    }
    vi.stubEnv(key, value);
  }

  const storage = await import('./s3');
  return { storage, sentCommands };
}

afterEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.doUnmock('@aws-sdk/client-s3');
});

describe('storage url and bucket mapping', () => {
  it('keeps logical bucket names in public URLs while writing to one physical bucket', async () => {
    const { storage, sentCommands } = await loadStorage({
      S3_PUBLIC_URL: 'https://file.chipscard.space',
      S3_BUCKET_NAME: 'chipscardspace',
    });

    const url = await storage.uploadBuffer({
      bucket: 'chips-card-render-cache',
      key: 'card-1/cache-version/index.html',
      body: '<!doctype html>',
      contentType: 'text/html',
    });

    expect(url).toBe('https://file.chipscard.space/chips-card-render-cache/card-1/cache-version/index.html');
    expect(sentCommands[0]?.input).toMatchObject({
      Bucket: 'chipscardspace',
      Key: 'chips-card-render-cache/card-1/cache-version/index.html',
      ContentType: 'text/html',
    });
  });

  it('uses checksum settings compatible with Qiniu public object responses', async () => {
    const { storage } = await loadStorage({
      S3_PUBLIC_URL: 'https://file.chipscard.space',
      S3_BUCKET_NAME: 'chipscardspace',
    });

    const client = storage.getS3Client() as { config: Record<string, unknown> };

    expect(client.config).toMatchObject({
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  });

  it('uploads text assets with explicit utf-8 charset metadata', async () => {
    const { storage, sentCommands } = await loadStorage({
      S3_PUBLIC_URL: 'https://file.chipscard.space',
      S3_BUCKET_NAME: 'chipscardspace',
    });
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccps-s3-test-'));
    const htmlPath = path.join(tempDir, 'index.html');

    try {
      fs.writeFileSync(htmlPath, '<!doctype html><title>薯片</title>', 'utf-8');

      await storage.uploadFile({
        bucket: 'chips-card-render-cache',
        key: 'card-1/cache-version/index.html',
        filePath: htmlPath,
      });

      expect(sentCommands[0]?.input).toMatchObject({
        ContentType: 'text/html; charset=utf-8',
      });
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('parses public URLs back to logical bucket and key', async () => {
    const { storage } = await loadStorage({
      S3_PUBLIC_URL: 'https://file.chipscard.space',
      S3_BUCKET_NAME: 'chipscardspace',
    });

    expect(
      storage.parseObjectUrl('https://file.chipscard.space/chips-covers/cards/user-1/card-1/index.html'),
    ).toEqual({
      bucket: 'chips-covers',
      key: 'cards/user-1/card-1/index.html',
    });
  });

  it('parses development MinIO public URLs back to logical bucket and key', async () => {
    const { storage } = await loadStorage({
      NODE_ENV: 'development',
      S3_ENDPOINT: 'http://localhost:9000',
    });

    expect(
      storage.parseObjectUrl('http://localhost:9000/chips-card-resources/users/user-1/uploads/upload-1/resources/photo.png'),
    ).toEqual({
      bucket: 'chips-card-resources',
      key: 'users/user-1/uploads/upload-1/resources/photo.png',
    });
  });

  it('creates presigned PUT URLs for logical public resource buckets', async () => {
    const { storage } = await loadStorage({
      S3_PUBLIC_URL: 'https://file.chipscard.space',
      S3_BUCKET_NAME: 'chipscardspace',
    });

    const signed = storage.createPresignedPutUrl({
      bucket: 'chips-card-resources',
      key: 'users/user-1/uploads/upload-1/resources/photo.png',
      contentType: 'image/png',
      expiresInSeconds: 900,
      headers: {
        'x-amz-meta-chips-sha256': 'hash-value',
      },
    });
    const url = new URL(signed.url);

    expect(signed.method).toBe('PUT');
    expect(signed.headers).toMatchObject({
      'content-type': 'image/png',
      'x-amz-meta-chips-sha256': 'hash-value',
    });
    expect(url.origin).toBe('https://s3.ap-southeast-1.qiniucs.com');
    expect(url.pathname).toBe('/chipscardspace/chips-card-resources/users/user-1/uploads/upload-1/resources/photo.png');
    expect(url.searchParams.get('X-Amz-Algorithm')).toBe('AWS4-HMAC-SHA256');
    expect(url.searchParams.get('X-Amz-SignedHeaders')).toContain('content-type');
    expect(signed.publicUrl).toBe(
      'https://file.chipscard.space/chips-card-resources/users/user-1/uploads/upload-1/resources/photo.png',
    );
  });

  it('creates presigned GET URLs for client-side card download plans', async () => {
    const { storage } = await loadStorage({
      S3_PUBLIC_URL: 'https://file.chipscard.space',
      S3_BUCKET_NAME: 'chipscardspace',
    });

    const signed = storage.createPresignedGetUrl({
      bucket: 'chips-card-resources',
      key: 'cards/card-1/versions/version-1/network-card/card.card',
      expiresInSeconds: 900,
      responseContentDisposition: 'attachment; filename="Demo.card"',
    });
    const url = new URL(signed.url);

    expect(signed.method).toBe('GET');
    expect(signed.headers).toEqual({});
    expect(url.origin).toBe('https://s3.ap-southeast-1.qiniucs.com');
    expect(url.pathname).toBe('/chipscardspace/chips-card-resources/cards/card-1/versions/version-1/network-card/card.card');
    expect(url.searchParams.get('X-Amz-Algorithm')).toBe('AWS4-HMAC-SHA256');
    expect(url.searchParams.get('X-Amz-SignedHeaders')).toBe('host');
    expect(url.searchParams.get('X-Amz-Expires')).toBe('900');
    expect(url.searchParams.get('response-content-disposition')).toBe('attachment; filename="Demo.card"');
  });

  it('deletes listed physical keys from the single physical bucket', async () => {
    const { storage, sentCommands } = await loadStorage(
      {
        S3_PUBLIC_URL: 'https://file.chipscard.space',
        S3_BUCKET_NAME: 'chipscardspace',
      },
      [
        {
          Contents: [{ Key: 'chips-card-render-cache/card-1/cache-version/index.html' }],
          IsTruncated: false,
        },
      ],
    );

    await storage.deleteObjectsByPrefix('chips-card-render-cache', 'card-1/cache-version/');

    expect(sentCommands[0]?.input).toMatchObject({
      Bucket: 'chipscardspace',
      Prefix: 'chips-card-render-cache/card-1/cache-version/',
    });
    expect(sentCommands[1]?.input).toMatchObject({
      Bucket: 'chipscardspace',
      Delete: {
        Objects: [{ Key: 'chips-card-render-cache/card-1/cache-version/index.html' }],
        Quiet: true,
      },
    });
  });

  it('keeps source card files in their private physical bucket', async () => {
    const { storage, sentCommands } = await loadStorage({
      S3_PUBLIC_URL: 'https://file.chipscard.space',
      S3_BUCKET_NAME: 'chipscardspace',
    });
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccps-s3-test-'));
    const cardPath = path.join(tempDir, 'source.card');

    try {
      fs.writeFileSync(cardPath, 'card-package-bytes');

      const url = await storage.uploadFile({
        bucket: 'chips-card-files',
        key: 'user-1/card-1/source.card',
        filePath: cardPath,
      });

      expect(url).toBe('');
      expect(sentCommands[0]?.input).toMatchObject({
        Bucket: 'chips-card-files',
        Key: 'user-1/card-1/source.card',
      });
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

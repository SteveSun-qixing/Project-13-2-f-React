import { createHash } from 'node:crypto';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { TransferCompleted, TransferFailure, TransferProgress } from '../src/platform/contracts/index.js';
import { PAL_ERROR_CODES } from '../src/platform/errors.js';
import { createMacHttpPort, isHttpUrl } from '../src/platform/mac/http-port.js';
import { createMacShellOpenPort } from '../src/platform/mac/shell-open-port.js';
import { createMacTransferPort } from '../src/platform/mac/transfer-port.js';
import type { NetworkLimits } from '../src/platform/mac/net-request.js';
import { MockNetModule, MockShellModule } from './helpers/electron-mock.js';

/** 小尺寸网络限制；测试不等待真实超时。 */
function fastLimits(overrides: Partial<NetworkLimits>): Partial<NetworkLimits> {
  return {
    connectTimeoutMs: 500,
    idleTimeoutMs: 500,
    maxResponseBytes: 1024 * 1024,
    maxRedirects: 5,
    ...overrides,
  };
}

/** 传输事件收集器。 */
function collectTransferEvents(): {
  readonly events: {
    onProgress(event: TransferProgress): void;
    onCompleted(event: TransferCompleted): void;
    onFailed(event: TransferFailure): void;
  };
  readonly completed: Promise<TransferCompleted>;
  readonly failed: Promise<TransferFailure>;
  readonly progress: TransferProgress[];
} {
  let resolveCompleted: (event: TransferCompleted) => void = () => undefined;
  let resolveFailed: (event: TransferFailure) => void = () => undefined;
  const completed = new Promise<TransferCompleted>((resolve) => {
    resolveCompleted = resolve;
  });
  const failed = new Promise<TransferFailure>((resolve) => {
    resolveFailed = resolve;
  });
  const progress: TransferProgress[] = [];
  return {
    events: {
      onProgress: (event) => progress.push(event),
      onCompleted: (event) => resolveCompleted(event),
      onFailed: (event) => resolveFailed(event),
    },
    completed,
    failed,
    progress,
  };
}

describe('isHttpUrl', () => {
  it('should accept plain http and https URLs', () => {
    expect(isHttpUrl('https://example.com/a?b=c')).toBe(true);
    expect(isHttpUrl('http://127.0.0.1:8080/')).toBe(true);
  });

  it('should reject other schemes, userinfo and malformed URLs', () => {
    expect(isHttpUrl('ftp://example.com')).toBe(false);
    expect(isHttpUrl('file:///etc/passwd')).toBe(false);
    expect(isHttpUrl('data:text/plain,hi')).toBe(false);
    expect(isHttpUrl('https://user:pass@example.com')).toBe(false);
    expect(isHttpUrl('not a url')).toBe(false);
  });
});

describe('createMacHttpPort', () => {
  let net: MockNetModule;

  beforeEach(() => {
    net = new MockNetModule();
  });

  it('should reject non-http URLs before touching the network', async () => {
    const port = createMacHttpPort({ net });
    await expect(port.request({ url: 'ftp://example.com' })).rejects.toMatchObject({
      code: PAL_ERROR_CODES.HTTP_URL_INVALID,
      retryable: false,
    });
    expect(net.requests).toHaveLength(0);
  });

  it('should send method, headers and body', async () => {
    net.plan = () => ({ status: 200, chunks: ['ok'] });
    const port = createMacHttpPort({ net });
    const body = new Uint8Array([1, 2, 3]);

    const response = await port.request({
      url: 'https://api.example.com/v1/summary',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });

    const request = net.lastRequest;
    expect(request?.options).toMatchObject({
      url: 'https://api.example.com/v1/summary',
      method: 'POST',
      redirect: 'manual',
      credentials: 'omit',
    });
    expect(request?.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(request?.body).toEqual(Buffer.from(body));
    expect(response.status).toBe(200);
    expect(Buffer.from(response.body)).toEqual(Buffer.from('ok'));
  });

  it('should default to GET and normalize response headers', async () => {
    net.plan = () => ({
      status: 206,
      headers: { 'Content-Type': 'text/plain', 'X-Multi': ['a', 'b'], 'X-Empty': undefined },
      chunks: ['part'],
    });
    const port = createMacHttpPort({ net });

    const response = await port.request({ url: 'https://example.com/file' });
    expect(net.lastRequest?.options['method']).toBe('GET');
    expect(net.lastRequest?.body).toBeNull();
    expect(response.status).toBe(206);
    expect(response.headers).toEqual({
      'content-type': 'text/plain',
      'x-multi': 'a, b',
    });
  });

  it('should follow authorized redirects and resolve relative locations', async () => {
    net.plan = (request) =>
      request.options['url'] === 'https://a.example.com/start'
        ? { redirect: { status: 302, location: '/next' } }
        : { status: 200, chunks: ['final'] };
    const authorizeRedirect = vi.fn(() => Promise.resolve(true));
    const port = createMacHttpPort({ net });

    const response = await port.request({
      url: 'https://a.example.com/start',
      authorizeRedirect,
    });

    expect(authorizeRedirect).toHaveBeenCalledWith('https://a.example.com/next');
    expect(net.requests).toHaveLength(2);
    expect(net.requests[1]?.options['url']).toBe('https://a.example.com/next');
    expect(Buffer.from(response.body)).toEqual(Buffer.from('final'));
  });

  it('should deny redirects without authorization', async () => {
    net.plan = () => ({ redirect: { location: 'https://b.example.com/' } });
    const port = createMacHttpPort({ net });

    await expect(port.request({ url: 'https://a.example.com/' })).rejects.toMatchObject({
      code: PAL_ERROR_CODES.HTTP_REDIRECT_DENIED,
    });
  });

  it('should deny redirects rejected by the authorizer', async () => {
    net.plan = () => ({ redirect: { location: 'https://evil.example.com/' } });
    const port = createMacHttpPort({ net });

    await expect(
      port.request({
        url: 'https://a.example.com/',
        authorizeRedirect: () => Promise.resolve(false),
      }),
    ).rejects.toMatchObject({ code: PAL_ERROR_CODES.HTTP_REDIRECT_DENIED });
  });

  it('should deny unresolvable redirect locations', async () => {
    net.plan = () => ({ redirect: { location: 'http://[::1' } });
    const port = createMacHttpPort({ net });

    await expect(
      port.request({ url: 'https://a.example.com/', authorizeRedirect: () => Promise.resolve(true) }),
    ).rejects.toMatchObject({
      code: PAL_ERROR_CODES.HTTP_REDIRECT_DENIED,
      details: { host: null },
    });
  });

  it('should strip sensitive headers when redirecting across origins', async () => {
    net.plan = (request) =>
      request.options['url'] === 'https://a.example.com/start'
        ? { redirect: { location: 'https://b.example.com/next' } }
        : { status: 200, chunks: [] };
    const port = createMacHttpPort({ net });

    await port.request({
      url: 'https://a.example.com/start',
      headers: { Authorization: 'Bearer secret', Cookie: 'a=b', 'X-Keep': 'yes' },
      authorizeRedirect: () => Promise.resolve(true),
    });

    expect(net.requests[1]?.headers).toEqual({ 'X-Keep': 'yes' });
  });

  it('should keep headers on same-origin redirects', async () => {
    net.plan = (request) =>
      request.options['url'] === 'https://a.example.com/start'
        ? { redirect: { location: '/next' } }
        : { status: 200, chunks: [] };
    const port = createMacHttpPort({ net });

    await port.request({
      url: 'https://a.example.com/start',
      headers: { Authorization: 'Bearer secret' },
      authorizeRedirect: () => Promise.resolve(true),
    });

    expect(net.requests[1]?.headers).toEqual({ Authorization: 'Bearer secret' });
  });

  it('should switch 302 redirects of entity requests to GET', async () => {
    net.plan = (request) =>
      request.options['url'] === 'https://a.example.com/start'
        ? { redirect: { status: 302, location: '/next' } }
        : { status: 200, chunks: [] };
    const port = createMacHttpPort({ net });

    await port.request({
      url: 'https://a.example.com/start',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Keep': 'yes' },
      body: new Uint8Array([1]),
      authorizeRedirect: () => Promise.resolve(true),
    });

    const second = net.requests[1];
    expect(second?.options['method']).toBe('GET');
    expect(second?.body).toBeNull();
    expect(second?.headers).toEqual({ 'X-Keep': 'yes' });
  });

  it('should fail after exceeding the redirect limit', async () => {
    net.plan = () => ({ redirect: { location: 'https://a.example.com/loop' } });
    const port = createMacHttpPort({ net, limits: fastLimits({ maxRedirects: 2 }) });

    await expect(
      port.request({ url: 'https://a.example.com/', authorizeRedirect: () => Promise.resolve(true) }),
    ).rejects.toMatchObject({
      code: PAL_ERROR_CODES.HTTP_REQUEST_FAILED,
      details: { reason: 'too-many-redirects', maxRedirects: 2 },
    });
    expect(net.requests).toHaveLength(3);
  });

  it('should abort responses that exceed the size limit', async () => {
    net.plan = () => ({ chunks: ['12345'] });
    const port = createMacHttpPort({ net, limits: fastLimits({ maxResponseBytes: 4 }) });

    await expect(port.request({ url: 'https://example.com/big' })).rejects.toMatchObject({
      code: PAL_ERROR_CODES.HTTP_REQUEST_FAILED,
      details: { reason: 'response-too-large', limitBytes: 4 },
    });
  });

  it('should time out when the connection does not respond', async () => {
    net.plan = () => ({ responseDelayMs: 50 });
    const port = createMacHttpPort({ net, limits: fastLimits({ connectTimeoutMs: 5 }) });

    await expect(port.request({ url: 'https://example.com/slow' })).rejects.toMatchObject({
      code: PAL_ERROR_CODES.BRIDGE_TIMEOUT,
      details: { reason: 'connect-timeout' },
    });
  });

  it('should time out idle response bodies', async () => {
    net.plan = () => ({ chunks: ['a'], holdBeforeEnd: true });
    const port = createMacHttpPort({ net, limits: fastLimits({ idleTimeoutMs: 5 }) });

    await expect(port.request({ url: 'https://example.com/stall' })).rejects.toMatchObject({
      code: PAL_ERROR_CODES.BRIDGE_TIMEOUT,
      details: { reason: 'idle-timeout' },
    });
  });

  it('should honor the absolute deadline', async () => {
    net.plan = () => ({ responseDelayMs: 50 });
    const port = createMacHttpPort({ net, limits: fastLimits({}) });

    await expect(port.request({ url: 'https://example.com/slow', deadline: Date.now() + 5 })).rejects.toMatchObject({
      code: PAL_ERROR_CODES.BRIDGE_TIMEOUT,
      details: { reason: 'deadline' },
    });
  });

  it('should cancel in-flight requests through the call signal', async () => {
    net.plan = () => ({ chunks: ['a'], holdBeforeEnd: true });
    const port = createMacHttpPort({ net });
    const controller = new AbortController();
    const pending = port.request({
      url: 'https://example.com/stream',
      signal: controller.signal,
    });

    await vi.waitFor(() => {
      expect(net.lastRequest?.response).not.toBeNull();
    });
    controller.abort();

    await expect(pending).rejects.toMatchObject({ code: PAL_ERROR_CODES.BRIDGE_CANCELLED });
  });

  it('should reject already-cancelled calls', async () => {
    const controller = new AbortController();
    controller.abort();
    const port = createMacHttpPort({ net });
    await expect(port.request({ url: 'https://example.com/', signal: controller.signal })).rejects.toMatchObject({
      code: PAL_ERROR_CODES.BRIDGE_CANCELLED,
    });
    expect(net.requests).toHaveLength(0);
  });

  it('should normalize request creation failures', async () => {
    net.requestError = new Error('net broken');
    const port = createMacHttpPort({ net });
    await expect(port.request({ url: 'https://example.com/' })).rejects.toMatchObject({
      code: PAL_ERROR_CODES.HTTP_REQUEST_FAILED,
      details: { reason: 'request-create-failed' },
    });
  });

  it('should normalize network and response errors', async () => {
    const port = createMacHttpPort({ net });
    net.plan = () => ({ error: new Error('dns') });
    await expect(port.request({ url: 'https://example.com/a' })).rejects.toMatchObject({
      code: PAL_ERROR_CODES.HTTP_REQUEST_FAILED,
      details: { reason: 'network-error' },
    });

    net.plan = () => ({ chunks: ['a'], responseError: new Error('reset') });
    await expect(port.request({ url: 'https://example.com/b' })).rejects.toMatchObject({
      code: PAL_ERROR_CODES.HTTP_REQUEST_FAILED,
      details: { reason: 'response-error' },
    });
  });
});

describe('createMacTransferPort', () => {
  let net: MockNetModule;
  let root: string;

  beforeEach(async () => {
    net = new MockNetModule();
    root = await mkdtemp(join(tmpdir(), 'chips-pal-transfer-'));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  /** 下载并等待完成事件。 */
  async function downloadAndWait(
    target: string,
    options: {
      readonly url?: string;
      readonly expectedDigest?: string;
      readonly overwrite?: boolean;
      readonly authorizeRedirect?: (url: string) => Promise<boolean>;
      readonly progressIntervalMs?: number;
      readonly limits?: Partial<NetworkLimits>;
    } = {},
  ): Promise<{
    port: ReturnType<typeof createMacTransferPort>;
    transferId: string;
    collector: ReturnType<typeof collectTransferEvents>;
  }> {
    const collector = collectTransferEvents();
    const port = createMacTransferPort({
      net,
      progressIntervalMs: options.progressIntervalMs ?? 0,
      ...(options.limits !== undefined ? { limits: options.limits } : {}),
    });
    const downloadOptions = {
      url: options.url ?? 'https://example.com/assets/template.card',
      target,
      ...(options.expectedDigest !== undefined ? { expectedDigest: options.expectedDigest } : {}),
      ...(options.overwrite !== undefined ? { overwrite: options.overwrite } : {}),
      ...(options.authorizeRedirect !== undefined ? { authorizeRedirect: options.authorizeRedirect } : {}),
    };
    const { transferId } = await port.download(downloadOptions, collector.events);
    return { port, transferId, collector };
  }

  it('should download to the target path with digest and progress events', async () => {
    net.plan = () => ({
      status: 200,
      headers: { 'content-length': '11' },
      chunks: ['hello ', 'world'],
    });
    const target = join(root, 'template.card');
    const { collector } = await downloadAndWait(target);

    const completed = await collector.completed;
    expect(completed.target).toBe(target);
    expect(completed.digest).toBe(`sha256:${createHash('sha256').update('hello world').digest('hex')}`);
    expect(await readFile(target, 'utf8')).toBe('hello world');
    expect(collector.progress.length).toBeGreaterThan(0);
    expect(collector.progress.at(-1)).toEqual({ transferredBytes: 11, totalBytes: 11 });
    expect(await readdir(root)).toEqual(['template.card']);
  });

  it('should verify the expected digest and keep the target untouched on mismatch', async () => {
    net.plan = () => ({ chunks: ['content'] });
    const target = join(root, 'card.card');
    const { collector } = await downloadAndWait(target, {
      expectedDigest: `sha256:${'0'.repeat(64)}`,
    });

    const failure = await collector.failed;
    expect(failure.code).toBe(PAL_ERROR_CODES.TRANSFER_DIGEST_MISMATCH);
    expect(failure.retryable).toBe(false);
    await expect(readFile(target)).rejects.toThrow();
    expect((await readdir(root)).filter((name) => name.includes('chips-transfer-tmp'))).toEqual([]);
  });

  it('should accept matching digests', async () => {
    net.plan = () => ({ chunks: ['payload'] });
    const target = join(root, 'card.card');
    const digest = `sha256:${createHash('sha256').update('payload').digest('hex')}`;
    const { collector } = await downloadAndWait(target, { expectedDigest: digest });

    await expect(collector.completed).resolves.toMatchObject({ target, digest });
  });

  it('should reject existing targets unless overwrite is requested', async () => {
    const target = join(root, 'existing.card');
    await writeFile(target, 'old');
    net.plan = () => ({ chunks: ['new'] });
    const port = createMacTransferPort({ net });

    await expect(
      port.download({ url: 'https://example.com/a', target }, collectTransferEvents().events),
    ).rejects.toMatchObject({ code: PAL_ERROR_CODES.TRANSFER_TARGET_EXISTS });

    const { collector } = await downloadAndWait(target, { overwrite: true });
    await collector.completed;
    expect(await readFile(target, 'utf8')).toBe('new');
  });

  it('should reject invalid URLs and relative targets', async () => {
    const port = createMacTransferPort({ net });
    const collector = collectTransferEvents();
    await expect(
      port.download({ url: 'ftp://example.com/a', target: join(root, 'a') }, collector.events),
    ).rejects.toMatchObject({ code: PAL_ERROR_CODES.HTTP_URL_INVALID });
    await expect(
      port.download({ url: 'https://example.com/a', target: 'relative.card' }, collector.events),
    ).rejects.toMatchObject({
      code: PAL_ERROR_CODES.TRANSFER_FAILED,
      details: { reason: 'target-not-absolute' },
    });
  });

  it('should throttle progress events to the configured interval', async () => {
    net.plan = () => ({ chunks: ['a', 'b', 'c'] });
    const target = join(root, 'throttled.card');
    const { collector } = await downloadAndWait(target, { progressIntervalMs: 60_000 });

    await collector.completed;
    expect(collector.progress).toHaveLength(1);
  });

  it('should cancel downloads, clean temporary files and leave the target absent', async () => {
    net.plan = () => ({ chunks: ['partial'], holdBeforeEnd: true });
    const target = join(root, 'cancelled.card');
    const { port, transferId, collector } = await downloadAndWait(target);

    await vi.waitFor(() => {
      expect(net.lastRequest?.response).not.toBeNull();
    });
    await port.cancel(transferId);

    const failure = await collector.failed;
    expect(failure.cancelled).toBe(true);
    expect(failure.code).toBe(PAL_ERROR_CODES.BRIDGE_CANCELLED);
    await expect(readFile(target)).rejects.toThrow();
    expect((await readdir(root)).filter((name) => name.includes('chips-transfer-tmp'))).toEqual([]);

    await expect(port.cancel(transferId)).resolves.toBeUndefined();
    await expect(port.cancel('missing')).resolves.toBeUndefined();
  });

  it('should gate redirects through authorizeRedirect', async () => {
    net.plan = () => ({ redirect: { location: 'https://cdn.example.com/next' } });
    const target = join(root, 'redirect.card');
    const { collector } = await downloadAndWait(target, {
      authorizeRedirect: () => Promise.resolve(false),
    });

    const failure = await collector.failed;
    expect(failure.code).toBe(PAL_ERROR_CODES.HTTP_REDIRECT_DENIED);
    expect(failure.retryable).toBe(false);
  });

  it('should normalize network failures to TRANSFER_FAILED', async () => {
    net.plan = () => ({ error: new Error('network down') });
    const target = join(root, 'failed.card');
    const { collector } = await downloadAndWait(target);

    const failure = await collector.failed;
    expect(failure.code).toBe(PAL_ERROR_CODES.TRANSFER_FAILED);
    expect(failure.retryable).toBe(true);
    await expect(readFile(target)).rejects.toThrow();
  });

  it('should map transfer timeouts to TRANSFER_FAILED', async () => {
    net.plan = () => ({ responseDelayMs: 50 });
    const target = join(root, 'timeout.card');
    const { collector } = await downloadAndWait(target, {
      limits: { connectTimeoutMs: 5 },
    });

    const failure = await collector.failed;
    expect(failure.code).toBe(PAL_ERROR_CODES.TRANSFER_FAILED);
    expect(failure.details).toMatchObject({ causeCode: PAL_ERROR_CODES.BRIDGE_TIMEOUT });
  });

  it('should reject aborted download calls before starting', async () => {
    const controller = new AbortController();
    controller.abort();
    const port = createMacTransferPort({ net });
    await expect(
      port.download(
        { url: 'https://example.com/a', target: join(root, 'a.card'), signal: controller.signal },
        collectTransferEvents().events,
      ),
    ).rejects.toMatchObject({ code: PAL_ERROR_CODES.BRIDGE_CANCELLED });
  });
});

describe('createMacShellOpenPort', () => {
  let shell: MockShellModule;

  beforeEach(() => {
    shell = new MockShellModule();
  });

  it('should open http, https and mailto URLs', async () => {
    const port = createMacShellOpenPort(shell);
    await port.openExternal('https://example.com/');
    await port.openExternal('http://example.com/');
    await port.openExternal('mailto:hello@example.com');

    expect(shell.opened).toEqual(['https://example.com/', 'http://example.com/', 'mailto:hello@example.com']);
  });

  it('should deny other schemes and malformed URLs', async () => {
    const port = createMacShellOpenPort(shell);
    for (const url of ['file:///etc/passwd', 'javascript:alert(1)', 'chips://x', 'no-scheme']) {
      await expect(port.openExternal(url)).rejects.toMatchObject({
        code: PAL_ERROR_CODES.SHELL_SCHEME_DENIED,
        retryable: false,
      });
    }
    expect(shell.opened).toEqual([]);
  });

  it('should normalize open failures', async () => {
    shell.openError = new Error('no handler');
    await expect(createMacShellOpenPort(shell).openExternal('https://example.com/')).rejects.toMatchObject({
      code: PAL_ERROR_CODES.SHELL_OPEN_FAILED,
      retryable: true,
    });
  });

  it('should reject aborted calls', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      createMacShellOpenPort(shell).openExternal('https://example.com/', {
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ code: PAL_ERROR_CODES.BRIDGE_CANCELLED });
  });
});

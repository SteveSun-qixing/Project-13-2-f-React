import Fastify from 'fastify';
import fastifyMultipart from '@fastify/multipart';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const roomServiceMock = {
  assertOwnedByUser: vi.fn(),
};

const boxServiceMock = {
  unpack: vi.fn(),
  create: vi.fn(),
};

const sha256FileMock = vi.fn();
const uploadFileMock = vi.fn();

vi.mock('../services/room.service', () => ({
  RoomService: roomServiceMock,
}));

vi.mock('../services/box.service', () => ({
  BoxService: boxServiceMock,
}));

vi.mock('../storage/buckets', () => ({
  Bucket: {
    BOX_FILES: 'chips-box-files',
  },
}));

vi.mock('../storage/s3', () => ({
  sha256File: sha256FileMock,
  uploadFile: uploadFileMock,
}));

vi.mock('../config/env', () => ({
  env: {
    MAX_BOX_SIZE_MB: 100,
  },
}));

async function buildUploadApp() {
  const { default: uploadRoutes } = await import('./upload');
  const { default: errorHandlerPlugin } = await import('../plugins/error-handler.plugin');
  const app = Fastify();
  await app.register(fastifyMultipart, {
    attachFieldsToBody: false,
  });
  await errorHandlerPlugin(app, {});
  app.decorate('authenticate', async (request: { user?: unknown }) => {
    request.user = { userId: 'user-1', role: 'user', jti: 'jwt-1' };
  });
  await app.register(uploadRoutes);
  return app;
}

function createMultipartBody(params: {
  fields?: Record<string, string>;
  fileField?: string;
  filename?: string;
  contentType?: string;
  fileBody?: Buffer | string;
}) {
  const boundary = `----chips-upload-test-${Math.random().toString(16).slice(2)}`;
  const chunks: Buffer[] = [];

  for (const [name, value] of Object.entries(params.fields ?? {})) {
    chunks.push(Buffer.from(`--${boundary}\r\n`));
    chunks.push(Buffer.from(`Content-Disposition: form-data; name="${name}"\r\n\r\n`));
    chunks.push(Buffer.from(`${value}\r\n`));
  }

  if (params.fileField) {
    chunks.push(Buffer.from(`--${boundary}\r\n`));
    chunks.push(
      Buffer.from(
        `Content-Disposition: form-data; name="${params.fileField}"; filename="${params.filename ?? 'demo.box'}"\r\n`,
      ),
    );
    chunks.push(Buffer.from(`Content-Type: ${params.contentType ?? 'application/octet-stream'}\r\n\r\n`));
    chunks.push(Buffer.isBuffer(params.fileBody) ? params.fileBody : Buffer.from(params.fileBody ?? 'box-bytes'));
    chunks.push(Buffer.from('\r\n'));
  }

  chunks.push(Buffer.from(`--${boundary}--\r\n`));

  return {
    body: Buffer.concat(chunks),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

beforeEach(() => {
  boxServiceMock.unpack.mockResolvedValue({
    tempDir: '/tmp/ccps-box-test-dir',
    metadata: {
      box_id: 'b1C2d3E4f5',
      name: '测试箱子',
      active_layout_type: 'chips.layout.grid',
    },
    structure: { entries: [] },
    content: { active_layout_type: 'chips.layout.grid', layout_configs: {} },
  });
  sha256FileMock.mockResolvedValue('a'.repeat(64));
  uploadFileMock.mockResolvedValue('');
  boxServiceMock.create.mockResolvedValue({
    id: 'box-1',
    title: '测试箱子',
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('upload routes', () => {
  it('stores the box source in chips-box-files and persists via the new BoxService contract', async () => {
    const app = await buildUploadApp();
    const multipart = createMultipartBody({
      fields: {
        roomId: '11111111-1111-4111-8111-111111111111',
        visibility: 'private',
      },
      fileField: 'file',
      filename: 'demo.box',
      contentType: 'application/vnd.chips.box+zip',
      fileBody: 'box-bytes',
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/upload/box',
      headers: {
        'content-type': multipart.contentType,
      },
      payload: multipart.body,
    });

    expect(response.statusCode).toBe(201);
    expect(roomServiceMock.assertOwnedByUser).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
      'user-1',
    );
    expect(boxServiceMock.unpack).toHaveBeenCalledWith(expect.stringContaining('.box'));
    expect(sha256FileMock).toHaveBeenCalledWith(expect.stringContaining('.box'));
    expect(uploadFileMock).toHaveBeenCalledWith(
      expect.objectContaining({
        bucket: 'chips-box-files',
        key: expect.stringMatching(/^boxes\/user-1\/uploads\/[\w-]+\/box\.box$/),
        contentType: 'application/vnd.chips.box+zip',
      }),
    );
    expect(boxServiceMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        roomId: '11111111-1111-4111-8111-111111111111',
        visibility: 'private',
        fileSizeBytes: Buffer.byteLength('box-bytes'),
        sourceBoxBucket: 'chips-box-files',
        sourceBoxSha256: 'a'.repeat(64),
        metadata: expect.objectContaining({ box_id: 'b1C2d3E4f5' }),
        structure: { entries: [] },
        content: expect.objectContaining({ active_layout_type: 'chips.layout.grid' }),
      }),
    );
    expect(response.json().data).toEqual({
      boxId: 'box-1',
      title: '测试箱子',
    });

    await app.close();
  });

  it('rejects card files on the legacy upload route', async () => {
    const app = await buildUploadApp();
    const multipart = createMultipartBody({
      fileField: 'file',
      filename: 'demo.card',
      contentType: 'application/vnd.chips.card+zip',
      fileBody: 'card-bytes',
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/upload/box',
      headers: {
        'content-type': multipart.contentType,
      },
      payload: multipart.body,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('FILE_TYPE_INVALID');
    expect(boxServiceMock.unpack).not.toHaveBeenCalled();
    expect(boxServiceMock.create).not.toHaveBeenCalled();

    await app.close();
  });

  it('does not expose the old browser card upload endpoints', async () => {
    const app = await buildUploadApp();

    const createSessionResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/upload-sessions',
      payload: {},
    });
    const submitCardResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/upload/card',
      payload: {},
    });

    expect(createSessionResponse.statusCode).toBe(404);
    expect(submitCardResponse.statusCode).toBe(404);

    await app.close();
  });
});

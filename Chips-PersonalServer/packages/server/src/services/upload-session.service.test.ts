import { afterEach, describe, expect, it, vi } from 'vitest';

const uploadSessionsTable = {
  id: 'upload_sessions.id',
  userId: 'upload_sessions.user_id',
  idempotencyKey: 'upload_sessions.idempotency_key',
};
const uploadSessionResourcesTable = {
  id: 'upload_session_resources.id',
  uploadSessionId: 'upload_session_resources.upload_session_id',
  relativePath: 'upload_session_resources.relative_path',
};

const findSessionMock = vi.fn();
const findResourcesMock = vi.fn();
const insertValuesMock = vi.fn();
const updateSetMock = vi.fn();
const createPresignedPutUrlMock = vi.fn();
const buildObjectUrlMock = vi.fn();
const headObjectMock = vi.fn();

vi.mock('../db/client', () => ({
  db: {
    query: {
      uploadSessions: {
        findFirst: findSessionMock,
      },
      uploadSessionResources: {
        findMany: findResourcesMock,
      },
    },
    insert: vi.fn(() => ({
      values: insertValuesMock,
    })),
    update: vi.fn(() => ({
      set: updateSetMock,
    })),
  },
}));

vi.mock('../db/schema/upload-sessions', () => ({
  uploadSessions: uploadSessionsTable,
  uploadSessionResources: uploadSessionResourcesTable,
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...conditions) => ({ op: 'and', conditions })),
  eq: vi.fn((left, right) => ({ op: 'eq', left, right })),
}));

vi.mock('../storage/buckets', () => ({
  Bucket: {
    CARD_RESOURCES: 'chips-card-resources',
  },
}));

vi.mock('../storage/s3', () => ({
  buildObjectUrl: buildObjectUrlMock,
  createPresignedPutUrl: createPresignedPutUrlMock,
  headObject: headObjectMock,
}));

vi.mock('../config/env', () => ({
  env: {
    UPLOAD_SESSION_TTL_MINUTES: 60,
  },
}));

function mockUpdateReturning(record?: Record<string, unknown>) {
  updateSetMock.mockReturnValue({
    where: vi.fn(() => ({
      returning: vi.fn(async () => (record ? [record] : [])),
    })),
  });
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('UploadSessionService', () => {
  it('creates upload sessions with final resource prefix after the id exists', async () => {
    const { UploadSessionService } = await import('./upload-session.service');
    const created = {
      id: 'upload-1',
      userId: 'user-1',
      contentType: 'card',
      resourcePrefix: 'users/user-1/uploads/session-pending/resources',
      expiresAt: new Date('2026-05-29T10:00:00.000Z'),
    };
    const updated = {
      ...created,
      resourcePrefix: 'users/user-1/uploads/upload-1/resources',
    };

    findSessionMock.mockResolvedValue(null);
    insertValuesMock.mockReturnValue({
      returning: vi.fn(async () => [created]),
    });
    mockUpdateReturning(updated);

    const session = await UploadSessionService.create('user-1', {
      contentType: 'card',
      fileName: 'demo.card',
      visibility: 'public',
      idempotencyKey: 'publish-demo',
      client: {
        name: 'community-uploader',
        version: '1.0.0',
        platform: 'darwin',
      },
    });

    expect(session.resourcePrefix).toBe('users/user-1/uploads/upload-1/resources');
    expect(insertValuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        contentType: 'card',
        fileName: 'demo.card',
        resourcePrefix: 'users/user-1/uploads/session-pending/resources',
        idempotencyKey: 'publish-demo',
        clientName: 'community-uploader',
        clientVersion: '1.0.0',
        clientPlatform: 'darwin',
      }),
    );
    expect(updateSetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        resourcePrefix: 'users/user-1/uploads/upload-1/resources',
      }),
    );
  });

  it('returns an existing idempotent upload session for the same user', async () => {
    const { UploadSessionService } = await import('./upload-session.service');
    const existing = {
      id: 'upload-existing',
      userId: 'user-1',
      contentType: 'card',
      resourcePrefix: 'users/user-1/uploads/upload-existing/resources',
      expiresAt: new Date('2026-05-29T10:00:00.000Z'),
    };
    findSessionMock.mockResolvedValue(existing);

    const session = await UploadSessionService.create('user-1', {
      contentType: 'card',
      visibility: 'private',
      idempotencyKey: 'same-operation',
    });

    expect(session).toBe(existing);
    expect(insertValuesMock).not.toHaveBeenCalled();
  });

  it('presigns resource uploads and stores normalized resource records', async () => {
    const { UploadSessionService } = await import('./upload-session.service');
    findSessionMock.mockResolvedValue({
      id: 'upload-1',
      userId: 'user-1',
      contentType: 'card',
      resourcePrefix: 'users/user-1/uploads/upload-1/resources',
      expiresAt: new Date(Date.now() + 60000),
    });
    createPresignedPutUrlMock.mockReturnValue({
      url: 'https://s3.example/presigned',
      method: 'PUT',
      headers: {
        'content-type': 'image/png',
      },
    });
    buildObjectUrlMock.mockReturnValue(
      'https://file.example/chips-card-resources/users/user-1/uploads/upload-1/resources/images/photo.png',
    );
    insertValuesMock.mockReturnValue({
      onConflictDoUpdate: vi.fn(async () => undefined),
    });
    mockUpdateReturning();

    const result = await UploadSessionService.presignResources('upload-1', 'user-1', {
      resources: [
        {
          relativePath: './images/../images/photo.png',
          sizeBytes: 12,
          sha256: 'a'.repeat(64),
          mimeType: 'image/png',
        },
      ],
    });

    expect(createPresignedPutUrlMock).toHaveBeenCalledWith({
      bucket: 'chips-card-resources',
      key: 'users/user-1/uploads/upload-1/resources/images/photo.png',
      contentType: 'image/png',
      expiresInSeconds: 3600,
      headers: {
        'x-amz-meta-chips-sha256': 'a'.repeat(64),
        'x-amz-meta-chips-upload-session': 'upload-1',
      },
    });
    expect(insertValuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        uploadSessionId: 'upload-1',
        relativePath: 'images/photo.png',
        bucket: 'chips-card-resources',
        objectKey: 'users/user-1/uploads/upload-1/resources/images/photo.png',
        publicUrl: 'https://file.example/chips-card-resources/users/user-1/uploads/upload-1/resources/images/photo.png',
        status: 'presigned',
      }),
    );
    expect(result.resources[0]).toMatchObject({
      relativePath: 'images/photo.png',
      publicUrl: 'https://file.example/chips-card-resources/users/user-1/uploads/upload-1/resources/images/photo.png',
      uploadUrl: 'https://s3.example/presigned',
      method: 'PUT',
    });
    expect(updateSetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'uploading_resources',
      }),
    );
  });

  it('rejects resource paths that traverse outside the card root', async () => {
    const { UploadSessionService } = await import('./upload-session.service');
    findSessionMock.mockResolvedValue({
      id: 'upload-1',
      userId: 'user-1',
      contentType: 'card',
      resourcePrefix: 'users/user-1/uploads/upload-1/resources',
      expiresAt: new Date(Date.now() + 60000),
    });

    await expect(
      UploadSessionService.presignResources('upload-1', 'user-1', {
        resources: [
          {
            relativePath: '../secrets.txt',
            sizeBytes: 12,
            sha256: 'a'.repeat(64),
            mimeType: 'text/plain',
          },
        ],
      }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });

    expect(createPresignedPutUrlMock).not.toHaveBeenCalled();
  });

  it('marks expired sessions before rejecting them', async () => {
    const { UploadSessionService } = await import('./upload-session.service');
    findSessionMock.mockResolvedValue({
      id: 'upload-expired',
      userId: 'user-1',
      contentType: 'card',
      expiresAt: new Date(Date.now() - 60000),
    });
    mockUpdateReturning();

    await expect(UploadSessionService.getOwned('upload-expired', 'user-1')).rejects.toMatchObject({
      code: 'UPLOAD_SESSION_EXPIRED',
    });
    expect(updateSetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'expired',
      }),
    );
  });

  it('verifies uploaded resources through object metadata', async () => {
    const { UploadSessionService } = await import('./upload-session.service');
    findResourcesMock.mockResolvedValue([
      {
        id: 'resource-1',
        relativePath: 'images/photo.png',
        bucket: 'chips-card-resources',
        objectKey: 'users/user-1/uploads/upload-1/resources/images/photo.png',
        publicUrl: 'https://file.example/chips-card-resources/users/user-1/uploads/upload-1/resources/images/photo.png',
        sizeBytes: 12,
        sha256: 'a'.repeat(64),
        mimeType: 'image/png',
      },
    ]);
    headObjectMock.mockResolvedValue({
      contentLength: 12,
      metadata: {
        'chips-sha256': 'a'.repeat(64),
      },
    });
    mockUpdateReturning();

    const resources = await UploadSessionService.verifyResources({
      id: 'upload-1',
    } as never);

    expect(resources).toEqual([
      {
        relativePath: 'images/photo.png',
        publicUrl: 'https://file.example/chips-card-resources/users/user-1/uploads/upload-1/resources/images/photo.png',
        sizeBytes: 12,
        sha256: 'a'.repeat(64),
        mimeType: 'image/png',
      },
    ]);
    expect(updateSetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'verified',
      }),
    );
  });

  it('rejects submitted cards that still contain uploaded resource files', async () => {
    const { UploadSessionService } = await import('./upload-session.service');

    expect(() =>
      UploadSessionService.assertResourcesMatchCard(
        {
          resourceFiles: [{ relativePath: 'images/photo.png' }],
          metadata: {},
          structure: {},
          contentMap: new Map(),
          coverHtml: '',
        } as never,
        [
          {
            relativePath: 'images/photo.png',
            publicUrl: 'https://file.example/photo.png',
            sizeBytes: 12,
            sha256: 'a'.repeat(64),
            mimeType: 'image/png',
          },
        ],
      ),
    ).toThrow(/still contains resources/);
  });
});

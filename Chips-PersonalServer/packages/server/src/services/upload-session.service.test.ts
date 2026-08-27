import { afterEach, describe, expect, it, vi } from 'vitest';

const uploadSessionsTable = {
  id: 'upload_sessions.id',
  idempotencyKey: 'upload_sessions.idempotency_key',
};

const findSessionMock = vi.fn();
const insertValuesMock = vi.fn();
const updateSetMock = vi.fn();

vi.mock('../db/client', () => ({
  db: {
    query: {
      uploadSessions: {
        findFirst: findSessionMock,
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
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...conditions) => ({ op: 'and', conditions })),
  eq: vi.fn((left, right) => ({ op: 'eq', left, right })),
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
      contentType: 'card',
      resourcePrefix: 'uploads/session-pending/resources',
      expiresAt: new Date('2026-05-29T10:00:00.000Z'),
    };
    const updated = {
      ...created,
      resourcePrefix: 'uploads/upload-1/resources',
    };

    findSessionMock.mockResolvedValue(null);
    insertValuesMock.mockReturnValue({
      returning: vi.fn(async () => [created]),
    });
    mockUpdateReturning(updated);

    const session = await UploadSessionService.create({
      contentType: 'card',
      fileName: 'demo.card',
      visibility: 'public',
      includeRenderArtifacts: true,
      idempotencyKey: 'publish-demo',
      client: {
        name: 'community-uploader',
        version: '1.0.0',
        platform: 'darwin',
      },
    });

    expect(session.resourcePrefix).toBe('uploads/upload-1/resources');
    expect(insertValuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        contentType: 'card',
        fileName: 'demo.card',
        includeRenderArtifacts: true,
        resourcePrefix: 'uploads/session-pending/resources',
        idempotencyKey: 'publish-demo',
        clientName: 'community-uploader',
        clientVersion: '1.0.0',
        clientPlatform: 'darwin',
      }),
    );
    expect(updateSetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        resourcePrefix: 'uploads/upload-1/resources',
      }),
    );
  });

  it('returns an existing idempotent upload session', async () => {
    const { UploadSessionService } = await import('./upload-session.service');
    const existing = {
      id: 'upload-existing',
      contentType: 'card',
      resourcePrefix: 'uploads/upload-existing/resources',
      expiresAt: new Date('2026-05-29T10:00:00.000Z'),
    };
    findSessionMock.mockResolvedValue(existing);

    const session = await UploadSessionService.create({
      contentType: 'card',
      visibility: 'private',
      idempotencyKey: 'same-operation',
    });

    expect(session).toBe(existing);
    expect(insertValuesMock).not.toHaveBeenCalled();
  });

  it('marks expired sessions before rejecting them', async () => {
    const { UploadSessionService } = await import('./upload-session.service');
    const expired = {
      id: 'upload-expired',
      contentType: 'card',
      resourcePrefix: 'uploads/upload-expired/resources',
      expiresAt: new Date('2020-01-01T00:00:00.000Z'),
      status: 'created',
    };
    findSessionMock.mockResolvedValue(expired);
    mockUpdateReturning();

    await expect(UploadSessionService.getById('upload-expired')).rejects.toMatchObject({
      code: 'UPLOAD_SESSION_EXPIRED',
    });
    expect(updateSetMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'expired' }),
    );
  });

  it('returns the upload session when it has not expired', async () => {
    const { UploadSessionService } = await import('./upload-session.service');
    const session = {
      id: 'upload-ok',
      contentType: 'card',
      resourcePrefix: 'uploads/upload-ok/resources',
      expiresAt: new Date('2099-01-01T00:00:00.000Z'),
      status: 'created',
    };
    findSessionMock.mockResolvedValue(session);

    const result = await UploadSessionService.getById('upload-ok');
    expect(result).toBe(session);
    expect(updateSetMock).not.toHaveBeenCalled();
  });

  it('throws not found when the session does not exist', async () => {
    const { UploadSessionService } = await import('./upload-session.service');
    findSessionMock.mockResolvedValue(null);

    await expect(UploadSessionService.getById('missing')).rejects.toMatchObject({
      code: 'UPLOAD_SESSION_NOT_FOUND',
    });
  });
});

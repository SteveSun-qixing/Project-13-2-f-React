import Fastify from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';

const roomServiceMock = {
  getAccessible: vi.fn(),
  getContentCounts: vi.fn(),
  listByUser: vi.fn(),
  toDTO: vi.fn((room: Record<string, unknown>) => room),
};

const cardServiceMock = {
  listByRoom: vi.fn(),
  toSummaryDTO: vi.fn((card: Record<string, unknown>) => card),
};

const boxServiceMock = {
  listByRoom: vi.fn(),
  toDTO: vi.fn((box: Record<string, unknown>) => box),
  toSummaryDTO: vi.fn((box: Record<string, unknown>) => box),
};

const userServiceMock = {
  findByUsername: vi.fn(),
};

vi.mock('../storage/s3', () => ({
  uploadBuffer: vi.fn(),
}));

vi.mock('../services/room.service', () => ({
  RoomService: roomServiceMock,
}));

vi.mock('../services/card.service', () => ({
  CardService: cardServiceMock,
}));

vi.mock('../services/box.service', () => ({
  BoxService: boxServiceMock,
}));

vi.mock('../services/user.service', () => ({
  UserService: userServiceMock,
}));

describe('rooms route authorization', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('查询房间详情时按请求者身份计算内容计数，避免公开元数据泄露', async () => {
    const { default: roomRoutes } = await import('./rooms');
    const app = Fastify();

    app.decorate('authenticate', async () => {});
    app.decorate('optionalAuthenticate', async (request: { user?: unknown }) => {
      request.user = { userId: 'viewer-user', role: 'user', jti: 'jwt-1' };
    });

    roomServiceMock.getAccessible.mockResolvedValue({
      id: 'room-1',
      userId: 'owner-user',
      name: '公开房间',
      slug: 'public-room',
      description: null,
      coverUrl: null,
      visibility: 'public',
      createdAt: new Date('2026-03-25T00:00:00.000Z'),
      updatedAt: new Date('2026-03-25T00:00:00.000Z'),
    });
    roomServiceMock.getContentCounts.mockResolvedValue({
      cardCount: 3,
      boxCount: 1,
    });

    await app.register(roomRoutes);

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/rooms/room-1',
    });

    expect(response.statusCode).toBe(200);
    expect(roomServiceMock.getContentCounts).toHaveBeenCalledWith(
      'room-1',
      'viewer-user',
      'owner-user',
    );

    await app.close();
  });

  it('查询用户房间列表时按请求者身份计算每个房间计数', async () => {
    const { default: roomRoutes } = await import('./rooms');
    const app = Fastify();

    app.decorate('authenticate', async () => {});
    app.decorate('optionalAuthenticate', async (request: { user?: unknown }) => {
      request.user = { userId: 'viewer-user', role: 'user', jti: 'jwt-1' };
    });

    userServiceMock.findByUsername.mockResolvedValue({
      id: 'owner-user',
      username: 'alice',
      isActive: true,
    });
    roomServiceMock.listByUser.mockResolvedValue([
      {
        id: 'room-1',
        userId: 'owner-user',
        name: '公开房间',
        slug: 'public-room',
        description: null,
        coverUrl: null,
        visibility: 'public',
        createdAt: new Date('2026-03-25T00:00:00.000Z'),
        updatedAt: new Date('2026-03-25T00:00:00.000Z'),
      },
    ]);
    roomServiceMock.getContentCounts.mockResolvedValue({
      cardCount: 3,
      boxCount: 1,
    });

    await app.register(roomRoutes);

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/users/alice/rooms',
    });

    expect(response.statusCode).toBe(200);
    expect(roomServiceMock.getContentCounts).toHaveBeenCalledWith(
      'room-1',
      'viewer-user',
      'owner-user',
    );

    await app.close();
  });

  it('向非所有者查询房间内容时传入房间所有者 ID，避免泄露私有内容', async () => {
    const { default: roomRoutes } = await import('./rooms');
    const app = Fastify();

    app.decorate('authenticate', async () => {});
    app.decorate('optionalAuthenticate', async (request: { user?: unknown }) => {
      request.user = { userId: 'viewer-user', role: 'user', jti: 'jwt-1' };
    });

    roomServiceMock.getAccessible.mockResolvedValue({
      id: 'room-1',
      userId: 'owner-user',
      name: '公开房间',
      slug: 'public-room',
      description: null,
      coverUrl: null,
      visibility: 'public',
      createdAt: new Date('2026-03-25T00:00:00.000Z'),
      updatedAt: new Date('2026-03-25T00:00:00.000Z'),
    });
    cardServiceMock.listByRoom.mockResolvedValue({
      items: [],
      pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
    });
    boxServiceMock.listByRoom.mockResolvedValue({
      items: [],
      pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
    });
    roomServiceMock.getContentCounts.mockResolvedValue({
      cardCount: 0,
      boxCount: 0,
    });

    await app.register(roomRoutes);

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/rooms/room-1/contents?page=1&pageSize=20',
    });

    expect(response.statusCode).toBe(200);
    expect(cardServiceMock.listByRoom).toHaveBeenCalledWith(
      'room-1',
      'viewer-user',
      'owner-user',
      { page: 1, pageSize: 20 },
    );
    expect(boxServiceMock.listByRoom).toHaveBeenCalledWith(
      'room-1',
      'viewer-user',
      'owner-user',
      { page: 1, pageSize: 20 },
    );

    await app.close();
  });
});

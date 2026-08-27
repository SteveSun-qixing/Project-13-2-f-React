import Fastify from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';

const userServiceMock = {
  findByUsername: vi.fn(),
  toPublicProfile: vi.fn((user: Record<string, unknown>) => user),
};

const roomServiceMock = {
  listByUser: vi.fn(),
  getContentCounts: vi.fn(),
  toDTO: vi.fn((room: Record<string, unknown>) => room),
};

const cardServiceMock = {
  listRootByUser: vi.fn(),
  toSummaryDTO: vi.fn((card: Record<string, unknown>) => card),
};

const boxServiceMock = {
  listRootByUser: vi.fn(),
  toDTO: vi.fn((box: Record<string, unknown>) => box),
  toSummaryDTO: vi.fn((box: Record<string, unknown>) => box),
};

vi.mock('../services/user.service', () => ({
  UserService: userServiceMock,
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

describe('space route authorization', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('查询公开空间时按请求者身份计算房间可见内容计数', async () => {
    const { default: spaceRoutes } = await import('./space');
    const app = Fastify();

    app.decorate('optionalAuthenticate', async (request: { user?: unknown }) => {
      request.user = { userId: 'viewer-user', role: 'user', jti: 'jwt-1' };
    });

    userServiceMock.findByUsername.mockResolvedValue({
      id: 'owner-user',
      username: 'alice',
      displayName: 'Alice',
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
    cardServiceMock.listRootByUser.mockResolvedValue({
      items: [],
      pagination: { page: 1, pageSize: 30, total: 0, totalPages: 0 },
    });
    boxServiceMock.listRootByUser.mockResolvedValue({
      items: [],
      pagination: { page: 1, pageSize: 30, total: 0, totalPages: 0 },
    });

    await app.register(spaceRoutes);

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/users/alice/space',
    });

    expect(response.statusCode).toBe(200);
    expect(roomServiceMock.getContentCounts).toHaveBeenCalledWith(
      'room-1',
      'viewer-user',
      'owner-user',
    );

    await app.close();
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createCardService, resetCardService } from '../../src/core/card-service';
import type { CardSessionSnapshot } from 'chips-sdk';

const SNAPSHOT: CardSessionSnapshot = {
    cardId: 'demo-card',
    path: '/workspace/demo.card',
    metadata: {
        name: '生态介绍',
        createdAt: '2026-03-13T00:00:00.000Z',
        modifiedAt: '2026-03-13T00:00:00.000Z',
        coverRatio: '3:4',
        description: '测试卡片',
        tags: ['chips'],
    },
    cover: {
        html: '<!doctype html><html><body>生态介绍</body></html>',
        ratio: '3:4',
        resources: [],
    },
    structure: {
        layout: { padding: 16, gap: 12 },
        basicCards: [
            {
                id: 'intro',
                type: 'base.richtext',
                data: { id: 'intro', content_text: 'hello' },
                createdAt: '2026-03-13T00:00:00.000Z',
                modifiedAt: '2026-03-13T00:00:00.000Z',
            },
        ],
    },
    isDirty: false,
    isPersisting: false,
    persistedRevision: 0,
};

const { mockClient } = vi.hoisted(() => {
    const sessionApi = {
        init: vi.fn(),
        open: vi.fn(),
        get: vi.fn(),
        updateBasicCard: vi.fn(),
        addBasicCard: vi.fn(),
        removeBasicCard: vi.fn(),
        moveBasicCard: vi.fn(),
        updateMetadata: vi.fn(),
        updateCover: vi.fn(),
        persist: vi.fn(),
        undo: vi.fn(),
        redo: vi.fn(),
        history: vi.fn(),
        close: vi.fn(async () => {}),
        onOpened: vi.fn(() => () => {}),
        onPersisted: vi.fn((_handler: (payload: { sessionId?: string; cardId: string; snapshot: CardSessionSnapshot }) => void) => () => {}),
        onPersistError: vi.fn(() => () => {}),
        onClosed: vi.fn(() => () => {}),
        onUndo: vi.fn(() => () => {}),
        onRedo: vi.fn(() => () => {}),
    };
    return {
        mockClient: {
            card: { session: sessionApi },
        },
    };
});

vi.mock('../../src/services/bridge-client', () => ({
    getChipsClient: () => mockClient,
}));

vi.mock('../../src/services/workspace-service', () => ({
    workspaceService: {
        getState: () => ({ rootPath: '/workspace' }),
    },
}));

describe('卡片服务会话消费层', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetCardService();
    });

    describe('createCard', () => {
        it('调用 card.session.init 并映射本地视图', async () => {
            mockClient.card.session.init.mockResolvedValue({
                cardDir: '/workspace/demo-card.card',
                cardId: 'demo-card',
                sessionId: 's1',
                snapshot: SNAPSHOT,
            });

            const service = createCardService();
            const card = await service.createCard('生态介绍');

            expect(mockClient.card.session.init).toHaveBeenCalledWith(
                '/workspace',
                '生态介绍',
                undefined,
            );
            expect(card.id).toBe('demo-card');
            expect(card.path).toBe('/workspace/demo.card');
            expect(card.structure.basicCards).toHaveLength(1);
            expect(service.getSelectedCardId()).toBe('demo-card');
        });
    });

    describe('openCard', () => {
        it('调用 card.session.open 并映射视图', async () => {
            mockClient.card.session.open.mockResolvedValue({
                sessionId: 's1',
                snapshot: SNAPSHOT,
            });

            const service = createCardService();
            const card = await service.openCard('demo-card', '/workspace/demo.card');

            expect(mockClient.card.session.open).toHaveBeenCalledWith('/workspace/demo.card');
            expect(card.metadata.name).toBe('生态介绍');
            expect(card.isDirty).toBe(false);
        });
    });

    describe('updateBasicCard', () => {
        it('转发配置与资源操作到会话', async () => {
            mockClient.card.session.open.mockResolvedValue({
                sessionId: 's1',
                snapshot: SNAPSHOT,
            });
            mockClient.card.session.updateBasicCard.mockResolvedValue({
                ...SNAPSHOT,
                structure: {
                    ...SNAPSHOT.structure,
                    basicCards: [
                        {
                            ...SNAPSHOT.structure.basicCards[0]!,
                            data: { id: 'intro', content_text: 'world' },
                        },
                    ],
                },
                isDirty: true,
                isPersisting: true,
            });

            const service = createCardService();
            await service.openCard('demo-card', '/workspace/demo.card');
            await service.updateBasicCard('demo-card', 'intro', { content_text: 'world' }, {
                imports: [{ path: 'a.png', data: new Uint8Array([1]) }],
                deletions: [],
            });

            expect(mockClient.card.session.updateBasicCard).toHaveBeenCalledWith(
                's1',
                'intro',
                { content_text: 'world' },
                {
                    imports: [{ path: 'a.png', data: new Uint8Array([1]) }],
                    deletions: [],
                },
            );

            const card = service.getCard('demo-card');
            expect(card?.structure.basicCards[0]?.data.content_text).toBe('world');
            expect(card?.isDirty).toBe(true);
            // 待导入资源保留本地预览字节
            expect(card?.structure.basicCards[0]?.pendingResourceImports?.get('a.png')).toBeTruthy();
        });
    });

    describe('saveCard 与 undo/redo', () => {
        it('saveCard 调用 session.persist', async () => {
            mockClient.card.session.open.mockResolvedValue({ sessionId: 's1', snapshot: SNAPSHOT });
            mockClient.card.session.persist.mockResolvedValue(SNAPSHOT);

            const service = createCardService();
            await service.openCard('demo-card', '/workspace/demo.card');
            await service.saveCard('demo-card');

            expect(mockClient.card.session.persist).toHaveBeenCalledWith('s1');
        });

        it('undo/redo/history 代理到会话', async () => {
            mockClient.card.session.open.mockResolvedValue({ sessionId: 's1', snapshot: SNAPSHOT });
            mockClient.card.session.undo.mockResolvedValue(SNAPSHOT);
            mockClient.card.session.redo.mockResolvedValue(SNAPSHOT);
            mockClient.card.session.history.mockResolvedValue({
                undoAvailable: true,
                redoAvailable: false,
                undoStack: [{ label: '更新基础卡片', recordedAt: 1000 }],
                redoStack: [],
            });

            const service = createCardService();
            await service.openCard('demo-card', '/workspace/demo.card');
            expect(await service.undo()).toBe(true);
            expect(await service.redo()).toBe(true);
            const history = await service.getHistory();
            expect(history.undoStack[0]?.label).toBe('更新基础卡片');
        });
    });

    describe('closeCard', () => {
        it('关闭会话并从视图移除', async () => {
            mockClient.card.session.open.mockResolvedValue({ sessionId: 's1', snapshot: SNAPSHOT });

            const service = createCardService();
            await service.openCard('demo-card', '/workspace/demo.card');
            service.closeCard('demo-card');

            expect(mockClient.card.session.close).toHaveBeenCalledWith('s1');
            expect(service.getCard('demo-card')).toBeUndefined();
        });
    });

    describe('onPersisted 事件同步', () => {
        it('订阅会话事件并在持久化后清理待导入资源', async () => {
            mockClient.card.session.open.mockResolvedValue({ sessionId: 's1', snapshot: SNAPSHOT });
            mockClient.card.session.updateBasicCard.mockResolvedValue({
                ...SNAPSHOT,
                structure: {
                    ...SNAPSHOT.structure,
                    basicCards: [
                        {
                            ...SNAPSHOT.structure.basicCards[0]!,
                            data: { id: 'intro', content_text: 'world' },
                        },
                    ],
                },
                isDirty: true,
                isPersisting: true,
            });

            const service = createCardService();
            await service.openCard('demo-card', '/workspace/demo.card');
            await service.updateBasicCard('demo-card', 'intro', { content_text: 'world' }, {
                imports: [{ path: 'a.png', data: new Uint8Array([1]) }],
                deletions: [],
            });

            const persistedHandler = mockClient.card.session.onPersisted.mock.calls[0]?.[0] as unknown as
                (payload: { sessionId: string; cardId: string; snapshot: CardSessionSnapshot }) => void;
            expect(persistedHandler).toBeTypeOf('function');
            persistedHandler({ sessionId: 's1', cardId: 'demo-card', snapshot: SNAPSHOT });

            const card = service.getCard('demo-card');
            expect(card?.structure.basicCards[0]?.pendingResourceImports?.size ?? 0).toBe(0);
            expect(card?.isDirty).toBe(false);
        });
    });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BoxDocumentService } from '../../src/services/box-document-service';
import type { BoxSessionSnapshot } from 'chips-sdk';

const SNAPSHOT: BoxSessionSnapshot = {
    boxId: 'box-1',
    boxFile: '/workspace/测试箱子.box',
    workspaceDir: '/tmp/chips-box-session-abc',
    metadata: {
        chipStandardsVersion: '1.0.0',
        boxId: 'box-1',
        name: '测试箱子',
        createdAt: '2026-01-01T00:00:00.000Z',
        modifiedAt: '2026-01-01T00:00:00.000Z',
        activeLayoutType: 'chips.layout.grid',
    },
    coverHtml: '<html><body>测试箱子</body></html>',
    content: { activeLayoutType: 'chips.layout.grid', layoutConfigs: {} },
    entries: [],
    assets: [],
    isDirty: false,
    isSaving: false,
};

const { mockClient } = vi.hoisted(() => {
    const sessionApi = {
        create: vi.fn(),
        rename: vi.fn(),
        open: vi.fn(),
        get: vi.fn(),
        addEntry: vi.fn(),
        addEmbeddedCard: vi.fn(),
        updateEntry: vi.fn(),
        moveEntry: vi.fn(),
        removeEntry: vi.fn(),
        updateMetadata: vi.fn(),
        updateLayoutConfig: vi.fn(),
        importAsset: vi.fn(),
        deleteAsset: vi.fn(),
        updateCover: vi.fn(),
        persist: vi.fn(),
        undo: vi.fn(),
        redo: vi.fn(),
        history: vi.fn(),
        close: vi.fn(async () => {}),
        onOpened: vi.fn(() => () => {}),
        onPersisted: vi.fn(() => () => {}),
        onPersistError: vi.fn(() => () => {}),
        onClosed: vi.fn(() => () => {}),
        onUndo: vi.fn(() => () => {}),
        onRedo: vi.fn(() => () => {}),
    };
    return {
        mockClient: {
            box: { session: sessionApi },
        },
    };
});

vi.mock('../../src/services/bridge-client', () => ({
    getChipsClient: () => mockClient,
}));

describe('BoxDocumentService 会话消费层', () => {
    let service: BoxDocumentService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new BoxDocumentService();
    });

    describe('createBoxFile', () => {
        it('调用 box.session.create', async () => {
            mockClient.box.session.create.mockResolvedValue({
                boxFile: '/workspace/新建.box',
                metadata: SNAPSHOT.metadata,
            });
            const result = await service.createBoxFile('新建', 'chips.layout.grid', '/workspace', '/workspace');
            expect(mockClient.box.session.create).toHaveBeenCalledWith('新建', 'chips.layout.grid', '/workspace');
            expect(result.boxFile).toBe('/workspace/新建.box');
        });

        it('未绑定工作区时抛错', async () => {
            await expect(service.createBoxFile('新建', 'chips.layout.grid', '/workspace', '')).rejects.toThrow();
        });
    });

    describe('openBox / closeBox', () => {
        it('打开会话并缓存快照，close 关闭会话', async () => {
            mockClient.box.session.open.mockResolvedValue({ sessionId: 's1', snapshot: SNAPSHOT });

            const snapshot = await service.openBox('/workspace/测试箱子.box', '/workspace', 'box-1');
            expect(mockClient.box.session.open).toHaveBeenCalledWith('/workspace/测试箱子.box');
            expect(snapshot.boxId).toBe('box-1');
            expect(service.getSession('box-1')?.metadata.name).toBe('测试箱子');

            await service.closeBox('box-1');
            expect(mockClient.box.session.close).toHaveBeenCalledWith('s1');
            expect(service.getSession('box-1')).toBeNull();
        });

        it('重复打开同一文件返回同一会话', async () => {
            mockClient.box.session.open.mockResolvedValue({ sessionId: 's1', snapshot: SNAPSHOT });
            await service.openBox('/workspace/测试箱子.box', '/workspace', 'box-1');
            const again = await service.openBox('/workspace/测试箱子.box', '/workspace', 'box-1');
            expect(mockClient.box.session.open).toHaveBeenCalledTimes(1);
            expect(again.boxId).toBe('box-1');
        });
    });

    describe('条目操作', () => {
        it('addEntry 转发到会话', async () => {
            mockClient.box.session.open.mockResolvedValue({ sessionId: 's1', snapshot: SNAPSHOT });
            mockClient.box.session.addEntry.mockResolvedValue({
                ...SNAPSHOT,
                entries: [{ entryId: 'e1', url: 'file:///tmp/a.card', enabled: true, snapshot: {}, layoutHints: { sortKey: 0 } }],
                isDirty: true,
            });

            await service.openBox('/workspace/测试箱子.box', '/workspace', 'box-1');
            const after = await service.addEntry('box-1', 'file:///tmp/a.card');
            expect(mockClient.box.session.addEntry).toHaveBeenCalledWith('s1', { url: 'file:///tmp/a.card' });
            expect(after.entries).toHaveLength(1);
            expect(service.getSession('box-1')?.isDirty).toBe(true);
        });

        it('moveEntryToIndex 转发到会话', async () => {
            mockClient.box.session.open.mockResolvedValue({ sessionId: 's1', snapshot: SNAPSHOT });
            mockClient.box.session.moveEntry.mockResolvedValue(SNAPSHOT);

            await service.openBox('/workspace/测试箱子.box', '/workspace', 'box-1');
            await service.moveEntryToIndex('box-1', 'e1', 2);
            expect(mockClient.box.session.moveEntry).toHaveBeenCalledWith('s1', 'e1', 2);
        });

        it('removeEntry 转发到会话', async () => {
            mockClient.box.session.open.mockResolvedValue({ sessionId: 's1', snapshot: SNAPSHOT });
            mockClient.box.session.removeEntry.mockResolvedValue(SNAPSHOT);

            await service.openBox('/workspace/测试箱子.box', '/workspace', 'box-1');
            await service.removeEntry('box-1', 'e1');
            expect(mockClient.box.session.removeEntry).toHaveBeenCalledWith('s1', 'e1');
        });
    });

    describe('saveBox 与 undo/redo', () => {
        it('saveBox 调用 session.persist', async () => {
            mockClient.box.session.open.mockResolvedValue({ sessionId: 's1', snapshot: SNAPSHOT });
            mockClient.box.session.persist.mockResolvedValue(SNAPSHOT);

            await service.openBox('/workspace/测试箱子.box', '/workspace', 'box-1');
            await service.saveBox('box-1');
            expect(mockClient.box.session.persist).toHaveBeenCalledWith('s1');
        });

        it('undo/redo 代理到会话', async () => {
            mockClient.box.session.open.mockResolvedValue({ sessionId: 's1', snapshot: SNAPSHOT });
            mockClient.box.session.undo.mockResolvedValue(SNAPSHOT);
            mockClient.box.session.redo.mockResolvedValue(SNAPSHOT);
            mockClient.box.session.history.mockResolvedValue({
                undoAvailable: true,
                redoAvailable: false,
                undoStack: [{ label: '添加条目', recordedAt: 1000 }],
                redoStack: [],
            });

            await service.openBox('/workspace/测试箱子.box', '/workspace', 'box-1');
            expect(await service.undo('box-1')).toBe(true);
            expect(await service.redo('box-1')).toBe(true);
            const history = await service.getHistory('box-1');
            expect(history.undoStack[0]?.label).toBe('添加条目');
        });
    });

    describe('updateCover 与资源', () => {
        it('updateCover 转发到会话', async () => {
            mockClient.box.session.open.mockResolvedValue({ sessionId: 's1', snapshot: SNAPSHOT });
            mockClient.box.session.updateCover.mockResolvedValue({
                ...SNAPSHOT,
                coverHtml: '<html>custom</html>',
                isDirty: true,
            });

            await service.openBox('/workspace/测试箱子.box', '/workspace', 'box-1');
            const after = await service.updateCover('box-1', {
                html: '<html>custom</html>',
                ratio: '16:9',
                resources: [{ path: 'boxcover/a.png', data: new Uint8Array([1]) }],
            });
            expect(mockClient.box.session.updateCover).toHaveBeenCalledWith('s1', {
                html: '<html>custom</html>',
                ratio: '16:9',
                resources: [{ path: 'boxcover/a.png', data: new Uint8Array([1]) }],
            });
            expect(after.coverHtml).toBe('<html>custom</html>');
        });

        it('updateMetadata 转发到会话', async () => {
            mockClient.box.session.open.mockResolvedValue({ sessionId: 's1', snapshot: SNAPSHOT });
            mockClient.box.session.updateMetadata.mockResolvedValue({
                ...SNAPSHOT,
                metadata: { ...SNAPSHOT.metadata, name: '改名' },
                isDirty: true,
            });

            await service.openBox('/workspace/测试箱子.box', '/workspace', 'box-1');
            const after = await service.updateMetadata('box-1', { name: '改名' });
            expect(mockClient.box.session.updateMetadata).toHaveBeenCalledWith('s1', expect.objectContaining({ name: '改名' }));
            expect(after.metadata.name).toBe('改名');
        });
    });

    describe('会话事件', () => {
        it('快照变化发出 session:changed 事件', async () => {
            mockClient.box.session.open.mockResolvedValue({ sessionId: 's1', snapshot: SNAPSHOT });
            const received: string[] = [];
            service.on('session:changed', (snapshot) => {
                received.push(snapshot.boxId);
            });

            await service.openBox('/workspace/测试箱子.box', '/workspace', 'box-1');
            expect(received).toContain('box-1');
        });
    });
});

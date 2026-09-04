import { fileService } from './file-service';
import { getChipsClient } from './bridge-client';
import { createEventEmitter, type EventEmitter } from '../core/event-emitter';
import { generateId62 } from '../utils/id';
import type {
    WorkspaceState,
    WorkspaceFile,
    WorkspaceFileCategory,
    WorkspaceFileEventPayload,
    WorkspaceOpenTarget,
} from '../types/workspace';
import { boxDocumentService, DEFAULT_BOX_LAYOUT_TYPE } from './box-document-service';
import yaml from 'yaml';
import type { FileStat } from 'chips-sdk';
import { readLaunchContext } from '../runtime/launch-context';

type WorkspaceFileViewWithMetadata = Omit<import('chips-sdk').WorkspaceFileView, 'type' | 'children'> & {
    type: string;
    resourceId?: string;
    extension?: string;
    mimeType?: string;
    category?: WorkspaceFileCategory;
    size?: number;
    children?: WorkspaceFileViewWithMetadata[];
};

function normalizeExtension(value: unknown, name: string): string | undefined {
    if (typeof value === 'string' && value.trim()) {
        const normalized = value.trim().toLowerCase();
        return normalized.startsWith('.') ? normalized : `.${normalized}`;
    }
    const dotIndex = name.lastIndexOf('.');
    return dotIndex > 0 ? name.slice(dotIndex).toLowerCase() : undefined;
}

function inferCategory(extension: string | undefined, mimeType: string | undefined): WorkspaceFileCategory {
    if (mimeType?.startsWith('image/')) return 'image';
    if (mimeType?.startsWith('video/')) return 'video';
    if (mimeType?.startsWith('audio/')) return 'audio';
    if (mimeType === 'text/html') return 'html';
    if (mimeType?.startsWith('text/')) return 'text';
    if (mimeType?.includes('pdf') || mimeType?.includes('word') || mimeType?.includes('presentation') || mimeType?.includes('spreadsheet')) return 'document';
    if (['.doc', '.docx', '.odt', '.rtf', '.ppt', '.pptx', '.odp', '.xls', '.xlsx', '.xlsm', '.csv', '.pdf'].includes(extension ?? '')) return 'document';
    if (['.zip', '.7z', '.rar', '.tar', '.gz'].includes(extension ?? '')) return 'archive';
    return 'unknown';
}

function toWorkspaceFile(view: import('chips-sdk').WorkspaceFileView): WorkspaceFile {
    const candidate = view as unknown as WorkspaceFileViewWithMetadata;
    const type: WorkspaceFile['type'] = candidate.type === 'card' || candidate.type === 'box' || candidate.type === 'folder'
        ? candidate.type
        : 'file';
    const extension = type === 'file' ? normalizeExtension(candidate.extension, candidate.name) : undefined;
    const mimeType = typeof candidate.mimeType === 'string' && candidate.mimeType.trim()
        ? candidate.mimeType.trim().toLowerCase()
        : undefined;
    return {
        id: candidate.id,
        name: candidate.name,
        path: candidate.path,
        type,
        createdAt: candidate.createdAt,
        modifiedAt: candidate.modifiedAt,
        ...(candidate.resourceId ? { resourceId: candidate.resourceId } : {}),
        ...(extension ? { extension } : {}),
        ...(mimeType ? { mimeType } : {}),
        ...(type === 'file' ? { category: candidate.category ?? inferCategory(extension, mimeType) } : {}),
        ...(typeof candidate.size === 'number' ? { size: candidate.size } : {}),
        ...(candidate.children ? { children: candidate.children.map(toWorkspaceFile) } : {}),
    };
}

export interface WorkspaceOpenOptions {
    windowPosition?: { x: number; y: number };
    isEditing?: boolean;
}

export interface WorkspaceCreateFileOptions {
    parentPath?: string;
    mimeType?: string;
    category?: WorkspaceFileCategory;
    openOptions?: WorkspaceOpenOptions;
}

const HOST_RUNTIME_ROOT_ENTRIES = new Set([
    'plugins',
    'plugins.json',
    'plugin-runtime.json',
    'plugin-shortcuts.json',
    'route-manifest.json',
    'route-descriptor-manifest.json',
    'credentials.enc.json',
    'config.json',
    'config.workspace.json',
    'config.system.json',
    'host-state.json',
    'electron-user-data',
]);

function joinPath(...parts: string[]): string {
    return parts.filter(Boolean).join('/').replace(/\\/g, '/').replace(/\/+/g, '/');
}

function isAbsolutePath(path: string): boolean {
    return path.startsWith('/') || /^[A-Za-z]:\//.test(path);
}

function resolveListedEntryPath(basePath: string, entryPath: string): string {
    const normalizedEntryPath = entryPath.replace(/\\/g, '/');
    if (isAbsolutePath(normalizedEntryPath)) {
        return normalizedEntryPath;
    }
    return joinPath(basePath, normalizedEntryPath);
}

function normalizeComparablePath(path: string): string {
    const normalized = path.replace(/\\/g, '/').replace(/\/+/g, '/');
    if (normalized.length > 1 && normalized.endsWith('/')) {
        return normalized.slice(0, -1);
    }
    return normalized;
}

function pathsEqual(left: string, right: string): boolean {
    return normalizeComparablePath(left) === normalizeComparablePath(right);
}

function stripExtension(name: string, ext: string): string {
    if (name.toLowerCase().endsWith(ext)) {
        return name.slice(0, -ext.length);
    }
    return name;
}

export class WorkspaceService {
    private eventEmitter: EventEmitter = createEventEmitter();
    private state: WorkspaceState = {
        initialized: false,
        rootPath: '',
        files: [],
        openedFiles: [],
    };

    async initialize(): Promise<void> {
        if (this.state.initialized && this.state.rootPath) return;

        try {
            const client = getChipsClient();
            let workspacePath = '';

            try {
                const launchSnapshot = readLaunchContext(client);
                if (launchSnapshot.workspacePath) {
                    workspacePath = launchSnapshot.workspacePath;
                }
            } catch (e) {
                console.warn('[WorkspaceService] Could not read workspace path from launch context', e);
            }

            if (!workspacePath) {
                try {
                    if (typeof client.workspace.getContext === 'function') {
                        workspacePath = (await client.workspace.getContext()).rootPath;
                    }
                } catch (e) {
                    console.warn('[WorkspaceService] Could not resolve workspace context from Host', e);
                }
            }

            if (!workspacePath) {
                // No workspace provided — enter "uninitialized" state without crashing.
                // The user may open a workspace later via the Dock / menu.
                console.info('[WorkspaceService] No workspace path provided by Host launch context. Waiting for workspace binding.');
                this.state.initialized = true;
                this.state.rootPath = '';
                this.state.files = [];
                this.eventEmitter.emit('workspace:no-path', {});
                return;
            }

            // Verify the path is accessible
            const exists = await fileService.exists(workspacePath);
            if (!exists) {
                console.warn('[WorkspaceService] Workspace path does not exist:', workspacePath);
                this.state.initialized = true;
                this.state.rootPath = workspacePath;
                this.state.files = [];
                this.eventEmitter.emit('workspace:path-missing', { path: workspacePath });
                return;
            }

            this.state.rootPath = workspacePath;
            await this.refresh();

            this.state.initialized = true;
            this.eventEmitter.emit('workspace:initialized', { rootPath: this.state.rootPath });
            console.log('[WorkspaceService] Initialized:', this.state.rootPath);
        } catch (error) {
            // Workspace init failure should not crash the entire app.
            // The editor can still function in a read-only or empty state.
            console.error('[WorkspaceService] Init failed, continuing without workspace:', error);
            this.state.initialized = true;
            this.state.rootPath = '';
            this.state.files = [];
            this.eventEmitter.emit('workspace:error', { error });
        }
    }


    getState() {
        return this.state;
    }

    isInitialized() {
        return this.state.initialized;
    }

    getFiles() {
        return this.state.files;
    }

    on(event: string, handler: any) {
        this.eventEmitter.on(event, handler);
    }

    off(event: string, handler: any) {
        this.eventEmitter.off(event, handler);
    }

    async readMetadata(path: string): Promise<Record<string, unknown> | null> {
        try {
            const content = await fileService.readText(path);
            return yaml.parse(content) as Record<string, unknown>;
        } catch {
            return null;
        }
    }

    async readBoxMetadata(boxFile: string): Promise<{
        boxId: string;
        name: string;
        createdAt: string;
        modifiedAt: string;
    } | null> {
        try {
            const metadata = await getChipsClient().box.readMetadata(boxFile);
            return {
                boxId: metadata.boxId,
                name: metadata.name,
                createdAt: metadata.createdAt,
                modifiedAt: metadata.modifiedAt,
            };
        } catch {
            return null;
        }
    }

    async buildTree(basePath: string): Promise<WorkspaceFile[]> {
        // task034 M6：文件树扫描/识别由 Host workspace.scan 统一执行
        const views = await getChipsClient().workspace.scan(basePath);
        return views.map(toWorkspaceFile);
    }

    private createWorkspaceRegularFile(filePath: string, stat?: FileStat, options: WorkspaceCreateFileOptions = {}): WorkspaceFile {
        const normalizedPath = normalizeComparablePath(filePath);
        const name = normalizedPath.split('/').pop() || normalizedPath;
        const extension = normalizeExtension(undefined, name);
        const mimeType = options.mimeType?.trim().toLowerCase() || undefined;
        return {
            id: normalizedPath,
            name,
            path: normalizedPath,
            type: 'file',
            createdAt: stat ? new Date(stat.mtimeMs).toISOString() : new Date().toISOString(),
            modifiedAt: stat ? new Date(stat.mtimeMs).toISOString() : new Date().toISOString(),
            ...(extension ? { extension } : {}),
            ...(mimeType ? { mimeType } : {}),
            category: options.category ?? inferCategory(extension, mimeType),
            ...(typeof stat?.size === 'number' ? { size: stat.size } : {}),
        };
    }

    async refresh(): Promise<void> {
        if (!this.state.rootPath) return;
        this.state.files = await this.buildTree(this.state.rootPath);
        this.eventEmitter.emit('workspace:refreshed', { files: this.state.files });
    }

    findFileById(list: WorkspaceFile[], id: string): WorkspaceFile | undefined {
        for (const file of list) {
            if (file.id === id) return file;
            if (file.children) {
                const found = this.findFileById(file.children, id);
                if (found) return found;
            }
        }
        return undefined;
    }

    getFile(id: string): WorkspaceFile | undefined {
        return this.findFileById(this.state.files, id);
    }

    getFileByPath(targetPath: string): WorkspaceFile | undefined {
        return this.findFileByPath(this.state.files, targetPath);
    }

    findFileByPath(list: WorkspaceFile[], targetPath: string): WorkspaceFile | undefined {
        for (const file of list) {
            if (pathsEqual(file.path, targetPath)) return file;
            if (file.children) {
                const found = this.findFileByPath(file.children, targetPath);
                if (found) return found;
            }
        }
        return undefined;
    }

    private async createWorkspaceCardFile(cardPath: string, stat?: FileStat): Promise<WorkspaceFile> {
        const normalizedCardPath = normalizeComparablePath(cardPath);
        const fileName = normalizedCardPath.split('/').pop() || '';
        const cardStat = stat ?? await fileService.stat(normalizedCardPath);
        const metadata = await this.readMetadata(joinPath(normalizedCardPath, '.card/metadata.yaml'));
        const cardId = (metadata?.card_id as string) ?? fileName.replace(/\.card$/i, '');
        const cardName = (metadata?.name as string) ?? fileName;

        return {
            id: cardId,
            name: `${stripExtension(cardName, '.card')}.card`,
            path: normalizedCardPath,
            type: 'card',
            createdAt: (metadata?.created_at as string) || new Date(cardStat.mtimeMs).toISOString(),
            modifiedAt: (metadata?.modified_at as string) || new Date(cardStat.mtimeMs).toISOString(),
        };
    }

    private async createWorkspaceBoxFile(boxPath: string, stat?: FileStat): Promise<WorkspaceFile> {
        const normalizedBoxPath = normalizeComparablePath(boxPath);
        const fileName = normalizedBoxPath.split('/').pop() || '';
        const boxStat = stat ?? await fileService.stat(normalizedBoxPath);
        const metadata = await this.readBoxMetadata(normalizedBoxPath);

        return {
            id: metadata?.boxId ?? normalizedBoxPath,
            name: `${stripExtension(metadata?.name ?? fileName, '.box')}.box`,
            path: normalizedBoxPath,
            type: 'box',
            createdAt: metadata?.createdAt ?? new Date(boxStat.mtimeMs).toISOString(),
            modifiedAt: metadata?.modifiedAt ?? new Date(boxStat.mtimeMs).toISOString(),
        };
    }

    private upsertWorkspaceFile(list: WorkspaceFile[], file: WorkspaceFile): boolean {
        for (let index = 0; index < list.length; index += 1) {
            const current = list[index];
            if (current.id === file.id || pathsEqual(current.path, file.path)) {
                list[index] = file;
                return true;
            }

            if (current.children && this.upsertWorkspaceFile(current.children, file)) {
                return true;
            }
        }

        return false;
    }

    private registerCreatedWorkspaceFile(parentPath: string, file: WorkspaceFile): void {
        if (this.upsertWorkspaceFile(this.state.files, file)) {
            this.eventEmitter.emit('workspace:refreshed', { files: this.state.files });
            return;
        }

        if (pathsEqual(parentPath, this.state.rootPath)) {
            this.state.files.push(file);
            this.eventEmitter.emit('workspace:refreshed', { files: this.state.files });
            return;
        }

        const parent = this.findFileByPath(this.state.files, parentPath);
        if (parent?.type === 'folder') {
            parent.children = parent.children ?? [];
            if (!this.upsertWorkspaceFile(parent.children, file)) {
                parent.children.push(file);
            }
            this.eventEmitter.emit('workspace:refreshed', { files: this.state.files });
            return;
        }

        this.state.files.push(file);
        this.eventEmitter.emit('workspace:refreshed', { files: this.state.files });
    }

    async createCard(
        name: string,
        initialContent?: { type: string; data?: Record<string, unknown> },
        cardId?: string,
        parentPath?: string,
        openOptions?: WorkspaceOpenOptions
    ): Promise<WorkspaceFile> {
        const id = cardId || generateId62();
        const parent = parentPath || this.state.rootPath;
        if (!parent) {
            throw new Error('当前工作区未绑定，无法创建卡片。');
        }

        // task034 M6：卡片骨架由 Host card.init（会话服务）创建
        const result = await getChipsClient().card.session.init(parent, name, initialContent, id);

        await this.refresh();
        let file = this.getFile(id) || this.findFileByPath(this.state.files, result.cardDir);
        if (!file) {
            file = await this.createWorkspaceCardFile(result.cardDir);
            this.registerCreatedWorkspaceFile(parent, file);
        }
        if (file) {
            this.eventEmitter.emit('workspace:file-created', {
                file,
                target: this.createOpenTarget(file),
                content: initialContent,
                openOptions,
            });
            return file;
        }

        throw new Error('Card created but not found in workspace tree');
    }

    async createBox(
        name: string,
        layoutType?: string,
        parentPath?: string,
        openOptions?: WorkspaceOpenOptions
    ): Promise<WorkspaceFile> {
        const parent = parentPath || this.state.rootPath;
        if (!parent) {
            throw new Error('当前工作区未绑定，无法创建箱子。');
        }

        const created = await boxDocumentService.createBoxFile(
            name,
            layoutType || DEFAULT_BOX_LAYOUT_TYPE,
            parent,
            this.state.rootPath,
        );

        await this.refresh();
        let file = this.getFile(created.metadata.boxId) || this.findFileByPath(this.state.files, created.boxFile);
        if (!file) {
            file = await this.createWorkspaceBoxFile(created.boxFile);
            this.registerCreatedWorkspaceFile(parent, file);
        }
        if (file) {
            this.eventEmitter.emit('workspace:file-created', {
                file,
                target: this.createOpenTarget(file),
                layoutType: layoutType || DEFAULT_BOX_LAYOUT_TYPE,
                openOptions,
            });
            return file;
        }

        throw new Error('Box created but not found in workspace tree');
    }

    async createFolder(name: string, parentPath?: string): Promise<WorkspaceFile> {
        const parent = parentPath || this.state.rootPath;
        const folderPath = joinPath(parent, name.trim());

        await fileService.mkdir(folderPath);
        await this.refresh();
        const file = this.findFileByPath(this.state.files, folderPath);
        if (file) {
            this.eventEmitter.emit('workspace:file-created', {
                file,
                target: this.createOpenTarget(file),
            });
            return file;
        }
        throw new Error('Folder created but not found in workspace tree');
    }

    /**
     * 创建普通工作区文件。内容写入仍然经 file.write，索引刷新经 workspace.scan；
     * 不在编辑引擎内维护第二套工作区目录或本地文件系统旁路。
     */
    async createFile(name: string, content: string | Uint8Array, options: WorkspaceCreateFileOptions = {}): Promise<WorkspaceFile> {
        const parent = options.parentPath || this.state.rootPath;
        if (!parent) {
            throw new Error('当前工作区未绑定，无法创建文件。');
        }
        const trimmedName = name.trim();
        if (!trimmedName || trimmedName === '.' || trimmedName === '..' || /[\\/]/.test(trimmedName)) {
            throw new Error('文件名无效。');
        }

        const targetPath = joinPath(parent, trimmedName);
        if (content instanceof Uint8Array) {
            await fileService.writeBinary(targetPath, content);
        } else {
            await fileService.writeText(targetPath, content);
        }

        await this.refresh();
        let file = this.findFileByPath(this.state.files, targetPath);
        if (!file) {
            const stat = await fileService.stat(targetPath);
            file = this.createWorkspaceRegularFile(targetPath, stat, options);
            this.registerCreatedWorkspaceFile(parent, file);
        }
        const target = this.createOpenTarget(file);
        this.eventEmitter.emit('workspace:file-created', {
            file,
            target,
            openOptions: options.openOptions,
        });
        return file;
    }

    async deleteFile(id: string): Promise<void> {
        const file = this.getFile(id);
        if (!file) return;

        await fileService.delete(file.path);
        await this.refresh();
        this.eventEmitter.emit('workspace:file-deleted', { file });
    }

    async renameFile(id: string, newName: string): Promise<void> {
        const file = this.getFile(id);
        if (!file) return;

        const trimmed = newName.trim();
        if (!trimmed) return;

        if (file.type === 'card' || file.type === 'box') {
            const extension = file.type === 'card' ? '.card' : '.box';
            const cleanName = stripExtension(trimmed, extension);
            if (file.type === 'box') {
                const renamed = await boxDocumentService.renameBoxFile(file.path, `${cleanName}${extension}`, this.state.rootPath);
                await this.refresh();
                this.eventEmitter.emit('workspace:file-renamed', {
                    previousFile: file,
                    file: {
                        ...file,
                        name: `${cleanName}${extension}`,
                        path: renamed.boxFile,
                        modifiedAt: renamed.metadata.modifiedAt,
                    },
                });
                return;
            }

            const metadataPath = joinPath(file.path, `.${file.type}`, 'metadata.yaml');
            const metadata = (await this.readMetadata(metadataPath)) || {};
            metadata.name = cleanName;
            metadata.modified_at = new Date().toISOString();
            await fileService.writeText(metadataPath, yaml.stringify(metadata));
            await this.refresh();
            this.eventEmitter.emit('workspace:file-renamed', {
                previousFile: file,
                file: {
                    ...file,
                    name: `${cleanName}${extension}`,
                    modifiedAt: String(metadata.modified_at),
                },
            });
            return;
        }

        const parent = file.path.split('/').slice(0, -1).join('/');
        const newPath = joinPath(parent, trimmed);
        await fileService.move(file.path, newPath);
        await this.refresh();
        this.eventEmitter.emit('workspace:file-renamed', {
            previousFile: file,
            file: {
                ...file,
                id: newPath,
                name: trimmed,
                path: newPath,
            },
        });
    }

    getOpenedFiles(): WorkspaceFile[] {
        return this.state.openedFiles
            .map((id: string) => this.getFile(id))
            .filter(Boolean) as WorkspaceFile[];
    }

    private createOpenTarget(file: WorkspaceFile): WorkspaceOpenTarget {
        return {
            id: file.id,
            path: file.path,
            name: file.name,
            type: file.type,
            ...(file.resourceId ? { resourceId: file.resourceId } : {}),
            ...(file.extension ? { extension: file.extension } : {}),
            ...(file.mimeType ? { mimeType: file.mimeType } : {}),
            ...(file.category ? { category: file.category } : {}),
        };
    }

    openFile(id: string, openOptions?: WorkspaceOpenOptions): WorkspaceOpenTarget | undefined {
        const file = this.getFile(id);
        if (!file) {
            return undefined;
        }

        if (!this.state.openedFiles.includes(id)) {
            this.state.openedFiles.push(id);
        }

        const target = this.createOpenTarget(file);
        this.eventEmitter.emit('workspace:file-opened', { file, target, openOptions });
        return target;
    }

    closeFile(id: string): void {
        const index = this.state.openedFiles.indexOf(id);
        if (index !== -1) {
            this.state.openedFiles.splice(index, 1);
            const file = this.getFile(id);
            this.eventEmitter.emit('workspace:file-closed', { file });
        }
    }
}

export const workspaceService = new WorkspaceService();

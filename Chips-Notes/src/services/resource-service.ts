/**
 * 资源服务
 * @module services/resource-service
 * @description 统一封装资源管理能力
 */

import { getChipsClient } from './bridge-client';
import { fileService } from './file-service';
import { globalEventEmitter } from '../core/event-emitter';

export interface FileMetadata {
    path: string;
    exists: boolean;
    isDirectory: boolean;
    isFile: boolean;
    size?: number;
    modified?: string;
}

export interface ResourceConvertTiffToPngRequest {
    resourceId: string;
    outputFile: string;
    overwrite?: boolean;
}

export interface ResourceConvertTiffToPngResult {
    outputFile: string;
    mimeType: 'image/png';
    sourceMimeType: 'image/tiff';
    width?: number;
    height?: number;
}

export interface ResourceExtractVideoFrameRequest {
    resourceId: string;
    outputFile: string;
    overwrite?: boolean;
    options?: {
        timeSeconds?: number;
        format?: 'png' | 'jpeg';
        width?: number;
        height?: number;
        fit?: 'contain' | 'cover';
        quality?: number;
    };
}

export interface ResourceExtractVideoFrameResult {
    outputFile: string;
    mimeType: 'image/png' | 'image/jpeg';
    sourceMimeType: string;
    width: number;
    height: number;
    format: 'png' | 'jpeg';
    frameTimeSeconds: number;
    durationSeconds?: number;
}

let resourceServiceInstance: ResourceService | null = null;

export class ResourceService {
    private initialized = false;
    private workspaceRoot = '';
    private externalRoot = '';

    async initialize(workspacePath?: string): Promise<void> {
        if (this.initialized) return;

        this.workspaceRoot = workspacePath || '';
        this.externalRoot = '';

        this.initialized = true;
        globalEventEmitter.emit('resource:initialized', { workspaceRoot: this.workspaceRoot });
    }

    isInitialized(): boolean {
        return this.initialized;
    }

    getWorkspaceRoot(): string {
        return this.workspaceRoot;
    }

    getExternalRoot(): string {
        return this.externalRoot;
    }

    private toAbsolutePath(path: string): string {
        if (!path) return this.workspaceRoot;
        if (path.startsWith(this.workspaceRoot)) {
            return path;
        }
        if (path.startsWith('/')) {
            return `${this.workspaceRoot}${path}`;
        }
        return `${this.workspaceRoot}/${path}`;
    }

    async readText(path: string): Promise<string> {
        const absolutePath = this.toAbsolutePath(path);
        return fileService.readText(absolutePath);
    }

    async readBinary(path: string): Promise<Uint8Array> {
        const absolutePath = this.toAbsolutePath(path);
        return fileService.readBinary(absolutePath);
    }

    async writeText(path: string, content: string): Promise<void> {
        const absolutePath = this.toAbsolutePath(path);
        return fileService.writeText(absolutePath, content);
    }

    async writeBinary(path: string, content: Uint8Array): Promise<void> {
        const absolutePath = this.toAbsolutePath(path);
        return fileService.writeBinary(absolutePath, content);
    }

    async exists(path: string): Promise<boolean> {
        const absolutePath = this.toAbsolutePath(path);
        return fileService.exists(absolutePath);
    }

    async metadata(path: string): Promise<FileMetadata> {
        const absolutePath = this.toAbsolutePath(path);
        try {
            const stat = await fileService.stat(absolutePath);
            return {
                path: absolutePath,
                exists: true,
                isDirectory: stat.isDirectory,
                isFile: stat.isFile,
                size: stat.size,
                modified: stat.mtimeMs ? new Date(stat.mtimeMs).toISOString() : undefined,
            };
        } catch {
            return {
                path: absolutePath,
                exists: false,
                isDirectory: false,
                isFile: false,
            };
        }
    }

    async list(path: string): Promise<string[]> {
        const absolutePath = this.toAbsolutePath(path);
        const entries = await fileService.list(absolutePath);
        return entries
            .filter(e => e.isFile || e.isDirectory)
            .map(e => e.path);
    }

    async delete(path: string): Promise<void> {
        const absolutePath = this.toAbsolutePath(path);
        await fileService.delete(absolutePath);
    }

    async move(sourcePath: string, destPath: string): Promise<void> {
        const source = this.toAbsolutePath(sourcePath);
        const dest = this.toAbsolutePath(destPath);
        await fileService.move(source, dest);
    }

    async copy(sourcePath: string, destPath: string): Promise<void> {
        const source = this.toAbsolutePath(sourcePath);
        const dest = this.toAbsolutePath(destPath);
        await fileService.copy(source, dest);
    }

    async mkdir(path: string): Promise<void> {
        const absolutePath = this.toAbsolutePath(path);
        await fileService.mkdir(absolutePath);
    }

    async ensureDir(path: string): Promise<void> {
        const absolutePath = this.toAbsolutePath(path);
        await fileService.ensureDir(absolutePath);
    }

    async convertTiffToPng(request: ResourceConvertTiffToPngRequest): Promise<ResourceConvertTiffToPngResult> {
        return getChipsClient().resource.convertTiffToPng(request);
    }

    async extractVideoFrame(request: ResourceExtractVideoFrameRequest): Promise<ResourceExtractVideoFrameResult> {
        return getChipsClient().resource.extractVideoFrame(request);
    }

    reset(): void {
        this.initialized = false;
        this.workspaceRoot = '';
        this.externalRoot = '';
    }
}

export function createResourceService(): ResourceService {
    return new ResourceService();
}

export function useResourceService(): ResourceService {
    if (!resourceServiceInstance) {
        resourceServiceInstance = createResourceService();
    }
    return resourceServiceInstance;
}

export function getResourceService(): ResourceService {
    return useResourceService();
}

export function resetResourceService(): void {
    if (resourceServiceInstance) {
        resourceServiceInstance.reset();
    }
    resourceServiceInstance = null;
}

export const resourceService = {
    get workspaceRoot(): string {
        return getResourceService().getWorkspaceRoot();
    },
    get externalRoot(): string {
        return getResourceService().getExternalRoot();
    },
    async readText(path: string): Promise<string> {
        return getResourceService().readText(path);
    },
    async readBinary(path: string): Promise<ArrayBuffer> {
        const data = await getResourceService().readBinary(path);
        const result = new ArrayBuffer(data.byteLength);
        new Uint8Array(result).set(data);
        return result;
    },
    async writeText(path: string, content: string): Promise<void> {
        return getResourceService().writeText(path, content);
    },
    async writeBinary(path: string, content: ArrayBuffer): Promise<void> {
        return getResourceService().writeBinary(path, new Uint8Array(content));
    },
    async ensureDir(path: string): Promise<void> {
        return getResourceService().ensureDir(path);
    },
    async exists(path: string): Promise<boolean> {
        return getResourceService().exists(path);
    },
    async delete(path: string): Promise<void> {
        return getResourceService().delete(path);
    },
    async list(path: string): Promise<string[]> {
        return getResourceService().list(path);
    },
    async metadata(path: string): Promise<{
        path: string;
        exists: boolean;
        isDirectory: boolean;
        isFile: boolean;
        size?: number;
        modified?: string;
    }> {
        return getResourceService().metadata(path);
    },
    async copy(sourcePath: string, destPath: string): Promise<void> {
        return getResourceService().copy(sourcePath, destPath);
    },
    async move(sourcePath: string, destPath: string): Promise<void> {
        return getResourceService().move(sourcePath, destPath);
    },
    async convertTiffToPng(
        request: ResourceConvertTiffToPngRequest,
    ): Promise<ResourceConvertTiffToPngResult> {
        return getResourceService().convertTiffToPng(request);
    },
    async extractVideoFrame(
        request: ResourceExtractVideoFrameRequest,
    ): Promise<ResourceExtractVideoFrameResult> {
        return getResourceService().extractVideoFrame(request);
    },
};

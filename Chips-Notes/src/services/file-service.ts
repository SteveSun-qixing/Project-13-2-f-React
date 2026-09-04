import { getChipsClient } from './bridge-client';
import type { FileStat, FileEntry, FileDeleteOptions, FileListOptions } from 'chips-sdk';

function toOwnedBytes(value: ArrayBuffer | ArrayBufferView): Uint8Array {
    if (value instanceof ArrayBuffer) {
        return new Uint8Array(value.slice(0));
    }

    return new Uint8Array(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
}

function isBufferJsonPayload(value: unknown): value is { type: 'Buffer'; data: number[] } {
    return (
        !!value
        && typeof value === 'object'
        && 'type' in value
        && (value as { type?: unknown }).type === 'Buffer'
        && 'data' in value
        && Array.isArray((value as { data?: unknown }).data)
    );
}

function decodeBase64ToBytes(input: string): Uint8Array {
    const bufferCtor = (globalThis as typeof globalThis & {
        Buffer?: {
            from(data: string, encoding: string): Uint8Array;
        };
    }).Buffer;

    if (bufferCtor) {
        const buffer = bufferCtor.from(input, 'base64');
        return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    }

    const normalized = input.replace(/\s+/g, '');
    const decoded = atob(normalized);
    const bytes = new Uint8Array(decoded.length);
    for (let index = 0; index < decoded.length; index += 1) {
        bytes[index] = decoded.charCodeAt(index);
    }
    return bytes;
}

function decodeByteString(input: string): Uint8Array {
    const bytes = new Uint8Array(input.length);
    for (let index = 0; index < input.length; index += 1) {
        bytes[index] = input.charCodeAt(index) & 0xff;
    }
    return bytes;
}

function shouldDecodeStringAsBase64(input: string): boolean {
    const normalized = input.replace(/\s+/g, '');
    if (normalized.length === 0 || normalized.length % 4 !== 0) {
        return false;
    }

    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)) {
        return false;
    }

    return normalized.includes('=') || normalized.includes('+') || normalized.includes('/') || /\s/.test(input);
}

function normalizeBinaryContent(value: unknown): Uint8Array {
    if (value instanceof ArrayBuffer) {
        return toOwnedBytes(value);
    }

    if (ArrayBuffer.isView(value)) {
        return toOwnedBytes(value);
    }

    if (typeof value === 'string') {
        return shouldDecodeStringAsBase64(value) ? decodeBase64ToBytes(value) : decodeByteString(value);
    }

    if (isBufferJsonPayload(value)) {
        return Uint8Array.from(value.data);
    }

    if (Array.isArray(value) && value.every((item) => Number.isInteger(item) && item >= 0 && item <= 255)) {
        return Uint8Array.from(value);
    }

    if (value && typeof value === 'object' && 'data' in value) {
        return normalizeBinaryContent((value as { data?: unknown }).data);
    }

    throw new Error('Expected binary content.');
}

/**
 * 文件服务 — 封装 Chips Host 提供的文件操作路由。
 *
 * Host 支持的路由（来自 register-schemas.ts / register-host-services.ts）：
 *   file.read, file.write, file.stat, file.list, file.watch
 *   file.mkdir, file.delete, file.move, file.copy
 */
export const fileService = {
    async readText(path: string): Promise<string> {
        const result = await getChipsClient().file.read(path, { encoding: 'utf-8' });
        const content = (result as any)?.content ?? result;
        if (typeof content !== 'string') {
            throw new Error(`Expected text content for ${path}`);
        }
        return content;
    },

    async readBinary(path: string): Promise<Uint8Array> {
        const result = await getChipsClient().file.read(path, { encoding: 'binary' });
        const content = (result as any)?.content ?? result;
        try {
            return normalizeBinaryContent(content);
        } catch {
            throw new Error(`Expected binary content for ${path}`);
        }
    },

    async writeText(path: string, content: string): Promise<void> {
        await getChipsClient().file.write(path, content, { encoding: 'utf-8' });
    },

    async writeBinary(path: string, content: Uint8Array): Promise<void> {
        await getChipsClient().file.write(path, content, { encoding: 'binary' });
    },

    async list(dir: string, options?: FileListOptions): Promise<FileEntry[]> {
        const result = await getChipsClient().file.list(dir, options);
        const entries = Array.isArray(result) ? result : (result as any)?.entries;
        return Array.isArray(entries) ? entries : [];
    },

    async stat(path: string): Promise<FileStat> {
        const result = await getChipsClient().file.stat(path);
        return ((result as any)?.meta ?? result) as FileStat;
    },

    async exists(path: string): Promise<boolean> {
        try {
            await this.stat(path);
            return true;
        } catch {
            return false;
        }
    },

    async mkdir(path: string): Promise<void> {
        await getChipsClient().file.mkdir(path);
    },

    async ensureDir(path: string): Promise<void> {
        const exists = await this.exists(path);
        if (!exists) {
            await this.mkdir(path);
        }
    },

    async delete(path: string, options?: FileDeleteOptions): Promise<void> {
        await getChipsClient().file.delete(path, options);
    },

    async move(sourcePath: string, destPath: string): Promise<void> {
        await getChipsClient().file.move(sourcePath, destPath);
    },

    async copy(sourcePath: string, destPath: string): Promise<void> {
        await getChipsClient().file.copy(sourcePath, destPath);
    },
};

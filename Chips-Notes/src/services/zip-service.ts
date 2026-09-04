import type { ZipEntryMeta } from 'chips-sdk';
import { getChipsClient } from './bridge-client';

export const zipService = {
    async extract(zipPath: string, outputDir: string): Promise<string> {
        return getChipsClient().zip.extract(zipPath, outputDir);
    },

    async list(zipPath: string): Promise<ZipEntryMeta[]> {
        return getChipsClient().zip.list(zipPath);
    },
};

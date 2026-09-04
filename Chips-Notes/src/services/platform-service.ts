import { getChipsClient } from './bridge-client';

export const platformService = {
    getPathForFile(file: unknown): string {
        return getChipsClient().platform.getPathForFile(file);
    },
};

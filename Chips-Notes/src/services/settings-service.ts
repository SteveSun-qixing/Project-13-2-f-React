import { getChipsClient } from './bridge-client';

export const settingsService = {
    /**
     * 获取设置
     */
    async get<T>(key: string, defaultValue?: T): Promise<T | undefined> {
        try {
            const value = await getChipsClient().config.get(key);
            return (value !== undefined ? value : defaultValue) as T | undefined;
        } catch (e) {
            console.warn(`[Settings] Failed to get config key: ${key}`, e);
            return defaultValue;
        }
    },

    /**
     * 写入设置
     */
    async set<T>(key: string, value: T): Promise<void> {
        await getChipsClient().config.set(key, value);
    }
};

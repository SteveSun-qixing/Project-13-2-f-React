import type { Client } from 'chips-sdk';
import { getEditingEngineClient } from '../runtime/chips-client';

/**
 * 获取 SDK 客户端单例
 * 在应用插件环境，它会自动适配 Bridge API。
 */
export function getChipsClient(): Client {
    return getEditingEngineClient();
}

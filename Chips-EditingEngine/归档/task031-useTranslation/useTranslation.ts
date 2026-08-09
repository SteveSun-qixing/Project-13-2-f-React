import { useCallback } from 'react';
import { formatMessage } from '../lib/messages';

/**
 * 应用中文文案 hook
 *
 * 多语言系统移除后（task030），界面文案统一为简体中文。
 * 保留 { t, locale } 签名以兼容既有调用点；t 只查 src/lib/messages.ts 本地中文表。
 */
export function useTranslation() {
    const t = useCallback((key: string, params?: Record<string, string | number>) => {
        return formatMessage(key, params);
    }, []);

    return { t, locale: 'zh-CN' };
}

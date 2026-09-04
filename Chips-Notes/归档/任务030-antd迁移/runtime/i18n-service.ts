/**
 * i18n 服务
 *
 * 职责：从 Host 读取当前系统 locale，并同步到本地 i18n 注册表。
 *
 * 重要区分：
 * - Host i18n.translate 仅用于系统级字符串（如 system.ready），不负责应用内 UI 文案。
 * - 应用内 UI 文案由 src/i18n/ 本地字典管理，通过 useTranslation hook 访问。
 */
import { getChipsClient } from './bridge-client';
import { getLocale, setLocale } from '../i18n';

export const i18nService = {
    /**
     * 从 Host 读取系统 locale，并初始化本地 i18n 注册表。
     * 应在应用启动时调用一次。
     */
    async initLocale(): Promise<string> {
        try {
            const locale = await getChipsClient().i18n.getCurrent();
            if (locale) {
                setLocale(locale);
            }
            return getLocale();
        } catch (e) {
            console.warn('[i18n] Failed to get locale from Host, using default zh-CN', e);
            return 'zh-CN';
        }
    },

    /**
     * 设置系统语言（会同时通知 Host 和刷新本地词典）
     */
    async setCurrentLocale(locale: string): Promise<void> {
        try {
            await getChipsClient().i18n.setCurrent(locale);
            setLocale(locale);
        } catch (e) {
            console.warn('[i18n] Failed to set locale on Host:', e);
            // Still apply locally even if Host call fails
            setLocale(locale);
        }
    },

    /**
     * 获取 Host 支持的所有 locale 列表
     */
    async listLocales(): Promise<string[]> {
        try {
            return await getChipsClient().i18n.listLocales();
        } catch {
            return ['zh-CN', 'en-US'];
        }
    },
};

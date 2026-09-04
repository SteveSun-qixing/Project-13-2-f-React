/**
 * 本地 i18n 注册表
 *
 * 应用内 UI 文案完全由本地管理，与 Host 的 i18n 服务解耦。
 * - Host i18n 服务（i18n.translate）仅用于系统级字符串，不存储应用文案。
 * - 应用从 Host 获取当前 locale（zh-CN / en-US），本地选择对应语言包。
 */
import zhCN from './zh-CN';
import enUS from './en-US';

const LOCALES: Record<string, Record<string, string>> = {
    'zh-CN': zhCN,
    'en-US': enUS,
};

/** 当前激活的语言 */
let currentLocale = 'zh-CN';
const listeners = new Set<() => void>();

function resolveLocale(locale: string): string {
    if (LOCALES[locale]) {
        return locale;
    }

    const prefix = locale.split('-')[0];
    const match = Object.keys(LOCALES).find(key => key.startsWith(prefix));
    return match ?? currentLocale;
}

/** 设置当前语言（由 App 初始化时从 Host 读取并设定） */
export function setLocale(locale: string): void {
    const nextLocale = resolveLocale(locale);
    if (nextLocale === currentLocale) {
        return;
    }
    currentLocale = nextLocale;
    listeners.forEach((listener) => listener());
}

/** 获取当前语言代码 */
export function getLocale(): string {
    return currentLocale;
}

export function subscribeLocaleChange(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

/**
 * 同步翻译函数
 * @param key 文案键
 * @param params 插值参数，如 { name: 'World' } 替换 {name}
 * @returns 翻译后的字符串，找不到则返回 key 本身
 */
export function translate(key: string, params?: Record<string, string | number>, locale = currentLocale): string {
    const table = LOCALES[resolveLocale(locale)] ?? LOCALES['zh-CN'] ?? {};
    let text = table[key] ?? key;

    if (params) {
        for (const [param, value] of Object.entries(params)) {
            text = text.replace(new RegExp(`\\{${param}\\}`, 'g'), String(value));
        }
    }

    return text;
}

export function t(key: string, params?: Record<string, string | number>): string {
    return translate(key, params, currentLocale);
}

import type { IBoxLayoutPlugin } from '@chips/sdk';
import { validateConfig } from './config';

/** 主进程入口集合：布局插件的主进程侧只有纯函数 validateConfig。 */
export const mainPlugin: Pick<IBoxLayoutPlugin, 'validateConfig'> = { validateConfig };

export default mainPlugin;

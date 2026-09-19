import { App, ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import type { ThemeConfig } from 'antd';
import type { ReactElement, ReactNode } from 'react';
import { CHIPS_CSS_VAR_KEY, CHIPS_CSS_VAR_PREFIX } from './css-vars';
import { validateChipsThemeConfig } from './theme-policy';

export interface ChipsThemeRootProps {
  /**
   * 由 `@chips/ui` 提供的 Design Tokens 主题配置（浅色 / 深色由系统外观驱动）。
   * 数值以《09-统一视觉规范》为唯一事实源，共享层只读、不覆盖、不复制。
   */
  theme: ThemeConfig;
  /** 主题根内容：窗口 UI 或帧 UI 的整棵树。 */
  children: ReactNode;
}

/**
 * 薯片生态唯一主题根：窗口与渲染帧都由 `@chips/ui` 安装一次。
 *
 * 职责边界：
 * - fork 独占：简体中文 locale、antd `App` 上下文（`message` / `notification` / `modal`）、
 *   CSS 变量作用域（`--chips-*` / `.css-var-chips`）与单实例优化（`hashed: false`）；
 * - 共享层提供：`algorithm`、`token` 与 `components` 数值；
 * - 业务代码与插件不自建主题根、`ConfigProvider` 或 `App`，一律继承本根。
 */
export function ChipsThemeRoot({ theme, children }: ChipsThemeRootProps): ReactElement {
  validateChipsThemeConfig(theme);

  return (
    <ConfigProvider
      theme={{
        ...theme,
        inherit: false,
        hashed: false,
        cssVar: { prefix: CHIPS_CSS_VAR_PREFIX, key: CHIPS_CSS_VAR_KEY },
      }}
      locale={zhCN}
    >
      <App>{children}</App>
    </ConfigProvider>
  );
}

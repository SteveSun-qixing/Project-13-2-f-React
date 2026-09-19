/**
 * 共享 DOM 测试 setup：`environment: 'jsdom'` 的项目由 {@link ./vitest} 工厂自动注入。
 *
 * 只安装测试断言扩展，不安装任何平台 Mock；平台调用一律使用
 * `@chips/sdk/testing` 的 `installMockBridge`。
 */

import '@testing-library/jest-dom/vitest';

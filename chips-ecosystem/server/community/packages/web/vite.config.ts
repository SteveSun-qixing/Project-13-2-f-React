import { defineConfig } from 'vite';

import react from '@vitejs/plugin-react';

/**
 * Web 前台 Vite 配置：
 * - 生产为同源部署（Nginx 将 `/api` 反代到 API 进程），客户端不写死备用域名（《11 契约》§2.1）；
 * - 本地开发经 dev server 代理 `/api` 指向本机社区 API，端口与目标可用环境变量覆盖。
 */
export default defineConfig(({ mode }) => {
  const devPort = Number.parseInt(process.env.COMMUNITY_WEB_PORT ?? '5173', 10);
  const apiProxyTarget = process.env.COMMUNITY_API_PROXY_TARGET || 'http://127.0.0.1:3000';

  void mode;

  return {
    plugins: [react()],
    server: {
      port: Number.isFinite(devPort) ? devPort : 5173,
      proxy: {
        '/api': apiProxyTarget,
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
    },
  };
});

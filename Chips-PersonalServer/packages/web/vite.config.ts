import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const devPort = Number.parseInt(env.CCPS_WEB_PORT ?? '5173', 10);
  const apiProxyTarget = env.CCPS_API_PROXY_TARGET || 'http://localhost:3000';
  const cdnProxyTarget = env.CCPS_CDN_PROXY_TARGET || 'http://localhost:9000';

  return {
    plugins: [react()],
    server: {
      port: Number.isFinite(devPort) ? devPort : 5173,
      proxy: {
        '/api': apiProxyTarget,
        '/cdn': {
          target: cdnProxyTarget,
          rewrite: (path) => path.replace(/^\/cdn/, ''),
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
    },
  };
});

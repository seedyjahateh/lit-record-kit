import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

// Live mode talks to a ServiceNow Personal Developer Instance through the Vite dev proxy.
// Credentials are read from .env on the Node side and added as a header here, so they are
// never bundled into browser code.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const proxy = env.SN_INSTANCE
    ? {
        '/api/now': {
          target: env.SN_INSTANCE,
          changeOrigin: true,
          secure: true,
          headers: {
            Authorization: 'Basic ' + Buffer.from(`${env.SN_USER ?? ''}:${env.SN_PASSWORD ?? ''}`).toString('base64'),
          },
        },
      }
    : undefined;

  return {
    server: { proxy },
    test: { environment: 'happy-dom', include: ['tests/**/*.test.ts'] },
  };
});

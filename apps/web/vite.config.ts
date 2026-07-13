import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// Load env from the monorepo root so VITE_* vars live in the shared .env.
export default defineConfig(({ mode }) => {
  const rootEnv = loadEnv(mode, resolve(__dirname, '../../'), '');
  const port = Number(rootEnv.WEB_PORT ?? 5173);
  const apiUrl = rootEnv.VITE_API_URL ?? 'http://localhost:3000/api';

  return {
    plugins: [react()],
    server: {
      port,
      proxy: {
        '/api': {
          target: apiUrl.replace(/\/api$/, ''),
          changeOrigin: true,
        },
      },
    },
    define: {
      'import.meta.env.VITE_API_URL': JSON.stringify(apiUrl),
    },
  };
});

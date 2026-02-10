import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

/**
 * dev-fixtures/data/ から開発用JSONデータを配信するViteプラグイン。
 * 本番では data/ は Azure Blob Storage で別管理されるため、
 * public/ には含めず開発サーバーのミドルウェアで配信する。
 */
function serveDevFixtures() {
  const handler = (req, res, next) => {
    if (!req.url?.startsWith('/data/')) return next();
    const urlPath = req.url.split('?')[0];
    const filePath = resolve(__dirname, 'dev-fixtures', urlPath.slice(1));
    if (!existsSync(filePath)) return next();
    const content = readFileSync(filePath, 'utf-8');
    res.setHeader('Content-Type', 'application/json');
    res.end(content);
  };

  return {
    name: 'serve-dev-fixtures',
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    },
  };
}

export default defineConfig({
  plugins: [serveDevFixtures(), react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.{js,jsx}'],
    setupFiles: ['./tests/vitest.setup.js'],
  },
});

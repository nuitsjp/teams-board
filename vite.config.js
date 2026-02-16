import { readFileSync, existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

/**
 * dev-fixtures/data/ から開発用JSONデータを配信するViteプラグイン。
 * 本番では data/ は Azure Blob Storage で別管理されるため、
 * public/ には含めず開発サーバーのミドルウェアで配信する。
 *
 * 開発環境では POST /dev-fixtures-write で書き込みも可能（管理者モードのテスト用）。
 */
function serveDevFixtures() {
  const handler = async (req, res, next) => {
    // GETリクエスト: 既存の読み込み処理
    if (req.method === 'GET' && req.url?.startsWith('/data/')) {
      const urlPath = req.url.split('?')[0];
      const filePath = resolve(__dirname, 'dev-fixtures', urlPath.slice(1));
      if (!existsSync(filePath)) return next();
      const content = readFileSync(filePath, 'utf-8');
      res.setHeader('Content-Type', 'application/json');
      res.end(content);
      return;
    }

    // POSTリクエスト: 開発用書き込み処理
    if (req.method === 'POST' && req.url?.startsWith('/dev-fixtures-write')) {
      console.log('[dev-fixtures-write] リクエスト受信');
      let body = '';
      req.on('data', (chunk) => {
        body += chunk.toString();
      });
      req.on('end', async () => {
        try {
          // リクエストボディのパース
          const { path, data } = JSON.parse(body);
          console.log('[dev-fixtures-write] パス:', path);
          if (!path || data === undefined) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: 'pathとdataが必要です' }));
            return;
          }

          // ファイルパスの構築
          const filePath = resolve(__dirname, 'dev-fixtures', path);

          // ディレクトリが存在しない場合は自動作成
          const dir = dirname(filePath);
          await mkdir(dir, { recursive: true });

          // JSON形式でインデント付き保存
          const jsonContent = JSON.stringify(data, null, 2);
          await writeFile(filePath, jsonContent, 'utf-8');
          console.log('[dev-fixtures-write] ファイル書き込み成功:', filePath);

          // 成功レスポンス
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true }));
        } catch (error) {
          // エラーハンドリング
          console.error('[dev-fixtures-write] エラー:', error);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              success: false,
              error: error.message || 'ファイルの書き込みに失敗しました',
            })
          );
        }
      });
      return;
    }

    next();
  };

  return {
    name: 'serve-dev-fixtures',
    configureServer(server) {
      server.middlewares.use(handler);

      // 開発サーバー起動後に管理者モード用URLを表示
      server.httpServer?.once('listening', () => {
        setTimeout(() => {
          const address = server.httpServer?.address();
          if (address && typeof address === 'object') {
            const protocol = server.config.server.https ? 'https' : 'http';
            const port = address.port;
            console.log(
              `\n  ${'\x1b[32m➜\x1b[0m'}  ${'\x1b[1m'}管理者モード:\x1b[0m ${'\x1b[36m'}${protocol}://localhost:${port}/?token=dev\x1b[0m`
            );
          }
        }, 100);
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    },
  };
}

/**
 * index.html の <title> タグを VITE_APP_TITLE 環境変数の値で置換するプラグイン。
 * 未設定時はデフォルト値「Teams Board」を使用する。
 */
function htmlTitlePlugin() {
  return {
    name: 'html-title',
    transformIndexHtml(html) {
      const title = process.env.VITE_APP_TITLE || 'Teams Board';
      return html.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`);
    },
  };
}

export default defineConfig({
  plugins: [serveDevFixtures(), htmlTitlePlugin(), react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.{js,jsx}'],
    setupFiles: ['./tests/vitest.setup.js'],
    coverage: {
      include: ['src/**/*.{js,jsx}'],
      exclude: ['src/main.jsx', 'src/App.jsx', 'src/services/shared-data-fetcher.js'],
    },
  },
});

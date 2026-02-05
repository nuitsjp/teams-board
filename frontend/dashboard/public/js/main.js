// メインエントリーポイント
import { AuthManager } from '../src/core/auth-manager.js';
import { Router } from '../src/core/router.js';
import { DataFetcher } from '../src/data/data-fetcher.js';
import { BlobWriter } from '../src/data/blob-writer.js';
import { CsvTransformer } from '../src/logic/csv-transformer.js';
import { DashboardView } from '../src/ui/dashboard-view.js';
import { DetailView } from '../src/ui/detail-view.js';
import { AdminPanel } from '../src/ui/admin-panel.js';

// アプリケーション初期化
const auth = AuthManager.initialize();
const router = new Router();
const fetcher = new DataFetcher();
const blobWriter = new BlobWriter(auth);
const csvTransformer = new CsvTransformer();

const appEl = document.getElementById('app');
const dashboardView = new DashboardView(appEl, fetcher, router);
const detailView = new DetailView(appEl, fetcher, router);
const adminPanel = new AdminPanel(
  document.getElementById('admin-panel'),
  auth, csvTransformer, blobWriter
);

// ルーティング
router.onRouteChange((route) => {
  if (route.view === 'dashboard') {
    dashboardView.render();
  } else if (route.view === 'detail') {
    detailView.render(route.itemId);
  }
});

// 初期ルートの描画
const initialRoute = router.getCurrentRoute();
if (initialRoute.view === 'dashboard') {
  dashboardView.render();
} else if (initialRoute.view === 'detail') {
  detailView.render(initialRoute.itemId);
}

// 管理者パネルの初期化
adminPanel.initialize();

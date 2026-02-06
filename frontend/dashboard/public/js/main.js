// メインエントリーポイント
import { AuthManager } from './core/auth-manager.js';
import { Router } from './core/router.js';
import { DataFetcher } from './data/data-fetcher.js';
import { BlobWriter } from './data/blob-writer.js';
import { IndexMerger } from './data/index-merger.js';
import { CsvTransformer } from './logic/csv-transformer.js';
import { DashboardView } from './ui/dashboard-view.js';
import { MemberDetailView } from './ui/detail-view.js';
import { AdminPanel } from './ui/admin-panel.js';

// アプリケーション初期化
const auth = AuthManager.initialize();
const router = new Router();
const fetcher = new DataFetcher();
const blobWriter = new BlobWriter(auth, 'https://strjstudylogprod.blob.core.windows.net/$web');
const indexMerger = new IndexMerger();
const csvTransformer = new CsvTransformer();

const appEl = document.getElementById('app');
const dashboardView = new DashboardView(appEl, fetcher, router);
const memberDetailView = new MemberDetailView(appEl, fetcher, router);
const adminPanel = new AdminPanel(
  document.getElementById('admin-panel'),
  auth, csvTransformer, blobWriter, indexMerger, fetcher
);

// ルーティング
router.onRouteChange((route) => {
  if (route.view === 'dashboard') {
    dashboardView.render();
  } else if (route.view === 'memberDetail') {
    memberDetailView.render(route.memberId);
  }
});

// 初期ルートの描画
const initialRoute = router.getCurrentRoute();
if (initialRoute.view === 'dashboard') {
  dashboardView.render();
} else if (initialRoute.view === 'memberDetail') {
  memberDetailView.render(initialRoute.memberId);
}

// 管理者パネルの初期化
adminPanel.initialize();

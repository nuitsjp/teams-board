// メインエントリーポイント
import { AuthManager } from '../src/core/auth-manager.js';
import { Router } from '../src/core/router.js';
import { DataFetcher } from '../src/data/data-fetcher.js';
import { BlobWriter } from '../src/data/blob-writer.js';
import { IndexMerger } from '../src/data/index-merger.js';
import { CsvTransformer } from '../src/logic/csv-transformer.js';
import { DashboardView } from '../src/ui/dashboard-view.js';
import { MemberDetailView } from '../src/ui/detail-view.js';
import { AdminPanel } from '../src/ui/admin-panel.js';

// アプリケーション初期化
const auth = AuthManager.initialize();
const router = new Router();
const fetcher = new DataFetcher();
const blobWriter = new BlobWriter(auth);
const indexMerger = new IndexMerger();
const csvTransformer = new CsvTransformer();

const appEl = document.getElementById('app');
const dashboardView = new DashboardView(appEl, fetcher, router);
const memberDetailView = new MemberDetailView(appEl, fetcher, router);
const adminPanel = new AdminPanel(
  document.getElementById('admin-panel'),
  auth, csvTransformer, blobWriter, indexMerger
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

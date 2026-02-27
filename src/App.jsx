import { lazy, Suspense } from 'react';
import { createHashRouter, RouterProvider, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth.jsx';
import { DashboardPage } from './pages/DashboardPage.jsx';
import { MemberDetailPage } from './pages/MemberDetailPage.jsx';
import { GroupDetailPage } from './pages/GroupDetailPage.jsx';
import { OrganizerDetailPage } from './pages/OrganizerDetailPage.jsx';
import { BookOpen, Settings } from 'lucide-react';

const loadAdminPage = () => import('./pages/AdminPage.jsx');
const LazyAdminPage = lazy(loadAdminPage);

const adminLoadingFallback = (
  <div className="card-base px-4 py-3 text-sm text-text-muted">
    管理画面を読み込み中...
  </div>
);

// ルート定義
const router = createHashRouter([
  { path: '/', element: <DashboardPage /> },
  { path: '/members/:memberId', element: <MemberDetailPage /> },
  { path: '/groups/:groupId', element: <GroupDetailPage /> },
  { path: '/organizers/:organizerId', element: <OrganizerDetailPage /> },
  {
    path: '/admin',
    element: (
      <Suspense fallback={adminLoadingFallback}>
        <LazyAdminPage />
      </Suspense>
    ),
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);

/**
 * アプリケーション内部レイアウト（AuthContext内で使用）
 */
function AppLayout() {
  const { isAdmin } = useAuth();

  return (
    <div className="min-h-screen bg-page-bg">
      {/* 統一ヘッダー — ガラスモルフィズム */}
      <header className="bg-surface/80 backdrop-blur-md shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-8 h-16 flex items-center justify-between">
          <a
            href="#/"
            className="flex items-center gap-3 text-text-primary hover:text-primary-700 transition-colors"
          >
            <div className="w-8 h-8 rounded-lg bg-primary-500 text-white flex items-center justify-center">
              <BookOpen className="w-4.5 h-4.5" />
            </div>
            <span className="text-lg font-bold tracking-tight">
              {import.meta.env.VITE_APP_TITLE || 'Teams Board'}
            </span>
            {import.meta.env.VITE_APP_DESCRIPTION && (
              <span className="hidden sm:inline text-xs text-text-muted font-normal ml-2">
                {import.meta.env.VITE_APP_DESCRIPTION}
              </span>
            )}
          </a>
          {isAdmin && (
            <a
              href="#/admin"
              onMouseEnter={loadAdminPage}
              onFocus={loadAdminPage}
              className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-primary-600 hover:bg-primary-50 rounded-lg px-3 py-1.5 transition-colors"
            >
              <Settings className="w-4 h-4" />
              管理
            </a>
          )}
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="max-w-7xl mx-auto px-8 py-10">
        <RouterProvider router={router} />
      </main>
    </div>
  );
}

/**
 * ルートコンポーネント — AuthContextとHashRouterを構成する
 */
export function App() {
  return (
    <AuthProvider>
      <AppLayout />
    </AuthProvider>
  );
}

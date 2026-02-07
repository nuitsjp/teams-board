import { createHashRouter, RouterProvider, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth.jsx';
import { DashboardPage } from './pages/DashboardPage.jsx';
import { MemberDetailPage } from './pages/MemberDetailPage.jsx';
import { StudyGroupDetailPage } from './pages/StudyGroupDetailPage.jsx';
import { AdminPage } from './pages/AdminPage.jsx';
import { BookOpen, Settings } from 'lucide-react';

// ルート定義
const router = createHashRouter([
  { path: '/', element: <DashboardPage /> },
  { path: '/members/:memberId', element: <MemberDetailPage /> },
  { path: '/study-groups/:studyGroupId', element: <StudyGroupDetailPage /> },
  { path: '/admin', element: <AdminPage /> },
  { path: '*', element: <Navigate to="/" replace /> },
]);

/**
 * アプリケーション内部レイアウト（AuthContext内で使用）
 */
function AppLayout() {
  const { isAdmin } = useAuth();

  return (
    <div className="min-h-screen bg-page-bg">
      {/* 統一ヘッダー */}
      <header className="bg-surface border-b border-border sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <a href="#/" className="flex items-center gap-2.5 text-text-primary hover:text-primary-700 transition-colors">
            <BookOpen className="w-5 h-5 text-primary-600" />
            <span className="text-lg font-bold tracking-tight">Study Log</span>
          </a>
          {isAdmin && (
            <a
              href="#/admin"
              className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-primary-600 transition-colors"
            >
              <Settings className="w-4 h-4" />
              管理
            </a>
          )}
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="max-w-6xl mx-auto px-6 py-8">
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

import { createHashRouter, RouterProvider, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth.jsx';
import { DashboardPage } from './pages/DashboardPage.jsx';
import { MemberDetailPage } from './pages/MemberDetailPage.jsx';
import { AdminPage } from './pages/AdminPage.jsx';

// ルート定義
const router = createHashRouter([
  { path: '/', element: <DashboardPage /> },
  { path: '/members/:memberId', element: <MemberDetailPage /> },
  { path: '*', element: <Navigate to="/" replace /> },
]);

/**
 * アプリケーション内部レイアウト（AuthContext内で使用）
 */
function AppLayout() {
  const { isAdmin } = useAuth();

  return (
    <>
      <header>
        <h1>ダッシュボード</h1>
      </header>
      <main id="app">
        <RouterProvider router={router} />
      </main>
      {isAdmin && <AdminPage />}
    </>
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

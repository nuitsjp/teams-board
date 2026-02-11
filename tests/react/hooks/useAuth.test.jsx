import { render, screen } from '@testing-library/react';
import { AuthProvider, useAuth } from '../../../src/hooks/useAuth.jsx';

// テスト用コンポーネント
function AuthDisplay() {
  const { sasToken, isAdmin } = useAuth();
  return (
    <div>
      <span data-testid="token">{sasToken || 'null'}</span>
      <span data-testid="admin">{isAdmin ? 'true' : 'false'}</span>
    </div>
  );
}

describe('useAuth', () => {
  let originalLocation;
  let originalReplaceState;

  beforeEach(() => {
    originalReplaceState = window.history.replaceState;
    window.history.replaceState = vi.fn();
  });

  afterEach(() => {
    window.history.replaceState = originalReplaceState;
  });

  it('トークンがない場合、isAdminがfalseであること', () => {
    // tokenパラメータなしのURL
    Object.defineProperty(window, 'location', {
      writable: true,
      value: new URL('http://localhost/'),
    });

    render(
      <AuthProvider>
        <AuthDisplay />
      </AuthProvider>
    );

    expect(screen.getByTestId('token').textContent).toBe('null');
    expect(screen.getByTestId('admin').textContent).toBe('false');
  });

  it('トークンがある場合、isAdminがtrueであること', () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: new URL('http://localhost/?token=test-sas-token'),
    });

    render(
      <AuthProvider>
        <AuthDisplay />
      </AuthProvider>
    );

    expect(screen.getByTestId('token').textContent).toBe('test-sas-token');
    expect(screen.getByTestId('admin').textContent).toBe('true');
  });

  it('トークン抽出後にURLからパラメータが削除されること', () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: new URL('http://localhost/?token=sas123'),
    });

    render(
      <AuthProvider>
        <AuthDisplay />
      </AuthProvider>
    );

    expect(window.history.replaceState).toHaveBeenCalled();
  });

  describe('開発用ダミートークン', () => {
    let originalEnv;

    beforeEach(() => {
      originalEnv = import.meta.env.DEV;
    });

    afterEach(() => {
      import.meta.env.DEV = originalEnv;
    });

    it('開発環境でtoken=devを使用した場合、isAdminがtrueであること', () => {
      // 開発環境をモック
      import.meta.env.DEV = true;

      Object.defineProperty(window, 'location', {
        writable: true,
        value: new URL('http://localhost/?token=dev'),
      });

      render(
        <AuthProvider>
          <AuthDisplay />
        </AuthProvider>
      );

      expect(screen.getByTestId('token').textContent).toBe('dev');
      expect(screen.getByTestId('admin').textContent).toBe('true');
    });

    it('本番環境でtoken=devを使用した場合、isAdminがfalseであること', () => {
      // 本番環境をモック
      import.meta.env.DEV = false;

      Object.defineProperty(window, 'location', {
        writable: true,
        value: new URL('http://localhost/?token=dev'),
      });

      render(
        <AuthProvider>
          <AuthDisplay />
        </AuthProvider>
      );

      expect(screen.getByTestId('token').textContent).toBe('null');
      expect(screen.getByTestId('admin').textContent).toBe('false');
    });

    it('開発環境で実際のSASトークンを使用した場合、通常通り動作すること', () => {
      // 開発環境をモック
      import.meta.env.DEV = true;

      Object.defineProperty(window, 'location', {
        writable: true,
        value: new URL('http://localhost/?token=real-sas-token'),
      });

      render(
        <AuthProvider>
          <AuthDisplay />
        </AuthProvider>
      );

      expect(screen.getByTestId('token').textContent).toBe('real-sas-token');
      expect(screen.getByTestId('admin').textContent).toBe('true');
    });
  });
});

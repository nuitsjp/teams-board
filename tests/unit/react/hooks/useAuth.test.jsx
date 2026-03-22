import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth, createAuthAdapter } from '../../../../src/hooks/useAuth.jsx';

// fetchWriterToken モック
const mockFetchWriterToken = vi.fn();
vi.mock('../../../../src/services/writer-token.js', () => ({
  fetchWriterToken: (...args) => mockFetchWriterToken(...args),
}));

// テスト用コンポーネント
function AuthDisplay() {
  const { sasToken, isAdmin, writerSasToken } = useAuth();
  return (
    <div>
      <span data-testid="token">{sasToken || 'null'}</span>
      <span data-testid="admin">{isAdmin ? 'true' : 'false'}</span>
      <span data-testid="writer-token">{writerSasToken || 'null'}</span>
    </div>
  );
}

describe('useAuth', () => {
  let originalLocation;
  let originalReplaceState;

  beforeEach(() => {
    originalReplaceState = window.history.replaceState;
    window.history.replaceState = vi.fn();
    mockFetchWriterToken.mockResolvedValue(null);
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

  it('tokenパラメータ以外のクエリパラメータが保持されること', () => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: new URL('http://localhost/?token=sas123&other=value#/admin'),
    });

    render(
      <AuthProvider>
        <AuthDisplay />
      </AuthProvider>
    );

    expect(screen.getByTestId('token').textContent).toBe('sas123');
    // replaceState が呼ばれ、他のパラメータが保持されていること
    expect(window.history.replaceState).toHaveBeenCalledWith(
      null,
      '',
      expect.stringContaining('other=value')
    );
  });
});

describe('writerSasToken', () => {
  let originalReplaceState;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchWriterToken.mockResolvedValue(null);
    originalReplaceState = window.history.replaceState;
    window.history.replaceState = vi.fn();
  });

  afterEach(() => {
    window.history.replaceState = originalReplaceState;
  });

  it('管理者トークンがない場合、writerSasToken を非同期取得すること', async () => {
    mockFetchWriterToken.mockResolvedValue('writer-token-abc');

    Object.defineProperty(window, 'location', {
      writable: true,
      value: new URL('http://localhost/'),
    });

    render(
      <AuthProvider>
        <AuthDisplay />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('writer-token').textContent).toBe('writer-token-abc');
    });
    expect(mockFetchWriterToken).toHaveBeenCalledTimes(1);
  });

  it('管理者トークンがある場合、writerSasToken の取得をスキップすること', async () => {
    mockFetchWriterToken.mockResolvedValue('should-not-be-used');

    Object.defineProperty(window, 'location', {
      writable: true,
      value: new URL('http://localhost/?token=admin-sas-token'),
    });

    render(
      <AuthProvider>
        <AuthDisplay />
      </AuthProvider>
    );

    // 管理者トークンが設定されている
    expect(screen.getByTestId('token').textContent).toBe('admin-sas-token');
    // fetchWriterToken は呼ばれない
    expect(mockFetchWriterToken).not.toHaveBeenCalled();
    // writerSasToken は null のまま
    expect(screen.getByTestId('writer-token').textContent).toBe('null');
  });

  it('writerSasToken 取得失敗時は null のままであること', async () => {
    mockFetchWriterToken.mockResolvedValue(null);

    Object.defineProperty(window, 'location', {
      writable: true,
      value: new URL('http://localhost/'),
    });

    render(
      <AuthProvider>
        <AuthDisplay />
      </AuthProvider>
    );

    // useEffect が実行されるのを待つ
    await waitFor(() => {
      expect(mockFetchWriterToken).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByTestId('writer-token').textContent).toBe('null');
  });
});

describe('createAuthAdapter', () => {
  it('SASトークンがある場合、getSasTokenがトークンを返しisAdminModeがtrueを返す', () => {
    const adapter = createAuthAdapter({ sasToken: 'test-token' });

    expect(adapter.getSasToken()).toBe('test-token');
    expect(adapter.isAdminMode()).toBe(true);
  });

  it('SASトークンがnullの場合、getSasTokenがnullを返しisAdminModeがfalseを返す', () => {
    const adapter = createAuthAdapter({ sasToken: null });

    expect(adapter.getSasToken()).toBeNull();
    expect(adapter.isAdminMode()).toBe(false);
  });
});

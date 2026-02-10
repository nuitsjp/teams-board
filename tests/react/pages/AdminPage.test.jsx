// AdminPage — ソースファイル保存パスの検証テスト
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AdminPage } from '../../../src/pages/AdminPage.jsx';

// BlobWriter のモック — executeWriteSequence の引数をキャプチャ
const mockExecuteWriteSequence = vi.fn().mockResolvedValue({ results: [], allSucceeded: true });

vi.mock('../../../src/services/blob-writer.js', () => ({
  BlobWriter: vi.fn().mockImplementation(() => ({
    executeWriteSequence: mockExecuteWriteSequence,
  })),
}));

// CsvTransformer のモック
const mockParse = vi.fn();
vi.mock('../../../src/services/csv-transformer.js', () => ({
  CsvTransformer: vi.fn().mockImplementation(() => ({
    parse: (...args) => mockParse(...args),
  })),
}));

// IndexMerger のモック
vi.mock('../../../src/services/index-merger.js', () => ({
  IndexMerger: vi.fn().mockImplementation(() => ({
    merge: vi.fn().mockReturnValue({
      index: { groups: [], members: [], updatedAt: '' },
      warnings: [],
    }),
  })),
}));

// IndexEditor のモック
vi.mock('../../../src/services/index-editor.js', () => ({
  IndexEditor: vi.fn().mockImplementation(() => ({
    updateGroupName: vi.fn().mockReturnValue({
      index: {
        groups: [
          { id: 'group1', name: '新しいグループ名', totalDurationSeconds: 3600, sessionIds: [] },
        ],
        members: [],
        updatedAt: new Date().toISOString(),
      },
    }),
  })),
}));

// DataFetcher のモック
vi.mock('../../../src/services/data-fetcher.js', () => ({
  DataFetcher: vi.fn().mockImplementation(() => ({
    fetchIndex: vi.fn().mockResolvedValue({
      ok: true,
      data: { groups: [], members: [], updatedAt: '' },
    }),
  })),
}));

// useAuth のモック — 管理者として認証済み
vi.mock('../../../src/hooks/useAuth.jsx', () => ({
  useAuth: () => ({ sasToken: 'test-sas-token', isAdmin: true }),
  createAuthAdapter: () => ({
    getSasToken: () => 'test-sas-token',
    isAdminMode: () => true,
  }),
}));

describe('AdminPage — ソースファイル保存パス', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockParse.mockResolvedValue({
      ok: true,
      sessionRecord: {
        id: 'abc12345-2026-02-08',
        groupId: 'abc12345',
        date: '2026-02-08',
        attendances: [{ memberId: 'mem001', durationSeconds: 3600 }],
      },
      mergeInput: {
        sessionId: 'abc12345-2026-02-08',
        groupId: 'abc12345',
        groupName: 'サンプル勉強会',
        date: '2026-02-08',
        attendances: [{ memberId: 'mem001', memberName: '佐藤 一郎', durationSeconds: 3600 }],
      },
      warnings: [],
    });
  });

  it('一括保存時にrawCsv.pathが data/sources/{sessionId}.csv 形式であること', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );

    // CSVファイルを追加（input[type="file"] を直接操作）
    const csvContent = new Blob(['dummy csv'], { type: 'text/csv' });
    const file = new File([csvContent], 'test-report.csv', { type: 'text/csv' });
    const fileInput = document.querySelector('input[type="file"]');
    await user.upload(fileInput, file);

    // パース完了後「一括保存」ボタンが表示されるまで待機
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /一括保存/ })).toBeInTheDocument();
    });

    // 一括保存ボタンをクリック
    await user.click(screen.getByRole('button', { name: /一括保存/ }));

    // BlobWriter.executeWriteSequence が呼ばれたことを確認
    await waitFor(() => {
      expect(mockExecuteWriteSequence).toHaveBeenCalled();
    });

    // rawCsv.path が data/sources/{sessionId}.csv 形式であることを検証
    const callArgs = mockExecuteWriteSequence.mock.calls[0][0];
    expect(callArgs.rawCsv.path).toBe('data/sources/abc12345-2026-02-08.csv');

    // raw/ ディレクトリへのパスでないことを検証
    expect(callArgs.rawCsv.path).not.toMatch(/^raw\//);
  });
});

describe('AdminPage — グループ管理セクション', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('グループ一覧が表示される', async () => {
    const mockFetchIndex = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        groups: [
          {
            id: 'group1',
            name: 'テストグループ1',
            totalDurationSeconds: 3600,
            sessionIds: ['session1', 'session2'],
          },
          {
            id: 'group2',
            name: 'テストグループ2',
            totalDurationSeconds: 7200,
            sessionIds: ['session3'],
          },
        ],
        members: [],
        updatedAt: '2026-02-08T00:00:00.000Z',
      },
    });

    vi.mocked(await import('../../../src/services/data-fetcher.js')).DataFetcher.mockImplementation(
      () => ({
        fetchIndex: mockFetchIndex,
      })
    );

    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('グループ管理')).toBeInTheDocument();
      expect(screen.getByText('テストグループ1')).toBeInTheDocument();
      expect(screen.getByText('テストグループ2')).toBeInTheDocument();
      expect(screen.getByText('group1')).toBeInTheDocument();
      expect(screen.getByText('group2')).toBeInTheDocument();
    });
  });

  it('グループがない場合は「グループがありません」と表示される', async () => {
    const mockFetchIndex = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        groups: [],
        members: [],
        updatedAt: '2026-02-08T00:00:00.000Z',
      },
    });

    vi.mocked(await import('../../../src/services/data-fetcher.js')).DataFetcher.mockImplementation(
      () => ({
        fetchIndex: mockFetchIndex,
      })
    );

    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('グループ管理')).toBeInTheDocument();
      expect(screen.getByText('グループがありません')).toBeInTheDocument();
    });
  });
});

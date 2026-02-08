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
      index: { studyGroups: [], members: [], updatedAt: '' },
      warnings: [],
    }),
  })),
}));

// DataFetcher のモック
vi.mock('../../../src/services/data-fetcher.js', () => ({
  DataFetcher: vi.fn().mockImplementation(() => ({
    fetchIndex: vi.fn().mockResolvedValue({
      ok: true,
      data: { studyGroups: [], members: [], updatedAt: '' },
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
        studyGroupId: 'abc12345',
        date: '2026-02-08',
        attendances: [{ memberId: 'mem001', durationSeconds: 3600 }],
      },
      mergeInput: {
        sessionId: 'abc12345-2026-02-08',
        studyGroupId: 'abc12345',
        studyGroupName: 'テスト勉強会',
        date: '2026-02-08',
        attendances: [{ memberId: 'mem001', memberName: 'テスト太郎', durationSeconds: 3600 }],
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

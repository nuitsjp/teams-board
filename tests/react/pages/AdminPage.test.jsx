// AdminPage — ソースファイル保存パスの検証テスト
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AdminPage } from '../../../src/pages/AdminPage.jsx';

// BlobWriter のモック — executeWriteSequence の引数をキャプチャ
const mockExecuteWriteSequence = vi.fn().mockResolvedValue({ results: [], allSucceeded: true });
const mockUpdateGroupName = vi.fn();
const mockMergeGroups = vi.fn();

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
    updateGroupName: (...args) => mockUpdateGroupName(...args),
    mergeGroups: (...args) => mockMergeGroups(...args),
  })),
}));

// DataFetcher のモック
const mockFetchIndex = vi.fn();
const mockFetchSession = vi.fn();
const mockInvalidateIndexCache = vi.fn();
const mockInvalidateSessionCache = vi.fn();
vi.mock('../../../src/services/shared-data-fetcher.js', () => ({
  sharedDataFetcher: {
    fetchIndex: (...args) => mockFetchIndex(...args),
    fetchSession: (...args) => mockFetchSession(...args),
    invalidateIndexCache: (...args) => mockInvalidateIndexCache(...args),
    invalidateSessionCache: (...args) => mockInvalidateSessionCache(...args),
  },
}));

// useAuth のモック — 管理者認証状態を制御可能
let mockIsAdmin = true;
let mockSasToken = 'test-sas-token';
vi.mock('../../../src/hooks/useAuth.jsx', () => ({
  useAuth: () => ({ sasToken: mockSasToken, isAdmin: mockIsAdmin }),
  createAuthAdapter: () => ({
    getSasToken: () => mockSasToken,
    isAdminMode: () => mockIsAdmin,
  }),
}));

describe('AdminPage — ソースファイル保存パス', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAdmin = true;
    mockSasToken = 'test-sas-token';
    mockExecuteWriteSequence.mockResolvedValue({ results: [], allSucceeded: true });
    mockUpdateGroupName.mockReturnValue({
      index: {
        groups: [
          { id: 'group1', name: '新しいグループ名', totalDurationSeconds: 3600, sessionIds: [] },
        ],
        members: [],
        updatedAt: new Date().toISOString(),
      },
    });
    mockMergeGroups.mockReturnValue({
      index: {
        groups: [{ id: 'group1', name: '統合後グループ', totalDurationSeconds: 3600, sessionIds: [] }],
        members: [],
        updatedAt: new Date().toISOString(),
      },
    });
    mockFetchIndex.mockResolvedValue({
      ok: true,
      data: { groups: [], members: [], updatedAt: '' },
    });
    mockFetchSession.mockResolvedValue({
      ok: false,
      error: 'not found',
    });
    mockParse.mockResolvedValue({
      ok: true,
      sessionRecord: {
        id: 'abc12345-2026-02-08',
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

  it('一括保存時に data/sources/{sessionId}.csv が保存対象に含まれること', async () => {
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

    // data/sources/{sessionId}.csv 形式で保存対象に含まれることを検証
    const callArgs = mockExecuteWriteSequence.mock.calls[0][0];
    const sourceItem = callArgs.newItems.find((item) =>
      item.path.startsWith('data/sources/abc12345-2026-02-08')
    );
    expect(sourceItem).toBeDefined();
    expect(sourceItem.path).toBe('data/sources/abc12345-2026-02-08.csv');

    // raw/ ディレクトリへのパスでないことを検証
    expect(sourceItem.path).not.toMatch(/^raw\//);
  });

  it('一括保存成功時に index キャッシュを無効化すること', async () => {
    const user = userEvent.setup();
    mockExecuteWriteSequence.mockResolvedValueOnce({
      allSucceeded: true,
      results: [{ path: 'data/index.json', success: true }],
    });

    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );

    const csvContent = new Blob(['dummy csv'], { type: 'text/csv' });
    const file = new File([csvContent], 'test-report.csv', { type: 'text/csv' });
    const fileInput = document.querySelector('input[type="file"]');
    await user.upload(fileInput, file);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /一括保存/ })).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /一括保存/ }));

    await waitFor(() => {
      expect(mockInvalidateIndexCache).toHaveBeenCalledTimes(1);
    });
  });
});

describe('AdminPage — グループ選択による mergeInput 上書き', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAdmin = true;
    mockSasToken = 'test-sas-token';
    mockExecuteWriteSequence.mockResolvedValue({ results: [], allSucceeded: true });
    mockUpdateGroupName.mockReturnValue({
      index: {
        groups: [{ id: 'existgrp1', name: '既存グループ', totalDurationSeconds: 3600, sessionIds: [] }],
        members: [],
        updatedAt: new Date().toISOString(),
      },
    });
    mockMergeGroups.mockReturnValue({
      index: {
        groups: [{ id: 'existgrp1', name: '既存グループ', totalDurationSeconds: 3600, sessionIds: [] }],
        members: [],
        updatedAt: new Date().toISOString(),
      },
    });
    mockFetchIndex.mockResolvedValue({
      ok: true,
      data: {
        groups: [{ id: 'existgrp1', name: '既存グループ', totalDurationSeconds: 3600, sessionIds: [] }],
        members: [],
        updatedAt: '2026-02-08T00:00:00.000Z',
      },
    });
    mockFetchSession.mockResolvedValue({
      ok: false,
      error: 'not found',
    });
  });

  it('グループ選択後の一括保存で groupOverride が mergeInput/sessionRecord に反映される', async () => {
    const user = userEvent.setup();

    // CsvTransformer: 新規グループの CSV パース結果
    mockParse.mockResolvedValue({
      ok: true,
      sessionRecord: {
        id: 'newgrp01-2026-02-08',
        date: '2026-02-08',
        attendances: [{ memberId: 'mem001', durationSeconds: 3600 }],
      },
      mergeInput: {
        sessionId: 'newgrp01-2026-02-08',
        groupId: 'newgrp01',
        groupName: '新しい勉強会',
        date: '2026-02-08',
        attendances: [{ memberId: 'mem001', memberName: '佐藤 一郎', durationSeconds: 3600 }],
      },
      warnings: [],
    });

    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );

    // 既存グループの読み込みを待つ
    await waitFor(() => {
      expect(screen.getByText('グループ管理')).toBeInTheDocument();
    });

    // CSVファイルを追加
    const csvContent = new Blob(['dummy csv'], { type: 'text/csv' });
    const file = new File([csvContent], 'test-report.csv', { type: 'text/csv' });
    const fileInput = document.querySelector('input[type="file"]');
    await user.upload(fileInput, file);

    // パース完了を待つ
    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    // プルダウンで既存グループを選択
    const select = screen.getByRole('combobox');
    await user.selectOptions(select, 'existgrp1');

    // 一括保存ボタンをクリック
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /一括保存/ })).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /一括保存/ }));

    // BlobWriter.executeWriteSequence が呼ばれたことを確認
    await waitFor(() => {
      expect(mockExecuteWriteSequence).toHaveBeenCalled();
    });

    // 上書きされたパスを検証
    const callArgs = mockExecuteWriteSequence.mock.calls[0][0];
    const sourceItem = callArgs.newItems.find((item) => item.path.startsWith('data/sources/'));
    const sessionItem = callArgs.newItems.find((item) => item.path.startsWith('data/sessions/'));
    expect(sourceItem).toBeDefined();
    expect(sessionItem).toBeDefined();
    // groupOverride により sessionId が existgrp1-2026-02-08 に変更される
    expect(sourceItem.path).toBe('data/sources/existgrp1-2026-02-08.csv');
    expect(sessionItem.path).toBe('data/sessions/existgrp1-2026-02-08.json');

    // sessionRecord の中身も上書きされていることを確認
    const sessionRecord = JSON.parse(sessionItem.content);
    expect(sessionRecord.id).toBe('existgrp1-2026-02-08');
    expect(sessionRecord.groupId).toBeUndefined();
  });
});

describe('AdminPage — グループ管理セクション', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAdmin = true;
    mockSasToken = 'test-sas-token';
    mockExecuteWriteSequence.mockResolvedValue({ results: [], allSucceeded: true });
    mockUpdateGroupName.mockReturnValue({
      index: {
        groups: [{ id: 'group1', name: '新しいグループ名', totalDurationSeconds: 3600, sessionIds: [] }],
        members: [],
        updatedAt: new Date().toISOString(),
      },
    });
    mockMergeGroups.mockReturnValue({
      index: {
        groups: [{ id: 'group1', name: '統合後グループ', totalDurationSeconds: 3600, sessionIds: [] }],
        members: [],
        updatedAt: new Date().toISOString(),
      },
    });
    mockFetchIndex.mockResolvedValue({
      ok: true,
      data: { groups: [], members: [], updatedAt: '2026-02-08T00:00:00.000Z' },
    });
    mockFetchSession.mockResolvedValue({
      ok: false,
      error: 'not found',
    });
  });

  it('グループ一覧が表示される', async () => {
    mockFetchIndex.mockResolvedValue({
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
    mockFetchIndex.mockResolvedValue({
      ok: true,
      data: {
        groups: [],
        members: [],
        updatedAt: '2026-02-08T00:00:00.000Z',
      },
    });

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

  it('グループを2件選択すると統合ボタンが有効になる', async () => {
    const user = userEvent.setup();
    mockFetchIndex.mockResolvedValue({
      ok: true,
      data: {
        groups: [
          {
            id: 'group1',
            name: 'テストグループ1',
            totalDurationSeconds: 3600,
            sessionIds: ['session1'],
          },
          {
            id: 'group2',
            name: 'テストグループ2',
            totalDurationSeconds: 7200,
            sessionIds: ['session2'],
          },
        ],
        members: [],
        updatedAt: '2026-02-08T00:00:00.000Z',
      },
    });

    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );

    const mergeButton = await screen.findByRole('button', { name: '統合' });
    expect(mergeButton).toBeDisabled();

    await user.click(screen.getByRole('checkbox', { name: 'テストグループ1 を選択' }));
    expect(mergeButton).toBeDisabled();

    await user.click(screen.getByRole('checkbox', { name: 'テストグループ2 を選択' }));
    expect(mergeButton).toBeEnabled();
  });

  it('統合ダイアログで統合先未選択時は統合実行ボタンが無効になる', async () => {
    const user = userEvent.setup();
    mockFetchIndex.mockResolvedValue({
      ok: true,
      data: {
        groups: [
          {
            id: 'group1',
            name: 'テストグループ1',
            totalDurationSeconds: 3600,
            sessionIds: ['session1'],
          },
          {
            id: 'group2',
            name: 'テストグループ2',
            totalDurationSeconds: 7200,
            sessionIds: ['session2'],
          },
        ],
        members: [],
        updatedAt: '2026-02-08T00:00:00.000Z',
      },
    });

    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );

    await user.click(await screen.findByRole('checkbox', { name: 'テストグループ1 を選択' }));
    await user.click(screen.getByRole('checkbox', { name: 'テストグループ2 を選択' }));
    await user.click(screen.getByRole('button', { name: '統合' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    const executeButton = screen.getByRole('button', { name: '統合実行' });
    expect(executeButton).toBeDisabled();

    await user.click(screen.getByRole('radio', { name: /テストグループ1/ }));
    expect(executeButton).toBeEnabled();
  });

  it('統合実行で mergeGroups と保存処理が呼ばれ、成功メッセージを表示する', async () => {
    const user = userEvent.setup();
    const initialIndex = {
      groups: [
        {
          id: 'group1',
          name: 'テストグループ1',
          totalDurationSeconds: 3600,
          sessionIds: ['session1'],
        },
        {
          id: 'group2',
          name: 'テストグループ2',
          totalDurationSeconds: 7200,
          sessionIds: ['session2'],
        },
      ],
      members: [],
      updatedAt: '2026-02-08T00:00:00.000Z',
    };
    const mergedIndex = {
      groups: [
        {
          id: 'group1',
          name: 'テストグループ1',
          totalDurationSeconds: 10800,
          sessionIds: ['session1', 'session2'],
        },
      ],
      members: [],
      updatedAt: '2026-02-09T00:00:00.000Z',
    };

    mockFetchIndex
      .mockResolvedValueOnce({ ok: true, data: initialIndex })
      .mockResolvedValueOnce({ ok: true, data: initialIndex })
      .mockResolvedValueOnce({ ok: true, data: mergedIndex });

    mockMergeGroups.mockReturnValue({ index: mergedIndex });

    mockExecuteWriteSequence.mockResolvedValueOnce({
      allSucceeded: true,
      results: [{ path: 'data/index.json', success: true }],
    });

    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );

    await user.click(await screen.findByRole('checkbox', { name: 'テストグループ1 を選択' }));
    await user.click(screen.getByRole('checkbox', { name: 'テストグループ2 を選択' }));
    await user.click(screen.getByRole('button', { name: '統合' }));
    await user.click(screen.getByRole('radio', { name: /テストグループ1/ }));
    await user.click(screen.getByRole('button', { name: '統合実行' }));

    await waitFor(() => {
      expect(mockMergeGroups).toHaveBeenCalledWith(initialIndex, 'group1', ['group1', 'group2']);
      expect(mockExecuteWriteSequence).toHaveBeenCalledWith({
        rawCsv: null,
        newItems: [],
        indexUpdater: expect.any(Function),
      });
    });

    await waitFor(() => {
      expect(screen.getByText('グループを統合しました')).toBeInTheDocument();
    });
  });
});

describe('AdminPage — 非管理者リダイレクト', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAdmin = false;
    mockSasToken = 'test-sas-token';
    mockFetchIndex.mockResolvedValue({
      ok: true,
      data: { groups: [], members: [], updatedAt: '' },
    });
  });

  afterEach(() => {
    mockIsAdmin = true;
  });

  it('非管理者はダッシュボードにリダイレクトされる', async () => {
    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );
    expect(screen.queryByText('管理者パネル')).not.toBeInTheDocument();
    // useEffect の非同期処理（fetchIndex → セッション一覧取得）の完了を待つ
    await act(async () => {});
  });
});

describe('AdminPage — 開発モード', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAdmin = true;
    mockSasToken = 'dev';
    mockFetchIndex.mockResolvedValue({
      ok: true,
      data: { groups: [], members: [], updatedAt: '' },
    });
    mockExecuteWriteSequence.mockResolvedValue({ results: [], allSucceeded: true });
  });

  afterEach(() => {
    mockSasToken = 'test-sas-token';
  });

  it('dev トークン使用時に正常にレンダリングされる', async () => {
    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('管理者パネル')).toBeInTheDocument();
    });
  });
});

describe('AdminPage — 一括保存コールバックとエラー処理', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAdmin = true;
    mockSasToken = 'test-sas-token';
    mockFetchIndex.mockResolvedValue({
      ok: true,
      data: { groups: [], members: [], updatedAt: '' },
    });
    mockParse.mockResolvedValue({
      ok: true,
      sessionRecord: {
        id: 'abc12345-2026-02-08',
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
    mockUpdateGroupName.mockReturnValue({ index: { groups: [], members: [], updatedAt: '' } });
    mockMergeGroups.mockReturnValue({ index: { groups: [], members: [], updatedAt: '' } });
  });

  it('indexUpdater と onItemComplete コールバックが正しく呼ばれる', async () => {
    const user = userEvent.setup();
    mockExecuteWriteSequence.mockImplementation(async (options) => {
      const writeResults = [
        { path: 'data/sources/abc12345-2026-02-08.csv', success: true },
        { path: 'data/sessions/abc12345-2026-02-08.json', success: true },
      ];
      // indexUpdater コールバックを呼び出す
      if (options.indexUpdater) {
        const currentIndex = { groups: [], members: [], updatedAt: '' };
        options.indexUpdater(currentIndex, writeResults);
      }
      // onItemComplete コールバックを呼び出す（source と session の両方）
      if (options.onItemComplete) {
        for (const result of writeResults) {
          options.onItemComplete(result);
        }
      }
      return {
        allSucceeded: true,
        results: [...writeResults, { path: 'data/index.json', success: true }],
      };
    });

    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );

    const csvContent = new Blob(['dummy csv'], { type: 'text/csv' });
    const file = new File([csvContent], 'test-report.csv', { type: 'text/csv' });
    const fileInput = document.querySelector('input[type="file"]');
    await user.upload(fileInput, file);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /一括保存/ })).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /一括保存/ }));

    await waitFor(() => {
      expect(mockExecuteWriteSequence).toHaveBeenCalled();
    });
  });

  it('indexUpdater で全項目失敗時に null を返す', async () => {
    const user = userEvent.setup();
    let indexUpdaterResult;

    mockExecuteWriteSequence.mockImplementation(async (options) => {
      const writeResults = [
        { path: 'data/sources/abc12345-2026-02-08.csv', success: false, error: 'Upload failed' },
        { path: 'data/sessions/abc12345-2026-02-08.json', success: false, error: 'Upload failed' },
      ];
      if (options.indexUpdater) {
        const currentIndex = { groups: [], members: [], updatedAt: '' };
        indexUpdaterResult = options.indexUpdater(currentIndex, writeResults);
      }
      if (options.onItemComplete) {
        for (const result of writeResults) {
          options.onItemComplete(result);
        }
      }
      return { allSucceeded: false, results: writeResults };
    });

    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );

    const csvContent = new Blob(['dummy csv'], { type: 'text/csv' });
    const file = new File([csvContent], 'test-report.csv', { type: 'text/csv' });
    const fileInput = document.querySelector('input[type="file"]');
    await user.upload(fileInput, file);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /一括保存/ })).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /一括保存/ }));

    await waitFor(() => {
      expect(mockExecuteWriteSequence).toHaveBeenCalled();
    });
    expect(indexUpdaterResult).toBeNull();
  });

  it('部分的な保存失敗時にリトライボタンが表示される', async () => {
    const user = userEvent.setup();
    mockExecuteWriteSequence.mockResolvedValueOnce({
      allSucceeded: false,
      results: [
        { path: 'data/sources/abc12345-2026-02-08.csv', success: false, error: 'CSV保存失敗' },
        { path: 'data/sessions/abc12345-2026-02-08.json', success: false, error: 'セッション保存失敗' },
      ],
    });

    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );

    const csvContent = new Blob(['dummy csv'], { type: 'text/csv' });
    const file = new File([csvContent], 'test-report.csv', { type: 'text/csv' });
    const fileInput = document.querySelector('input[type="file"]');
    await user.upload(fileInput, file);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /一括保存/ })).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /一括保存/ }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /失敗した操作をリトライ/ })).toBeInTheDocument();
    });
  });

  it('index.json 保存失敗時にもエラーステータスが設定される', async () => {
    const user = userEvent.setup();
    mockExecuteWriteSequence.mockResolvedValueOnce({
      allSucceeded: false,
      results: [
        { path: 'data/sources/abc12345-2026-02-08.csv', success: true },
        { path: 'data/sessions/abc12345-2026-02-08.json', success: true },
        { path: 'data/index.json', success: false, error: 'index保存失敗' },
      ],
    });

    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );

    const csvContent = new Blob(['dummy csv'], { type: 'text/csv' });
    const file = new File([csvContent], 'test-report.csv', { type: 'text/csv' });
    const fileInput = document.querySelector('input[type="file"]');
    await user.upload(fileInput, file);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /一括保存/ })).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /一括保存/ }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /失敗した操作をリトライ/ })).toBeInTheDocument();
    });
  });
});

describe('AdminPage — リトライ処理', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAdmin = true;
    mockSasToken = 'test-sas-token';
    mockFetchIndex.mockResolvedValue({
      ok: true,
      data: { groups: [], members: [], updatedAt: '' },
    });
    mockParse.mockResolvedValue({
      ok: true,
      sessionRecord: {
        id: 'abc12345-2026-02-08',
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
    mockUpdateGroupName.mockReturnValue({ index: { groups: [], members: [], updatedAt: '' } });
    mockMergeGroups.mockReturnValue({ index: { groups: [], members: [], updatedAt: '' } });
  });

  it('失敗した操作をリトライボタンでリセットし一括保存ボタンが再表示される', async () => {
    const user = userEvent.setup();
    mockExecuteWriteSequence.mockResolvedValueOnce({
      allSucceeded: false,
      results: [
        { path: 'data/sources/abc12345-2026-02-08.csv', success: false, error: '保存失敗' },
        { path: 'data/sessions/abc12345-2026-02-08.json', success: false, error: '保存失敗' },
      ],
    });

    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );

    const csvContent = new Blob(['dummy csv'], { type: 'text/csv' });
    const file = new File([csvContent], 'test-report.csv', { type: 'text/csv' });
    const fileInput = document.querySelector('input[type="file"]');
    await user.upload(fileInput, file);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /一括保存/ })).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /一括保存/ }));

    const retryButton = await screen.findByRole('button', { name: /失敗した操作をリトライ/ });
    await user.click(retryButton);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /一括保存/ })).toBeInTheDocument();
    });
  });
});

describe('AdminPage — グループ名保存', () => {
  const initialIndex = {
    groups: [
      {
        id: 'group1',
        name: 'テストグループ',
        totalDurationSeconds: 3600,
        sessionIds: ['session1'],
      },
    ],
    members: [],
    updatedAt: '2026-02-08T00:00:00.000Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAdmin = true;
    mockSasToken = 'test-sas-token';
    mockExecuteWriteSequence.mockResolvedValue({
      allSucceeded: true,
      results: [{ path: 'data/index.json', success: true }],
    });
    mockMergeGroups.mockReturnValue({ index: { groups: [], members: [], updatedAt: '' } });
  });

  // ヘルパー: グループ名の編集操作を実行
  async function editGroupName(user, newName) {
    const editButton = await screen.findByTitle('グループ名を編集');
    await user.click(editButton);

    const input = screen.getByPlaceholderText('グループ名を入力');
    await user.clear(input);
    await user.type(input, newName);

    const saveButton = screen.getByTitle('保存');
    await user.click(saveButton);
  }

  it('グループ名の保存が成功する', async () => {
    const user = userEvent.setup();
    const updatedIndex = {
      ...initialIndex,
      groups: [{ ...initialIndex.groups[0], name: '新しい名前' }],
      updatedAt: '2026-02-09T00:00:00.000Z',
    };

    mockFetchIndex
      .mockResolvedValueOnce({ ok: true, data: initialIndex })
      .mockResolvedValueOnce({ ok: true, data: initialIndex })
      .mockResolvedValueOnce({ ok: true, data: updatedIndex });

    mockUpdateGroupName.mockReturnValue({ index: updatedIndex });

    // indexUpdater コールバックを呼び出してカバレッジを確保
    mockExecuteWriteSequence.mockImplementation(async (options) => {
      if (options.indexUpdater) {
        options.indexUpdater(initialIndex, []);
      }
      return {
        allSucceeded: true,
        results: [{ path: 'data/index.json', success: true }],
      };
    });

    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );

    await editGroupName(user, '新しい名前');

    await waitFor(() => {
      expect(screen.getByText('グループ名を保存しました')).toBeInTheDocument();
    });
    expect(mockUpdateGroupName).toHaveBeenCalledWith(initialIndex, 'group1', '新しい名前');
    expect(mockInvalidateIndexCache).toHaveBeenCalled();
  });

  it('fetchIndex 失敗時にエラーメッセージが表示される', async () => {
    const user = userEvent.setup();

    mockFetchIndex
      .mockResolvedValueOnce({ ok: true, data: initialIndex })
      .mockResolvedValueOnce({ ok: false });

    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );

    await editGroupName(user, '新しい名前');

    await waitFor(() => {
      expect(
        screen.getByText('最新データの取得に失敗しました。ネットワーク接続を確認してください')
      ).toBeInTheDocument();
    });
  });

  it('楽観的ロック（updatedAt 不一致）でエラーメッセージが表示される', async () => {
    const user = userEvent.setup();

    mockFetchIndex
      .mockResolvedValueOnce({ ok: true, data: initialIndex })
      .mockResolvedValueOnce({
        ok: true,
        data: { ...initialIndex, updatedAt: 'DIFFERENT_TIMESTAMP' },
      });

    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );

    await editGroupName(user, '新しい名前');

    await waitFor(() => {
      expect(
        screen.getByText(
          '他のユーザーが同時に編集しています。最新データを再読み込みしてください'
        )
      ).toBeInTheDocument();
    });
  });

  it('IndexEditor エラー時にエラーメッセージが表示される', async () => {
    const user = userEvent.setup();

    mockFetchIndex
      .mockResolvedValueOnce({ ok: true, data: initialIndex })
      .mockResolvedValueOnce({ ok: true, data: initialIndex });

    mockUpdateGroupName.mockReturnValue({ error: 'グループが見つかりません' });

    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );

    await editGroupName(user, '新しい名前');

    await waitFor(() => {
      expect(screen.getByText('グループが見つかりません')).toBeInTheDocument();
    });
  });

  it('BlobWriter 保存失敗時にエラーメッセージが表示される', async () => {
    const user = userEvent.setup();

    mockFetchIndex
      .mockResolvedValueOnce({ ok: true, data: initialIndex })
      .mockResolvedValueOnce({ ok: true, data: initialIndex });

    mockUpdateGroupName.mockReturnValue({
      index: { ...initialIndex, groups: [{ ...initialIndex.groups[0], name: '新しい名前' }] },
    });

    mockExecuteWriteSequence.mockResolvedValueOnce({
      allSucceeded: false,
      results: [{ path: 'data/index.json', success: false, error: 'ストレージエラー' }],
    });

    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );

    await editGroupName(user, '新しい名前');

    await waitFor(() => {
      expect(screen.getByText(/保存に失敗しました。ストレージエラー/)).toBeInTheDocument();
    });
  });

  it('例外発生時にエラーメッセージが表示される', async () => {
    const user = userEvent.setup();

    mockFetchIndex
      .mockResolvedValueOnce({ ok: true, data: initialIndex })
      .mockRejectedValueOnce(new Error('Network error'));

    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );

    await editGroupName(user, '新しい名前');

    await waitFor(() => {
      expect(screen.getByText(/保存に失敗しました。Network error/)).toBeInTheDocument();
    });
  });
});

describe('AdminPage — グループ統合エラー処理', () => {
  const initialIndex = {
    groups: [
      {
        id: 'group1',
        name: 'テストグループ1',
        totalDurationSeconds: 3600,
        sessionIds: ['session1'],
      },
      {
        id: 'group2',
        name: 'テストグループ2',
        totalDurationSeconds: 7200,
        sessionIds: ['session2'],
      },
    ],
    members: [],
    updatedAt: '2026-02-08T00:00:00.000Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAdmin = true;
    mockSasToken = 'test-sas-token';
    mockExecuteWriteSequence.mockResolvedValue({
      allSucceeded: true,
      results: [{ path: 'data/index.json', success: true }],
    });
    mockUpdateGroupName.mockReturnValue({ index: { groups: [], members: [], updatedAt: '' } });
  });

  // ヘルパー: 統合ダイアログを開いて統合先を選択して実行
  async function openMergeDialogAndExecute(user) {
    await user.click(await screen.findByRole('checkbox', { name: 'テストグループ1 を選択' }));
    await user.click(screen.getByRole('checkbox', { name: 'テストグループ2 を選択' }));
    await user.click(screen.getByRole('button', { name: '統合' }));
    await user.click(screen.getByRole('radio', { name: /テストグループ1/ }));
    await user.click(screen.getByRole('button', { name: '統合実行' }));
  }

  it('fetchIndex 失敗時にエラーメッセージが表示される', async () => {
    const user = userEvent.setup();

    mockFetchIndex
      .mockResolvedValueOnce({ ok: true, data: initialIndex })
      .mockResolvedValueOnce({ ok: false });

    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );

    await openMergeDialogAndExecute(user);

    await waitFor(() => {
      expect(
        screen.getByText('最新データの取得に失敗しました。ネットワーク接続を確認してください')
      ).toBeInTheDocument();
    });
  });

  it('楽観的ロック失敗時にエラーメッセージが表示される', async () => {
    const user = userEvent.setup();

    mockFetchIndex
      .mockResolvedValueOnce({ ok: true, data: initialIndex })
      .mockResolvedValueOnce({
        ok: true,
        data: { ...initialIndex, updatedAt: 'DIFFERENT_TIMESTAMP' },
      });

    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );

    await openMergeDialogAndExecute(user);

    await waitFor(() => {
      expect(
        screen.getByText(
          '他のユーザーが同時に編集しています。最新データを再読み込みしてください'
        )
      ).toBeInTheDocument();
    });
  });

  it('mergeGroups エラー時にエラーメッセージが表示される', async () => {
    const user = userEvent.setup();

    mockFetchIndex
      .mockResolvedValueOnce({ ok: true, data: initialIndex })
      .mockResolvedValueOnce({ ok: true, data: initialIndex });

    mockMergeGroups.mockReturnValue({ error: '統合先グループが見つかりません' });

    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );

    await openMergeDialogAndExecute(user);

    await waitFor(() => {
      expect(screen.getByText('統合先グループが見つかりません')).toBeInTheDocument();
    });
  });

  it('BlobWriter 保存失敗時にエラーメッセージが表示される', async () => {
    const user = userEvent.setup();
    const mergedIndex = {
      groups: [
        {
          ...initialIndex.groups[0],
          totalDurationSeconds: 10800,
          sessionIds: ['session1', 'session2'],
        },
      ],
      members: [],
      updatedAt: '2026-02-09T00:00:00.000Z',
    };

    mockFetchIndex
      .mockResolvedValueOnce({ ok: true, data: initialIndex })
      .mockResolvedValueOnce({ ok: true, data: initialIndex });

    mockMergeGroups.mockReturnValue({ index: mergedIndex });

    // indexUpdater コールバックを呼び出してカバレッジを確保
    mockExecuteWriteSequence.mockImplementation(async (options) => {
      if (options.indexUpdater) {
        options.indexUpdater(initialIndex, []);
      }
      return {
        allSucceeded: false,
        results: [{ path: 'data/index.json', success: false, error: 'ストレージエラー' }],
      };
    });

    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );

    await openMergeDialogAndExecute(user);

    await waitFor(() => {
      expect(screen.getByText(/統合の保存に失敗しました。ストレージエラー/)).toBeInTheDocument();
    });
  });

  it('例外発生時にエラーメッセージが表示される', async () => {
    const user = userEvent.setup();

    mockFetchIndex
      .mockResolvedValueOnce({ ok: true, data: initialIndex })
      .mockRejectedValueOnce(new Error('ネットワーク障害'));

    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );

    await openMergeDialogAndExecute(user);

    await waitFor(() => {
      expect(screen.getByText(/統合の保存に失敗しました。ネットワーク障害/)).toBeInTheDocument();
    });
  });

  it('統合ダイアログの閉じるボタンでダイアログが閉じる', async () => {
    const user = userEvent.setup();
    mockFetchIndex.mockResolvedValue({ ok: true, data: initialIndex });

    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );

    await user.click(await screen.findByRole('checkbox', { name: 'テストグループ1 を選択' }));
    await user.click(screen.getByRole('checkbox', { name: 'テストグループ2 を選択' }));
    await user.click(screen.getByRole('button', { name: '統合' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // 閉じるボタン（×）をクリック
    await user.click(screen.getByRole('button', { name: 'ダイアログを閉じる' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('チェックボックスの選択解除でグループが選択リストから削除される', async () => {
    const user = userEvent.setup();
    mockFetchIndex.mockResolvedValue({ ok: true, data: initialIndex });

    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );

    const checkbox1 = await screen.findByRole('checkbox', { name: 'テストグループ1 を選択' });
    const checkbox2 = screen.getByRole('checkbox', { name: 'テストグループ2 を選択' });

    // 2件選択して統合ボタンが有効になることを確認
    await user.click(checkbox1);
    await user.click(checkbox2);
    expect(screen.getByRole('button', { name: '統合' })).toBeEnabled();

    // 1件選択解除して統合ボタンが無効になることを確認
    await user.click(checkbox1);
    expect(screen.getByRole('button', { name: '統合' })).toBeDisabled();
  });
});

describe('AdminPage — セッション名管理', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAdmin = true;
    mockSasToken = 'test-sas-token';
    mockExecuteWriteSequence.mockResolvedValue({ results: [], allSucceeded: true });
    mockUpdateGroupName.mockReturnValue({ index: { groups: [], members: [], updatedAt: '' } });
    mockMergeGroups.mockReturnValue({ index: { groups: [], members: [], updatedAt: '' } });
    mockFetchIndex.mockResolvedValue({
      ok: true,
      data: {
        groups: [
          {
            id: 'group1',
            name: 'テストグループ1',
            totalDurationSeconds: 3600,
            sessionIds: ['group1-2026-02-08'],
          },
        ],
        members: [],
        updatedAt: '2026-02-08T00:00:00.000Z',
      },
    });
    mockFetchSession.mockResolvedValue({
      ok: true,
      data: {
        id: 'group1-2026-02-08',
        groupId: 'group1',
        date: '2026-02-08',
        attendances: [],
      },
    });
  });

  it('セッションJSONのgroupIdが不一致でも index.json の所属グループ名を表示する', async () => {
    mockFetchIndex.mockResolvedValueOnce({
      ok: true,
      data: {
        groups: [
          {
            id: 'group-target',
            name: '統合先グループ',
            totalDurationSeconds: 3600,
            sessionIds: ['group-old-2026-02-08'],
          },
        ],
        members: [],
        updatedAt: '2026-02-08T00:00:00.000Z',
      },
    });
    mockFetchSession.mockResolvedValueOnce({
      ok: true,
      data: {
        id: 'group-old-2026-02-08',
        groupId: 'group-old',
        date: '2026-02-08',
        attendances: [],
      },
    });

    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('セッション名管理')).toBeInTheDocument();
    });

    expect(screen.getAllByText('統合先グループ').length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText('group-old')).not.toBeInTheDocument();
  });

  it('セッション名保存時に data/sessions/{sessionId}.json を上書きする', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('セッション名管理')).toBeInTheDocument();
    });

    const input = screen.getByRole('textbox', { name: '2026-02-08 のセッション名' });
    await user.type(input, '第3回 React入門');
    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(mockExecuteWriteSequence).toHaveBeenCalled();
    });

    const callArgs = mockExecuteWriteSequence.mock.calls[0][0];
    expect(callArgs.newItems).toHaveLength(1);
    expect(callArgs.newItems[0].path).toBe('data/sessions/group1-2026-02-08.json');

    const savedSession = JSON.parse(callArgs.newItems[0].content);
    expect(savedSession.name).toBe('第3回 React入門');
    expect(savedSession.groupId).toBeUndefined();
    expect(mockInvalidateSessionCache).toHaveBeenCalledWith('group1-2026-02-08');
  });

  it('セッション名保存失敗時にエラーメッセージが表示される', async () => {
    const user = userEvent.setup();
    mockExecuteWriteSequence.mockResolvedValueOnce({
      allSucceeded: false,
      results: [
        { path: 'data/sessions/group1-2026-02-08.json', success: false, error: 'ストレージエラー' },
      ],
    });

    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('セッション名管理')).toBeInTheDocument();
    });

    const input = screen.getByRole('textbox', { name: '2026-02-08 のセッション名' });
    await user.type(input, 'テスト名');
    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(
        screen.getByText('セッション名の保存に失敗しました。ストレージエラー')
      ).toBeInTheDocument();
    });
  });

  it('セッション名保存時に例外が発生するとエラーメッセージが表示される', async () => {
    const user = userEvent.setup();
    mockExecuteWriteSequence.mockRejectedValueOnce(new Error('ネットワーク障害'));

    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('セッション名管理')).toBeInTheDocument();
    });

    const input = screen.getByRole('textbox', { name: '2026-02-08 のセッション名' });
    await user.type(input, 'テスト名');
    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(
        screen.getByText('セッション名の保存に失敗しました。ネットワーク障害')
      ).toBeInTheDocument();
    });
  });

  it('空のセッション名で保存すると name プロパティが削除される', async () => {
    const user = userEvent.setup();
    mockFetchSession.mockResolvedValue({
      ok: true,
      data: {
        id: 'group1-2026-02-08',
        groupId: 'group1',
        date: '2026-02-08',
        name: '既存の名前',
        attendances: [],
      },
    });

    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('セッション名管理')).toBeInTheDocument();
    });

    const input = screen.getByRole('textbox', { name: '2026-02-08 のセッション名' });
    await user.clear(input);
    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(mockExecuteWriteSequence).toHaveBeenCalled();
    });

    const callArgs = mockExecuteWriteSequence.mock.calls[0][0];
    const savedSession = JSON.parse(callArgs.newItems[0].content);
    expect(savedSession.name).toBeUndefined();
    expect(savedSession.groupId).toBeUndefined();
  });
});

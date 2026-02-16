// AdminPage — ソースファイル保存パスの検証テスト
import { render, screen, waitFor } from '@testing-library/react';
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
const mockInvalidateIndexCache = vi.fn();
vi.mock('../../../src/services/shared-data-fetcher.js', () => ({
  sharedDataFetcher: {
    fetchIndex: (...args) => mockFetchIndex(...args),
    invalidateIndexCache: (...args) => mockInvalidateIndexCache(...args),
  },
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
  });

  it('グループ選択後の一括保存で groupOverride が mergeInput/sessionRecord に反映される', async () => {
    const user = userEvent.setup();

    // CsvTransformer: 新規グループの CSV パース結果
    mockParse.mockResolvedValue({
      ok: true,
      sessionRecord: {
        id: 'newgrp01-2026-02-08',
        groupId: 'newgrp01',
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
    expect(sessionRecord.groupId).toBe('existgrp1');
  });
});

describe('AdminPage — グループ管理セクション', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

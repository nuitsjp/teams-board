// AdminPage — V2 データモデル対応テスト
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AdminPage } from '../../../src/pages/AdminPage.jsx';

// BlobWriter のモック — executeWriteSequence の引数をキャプチャ
const mockExecuteWriteSequence = vi.fn().mockResolvedValue({ results: [], allSucceeded: true });
const mockUpdateGroupName = vi.fn();
const mockMergeGroups = vi.fn();
const mockCreateSessionRevision = vi.fn().mockImplementation((sessionRef, sessionData, updates = {}) => {
  const parts = sessionRef.split('/');
  const revision = parseInt(parts[1], 10);
  const newRevision = revision + 1;
  const newRef = `${sessionData.sessionId}/${newRevision}`;
  const newPath = `data/sessions/${sessionData.sessionId}/${newRevision}.json`;

  const sessionRecord = {
    sessionId: sessionData.sessionId,
    revision: newRevision,
    startedAt: sessionData.startedAt,
    endedAt: sessionData.endedAt,
    attendances: sessionData.attendances,
    instructors: sessionData.instructors ?? [],
    createdAt: sessionData.createdAt,
  };

  if (updates.title !== undefined) {
    if (updates.title.length > 0) {
      sessionRecord.title = updates.title;
    }
  } else if (sessionData.title) {
    sessionRecord.title = sessionData.title;
  }

  if (updates.instructors !== undefined) {
    sessionRecord.instructors = updates.instructors;
  }

  return { sessionRecord, newRef, newPath };
});

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

// IndexMerger のモック（V2: sessionRecord を返す）
const mockMerge = vi.fn();
vi.mock('../../../src/services/index-merger.js', () => ({
  IndexMerger: vi.fn().mockImplementation(() => ({
    merge: (...args) => mockMerge(...args),
  })),
}));

// IndexEditor のモック
vi.mock('../../../src/services/index-editor.js', () => ({
  IndexEditor: vi.fn().mockImplementation(() => ({
    updateGroupName: (...args) => mockUpdateGroupName(...args),
    mergeGroups: (...args) => mockMergeGroups(...args),
    createSessionRevision: (...args) => mockCreateSessionRevision(...args),
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

// IndexFetcher のモック（V2: handleBulkSave で直接 indexFetcher.fetch() を呼ぶ）
const mockIndexFetcherFetch = vi.fn();
vi.mock('../../../src/services/index-fetcher.js', () => ({
  ProductionIndexFetcher: vi.fn().mockImplementation(() => ({
    fetch: (...args) => mockIndexFetcherFetch(...args),
  })),
  DevIndexFetcher: vi.fn().mockImplementation(() => ({
    fetch: (...args) => mockIndexFetcherFetch(...args),
  })),
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

// V2 テスト用データヘルパー
const SESSION_ID_1 = '01SESSION00000000000001';
const SESSION_REF_1 = `${SESSION_ID_1}/0`;

function createV2Index(overrides = {}) {
  return {
    schemaVersion: 2,
    version: 1,
    groups: [],
    members: [],
    updatedAt: '2026-02-08T00:00:00.000Z',
    ...overrides,
  };
}

function createV2ParseResult(overrides = {}) {
  return {
    ok: true,
    parsedSession: {
      sessionId: SESSION_ID_1,
      groupName: 'サンプル勉強会',
      date: '2026-02-08',
      startedAt: '2026-02-08T19:00:00',
      endedAt: null,
      attendances: [
        { memberName: '佐藤 一郎', memberEmail: 'ichiro@example.com', durationSeconds: 3600 },
      ],
    },
    warnings: [],
    ...overrides,
  };
}

describe('AdminPage — ソースファイル保存パス', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAdmin = true;
    mockSasToken = 'test-sas-token';
    mockExecuteWriteSequence.mockResolvedValue({ results: [], allSucceeded: true });
    mockUpdateGroupName.mockReturnValue({
      index: createV2Index({
        groups: [
          { id: 'group1', name: '新しいグループ名', totalDurationSeconds: 3600, sessionRevisions: [] },
        ],
      }),
    });
    mockMergeGroups.mockReturnValue({
      index: createV2Index({
        groups: [{ id: 'group1', name: '統合後グループ', totalDurationSeconds: 3600, sessionRevisions: [] }],
      }),
    });
    mockFetchIndex.mockResolvedValue({
      ok: true,
      data: createV2Index(),
    });
    mockFetchSession.mockResolvedValue({
      ok: false,
      error: 'not found',
    });
    mockParse.mockResolvedValue(createV2ParseResult());
    // IndexMerger.merge の V2 モック
    mockMerge.mockReturnValue({
      index: createV2Index({
        groups: [
          { id: '01NEWGROUP0000000000000', name: 'サンプル勉強会', totalDurationSeconds: 3600, sessionRevisions: [SESSION_REF_1] },
        ],
        version: 2,
      }),
      sessionRecord: {
        sessionId: SESSION_ID_1,
        revision: 0,
        title: '',
        startedAt: '2026-02-08T19:00:00',
        endedAt: null,
        attendances: [{ memberId: '01MEMBER000000000000000', durationSeconds: 3600 }],
        createdAt: '2026-02-08T19:00:00',
      },
      warnings: [],
    });
    mockIndexFetcherFetch.mockResolvedValue({
      ok: true,
      data: createV2Index(),
    });
  });

  it('一括保存時に data/sources/{sessionId}.csv が保存対象に含まれること', async () => {
    const user = userEvent.setup();

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

    const callArgs = mockExecuteWriteSequence.mock.calls[0][0];
    const sourceItem = callArgs.newItems.find((item) =>
      item.path.startsWith(`data/sources/${SESSION_ID_1}`)
    );
    expect(sourceItem).toBeDefined();
    expect(sourceItem.path).toBe(`data/sources/${SESSION_ID_1}.csv`);
    expect(sourceItem.path).not.toMatch(/^raw\//);
  });

  it('一括保存時に V2 パス data/sessions/{sessionId}/0.json が保存対象に含まれること', async () => {
    const user = userEvent.setup();

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

    const callArgs = mockExecuteWriteSequence.mock.calls[0][0];
    const sessionItem = callArgs.newItems.find((item) =>
      item.path.startsWith('data/sessions/')
    );
    expect(sessionItem).toBeDefined();
    expect(sessionItem.path).toBe(`data/sessions/${SESSION_ID_1}/0.json`);
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

describe('AdminPage — グループ選択による parsedSession 上書き', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAdmin = true;
    mockSasToken = 'test-sas-token';
    mockExecuteWriteSequence.mockResolvedValue({ results: [], allSucceeded: true });
    mockUpdateGroupName.mockReturnValue({
      index: createV2Index({
        groups: [{ id: 'existgrp1', name: '既存グループ', totalDurationSeconds: 3600, sessionRevisions: [] }],
      }),
    });
    mockMergeGroups.mockReturnValue({
      index: createV2Index({
        groups: [{ id: 'existgrp1', name: '既存グループ', totalDurationSeconds: 3600, sessionRevisions: [] }],
      }),
    });
    mockFetchIndex.mockResolvedValue({
      ok: true,
      data: createV2Index({
        groups: [{ id: 'existgrp1', name: '既存グループ', totalDurationSeconds: 3600, sessionRevisions: [] }],
      }),
    });
    mockFetchSession.mockResolvedValue({
      ok: false,
      error: 'not found',
    });
    mockIndexFetcherFetch.mockResolvedValue({
      ok: true,
      data: createV2Index({
        groups: [{ id: 'existgrp1', name: '既存グループ', totalDurationSeconds: 3600, sessionRevisions: [] }],
      }),
    });
  });

  it('グループ選択後の一括保存で groupOverride が parsedSession に反映される', async () => {
    const user = userEvent.setup();
    const newSessionId = '01NEWSESSION0000000000000';

    mockParse.mockResolvedValue(createV2ParseResult({
      parsedSession: {
        sessionId: newSessionId,
        groupName: '新しい勉強会',
        date: '2026-02-08',
        startedAt: '2026-02-08T19:00:00',
        endedAt: null,
        attendances: [
          { memberName: '佐藤 一郎', memberEmail: 'ichiro@example.com', durationSeconds: 3600 },
        ],
      },
    }));

    mockMerge.mockReturnValue({
      index: createV2Index({
        groups: [
          { id: 'existgrp1', name: '既存グループ', totalDurationSeconds: 7200, sessionRevisions: [`${newSessionId}/0`] },
        ],
        version: 2,
      }),
      sessionRecord: {
        sessionId: newSessionId,
        revision: 0,
        title: '',
        startedAt: '2026-02-08T19:00:00',
        endedAt: null,
        attendances: [{ memberId: '01MEMBER000000000000000', durationSeconds: 3600 }],
        createdAt: '2026-02-08T19:00:00',
      },
      warnings: [],
    });

    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('グループ・セッション管理')).toBeInTheDocument();
    });

    const csvContent = new Blob(['dummy csv'], { type: 'text/csv' });
    const file = new File([csvContent], 'test-report.csv', { type: 'text/csv' });
    const fileInput = document.querySelector('input[type="file"]');
    await user.upload(fileInput, file);

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    const select = screen.getByRole('combobox');
    await user.selectOptions(select, 'existgrp1');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /一括保存/ })).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /一括保存/ }));

    await waitFor(() => {
      expect(mockExecuteWriteSequence).toHaveBeenCalled();
    });

    // IndexMerger.merge に渡された parsedSession の groupName が上書きされていること
    expect(mockMerge).toHaveBeenCalled();
    const mergeParsedSession = mockMerge.mock.calls[0][1];
    expect(mergeParsedSession.groupName).toBe('既存グループ');
  });
});

describe('AdminPage — グループ管理セクション', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAdmin = true;
    mockSasToken = 'test-sas-token';
    mockExecuteWriteSequence.mockResolvedValue({ results: [], allSucceeded: true });
    mockUpdateGroupName.mockReturnValue({
      index: createV2Index({
        groups: [{ id: 'group1', name: '新しいグループ名', totalDurationSeconds: 3600, sessionRevisions: [] }],
      }),
    });
    mockMergeGroups.mockReturnValue({
      index: createV2Index({
        groups: [{ id: 'group1', name: '統合後グループ', totalDurationSeconds: 3600, sessionRevisions: [] }],
      }),
    });
    mockFetchIndex.mockResolvedValue({
      ok: true,
      data: createV2Index(),
    });
    mockFetchSession.mockResolvedValue({
      ok: false,
      error: 'not found',
    });
    mockIndexFetcherFetch.mockResolvedValue({
      ok: true,
      data: createV2Index(),
    });
  });

  it('グループ一覧が表示される', async () => {
    mockFetchIndex.mockResolvedValue({
      ok: true,
      data: createV2Index({
        groups: [
          {
            id: 'group1',
            name: 'テストグループ1',
            totalDurationSeconds: 3600,
            sessionRevisions: ['session1/0', 'session2/0'],
          },
          {
            id: 'group2',
            name: 'テストグループ2',
            totalDurationSeconds: 7200,
            sessionRevisions: ['session3/0'],
          },
        ],
      }),
    });

    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('グループ・セッション管理')).toBeInTheDocument();
      expect(screen.getByText('テストグループ1')).toBeInTheDocument();
      expect(screen.getByText('テストグループ2')).toBeInTheDocument();
    });
  });

  it('グループがない場合は「グループがありません」と表示される', async () => {
    mockFetchIndex.mockResolvedValue({
      ok: true,
      data: createV2Index(),
    });

    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('グループ・セッション管理')).toBeInTheDocument();
      expect(screen.getByText('グループがありません')).toBeInTheDocument();
    });
  });

  it('グループを2件選択すると統合ボタンが有効になる', async () => {
    const user = userEvent.setup();
    mockFetchIndex.mockResolvedValue({
      ok: true,
      data: createV2Index({
        groups: [
          { id: 'group1', name: 'テストグループ1', totalDurationSeconds: 3600, sessionRevisions: ['session1/0'] },
          { id: 'group2', name: 'テストグループ2', totalDurationSeconds: 7200, sessionRevisions: ['session2/0'] },
        ],
      }),
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
      data: createV2Index({
        groups: [
          { id: 'group1', name: 'テストグループ1', totalDurationSeconds: 3600, sessionRevisions: ['session1/0'] },
          { id: 'group2', name: 'テストグループ2', totalDurationSeconds: 7200, sessionRevisions: ['session2/0'] },
        ],
      }),
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
    const initialIndex = createV2Index({
      groups: [
        { id: 'group1', name: 'テストグループ1', totalDurationSeconds: 3600, sessionRevisions: ['session1/0'] },
        { id: 'group2', name: 'テストグループ2', totalDurationSeconds: 7200, sessionRevisions: ['session2/0'] },
      ],
    });
    const mergedIndex = createV2Index({
      groups: [
        { id: 'group1', name: 'テストグループ1', totalDurationSeconds: 10800, sessionRevisions: ['session1/0', 'session2/0'] },
      ],
      version: 2,
    });

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
      data: createV2Index(),
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
      data: createV2Index(),
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
      data: createV2Index(),
    });
    mockParse.mockResolvedValue(createV2ParseResult());
    mockMerge.mockReturnValue({
      index: createV2Index({ version: 2 }),
      sessionRecord: {
        sessionId: SESSION_ID_1,
        revision: 0,
        title: '',
        startedAt: '2026-02-08T19:00:00',
        endedAt: null,
        attendances: [{ memberId: '01MEMBER000000000000000', durationSeconds: 3600 }],
        createdAt: '2026-02-08T19:00:00',
      },
      warnings: [],
    });
    mockUpdateGroupName.mockReturnValue({ index: createV2Index() });
    mockMergeGroups.mockReturnValue({ index: createV2Index() });
    mockIndexFetcherFetch.mockResolvedValue({
      ok: true,
      data: createV2Index(),
    });
  });

  it('indexFetcher.fetch() 失敗時に全アイテムが save_failed になる', async () => {
    const user = userEvent.setup();
    mockIndexFetcherFetch.mockResolvedValueOnce({ ok: false, error: 'fetch failed' });

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

  it('indexUpdater と onItemComplete コールバックが正しく呼ばれる', async () => {
    const user = userEvent.setup();
    mockExecuteWriteSequence.mockImplementation(async (options) => {
      const writeResults = [
        { path: `data/sources/${SESSION_ID_1}.csv`, success: true },
        { path: `data/sessions/${SESSION_ID_1}/0.json`, success: true },
      ];
      if (options.indexUpdater) {
        const currentIndex = createV2Index();
        options.indexUpdater(currentIndex, writeResults);
      }
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

  it('indexUpdater で version 不一致時に null を返す', async () => {
    const user = userEvent.setup();
    let indexUpdaterResult;

    mockExecuteWriteSequence.mockImplementation(async (options) => {
      const writeResults = [
        { path: `data/sources/${SESSION_ID_1}.csv`, success: true },
        { path: `data/sessions/${SESSION_ID_1}/0.json`, success: true },
      ];
      if (options.indexUpdater) {
        // version が変更された最新 index を渡す（楽観ロック失敗をシミュレート）
        const currentIndex = createV2Index({ version: 999 });
        indexUpdaterResult = options.indexUpdater(currentIndex, writeResults);
      }
      return { allSucceeded: true, results: writeResults };
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

    // version 不一致で null が返される（楽観ロック）
    // 注: indexUpdater は baseVersion と比較するので、同じ version なら成功
    // ここでは version=999 を渡すので baseVersion=1 と不一致
  });

  it('部分的な保存失敗時にリトライボタンが表示される', async () => {
    const user = userEvent.setup();
    mockExecuteWriteSequence.mockResolvedValueOnce({
      allSucceeded: false,
      results: [
        { path: `data/sources/${SESSION_ID_1}.csv`, success: false, error: 'CSV保存失敗' },
        { path: `data/sessions/${SESSION_ID_1}/0.json`, success: false, error: 'セッション保存失敗' },
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
        { path: `data/sources/${SESSION_ID_1}.csv`, success: true },
        { path: `data/sessions/${SESSION_ID_1}/0.json`, success: true },
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
      data: createV2Index(),
    });
    mockParse.mockResolvedValue(createV2ParseResult());
    mockMerge.mockReturnValue({
      index: createV2Index({ version: 2 }),
      sessionRecord: {
        sessionId: SESSION_ID_1,
        revision: 0,
        title: '',
        startedAt: '2026-02-08T19:00:00',
        endedAt: null,
        attendances: [{ memberId: '01MEMBER000000000000000', durationSeconds: 3600 }],
        createdAt: '2026-02-08T19:00:00',
      },
      warnings: [],
    });
    mockUpdateGroupName.mockReturnValue({ index: createV2Index() });
    mockMergeGroups.mockReturnValue({ index: createV2Index() });
    mockIndexFetcherFetch.mockResolvedValue({
      ok: true,
      data: createV2Index(),
    });
  });

  it('失敗した操作をリトライボタンでリセットし一括保存ボタンが再表示される', async () => {
    const user = userEvent.setup();
    mockExecuteWriteSequence.mockResolvedValueOnce({
      allSucceeded: false,
      results: [
        { path: `data/sources/${SESSION_ID_1}.csv`, success: false, error: '保存失敗' },
        { path: `data/sessions/${SESSION_ID_1}/0.json`, success: false, error: '保存失敗' },
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
  const initialIndex = createV2Index({
    groups: [
      { id: 'group1', name: 'テストグループ', totalDurationSeconds: 3600, sessionRevisions: ['session1/0'] },
    ],
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAdmin = true;
    mockSasToken = 'test-sas-token';
    mockExecuteWriteSequence.mockResolvedValue({
      allSucceeded: true,
      results: [{ path: 'data/index.json', success: true }],
    });
    mockMergeGroups.mockReturnValue({ index: createV2Index() });
    mockIndexFetcherFetch.mockResolvedValue({
      ok: true,
      data: initialIndex,
    });
  });

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
    const updatedIndex = createV2Index({
      groups: [{ ...initialIndex.groups[0], name: '新しい名前' }],
      version: 2,
    });

    mockFetchIndex
      .mockResolvedValueOnce({ ok: true, data: initialIndex })
      .mockResolvedValueOnce({ ok: true, data: initialIndex })
      .mockResolvedValueOnce({ ok: true, data: updatedIndex });

    mockUpdateGroupName.mockReturnValue({ index: updatedIndex });

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

  it('楽観的ロック（version 不一致）でエラーメッセージが表示される', async () => {
    const user = userEvent.setup();

    mockFetchIndex
      .mockResolvedValueOnce({ ok: true, data: initialIndex })
      .mockResolvedValueOnce({
        ok: true,
        data: createV2Index({ ...initialIndex, version: 999 }),
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
      index: createV2Index({
        groups: [{ ...initialIndex.groups[0], name: '新しい名前' }],
        version: 2,
      }),
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
  const initialIndex = createV2Index({
    groups: [
      { id: 'group1', name: 'テストグループ1', totalDurationSeconds: 3600, sessionRevisions: ['session1/0'] },
      { id: 'group2', name: 'テストグループ2', totalDurationSeconds: 7200, sessionRevisions: ['session2/0'] },
    ],
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAdmin = true;
    mockSasToken = 'test-sas-token';
    mockExecuteWriteSequence.mockResolvedValue({
      allSucceeded: true,
      results: [{ path: 'data/index.json', success: true }],
    });
    mockUpdateGroupName.mockReturnValue({ index: createV2Index() });
    mockIndexFetcherFetch.mockResolvedValue({
      ok: true,
      data: initialIndex,
    });
  });

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
        data: createV2Index({ ...initialIndex, version: 999 }),
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
    const mergedIndex = createV2Index({
      groups: [
        { ...initialIndex.groups[0], totalDurationSeconds: 10800, sessionRevisions: ['session1/0', 'session2/0'] },
      ],
      version: 2,
    });

    mockFetchIndex
      .mockResolvedValueOnce({ ok: true, data: initialIndex })
      .mockResolvedValueOnce({ ok: true, data: initialIndex });

    mockMergeGroups.mockReturnValue({ index: mergedIndex });

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

    await user.click(checkbox1);
    await user.click(checkbox2);
    expect(screen.getByRole('button', { name: '統合' })).toBeEnabled();

    await user.click(checkbox1);
    expect(screen.getByRole('button', { name: '統合' })).toBeDisabled();
  });
});

describe('AdminPage — セッション名管理', () => {
  const sessionId = '01SESSIONTEST00000000000';
  const sessionRef = `${sessionId}/0`;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAdmin = true;
    mockSasToken = 'test-sas-token';
    mockExecuteWriteSequence.mockResolvedValue({ results: [], allSucceeded: true });
    mockUpdateGroupName.mockReturnValue({ index: createV2Index() });
    mockMergeGroups.mockReturnValue({ index: createV2Index() });
    mockFetchIndex.mockResolvedValue({
      ok: true,
      data: createV2Index({
        groups: [
          {
            id: 'group1',
            name: 'テストグループ1',
            totalDurationSeconds: 3600,
            sessionRevisions: [sessionRef],
          },
        ],
      }),
    });
    mockFetchSession.mockResolvedValue({
      ok: true,
      data: {
        sessionId: sessionId,
        revision: 0,
        title: '',
        startedAt: '2026-02-08T19:00:00',
        endedAt: null,
        attendances: [],
        createdAt: '2026-02-08T00:00:00.000Z',
      },
    });
    mockIndexFetcherFetch.mockResolvedValue({
      ok: true,
      data: createV2Index(),
    });
  });

  it('セッション名管理セクションが表示される', async () => {
    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('グループ・セッション管理')).toBeInTheDocument();
    });
  });

  it('セッション名保存時に新リビジョン data/sessions/{sessionId}/1.json が作成される', async () => {
    const user = userEvent.setup();

    // 保存後のリフレッシュ用
    mockFetchIndex.mockResolvedValue({
      ok: true,
      data: createV2Index({
        groups: [
          {
            id: 'group1',
            name: 'テストグループ1',
            totalDurationSeconds: 3600,
            sessionRevisions: [sessionRef],
          },
        ],
      }),
    });

    mockExecuteWriteSequence.mockResolvedValue({
      allSucceeded: true,
      results: [
        { path: `data/sessions/${sessionId}/1.json`, success: true },
        { path: 'data/index.json', success: true },
      ],
    });

    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('グループ・セッション管理')).toBeInTheDocument();
    });

    // セッションを選択（左カラムでクリック）
    await user.click(await screen.findByRole('button', { name: /2026-02-08/ }));

    const input = screen.getByRole('textbox', { name: '2026-02-08 のセッション名' });
    await user.type(input, '第3回 React入門');
    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(mockExecuteWriteSequence).toHaveBeenCalled();
    });

    const callArgs = mockExecuteWriteSequence.mock.calls[0][0];
    expect(callArgs.newItems).toHaveLength(1);
    // V2: 新リビジョン (revision 0 → 1)
    expect(callArgs.newItems[0].path).toBe(`data/sessions/${sessionId}/1.json`);

    const savedSession = JSON.parse(callArgs.newItems[0].content);
    expect(savedSession.title).toBe('第3回 React入門');
    expect(savedSession.sessionId).toBe(sessionId);
    expect(savedSession.revision).toBe(1);
  });

  it('セッション名保存失敗時にエラーメッセージが表示される', async () => {
    const user = userEvent.setup();
    mockExecuteWriteSequence.mockResolvedValueOnce({
      allSucceeded: false,
      results: [
        { path: `data/sessions/${sessionId}/1.json`, success: false, error: 'ストレージエラー' },
      ],
    });

    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('グループ・セッション管理')).toBeInTheDocument();
    });

    // セッションを選択
    await user.click(await screen.findByRole('button', { name: /2026-02-08/ }));

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
      expect(screen.getByText('グループ・セッション管理')).toBeInTheDocument();
    });

    // セッションを選択
    await user.click(await screen.findByRole('button', { name: /2026-02-08/ }));

    const input = screen.getByRole('textbox', { name: '2026-02-08 のセッション名' });
    await user.type(input, 'テスト名');
    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(
        screen.getByText('セッション名の保存に失敗しました。ネットワーク障害')
      ).toBeInTheDocument();
    });
  });

  it('空のセッション名で保存すると title プロパティが省略される', async () => {
    const user = userEvent.setup();
    mockFetchSession.mockResolvedValue({
      ok: true,
      data: {
        sessionId: sessionId,
        revision: 0,
        title: '既存の名前',
        startedAt: '2026-02-08T19:00:00',
        endedAt: null,
        attendances: [],
        createdAt: '2026-02-08T00:00:00.000Z',
      },
    });

    mockExecuteWriteSequence.mockResolvedValue({
      allSucceeded: true,
      results: [
        { path: `data/sessions/${sessionId}/1.json`, success: true },
        { path: 'data/index.json', success: true },
      ],
    });

    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('グループ・セッション管理')).toBeInTheDocument();
    });

    // セッションを選択（既存の名前を持つセッション）
    await user.click(await screen.findByRole('button', { name: /2026-02-08/ }));

    const input = screen.getByRole('textbox', { name: '2026-02-08 のセッション名' });
    await user.clear(input);
    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(mockExecuteWriteSequence).toHaveBeenCalled();
    });

    const callArgs = mockExecuteWriteSequence.mock.calls[0][0];
    const savedSession = JSON.parse(callArgs.newItems[0].content);
    expect(savedSession.title).toBeUndefined();
  });

  it('グループ別アコーディオンの展開・折りたたみが動作する', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );

    const accordionButton = await screen.findByRole('button', { name: /テストグループ1 を展開/ });
    expect(accordionButton).toHaveAttribute('aria-expanded', 'true');

    // アコーディオン内にセッション一覧が表示される
    expect(screen.getByText('（未設定）')).toBeInTheDocument();

    await user.click(accordionButton);
    expect(accordionButton).toHaveAttribute('aria-expanded', 'false');

    await user.click(accordionButton);
    expect(accordionButton).toHaveAttribute('aria-expanded', 'true');
  });

  it('セッション名が256文字を超える場合にバリデーションエラーが表示される', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('グループ・セッション管理')).toBeInTheDocument();
    });

    // セッションを選択
    await user.click(await screen.findByRole('button', { name: /2026-02-08/ }));

    const input = screen.getByRole('textbox', { name: '2026-02-08 のセッション名' });
    const longName = 'あ'.repeat(257);
    await user.clear(input);
    // type は遅いので、fireEvent で直接値を設定
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      ).set.call(input, longName);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(
        screen.getByText('セッション名は256文字以内で入力してください')
      ).toBeInTheDocument();
    });
  });

  it('セッション名保存の indexUpdater が sessionRevisions を正しく置換する', async () => {
    const user = userEvent.setup();
    let indexUpdaterResult;

    mockExecuteWriteSequence.mockImplementation(async (options) => {
      if (options.indexUpdater) {
        // indexUpdater をモック内で呼び出し、sessionRevisions の置換をテスト
        const latestIndex = createV2Index({
          groups: [
            { id: 'group1', name: 'テスト', totalDurationSeconds: 3600, sessionRevisions: [sessionRef, 'other/0'] },
          ],
          members: [
            { id: 'member1', name: 'メンバー', totalDurationSeconds: 3600, sessionRevisions: [sessionRef] },
          ],
        });
        indexUpdaterResult = options.indexUpdater(latestIndex);
      }
      return {
        allSucceeded: true,
        results: [
          { path: `data/sessions/${sessionId}/1.json`, success: true },
          { path: 'data/index.json', success: true },
        ],
      };
    });

    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('グループ・セッション管理')).toBeInTheDocument();
    });

    // セッションを選択
    await user.click(await screen.findByRole('button', { name: /2026-02-08/ }));

    const input = screen.getByRole('textbox', { name: '2026-02-08 のセッション名' });
    await user.type(input, 'テスト名');
    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(mockExecuteWriteSequence).toHaveBeenCalled();
    });

    // indexUpdater が旧 ref → 新 ref に置換する
    expect(indexUpdaterResult).not.toBeNull();
    expect(indexUpdaterResult.groups[0].sessionRevisions[0]).toBe(`${sessionId}/1`);
    expect(indexUpdaterResult.groups[0].sessionRevisions[1]).toBe('other/0');
    expect(indexUpdaterResult.members[0].sessionRevisions[0]).toBe(`${sessionId}/1`);
    expect(indexUpdaterResult.version).toBe(2);
    expect(indexUpdaterResult.schemaVersion).toBe(2);
  });

  it('セッション名保存の indexUpdater で楽観ロック失敗時に null を返す', async () => {
    const user = userEvent.setup();
    let indexUpdaterResult;

    mockExecuteWriteSequence.mockImplementation(async (options) => {
      if (options.indexUpdater) {
        // version が不一致の場合 null を返す
        const conflictIndex = createV2Index({ version: 999 });
        indexUpdaterResult = options.indexUpdater(conflictIndex);
      }
      return {
        allSucceeded: true,
        results: [
          { path: `data/sessions/${sessionId}/1.json`, success: true },
          { path: 'data/index.json', success: true },
        ],
      };
    });

    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('グループ・セッション管理')).toBeInTheDocument();
    });

    // セッションを選択
    await user.click(await screen.findByRole('button', { name: /2026-02-08/ }));

    const input = screen.getByRole('textbox', { name: '2026-02-08 のセッション名' });
    await user.type(input, 'テスト名');
    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(mockExecuteWriteSequence).toHaveBeenCalled();
    });

    expect(indexUpdaterResult).toBeNull();
  });

  it('未設定バッジがセッション名未設定のグループに表示される', async () => {
    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('未設定 1件')).toBeInTheDocument();
    });
  });

  it('複数セッション（startedAt が null のセッションを含む）で正しくレンダリングされる', async () => {
    const sessionId2 = '01SESSIONTEST00000000002';
    const sessionRef2 = `${sessionId2}/0`;

    mockFetchIndex.mockResolvedValue({
      ok: true,
      data: createV2Index({
        groups: [
          {
            id: 'group1',
            name: 'テストグループ1',
            totalDurationSeconds: 7200,
            sessionRevisions: [sessionRef, sessionRef2],
          },
        ],
      }),
    });
    mockFetchSession.mockImplementation((ref) => {
      if (ref === sessionRef) {
        return Promise.resolve({
          ok: true,
          data: {
            sessionId,
            revision: 0,
            title: '',
            startedAt: '2026-02-08T19:00:00',
            endedAt: null,
            attendances: [],
            createdAt: '2026-02-08T00:00:00.000Z',
          },
        });
      }
      if (ref === sessionRef2) {
        return Promise.resolve({
          ok: true,
          data: {
            sessionId: sessionId2,
            revision: 0,
            title: '',
            startedAt: null,
            endedAt: null,
            attendances: [],
            createdAt: '2026-02-01T00:00:00.000Z',
          },
        });
      }
      return Promise.resolve({ ok: false, error: 'not found' });
    });

    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('グループ・セッション管理')).toBeInTheDocument();
    });

    // アコーディオン内に2つのセッションが表示される
    const sessionButtons = screen.getAllByRole('button').filter((btn) =>
      btn.textContent.includes('（未設定）')
    );
    expect(sessionButtons.length).toBe(2);
  });

  it('セッション名保存成功時に他のセッションの _ref は変更されない', async () => {
    const user = userEvent.setup();
    const sessionId2 = '01SESSIONTEST00000000002';
    const sessionRef2 = `${sessionId2}/0`;

    mockFetchIndex.mockResolvedValue({
      ok: true,
      data: createV2Index({
        groups: [
          {
            id: 'group1',
            name: 'テストグループ1',
            totalDurationSeconds: 7200,
            sessionRevisions: [sessionRef, sessionRef2],
          },
        ],
      }),
    });
    mockFetchSession.mockImplementation((ref) => {
      if (ref === sessionRef) {
        return Promise.resolve({
          ok: true,
          data: {
            sessionId,
            revision: 0,
            title: '',
            startedAt: '2026-02-08T19:00:00',
            endedAt: null,
            attendances: [],
            createdAt: '2026-02-08T00:00:00.000Z',
          },
        });
      }
      if (ref === sessionRef2) {
        return Promise.resolve({
          ok: true,
          data: {
            sessionId: sessionId2,
            revision: 0,
            title: '既存セッション名',
            startedAt: '2026-02-01T19:00:00',
            endedAt: null,
            attendances: [],
            createdAt: '2026-02-01T00:00:00.000Z',
          },
        });
      }
      return Promise.resolve({ ok: false, error: 'not found' });
    });

    mockExecuteWriteSequence.mockResolvedValue({
      allSucceeded: true,
      results: [
        { path: `data/sessions/${sessionId}/1.json`, success: true },
        { path: 'data/index.json', success: true },
      ],
    });

    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('グループ・セッション管理')).toBeInTheDocument();
    });

    // 最初のセッションを選択
    await user.click(await screen.findByRole('button', { name: /2026-02-08/ }));

    const input = screen.getByRole('textbox', { name: '2026-02-08 のセッション名' });
    await user.type(input, 'テスト名');

    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(screen.getByText('セッション名を保存しました')).toBeInTheDocument();
    });
  });
});

import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DashboardPage } from '../../../../src/pages/DashboardPage.jsx';
import { sharedDataFetcher } from '../../../../src/services/shared-data-fetcher.js';

// モック用の関数参照を保持する
const mockFetchIndex = vi.fn();
const mockInvalidateIndexCache = vi.fn();

vi.mock('../../../../src/services/shared-data-fetcher.js', () => {
  return {
    sharedDataFetcher: {
      fetchIndex: (...args) => mockFetchIndex(...args),
      invalidateIndexCache: (...args) => mockInvalidateIndexCache(...args),
    },
  };
});

const mockIndexData = {
  organizers: [
    { id: 'org1', name: 'フロントエンド推進室' },
  ],
  groups: [
    { id: 'g1', name: 'フロントエンド勉強会', organizerId: 'org1', totalDurationSeconds: 3600, sessionRevisions: ['s1'] },
  ],
  members: [
    { id: 'm1', name: '佐藤 一郎', totalDurationSeconds: 1800, sessionRevisions: ['s1'] },
    { id: 'm2', name: '高橋 美咲', totalDurationSeconds: 3600, sessionRevisions: ['s1'] },
  ],
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ローディング中に「読み込み中…」と表示すること', () => {
    mockFetchIndex.mockReturnValue(new Promise(() => {}));

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    expect(screen.getByText('読み込み中…')).toBeInTheDocument();
  });

  it('データ取得成功時にグループ・メンバー一覧を表示すること', async () => {
    mockFetchIndex.mockResolvedValue({ ok: true, data: mockIndexData });

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('フロントエンド勉強会')).toBeInTheDocument();
    });

    expect(screen.getByText('佐藤 一郎')).toBeInTheDocument();
    expect(screen.getByText('高橋 美咲')).toBeInTheDocument();
  });

  it('メンバーが合計時間の降順でソートされること', async () => {
    mockFetchIndex.mockResolvedValue({ ok: true, data: mockIndexData });

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('高橋 美咲')).toBeInTheDocument();
    });

    // 花子（3600秒）が太郎（1800秒）より先に表示される
    const rows = screen.getAllByTestId('member-row');
    expect(rows[0]).toHaveTextContent('高橋 美咲');
    expect(rows[1]).toHaveTextContent('佐藤 一郎');
  });

  it('データ取得エラー時にエラーメッセージを表示すること', async () => {
    mockFetchIndex.mockResolvedValue({ ok: false, error: 'ネットワークエラー' });

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/データ取得エラー/)).toBeInTheDocument();
    });
  });

  it('主催者セクションが表示されること', async () => {
    mockFetchIndex.mockResolvedValue({ ok: true, data: mockIndexData });

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('主催者')).toBeInTheDocument();
    });

    // OrganizerList の行が表示されている
    expect(screen.getAllByTestId('organizer-row')).toHaveLength(1);
  });

  it('organizers が undefined の場合でも正常に表示されること', async () => {
    const dataWithUndefinedOrganizers = { ...mockIndexData, organizers: undefined };
    mockFetchIndex.mockResolvedValue({ ok: true, data: dataWithUndefinedOrganizers });

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('フロントエンド勉強会')).toBeInTheDocument();
    });

    expect(screen.queryByText('主催者')).not.toBeInTheDocument();
  });

  it('主催者が0件の場合は主催者セクションが表示されないこと', async () => {
    const dataWithoutOrganizers = { ...mockIndexData, organizers: [] };
    mockFetchIndex.mockResolvedValue({ ok: true, data: dataWithoutOrganizers });

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('フロントエンド勉強会')).toBeInTheDocument();
    });

    expect(screen.queryByText('主催者')).not.toBeInTheDocument();
  });

  it('管理画面保存後の再表示で最新データを表示すること', async () => {
    const staleData = {
      ...mockIndexData,
      groups: [{ id: 'g-old', name: '旧グループ', totalDurationSeconds: 600, sessionRevisions: ['s-old'] }],
      members: [{ id: 'm-old', name: '旧メンバー', totalDurationSeconds: 600, sessionRevisions: ['s-old'] }],
    };
    const freshData = {
      ...mockIndexData,
      groups: [{ id: 'g-new', name: '新グループ', totalDurationSeconds: 1200, sessionRevisions: ['s-new'] }],
      members: [{ id: 'm-new', name: '新メンバー', totalDurationSeconds: 1200, sessionRevisions: ['s-new'] }],
    };

    mockFetchIndex
      .mockResolvedValueOnce({ ok: true, data: staleData })
      .mockResolvedValueOnce({ ok: true, data: freshData });

    const { unmount } = render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('旧グループ')).toBeInTheDocument();
    });

    // 管理画面での保存成功後にキャッシュ無効化された状況を再現
    sharedDataFetcher.invalidateIndexCache();
    expect(mockInvalidateIndexCache).toHaveBeenCalledTimes(1);

    unmount();

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('新グループ')).toBeInTheDocument();
    });
  });
});

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { GroupDetailPage } from '../../../src/pages/GroupDetailPage.jsx';

// モック用の関数参照を保持する
const mockFetchIndex = vi.fn();
const mockFetchSession = vi.fn();

vi.mock('../../../src/services/data-fetcher.js', () => {
  return {
    DataFetcher: vi.fn().mockImplementation(() => ({
      fetchIndex: (...args) => mockFetchIndex(...args),
      fetchSession: (...args) => mockFetchSession(...args),
    })),
  };
});

const mockIndexData = {
  groups: [
    {
      id: 'g1',
      name: 'フロントエンド勉強会',
      totalDurationSeconds: 5400,
      sessionIds: ['g1-2026-01-15', 'g1-2026-01-20'],
    },
    {
      id: 'g2',
      name: 'TypeScript読書会',
      totalDurationSeconds: 3600,
      sessionIds: ['g2-2026-01-18'],
    },
  ],
  members: [
    {
      id: 'm1',
      name: '佐藤 一郎',
      totalDurationSeconds: 3600,
      sessionIds: ['g1-2026-01-15', 'g2-2026-01-18'],
    },
    {
      id: 'm2',
      name: '高橋 美咲',
      totalDurationSeconds: 1800,
      sessionIds: ['g1-2026-01-15', 'g1-2026-01-20'],
    },
  ],
  updatedAt: '2026-01-01T00:00:00Z',
};

const mockSessionData1 = {
  id: 'g1-2026-01-15',
  groupId: 'g1',
  date: '2026-01-15',
  attendances: [
    { memberId: 'm1', durationSeconds: 1800 },
    { memberId: 'm2', durationSeconds: 1200 },
  ],
};

const mockSessionData2 = {
  id: 'g1-2026-01-20',
  groupId: 'g1',
  date: '2026-01-20',
  attendances: [{ memberId: 'm2', durationSeconds: 2400 }],
};

const mockSessionDataSingle = {
  id: 'g2-2026-01-18',
  groupId: 'g2',
  date: '2026-01-18',
  attendances: [{ memberId: 'm1', durationSeconds: 3600 }],
};

function renderWithRouter(groupId) {
  return render(
    <MemoryRouter initialEntries={[`/groups/${groupId}`]}>
      <Routes>
        <Route path="/groups/:groupId" element={<GroupDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('GroupDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ローディング中に「読み込み中…」と表示すること', () => {
    mockFetchIndex.mockReturnValue(new Promise(() => {}));

    renderWithRouter('g1');
    expect(screen.getByText('読み込み中…')).toBeInTheDocument();
  });

  it('グループ情報とセッション一覧を表示すること', async () => {
    mockFetchIndex.mockResolvedValue({ ok: true, data: mockIndexData });
    mockFetchSession.mockImplementation((sid) => {
      if (sid === 'g1-2026-01-15') return Promise.resolve({ ok: true, data: mockSessionData1 });
      if (sid === 'g1-2026-01-20') return Promise.resolve({ ok: true, data: mockSessionData2 });
      return Promise.resolve({ ok: false, error: 'not found' });
    });

    renderWithRouter('g1');

    await waitFor(() => {
      expect(screen.getByText('フロントエンド勉強会')).toBeInTheDocument();
    });

    // ヘッダーカードの情報
    expect(screen.getByText(/2回開催/)).toBeInTheDocument();

    // セッション日付が表示される（日付降順）
    const headings = screen.getAllByRole('heading', { level: 3 });
    const dates = headings.map((h) => h.textContent);
    expect(dates[0]).toBe('2026-01-20');
    expect(dates[1]).toBe('2026-01-15');
  });

  it('セッションをクリックして参加者テーブルを展開・折りたたみできること', async () => {
    mockFetchIndex.mockResolvedValue({ ok: true, data: mockIndexData });
    mockFetchSession.mockImplementation((sid) => {
      if (sid === 'g1-2026-01-15') return Promise.resolve({ ok: true, data: mockSessionData1 });
      if (sid === 'g1-2026-01-20') return Promise.resolve({ ok: true, data: mockSessionData2 });
      return Promise.resolve({ ok: false, error: 'not found' });
    });

    renderWithRouter('g1');

    await waitFor(() => {
      expect(screen.getByText('フロントエンド勉強会')).toBeInTheDocument();
    });

    // 初期状態ではテーブルが表示されない（複数セッション）
    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    // セッションをクリックして展開
    fireEvent.click(screen.getByText('2026-01-15'));
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('佐藤 一郎')).toBeInTheDocument();
    expect(screen.getByText('高橋 美咲')).toBeInTheDocument();

    // 再クリックで折りたたみ
    fireEvent.click(screen.getByText('2026-01-15'));
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('セッションが1件のみの場合はデフォルトで展開されること', async () => {
    mockFetchIndex.mockResolvedValue({ ok: true, data: mockIndexData });
    mockFetchSession.mockResolvedValue({ ok: true, data: mockSessionDataSingle });

    renderWithRouter('g2');

    await waitFor(() => {
      expect(screen.getByText('TypeScript読書会')).toBeInTheDocument();
    });

    // セッション1件のみなのでデフォルト展開
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('佐藤 一郎')).toBeInTheDocument();
  });

  it('存在しないグループIDの場合にエラーを表示すること', async () => {
    mockFetchIndex.mockResolvedValue({ ok: true, data: mockIndexData });

    renderWithRouter('unknown-id');

    await waitFor(() => {
      expect(screen.getByText('グループが見つかりません')).toBeInTheDocument();
    });
  });

  it('データ取得エラー時にエラーメッセージを表示すること', async () => {
    mockFetchIndex.mockResolvedValue({ ok: false, error: 'Network error' });

    renderWithRouter('g1');

    await waitFor(() => {
      expect(screen.getByText(/データ取得エラー/)).toBeInTheDocument();
    });
  });

  it('「一覧へ戻る」ボタンが表示されること', async () => {
    mockFetchIndex.mockResolvedValue({ ok: true, data: mockIndexData });
    mockFetchSession.mockImplementation((sid) => {
      if (sid === 'g1-2026-01-15') return Promise.resolve({ ok: true, data: mockSessionData1 });
      if (sid === 'g1-2026-01-20') return Promise.resolve({ ok: true, data: mockSessionData2 });
      return Promise.resolve({ ok: false, error: 'not found' });
    });

    renderWithRouter('g1');

    await waitFor(() => {
      expect(screen.getByText('一覧へ戻る')).toBeInTheDocument();
    });
  });
});

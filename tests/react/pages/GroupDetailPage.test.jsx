import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
  schemaVersion: 2,
  version: 1,
  groups: [
    {
      id: 'g1',
      name: 'フロントエンド勉強会',
      totalDurationSeconds: 5400,
      sessionRevisions: ['g1-2026-01-15/0', 'g1-2026-01-20/0'],
    },
    {
      id: 'g2',
      name: 'TypeScript読書会',
      totalDurationSeconds: 3600,
      sessionRevisions: ['g2-2026-01-18/0'],
    },
  ],
  members: [
    {
      id: 'm1',
      name: '佐藤 一郎',
      totalDurationSeconds: 3600,
      sessionRevisions: ['g1-2026-01-15/0', 'g2-2026-01-18/0'],
    },
    {
      id: 'm2',
      name: '高橋 美咲',
      totalDurationSeconds: 1800,
      sessionRevisions: ['g1-2026-01-15/0', 'g1-2026-01-20/0'],
    },
  ],
  updatedAt: '2026-01-01T00:00:00Z',
};

const mockSessionData1 = {
  sessionId: 'g1-2026-01-15',
  revision: 0,
  title: '',
  startedAt: '2026-01-15T19:00:00',
  endedAt: null,
  attendances: [
    { memberId: 'm1', durationSeconds: 1800 },
    { memberId: 'm2', durationSeconds: 1200 },
  ],
  createdAt: '2026-01-15T00:00:00.000Z',
};

const mockSessionData2 = {
  sessionId: 'g1-2026-01-20',
  revision: 0,
  title: '第3回 React入門',
  startedAt: '2026-01-20T19:00:00',
  endedAt: null,
  attendances: [{ memberId: 'm2', durationSeconds: 2400 }],
  createdAt: '2026-01-20T00:00:00.000Z',
};

const mockSessionDataSingle = {
  sessionId: 'g2-2026-01-18',
  revision: 0,
  title: '',
  startedAt: '2026-01-18T19:00:00',
  endedAt: null,
  attendances: [{ memberId: 'm1', durationSeconds: 3600 }],
  createdAt: '2026-01-18T00:00:00.000Z',
};

// 複数期にまたがるモックデータ
const mockMultiPeriodIndexData = {
  schemaVersion: 2,
  version: 1,
  groups: [
    {
      id: 'g1',
      name: 'フロントエンド勉強会',
      totalDurationSeconds: 9000,
      sessionRevisions: ['g1-2025-06-15/0', 'g1-2025-08-20/0', 'g1-2026-01-15/0'],
    },
  ],
  members: [
    {
      id: 'm1',
      name: '佐藤 一郎',
      totalDurationSeconds: 5400,
      sessionRevisions: ['g1-2025-06-15/0', 'g1-2025-08-20/0', 'g1-2026-01-15/0'],
    },
    {
      id: 'm2',
      name: '高橋 美咲',
      totalDurationSeconds: 3600,
      sessionRevisions: ['g1-2025-06-15/0', 'g1-2026-01-15/0'],
    },
  ],
  updatedAt: '2026-01-01T00:00:00Z',
};

const mockMultiPeriodSessions = {
  'g1-2025-06-15/0': {
    sessionId: 'g1-2025-06-15',
    revision: 0,
    title: '',
    startedAt: '2025-06-15T19:00:00',
    endedAt: null,
    attendances: [
      { memberId: 'm1', durationSeconds: 1800 },
      { memberId: 'm2', durationSeconds: 1200 },
    ],
    createdAt: '2025-06-15T00:00:00.000Z',
  },
  'g1-2025-08-20/0': {
    sessionId: 'g1-2025-08-20',
    revision: 0,
    title: '',
    startedAt: '2025-08-20T19:00:00',
    endedAt: null,
    attendances: [{ memberId: 'm1', durationSeconds: 3600 }],
    createdAt: '2025-08-20T00:00:00.000Z',
  },
  'g1-2026-01-15/0': {
    sessionId: 'g1-2026-01-15',
    revision: 0,
    title: '',
    startedAt: '2026-01-15T19:00:00',
    endedAt: null,
    attendances: [
      { memberId: 'm1', durationSeconds: 1800 },
      { memberId: 'm2', durationSeconds: 2400 },
    ],
    createdAt: '2026-01-15T00:00:00.000Z',
  },
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
    mockFetchSession.mockImplementation((ref) => {
      if (ref === 'g1-2026-01-15/0') return Promise.resolve({ ok: true, data: mockSessionData1 });
      if (ref === 'g1-2026-01-20/0') return Promise.resolve({ ok: true, data: mockSessionData2 });
      return Promise.resolve({ ok: false, error: 'not found' });
    });

    renderWithRouter('g1');

    await waitFor(() => {
      expect(screen.getByText('フロントエンド勉強会')).toBeInTheDocument();
    });

    // ヘッダーカードの情報（数値とテキストが別要素に分かれている）
    const headerCard = screen.getByText('フロントエンド勉強会').closest('div');
    expect(headerCard.textContent).toContain('2回開催');

    // 期サマリーが表示される（2025年度 下期 = 2026年1月）
    expect(screen.getByText('2025年度 下期')).toBeInTheDocument();

    // セッション見出しが表示される（日付降順）
    const headings = screen.getAllByRole('heading', { level: 3 });
    const dates = headings.map((h) => h.textContent);
    expect(dates[0]).toBe('第3回 React入門 - 2026-01-20');
    expect(dates[1]).toBe('2026-01-15');
  });

  it('セッションをクリックして参加者テーブルを展開・折りたたみできること', async () => {
    const user = userEvent.setup();
    mockFetchIndex.mockResolvedValue({ ok: true, data: mockIndexData });
    mockFetchSession.mockImplementation((ref) => {
      if (ref === 'g1-2026-01-15/0') return Promise.resolve({ ok: true, data: mockSessionData1 });
      if (ref === 'g1-2026-01-20/0') return Promise.resolve({ ok: true, data: mockSessionData2 });
      return Promise.resolve({ ok: false, error: 'not found' });
    });

    renderWithRouter('g1');

    await waitFor(() => {
      expect(screen.getByText('フロントエンド勉強会')).toBeInTheDocument();
    });

    // 初期状態ではテーブルがaria-hiddenで非表示（queryByRoleはaria-hiddenを尊重）
    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    // セッションをクリックして展開
    await user.click(screen.getByText('2026-01-15'));
    const table = screen.getByRole('table');
    expect(table).toBeInTheDocument();
    expect(within(table).getByText('佐藤 一郎')).toBeInTheDocument();
    expect(within(table).getByText('高橋 美咲')).toBeInTheDocument();

    // 再クリックで折りたたみ
    await user.click(screen.getByText('2026-01-15'));
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
    mockFetchSession.mockImplementation((ref) => {
      if (ref === 'g1-2026-01-15/0') return Promise.resolve({ ok: true, data: mockSessionData1 });
      if (ref === 'g1-2026-01-20/0') return Promise.resolve({ ok: true, data: mockSessionData2 });
      return Promise.resolve({ ok: false, error: 'not found' });
    });

    renderWithRouter('g1');

    await waitFor(() => {
      expect(screen.getByText('一覧へ戻る')).toBeInTheDocument();
    });
  });

  describe('期別表示', () => {
    it('複数期のサマリーが降順で表示されること', async () => {
      mockFetchIndex.mockResolvedValue({ ok: true, data: mockMultiPeriodIndexData });
      mockFetchSession.mockImplementation((ref) =>
        Promise.resolve({ ok: true, data: mockMultiPeriodSessions[ref] })
      );

      renderWithRouter('g1');

      await waitFor(() => {
        expect(screen.getByText('フロントエンド勉強会')).toBeInTheDocument();
      });

      // 期サマリーが降順で表示される
      const periodButtons = screen.getAllByRole('button', { pressed: undefined });
      const periodLabels = periodButtons
        .filter((btn) => btn.getAttribute('aria-pressed') !== null)
        .map((btn) => btn.textContent);
      expect(periodLabels[0]).toContain('2025年度 下期');
      expect(periodLabels[1]).toContain('2025年度 上期');
    });

    it('最新の期がデフォルトで選択されること', async () => {
      mockFetchIndex.mockResolvedValue({ ok: true, data: mockMultiPeriodIndexData });
      mockFetchSession.mockImplementation((ref) =>
        Promise.resolve({ ok: true, data: mockMultiPeriodSessions[ref] })
      );

      renderWithRouter('g1');

      await waitFor(() => {
        expect(screen.getByText('フロントエンド勉強会')).toBeInTheDocument();
      });

      // 最新の期（2025年度 下期）が選択されている
      const selectedButton = screen.getByRole('button', { pressed: true });
      expect(selectedButton).toHaveTextContent('2025年度 下期');

      // 下期のセッション（2026-01-15）が右列に表示される
      expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('2026-01-15');
    });

    it('期を切り替えるとその期のセッションが表示されること', async () => {
      const user = userEvent.setup();
      mockFetchIndex.mockResolvedValue({ ok: true, data: mockMultiPeriodIndexData });
      mockFetchSession.mockImplementation((ref) =>
        Promise.resolve({ ok: true, data: mockMultiPeriodSessions[ref] })
      );

      renderWithRouter('g1');

      await waitFor(() => {
        expect(screen.getByText('フロントエンド勉強会')).toBeInTheDocument();
      });

      // 上期ボタンをクリック
      const firstHalfButton = screen.getByRole('button', { pressed: false });
      await user.click(firstHalfButton);

      // 上期のボタンが選択状態になる
      expect(firstHalfButton).toHaveAttribute('aria-pressed', 'true');

      // 上期のセッション日付が表示される（2025-08-20, 2025-06-15 の2件）
      const headings = screen.getAllByRole('heading', { level: 3 });
      const dates = headings.map((h) => h.textContent);
      expect(dates).toContain('2025-08-20');
      expect(dates).toContain('2025-06-15');
    });

    it('期サマリーにセッション数と合計時間が表示されること', async () => {
      mockFetchIndex.mockResolvedValue({ ok: true, data: mockMultiPeriodIndexData });
      mockFetchSession.mockImplementation((ref) =>
        Promise.resolve({ ok: true, data: mockMultiPeriodSessions[ref] })
      );

      renderWithRouter('g1');

      await waitFor(() => {
        expect(screen.getByText('フロントエンド勉強会')).toBeInTheDocument();
      });

      // 下期（1セッション）の期ボタン
      const selectedButton = screen.getByRole('button', { pressed: true });
      expect(selectedButton.textContent).toContain('1回');

      // 上期（2セッション）の期ボタン
      const unselectedButton = screen.getByRole('button', { pressed: false });
      expect(unselectedButton.textContent).toContain('2回');
    });
  });
});

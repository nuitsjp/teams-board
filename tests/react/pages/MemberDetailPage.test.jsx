import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { MemberDetailPage } from '../../../src/pages/MemberDetailPage.jsx';

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
      totalDurationSeconds: 3600,
      sessionIds: ['g1-2026-01-15'],
    },
  ],
  members: [
    { id: 'm1', name: '佐藤 一郎', totalDurationSeconds: 1800, sessionIds: ['g1-2026-01-15'] },
  ],
  updatedAt: '2026-01-01T00:00:00Z',
};

const mockSessionData = {
  id: 'g1-2026-01-15',
  groupId: 'g1',
  date: '2026-01-15',
  attendances: [{ memberId: 'm1', durationSeconds: 1800 }],
};

// 複数期にまたがるモックデータ
const mockMultiPeriodIndexData = {
  groups: [
    {
      id: 'g1',
      name: 'フロントエンド勉強会',
      totalDurationSeconds: 7200,
      sessionIds: ['g1-2025-06-15', 'g1-2026-01-15'],
    },
    {
      id: 'g2',
      name: 'TypeScript読書会',
      totalDurationSeconds: 5400,
      sessionIds: ['g2-2025-05-12'],
    },
  ],
  members: [
    {
      id: 'm1',
      name: '佐藤 一郎',
      totalDurationSeconds: 9000,
      sessionIds: ['g1-2025-06-15', 'g2-2025-05-12', 'g1-2026-01-15'],
    },
  ],
  updatedAt: '2026-01-01T00:00:00Z',
};

const mockMultiPeriodSessions = {
  'g1-2025-06-15': {
    id: 'g1-2025-06-15',
    groupId: 'g1',
    date: '2025-06-15',
    attendances: [{ memberId: 'm1', durationSeconds: 3600 }],
  },
  'g2-2025-05-12': {
    id: 'g2-2025-05-12',
    groupId: 'g2',
    date: '2025-05-12',
    attendances: [{ memberId: 'm1', durationSeconds: 5400 }],
  },
  'g1-2026-01-15': {
    id: 'g1-2026-01-15',
    groupId: 'g1',
    date: '2026-01-15',
    attendances: [{ memberId: 'm1', durationSeconds: 1800 }],
  },
};

function renderWithRouter(memberId) {
  return render(
    <MemoryRouter initialEntries={[`/members/${memberId}`]}>
      <Routes>
        <Route path="/members/:memberId" element={<MemberDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('MemberDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ローディング中に「読み込み中…」と表示すること', () => {
    mockFetchIndex.mockReturnValue(new Promise(() => {}));

    renderWithRouter('m1');
    expect(screen.getByText('読み込み中…')).toBeInTheDocument();
  });

  it('メンバー情報とセッション出席履歴を表示すること', async () => {
    mockFetchIndex.mockResolvedValue({ ok: true, data: mockIndexData });
    mockFetchSession.mockResolvedValue({ ok: true, data: mockSessionData });

    renderWithRouter('m1');

    await waitFor(() => {
      expect(screen.getByText('佐藤 一郎')).toBeInTheDocument();
    });

    // 期サマリーが表示される（2025年度 下期 = 2026年1月）
    expect(screen.getByText('2025年度 下期')).toBeInTheDocument();
    // グループが1つのみなのでデフォルト展開され、セッション日付が表示される
    expect(screen.getByText(/2026-01-15/)).toBeInTheDocument();
    // グループ名がサマリーカードに表示される
    expect(screen.getByText(/フロントエンド勉強会/)).toBeInTheDocument();
  });

  it('存在しないメンバーIDの場合にエラーを表示すること', async () => {
    mockFetchIndex.mockResolvedValue({ ok: true, data: mockIndexData });

    renderWithRouter('unknown-id');

    await waitFor(() => {
      expect(screen.getByText('参加者が見つかりません')).toBeInTheDocument();
    });
  });

  it('「一覧へ戻る」リンクが表示されること', async () => {
    mockFetchIndex.mockResolvedValue({ ok: true, data: mockIndexData });
    mockFetchSession.mockResolvedValue({ ok: true, data: mockSessionData });

    renderWithRouter('m1');

    await waitFor(() => {
      expect(screen.getByText('一覧へ戻る')).toBeInTheDocument();
    });
  });

  describe('期別表示', () => {
    it('複数期のサマリーが降順で表示されること', async () => {
      mockFetchIndex.mockResolvedValue({ ok: true, data: mockMultiPeriodIndexData });
      mockFetchSession.mockImplementation((id) =>
        Promise.resolve({ ok: true, data: mockMultiPeriodSessions[id] })
      );

      renderWithRouter('m1');

      await waitFor(() => {
        expect(screen.getByText('佐藤 一郎')).toBeInTheDocument();
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
      mockFetchSession.mockImplementation((id) =>
        Promise.resolve({ ok: true, data: mockMultiPeriodSessions[id] })
      );

      renderWithRouter('m1');

      await waitFor(() => {
        expect(screen.getByText('佐藤 一郎')).toBeInTheDocument();
      });

      // 最新の期（2025年度 下期）が選択されている
      const selectedButton = screen.getByRole('button', { pressed: true });
      expect(selectedButton).toHaveTextContent('2025年度 下期');

      // 下期のセッション（2026-01-15）が右列に表示される
      expect(screen.getByText(/フロントエンド勉強会/)).toBeInTheDocument();
    });

    it('期を切り替えるとその期のセッションが表示されること', async () => {
      const user = userEvent.setup();
      mockFetchIndex.mockResolvedValue({ ok: true, data: mockMultiPeriodIndexData });
      mockFetchSession.mockImplementation((id) =>
        Promise.resolve({ ok: true, data: mockMultiPeriodSessions[id] })
      );

      renderWithRouter('m1');

      await waitFor(() => {
        expect(screen.getByText('佐藤 一郎')).toBeInTheDocument();
      });

      // 上期ボタンをクリック
      const firstHalfButton = screen.getByRole('button', { pressed: false });
      await user.click(firstHalfButton);

      // 上期のボタンが選択状態になる
      expect(firstHalfButton).toHaveAttribute('aria-pressed', 'true');

      // 上期のグループが表示される（フロントエンド勉強会 + TypeScript読書会）
      expect(screen.getByText(/TypeScript読書会/)).toBeInTheDocument();
    });
  });

  it('統合後でも sessionId 逆引きで統合先グループ名を表示すること', async () => {
    mockFetchIndex.mockResolvedValue({
      ok: true,
      data: {
        groups: [
          {
            id: 'g-target',
            name: '統合先グループ',
            totalDurationSeconds: 3600,
            sessionIds: ['g-old-2026-01-15'],
          },
        ],
        members: [
          {
            id: 'm1',
            name: '佐藤 一郎',
            totalDurationSeconds: 1800,
            sessionIds: ['g-old-2026-01-15'],
          },
        ],
        updatedAt: '2026-02-10T00:00:00Z',
      },
    });
    mockFetchSession.mockResolvedValue({
      ok: true,
      data: {
        id: 'g-old-2026-01-15',
        groupId: 'g-old',
        date: '2026-01-15',
        attendances: [{ memberId: 'm1', durationSeconds: 1800 }],
      },
    });

    renderWithRouter('m1');

    await waitFor(() => {
      expect(screen.getByText('佐藤 一郎')).toBeInTheDocument();
    });

    expect(screen.getByText('統合先グループ')).toBeInTheDocument();
    expect(screen.queryByText('不明')).not.toBeInTheDocument();
  });
});

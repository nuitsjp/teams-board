import { render, screen, waitFor } from '@testing-library/react';
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
    { id: 'g1', name: 'もくもく勉強会', totalDurationSeconds: 3600, sessionIds: ['g1-2026-01-15'] },
  ],
  members: [
    { id: 'm1', name: 'テスト太郎', totalDurationSeconds: 1800, sessionIds: ['g1-2026-01-15'] },
  ],
  updatedAt: '2026-01-01T00:00:00Z',
};

const mockSessionData = {
  id: 'g1-2026-01-15',
  groupId: 'g1',
  date: '2026-01-15',
  attendances: [
    { memberId: 'm1', durationSeconds: 1800 },
  ],
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

  it('ローディング中に「読み込み中...」と表示すること', () => {
    mockFetchIndex.mockReturnValue(new Promise(() => {}));

    renderWithRouter('m1');
    expect(screen.getByText('読み込み中...')).toBeInTheDocument();
  });

  it('メンバー情報とセッション出席履歴を表示すること', async () => {
    mockFetchIndex.mockResolvedValue({ ok: true, data: mockIndexData });
    mockFetchSession.mockResolvedValue({ ok: true, data: mockSessionData });

    renderWithRouter('m1');

    await waitFor(() => {
      expect(screen.getByText('テスト太郎')).toBeInTheDocument();
    });

    // グループが1つのみなのでデフォルト展開され、セッション日付が表示される
    expect(screen.getByText(/2026-01-15/)).toBeInTheDocument();
    // グループ名がサマリーカードに表示される
    expect(screen.getByText(/もくもく勉強会/)).toBeInTheDocument();
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
});

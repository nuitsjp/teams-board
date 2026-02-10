import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DashboardPage } from '../../../src/pages/DashboardPage.jsx';

// モック用の関数参照を保持する
const mockFetchIndex = vi.fn();

vi.mock('../../../src/services/data-fetcher.js', () => {
  return {
    DataFetcher: vi.fn().mockImplementation(() => ({
      fetchIndex: (...args) => mockFetchIndex(...args),
    })),
  };
});

const mockIndexData = {
  groups: [
    { id: 'g1', name: 'フロントエンド勉強会', totalDurationSeconds: 3600, sessionIds: ['s1'] },
  ],
  members: [
    { id: 'm1', name: '佐藤 一郎', totalDurationSeconds: 1800, sessionIds: ['s1'] },
    { id: 'm2', name: '高橋 美咲', totalDurationSeconds: 3600, sessionIds: ['s1'] },
  ],
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ローディング中に「読み込み中...」と表示すること', () => {
    mockFetchIndex.mockReturnValue(new Promise(() => { }));

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    expect(screen.getByText('読み込み中...')).toBeInTheDocument();
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
});

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { OrganizerDetailPage } from '../../../src/pages/OrganizerDetailPage.jsx';

const mockFetchIndex = vi.fn();

vi.mock('../../../src/services/shared-data-fetcher.js', () => {
    return {
        sharedDataFetcher: {
            fetchIndex: (...args) => mockFetchIndex(...args),
        },
    };
});

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return { ...actual, useNavigate: () => mockNavigate };
});

const mockIndexData = {
    organizers: [
        { id: 'org1', name: 'フロントエンド推進室' },
        { id: 'org2', name: '技術戦略部' },
    ],
    groups: [
        { id: 'g1', name: 'フロントエンド勉強会', organizerId: 'org1', totalDurationSeconds: 3600, sessionRevisions: ['s1', 's2'] },
        { id: 'g2', name: 'React読書会', organizerId: 'org1', totalDurationSeconds: 1800, sessionRevisions: ['s3'] },
        { id: 'g3', name: 'インフラ研究会', organizerId: 'org2', totalDurationSeconds: 7200, sessionRevisions: ['s4'] },
    ],
    members: [],
};

function renderWithRoute(organizerId) {
    return render(
        <MemoryRouter initialEntries={[`/organizers/${organizerId}`]}>
            <Routes>
                <Route path="/organizers/:organizerId" element={<OrganizerDetailPage />} />
            </Routes>
        </MemoryRouter>
    );
}

describe('OrganizerDetailPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('ローディング中に「読み込み中…」と表示すること', () => {
        mockFetchIndex.mockReturnValue(new Promise(() => {}));

        renderWithRoute('org1');

        expect(screen.getByText('読み込み中…')).toBeInTheDocument();
    });

    it('主催者名と統計情報が表示されること', async () => {
        mockFetchIndex.mockResolvedValue({ ok: true, data: mockIndexData });

        renderWithRoute('org1');

        await waitFor(() => {
            expect(screen.getByText('フロントエンド推進室')).toBeInTheDocument();
        });

        // ヘッダーカードにグループ数と合計時間が表示されている
        expect(screen.getByText('グループ')).toBeInTheDocument();
        // グループ一覧が2件表示されている
        expect(screen.getAllByTestId('organizer-group-row')).toHaveLength(2);
    });

    it('紐づくグループ一覧が表示されること', async () => {
        mockFetchIndex.mockResolvedValue({ ok: true, data: mockIndexData });

        renderWithRoute('org1');

        await waitFor(() => {
            expect(screen.getByText('フロントエンド勉強会')).toBeInTheDocument();
        });

        expect(screen.getByText('React読書会')).toBeInTheDocument();
        // org2 のグループは表示されない
        expect(screen.queryByText('インフラ研究会')).not.toBeInTheDocument();
    });

    it('グループクリックでグループ詳細ページに遷移すること', async () => {
        const user = userEvent.setup();
        mockFetchIndex.mockResolvedValue({ ok: true, data: mockIndexData });

        renderWithRoute('org1');

        await waitFor(() => {
            expect(screen.getByText('フロントエンド勉強会')).toBeInTheDocument();
        });

        const rows = screen.getAllByTestId('organizer-group-row');
        await user.click(rows[0]);

        expect(mockNavigate).toHaveBeenCalledWith('/groups/g1');
    });

    it('存在しない主催者IDでエラー表示されること', async () => {
        mockFetchIndex.mockResolvedValue({ ok: true, data: mockIndexData });

        renderWithRoute('nonexistent');

        await waitFor(() => {
            expect(screen.getByText('主催者が見つかりません')).toBeInTheDocument();
        });

        expect(screen.getByText('戻る')).toBeInTheDocument();
    });

    it('データ取得エラー時にエラーメッセージを表示すること', async () => {
        mockFetchIndex.mockResolvedValue({ ok: false, error: 'ネットワークエラー' });

        renderWithRoute('org1');

        await waitFor(() => {
            expect(screen.getByText(/データ取得エラー/)).toBeInTheDocument();
        });
    });

    it('グループが0件の主催者では空メッセージが表示されること', async () => {
        const dataWithNoGroups = {
            ...mockIndexData,
            groups: mockIndexData.groups.map((g) => ({ ...g, organizerId: 'org2' })),
        };
        mockFetchIndex.mockResolvedValue({ ok: true, data: dataWithNoGroups });

        renderWithRoute('org1');

        await waitFor(() => {
            expect(screen.getByText('この主催者に紐づくグループはありません')).toBeInTheDocument();
        });
    });

    it('「戻る」ボタンクリックで navigate(-1) が呼ばれること', async () => {
        const user = userEvent.setup();
        mockFetchIndex.mockResolvedValue({ ok: true, data: mockIndexData });

        renderWithRoute('org1');

        await waitFor(() => {
            expect(screen.getByText('フロントエンド推進室')).toBeInTheDocument();
        });

        await user.click(screen.getByText('戻る'));
        expect(mockNavigate).toHaveBeenCalledWith(-1);
    });

    it('エラー画面の「戻る」ボタンクリックで navigate(-1) が呼ばれること', async () => {
        const user = userEvent.setup();
        mockFetchIndex.mockResolvedValue({ ok: true, data: mockIndexData });

        renderWithRoute('nonexistent');

        await waitFor(() => {
            expect(screen.getByText('戻る')).toBeInTheDocument();
        });

        await user.click(screen.getByText('戻る'));
        expect(mockNavigate).toHaveBeenCalledWith(-1);
    });

    it('アンマウント時にクリーンアップが実行されること', () => {
        mockFetchIndex.mockReturnValue(new Promise(() => {}));

        const { unmount } = renderWithRoute('org1');
        unmount();
        // クリーンアップ関数が実行されてエラーにならないことを確認
    });
});

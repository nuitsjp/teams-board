import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { MemberDetailPage } from '../../../../src/pages/MemberDetailPage.jsx';

const mockFetchMemberTermSummary = vi.fn();

vi.mock('../../../../src/services/member-term-summary.js', () => ({
    fetchMemberTermSummary: (...args) => mockFetchMemberTermSummary(...args),
}));

vi.mock('../../../../src/services/shared-data-fetcher.js', () => ({
    sharedDataFetcher: {},
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return { ...actual, useNavigate: () => mockNavigate };
});

const summaryData = {
    member: {
        id: 'm1',
        name: '佐藤 一郎',
        totalDurationSeconds: 5400,
        sessionRevisions: ['g1-2025-10-15/0', 'g2-2025-11-20/0'],
    },
    totalInstructorSessions: 1,
    periods: [
        {
            label: '2025年度 下期',
            termKey: '20251',
            totalSessions: 2,
            totalDurationSeconds: 5400,
            totalInstructorSessions: 1,
            groups: [
                {
                    groupId: 'g1',
                    groupName: 'フロントエンド勉強会',
                    organizerName: '技術推進室',
                    sessionCount: 1,
                    instructorSessionCount: 1,
                    hasInstructorSession: true,
                    totalDurationSeconds: 1800,
                    sessions: [],
                },
                {
                    groupId: 'g2',
                    groupName: 'TypeScript読書会',
                    organizerName: null,
                    sessionCount: 1,
                    instructorSessionCount: 0,
                    hasInstructorSession: false,
                    totalDurationSeconds: 3600,
                    sessions: [],
                },
            ],
        },
        {
            label: '2025年度 上期',
            termKey: '20250',
            totalSessions: 1,
            totalDurationSeconds: 2400,
            totalInstructorSessions: 0,
            groups: [
                {
                    groupId: 'g3',
                    groupName: '設計レビュー会',
                    organizerName: null,
                    sessionCount: 1,
                    instructorSessionCount: 0,
                    hasInstructorSession: false,
                    totalDurationSeconds: 2400,
                    sessions: [],
                },
            ],
        },
    ],
};

function renderWithRouter(memberId = 'm1') {
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
        mockFetchMemberTermSummary.mockReturnValue(new Promise(() => {}));

        renderWithRouter();

        expect(screen.getByText('読み込み中…')).toBeInTheDocument();
    });

    it('期ごとのグループ一覧を表示すること', async () => {
        mockFetchMemberTermSummary.mockResolvedValue({ ok: true, data: summaryData });

        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByText('佐藤 一郎')).toBeInTheDocument();
        });

        expect(screen.getByText('2025年度 下期')).toBeInTheDocument();
        expect(screen.getByText('フロントエンド勉強会')).toBeInTheDocument();
        expect(screen.getByText('技術推進室')).toBeInTheDocument();
        expect(screen.getByText('TypeScript読書会')).toBeInTheDocument();
        expect(screen.getAllByText(/講師/).length).toBeGreaterThan(0);
    });

    it('期を切り替えるとグループ一覧が切り替わること', async () => {
        const user = userEvent.setup();
        mockFetchMemberTermSummary.mockResolvedValue({ ok: true, data: summaryData });

        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByText('フロントエンド勉強会')).toBeInTheDocument();
        });

        await user.click(screen.getByRole('button', { name: /2025年度 上期/ }));

        expect(screen.getByText('設計レビュー会')).toBeInTheDocument();
        expect(screen.queryByText('TypeScript読書会')).not.toBeInTheDocument();
    });

    it('グループ行クリックで期詳細画面へ遷移すること', async () => {
        const user = userEvent.setup();
        mockFetchMemberTermSummary.mockResolvedValue({ ok: true, data: summaryData });

        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByText('フロントエンド勉強会')).toBeInTheDocument();
        });

        await user.click(screen.getAllByTestId('member-term-group-row')[0]);

        expect(mockNavigate).toHaveBeenCalledWith('/members/m1/groups/g1/terms/20251');
    });

    it('取得失敗時にエラーを表示すること', async () => {
        mockFetchMemberTermSummary.mockResolvedValue({
            ok: false,
            error: '参加者が見つかりません',
        });

        renderWithRouter('unknown');

        await waitFor(() => {
            expect(screen.getByText('参加者が見つかりません')).toBeInTheDocument();
        });
    });
});

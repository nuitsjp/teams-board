import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { MemberGroupTermDetailPage } from '../../../../src/pages/MemberGroupTermDetailPage.jsx';

const mockFetchMemberTermSummary = vi.fn();
const mockFetchGroupTermDetail = vi.fn();
const mockFetchMemberGroupTermDetail = vi.fn();
const mockSaveMemberGroupTermDetail = vi.fn();
const mockDeleteMemberGroupTermDetail = vi.fn();
const mockValidateTermDetail = vi.fn(() => null);

vi.mock('../../../../src/services/member-term-summary.js', () => ({
    fetchMemberTermSummary: (...args) => mockFetchMemberTermSummary(...args),
    findMemberTermGroup: (periods, termKey, groupId) => {
        const selectedPeriod = periods.find((period) => period.termKey === String(termKey));
        if (!selectedPeriod) {
            return null;
        }

        const selectedGroup = selectedPeriod.groups.find((group) => group.groupId === groupId);
        if (!selectedGroup) {
            return null;
        }

        return { selectedPeriod, selectedGroup };
    },
}));

vi.mock('../../../../src/services/shared-data-fetcher.js', () => ({
    sharedDataFetcher: {},
}));

vi.mock('../../../../src/services/term-detail-service.js', () => ({
    createEmptyTermDetail: () => ({
        purpose: '',
        learningContent: '',
        learningOutcome: '',
        references: [],
    }),
    fetchGroupTermDetail: (...args) => mockFetchGroupTermDetail(...args),
    fetchMemberGroupTermDetail: (...args) => mockFetchMemberGroupTermDetail(...args),
    saveMemberGroupTermDetail: (...args) => mockSaveMemberGroupTermDetail(...args),
    deleteMemberGroupTermDetail: (...args) => mockDeleteMemberGroupTermDetail(...args),
    validateTermDetail: (...args) => mockValidateTermDetail(...args),
    hasTermDetailContent: (detail) =>
        Boolean(
            detail &&
                ((detail.purpose ?? '').trim() ||
                    (detail.learningContent ?? '').trim() ||
                    (detail.learningOutcome ?? '').trim() ||
                    (detail.references ?? []).some(
                        (reference) =>
                            (reference.title ?? '').trim() ||
                            (reference.url ?? '').trim()
                    ))
        ),
}));

const mockAuth = { sasToken: null, isAdmin: false };
vi.mock('../../../../src/hooks/useAuth.jsx', () => ({
    useAuth: () => mockAuth,
    createAuthAdapter: (auth) => ({
        getSasToken: () => auth.sasToken,
        isAdminMode: () => auth.sasToken !== null,
    }),
}));

const mockBlobStorage = {};
vi.mock('../../../../src/services/blob-storage.js', () => ({
    AzureBlobStorage: vi.fn().mockImplementation(() => mockBlobStorage),
    DevBlobStorage: vi.fn().mockImplementation(() => mockBlobStorage),
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
        sessionRevisions: ['g1-2025-10-15/0'],
    },
    periods: [
        {
            label: '2025年度 下期',
            termKey: '20251',
            groups: [
                {
                    groupId: 'g1',
                    groupName: 'フロントエンド勉強会',
                    totalDurationSeconds: 5400,
                    sessionCount: 2,
                    sessions: [
                        {
                            sessionId: 's2',
                            date: '2026-01-20',
                            title: '振り返り会',
                            durationSeconds: 1800,
                            isInstructor: true,
                        },
                        {
                            sessionId: 's1',
                            date: '2025-10-15',
                            title: '',
                            durationSeconds: 3600,
                            isInstructor: false,
                        },
                    ],
                },
            ],
        },
    ],
};

const commonDetail = {
    purpose: '期の目的',
    learningContent: '',
    learningOutcome: '',
    references: [],
};

const memberDetail = {
    purpose: '個人の目的',
    learningContent: 'React の学習',
    learningOutcome: '',
    references: [{ title: '資料', url: 'https://example.com/doc' }],
};

function renderWithRouter(path = '/members/m1/groups/g1/terms/20251') {
    return render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route
                    path="/members/:memberId/groups/:groupId/terms/:termKey"
                    element={<MemberGroupTermDetailPage />}
                />
            </Routes>
        </MemoryRouter>
    );
}

describe('MemberGroupTermDetailPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockAuth.sasToken = null;
        mockAuth.isAdmin = false;
        mockFetchMemberTermSummary.mockResolvedValue({ ok: true, data: summaryData });
        mockFetchGroupTermDetail.mockResolvedValue({ ok: true, data: commonDetail });
        mockFetchMemberGroupTermDetail.mockResolvedValue({ ok: true, data: memberDetail });
        mockSaveMemberGroupTermDetail.mockResolvedValue({ success: true });
        mockDeleteMemberGroupTermDetail.mockResolvedValue({ success: true });
    });

    it('基本情報と詳細情報を表示し、詳細情報がセッション一覧より先にあること', async () => {
        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByText('佐藤 一郎')).toBeInTheDocument();
        });

        expect(screen.getByText('フロントエンド勉強会')).toBeInTheDocument();
        expect(screen.getByText('2025年度 下期')).toBeInTheDocument();
        expect(screen.getByText('2026-01-20')).toBeInTheDocument();
        expect(screen.getAllByText('講師').length).toBeGreaterThan(0);
        expect(screen.getByRole('button', { name: '共通情報' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'メンバー情報' })).toBeInTheDocument();

        const detailHeading = screen.getByRole('heading', { name: '詳細情報' });
        const sessionHeading = screen.getByRole('heading', { name: 'セッション一覧' });
        expect(
            detailHeading.compareDocumentPosition(sessionHeading) & Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy();
    });

    it('詳細未登録かつ token ありの場合に追加ボタンを表示すること', async () => {
        mockAuth.sasToken = 'dev';
        mockAuth.isAdmin = true;
        mockFetchGroupTermDetail.mockResolvedValue({ ok: true, data: null });
        mockFetchMemberGroupTermDetail.mockResolvedValue({ ok: true, data: null });

        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByText('登録された詳細情報はありません')).toBeInTheDocument();
        });

        expect(screen.getByRole('button', { name: '＋ メンバー情報を追加' })).toBeInTheDocument();
    });

    it('メンバー情報を保存できること', async () => {
        const user = userEvent.setup();
        mockAuth.sasToken = 'dev';
        mockAuth.isAdmin = true;
        mockFetchMemberGroupTermDetail.mockResolvedValue({ ok: true, data: null });
        mockFetchGroupTermDetail.mockResolvedValue({ ok: true, data: null });

        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByRole('button', { name: '＋ メンバー情報を追加' })).toBeInTheDocument();
        });

        await user.click(screen.getByRole('button', { name: '＋ メンバー情報を追加' }));
        await user.type(screen.getByLabelText('セッションの目的'), '学習目標');
        await user.click(screen.getByRole('button', { name: '保存' }));

        await waitFor(() => {
            expect(mockSaveMemberGroupTermDetail).toHaveBeenCalled();
        });
        expect(screen.getByText('メンバー情報を保存しました')).toBeInTheDocument();
    });

    it('メンバー情報を削除できること', async () => {
        const user = userEvent.setup();
        mockAuth.sasToken = 'dev';
        mockAuth.isAdmin = true;

        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'メンバー情報' })).toBeInTheDocument();
        });

        await user.click(screen.getByRole('button', { name: 'メンバー情報' }));
        await user.click(screen.getAllByRole('button', { name: '削除' })[0]);
        const dialog = screen.getByRole('dialog');
        await user.click(within(dialog).getByRole('button', { name: '削除' }));

        await waitFor(() => {
            expect(mockDeleteMemberGroupTermDetail).toHaveBeenCalled();
        });
        expect(screen.getByText('メンバー情報を削除しました')).toBeInTheDocument();
    });
});

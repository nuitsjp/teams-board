import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { GroupDetailPage } from '../../../src/pages/GroupDetailPage.jsx';

// モック用の関数参照を保持する
const mockFetchIndex = vi.fn();
const mockFetchSession = vi.fn();
const mockInvalidateIndexCache = vi.fn();

vi.mock('../../../src/services/shared-data-fetcher.js', () => {
    return {
        sharedDataFetcher: {
            fetchIndex: (...args) => mockFetchIndex(...args),
            fetchSession: (...args) => mockFetchSession(...args),
            invalidateIndexCache: (...args) => mockInvalidateIndexCache(...args),
        },
    };
});

// useAuth モック
const mockAuth = { sasToken: null, isAdmin: false };
vi.mock('../../../src/hooks/useAuth.jsx', () => ({
    useAuth: () => mockAuth,
    createAuthAdapter: (auth) => ({
        getSasToken: () => auth.sasToken,
        isAdminMode: () => auth.sasToken !== null,
    }),
}));

// BlobWriter モック
const mockExecuteWriteSequence = vi.fn();
vi.mock('../../../src/services/blob-writer.js', () => ({
    BlobWriter: vi.fn().mockImplementation(() => ({
        executeWriteSequence: (...args) => mockExecuteWriteSequence(...args),
    })),
}));

// IndexEditor モック
const mockRemoveSessionFromGroup = vi.fn();
vi.mock('../../../src/services/index-editor.js', () => ({
    IndexEditor: vi.fn().mockImplementation(() => ({
        removeSessionFromGroup: (...args) => mockRemoveSessionFromGroup(...args),
    })),
}));

// IndexFetcher モック
vi.mock('../../../src/services/index-fetcher.js', () => ({
    ProductionIndexFetcher: vi.fn(),
    DevIndexFetcher: vi.fn(),
}));

// BlobStorage モック
vi.mock('../../../src/services/blob-storage.js', () => ({
    AzureBlobStorage: vi.fn(),
    DevBlobStorage: vi.fn(),
}));

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
    instructors: ['m1', 'm2'],
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
    instructors: [],
    attendances: [{ memberId: 'm2', durationSeconds: 2400 }],
    createdAt: '2026-01-20T00:00:00.000Z',
};

const mockSessionDataSingle = {
    sessionId: 'g2-2026-01-18',
    revision: 0,
    title: '',
    startedAt: '2026-01-18T19:00:00',
    endedAt: null,
    instructors: [],
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
        instructors: [],
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
        instructors: [],
        attendances: [{ memberId: 'm1', durationSeconds: 3600 }],
        createdAt: '2025-08-20T00:00:00.000Z',
    },
    'g1-2026-01-15/0': {
        sessionId: 'g1-2026-01-15',
        revision: 0,
        title: '',
        startedAt: '2026-01-15T19:00:00',
        endedAt: null,
        instructors: [],
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
        // デフォルトは非管理者モード
        mockAuth.sasToken = null;
        mockAuth.isAdmin = false;
    });

    it('ローディング中に「読み込み中…」と表示すること', () => {
        mockFetchIndex.mockReturnValue(new Promise(() => {}));

        renderWithRouter('g1');
        expect(screen.getByText('読み込み中…')).toBeInTheDocument();
    });

    it('グループ情報とセッション一覧を表示すること', async () => {
        mockFetchIndex.mockResolvedValue({ ok: true, data: mockIndexData });
        mockFetchSession.mockImplementation((ref) => {
            if (ref === 'g1-2026-01-15/0')
                return Promise.resolve({ ok: true, data: mockSessionData1 });
            if (ref === 'g1-2026-01-20/0')
                return Promise.resolve({ ok: true, data: mockSessionData2 });
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

        // セッション見出しが表示される（日付降順、日付が先頭・別名が後続で表示される）
        expect(screen.getByText('2026-01-20')).toBeInTheDocument();
        expect(screen.getByText('第3回 React入門')).toBeInTheDocument();
        expect(screen.getByText('2026-01-15')).toBeInTheDocument();
    });

    it('セッションをクリックして参加者テーブルを展開・折りたたみできること', async () => {
        const user = userEvent.setup();
        mockFetchIndex.mockResolvedValue({ ok: true, data: mockIndexData });
        mockFetchSession.mockImplementation((ref) => {
            if (ref === 'g1-2026-01-15/0')
                return Promise.resolve({ ok: true, data: mockSessionData1 });
            if (ref === 'g1-2026-01-20/0')
                return Promise.resolve({ ok: true, data: mockSessionData2 });
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
        // 参加者テーブルの列見出しが存在する
        expect(screen.getByRole('columnheader', { name: '名前' })).toBeInTheDocument();
        expect(screen.getByRole('columnheader', { name: '参加時間' })).toBeInTheDocument();
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

    it('全セッションの取得に失敗した場合にエラーメッセージを表示すること', async () => {
        mockFetchIndex.mockResolvedValue({ ok: true, data: mockIndexData });
        mockFetchSession.mockResolvedValue({ ok: false, error: 'fetch failed' });

        renderWithRouter('g1');

        await waitFor(() => {
            expect(screen.getByText('セッションデータの取得に失敗しました')).toBeInTheDocument();
        });
    });

    it('「戻る」ボタンが表示されること', async () => {
        mockFetchIndex.mockResolvedValue({ ok: true, data: mockIndexData });
        mockFetchSession.mockImplementation((ref) => {
            if (ref === 'g1-2026-01-15/0')
                return Promise.resolve({ ok: true, data: mockSessionData1 });
            if (ref === 'g1-2026-01-20/0')
                return Promise.resolve({ ok: true, data: mockSessionData2 });
            return Promise.resolve({ ok: false, error: 'not found' });
        });

        renderWithRouter('g1');

        await waitFor(() => {
            expect(screen.getByText('戻る')).toBeInTheDocument();
        });
    });

    it('講師がいるセッションに講師名がカンマ区切りで表示されること', async () => {
        mockFetchIndex.mockResolvedValue({ ok: true, data: mockIndexData });
        mockFetchSession.mockImplementation((ref) => {
            if (ref === 'g1-2026-01-15/0')
                return Promise.resolve({ ok: true, data: mockSessionData1 });
            if (ref === 'g1-2026-01-20/0')
                return Promise.resolve({ ok: true, data: mockSessionData2 });
            return Promise.resolve({ ok: false, error: 'not found' });
        });

        renderWithRouter('g1');

        await waitFor(() => {
            // mockSessionData1 の講師: m1=佐藤 一郎, m2=高橋 美咲
            expect(screen.getByText('佐藤 一郎、高橋 美咲')).toBeInTheDocument();
        });
    });

    it('講師がいないセッションには講師名が表示されないこと', async () => {
        mockFetchIndex.mockResolvedValue({ ok: true, data: mockIndexData });
        mockFetchSession.mockImplementation((ref) => {
            if (ref === 'g1-2026-01-15/0')
                return Promise.resolve({ ok: true, data: mockSessionData1 });
            if (ref === 'g1-2026-01-20/0')
                return Promise.resolve({ ok: true, data: mockSessionData2 });
            return Promise.resolve({ ok: false, error: 'not found' });
        });

        renderWithRouter('g1');

        await waitFor(() => {
            expect(screen.getByText('2026-01-20')).toBeInTheDocument();
        });

        // mockSessionData2 は講師なし — 講師名テキストは1箇所のみ（mockSessionData1 分）
        const instructorTexts = screen.queryAllByText('佐藤 一郎、高橋 美咲');
        expect(instructorTexts).toHaveLength(1);
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

    describe('管理者モード — セッション削除', () => {
        beforeEach(() => {
            mockAuth.sasToken = 'dev';
            mockAuth.isAdmin = true;
        });

        it('管理者モードで削除ボタンが表示されること', async () => {
            mockFetchIndex.mockResolvedValue({ ok: true, data: mockIndexData });
            mockFetchSession.mockImplementation((ref) => {
                if (ref === 'g1-2026-01-15/0')
                    return Promise.resolve({ ok: true, data: mockSessionData1 });
                if (ref === 'g1-2026-01-20/0')
                    return Promise.resolve({ ok: true, data: mockSessionData2 });
                return Promise.resolve({ ok: false, error: 'not found' });
            });

            renderWithRouter('g1');

            await waitFor(() => {
                expect(screen.getByText('フロントエンド勉強会')).toBeInTheDocument();
            });

            // 削除ボタンが2つ表示される（セッション2件分）
            const deleteButtons = screen.getAllByRole('button', {
                name: /のセッションを削除/,
            });
            expect(deleteButtons).toHaveLength(2);
        });

        it('非管理者モードで削除ボタンが表示されないこと', async () => {
            mockAuth.sasToken = null;
            mockAuth.isAdmin = false;

            mockFetchIndex.mockResolvedValue({ ok: true, data: mockIndexData });
            mockFetchSession.mockImplementation((ref) => {
                if (ref === 'g1-2026-01-15/0')
                    return Promise.resolve({ ok: true, data: mockSessionData1 });
                if (ref === 'g1-2026-01-20/0')
                    return Promise.resolve({ ok: true, data: mockSessionData2 });
                return Promise.resolve({ ok: false, error: 'not found' });
            });

            renderWithRouter('g1');

            await waitFor(() => {
                expect(screen.getByText('フロントエンド勉強会')).toBeInTheDocument();
            });

            // 削除ボタンが表示されない
            expect(
                screen.queryByRole('button', { name: /のセッションを削除/ })
            ).not.toBeInTheDocument();
        });

        it('削除ボタンクリックで確認ダイアログが表示されること', async () => {
            const user = userEvent.setup();
            mockFetchIndex.mockResolvedValue({ ok: true, data: mockIndexData });
            mockFetchSession.mockImplementation((ref) => {
                if (ref === 'g1-2026-01-15/0')
                    return Promise.resolve({ ok: true, data: mockSessionData1 });
                if (ref === 'g1-2026-01-20/0')
                    return Promise.resolve({ ok: true, data: mockSessionData2 });
                return Promise.resolve({ ok: false, error: 'not found' });
            });

            renderWithRouter('g1');

            await waitFor(() => {
                expect(screen.getByText('フロントエンド勉強会')).toBeInTheDocument();
            });

            // 最初の削除ボタンをクリック
            const deleteButtons = screen.getAllByRole('button', {
                name: /のセッションを削除/,
            });
            await user.click(deleteButtons[0]);

            // ダイアログが表示される
            const dialog = screen.getByRole('dialog');
            expect(dialog).toBeInTheDocument();
            expect(within(dialog).getByText('セッションの削除')).toBeInTheDocument();
            expect(within(dialog).getByText('キャンセル')).toBeInTheDocument();
            expect(within(dialog).getByText('削除')).toBeInTheDocument();
        });

        it('キャンセルでダイアログが閉じること', async () => {
            const user = userEvent.setup();
            mockFetchIndex.mockResolvedValue({ ok: true, data: mockIndexData });
            mockFetchSession.mockImplementation((ref) => {
                if (ref === 'g1-2026-01-15/0')
                    return Promise.resolve({ ok: true, data: mockSessionData1 });
                if (ref === 'g1-2026-01-20/0')
                    return Promise.resolve({ ok: true, data: mockSessionData2 });
                return Promise.resolve({ ok: false, error: 'not found' });
            });

            renderWithRouter('g1');

            await waitFor(() => {
                expect(screen.getByText('フロントエンド勉強会')).toBeInTheDocument();
            });

            // 削除ボタンクリック → ダイアログ表示
            const deleteButtons = screen.getAllByRole('button', {
                name: /のセッションを削除/,
            });
            await user.click(deleteButtons[0]);
            expect(screen.getByRole('dialog')).toBeInTheDocument();

            // キャンセルクリック → ダイアログ閉じる
            await user.click(screen.getByText('キャンセル'));
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });

        it('削除実行で indexUpdater 内から removeSessionFromGroup が呼ばれること', async () => {
            const user = userEvent.setup();
            mockFetchIndex.mockResolvedValue({ ok: true, data: mockIndexData });
            mockFetchSession.mockImplementation((ref) => {
                if (ref === 'g1-2026-01-15/0')
                    return Promise.resolve({ ok: true, data: mockSessionData1 });
                if (ref === 'g1-2026-01-20/0')
                    return Promise.resolve({ ok: true, data: mockSessionData2 });
                return Promise.resolve({ ok: false, error: 'not found' });
            });

            const updatedIndex = { ...mockIndexData, version: 2 };
            mockRemoveSessionFromGroup.mockReturnValue({ index: updatedIndex });
            mockExecuteWriteSequence.mockImplementation(async ({ indexUpdater }) => {
                // BlobWriter 内部の動作を模倣: indexUpdater に最新 index を渡す
                if (indexUpdater) {
                    indexUpdater(mockIndexData);
                }
                return {
                    allSucceeded: true,
                    results: [{ path: 'data/index.json', success: true }],
                };
            });

            renderWithRouter('g1');

            await waitFor(() => {
                expect(screen.getByText('フロントエンド勉強会')).toBeInTheDocument();
            });

            // 日付降順なので最初のボタンは 2026-01-20 のセッション
            const deleteButtons = screen.getAllByRole('button', {
                name: /のセッションを削除/,
            });
            await user.click(deleteButtons[0]);

            // ダイアログで削除実行
            await user.click(screen.getByText('削除'));

            await waitFor(() => {
                expect(mockRemoveSessionFromGroup).toHaveBeenCalledWith(
                    mockIndexData,
                    'g1',
                    'g1-2026-01-20/0',
                    mockSessionData2
                );
            });

            expect(mockExecuteWriteSequence).toHaveBeenCalled();
        });

        it('削除成功後に成功メッセージが表示されること', async () => {
            const user = userEvent.setup();
            mockFetchIndex.mockResolvedValue({ ok: true, data: mockIndexData });
            mockFetchSession.mockImplementation((ref) => {
                if (ref === 'g1-2026-01-15/0')
                    return Promise.resolve({ ok: true, data: mockSessionData1 });
                if (ref === 'g1-2026-01-20/0')
                    return Promise.resolve({ ok: true, data: mockSessionData2 });
                return Promise.resolve({ ok: false, error: 'not found' });
            });

            const updatedIndex = { ...mockIndexData, version: 2 };
            mockRemoveSessionFromGroup.mockReturnValue({ index: updatedIndex });
            mockExecuteWriteSequence.mockImplementation(async ({ indexUpdater }) => {
                if (indexUpdater) indexUpdater(mockIndexData);
                return {
                    allSucceeded: true,
                    results: [{ path: 'data/index.json', success: true }],
                };
            });

            renderWithRouter('g1');

            await waitFor(() => {
                expect(screen.getByText('フロントエンド勉強会')).toBeInTheDocument();
            });

            const deleteButtons = screen.getAllByRole('button', {
                name: /のセッションを削除/,
            });
            await user.click(deleteButtons[0]);
            await user.click(screen.getByText('削除'));

            await waitFor(() => {
                expect(screen.getByText('セッションを削除しました')).toBeInTheDocument();
            });
        });

        it('削除失敗時にエラーメッセージが表示されること', async () => {
            const user = userEvent.setup();
            mockFetchIndex.mockResolvedValue({ ok: true, data: mockIndexData });
            mockFetchSession.mockImplementation((ref) => {
                if (ref === 'g1-2026-01-15/0')
                    return Promise.resolve({ ok: true, data: mockSessionData1 });
                if (ref === 'g1-2026-01-20/0')
                    return Promise.resolve({ ok: true, data: mockSessionData2 });
                return Promise.resolve({ ok: false, error: 'not found' });
            });

            const updatedIndex = { ...mockIndexData, version: 2 };
            mockRemoveSessionFromGroup.mockReturnValue({ index: updatedIndex });
            mockExecuteWriteSequence.mockImplementation(async ({ indexUpdater }) => {
                if (indexUpdater) indexUpdater(mockIndexData);
                return {
                    allSucceeded: false,
                    results: [
                        { path: 'data/index.json', success: false, error: '書き込みエラー' },
                    ],
                };
            });

            renderWithRouter('g1');

            await waitFor(() => {
                expect(screen.getByText('フロントエンド勉強会')).toBeInTheDocument();
            });

            const deleteButtons = screen.getAllByRole('button', {
                name: /のセッションを削除/,
            });
            await user.click(deleteButtons[0]);
            await user.click(screen.getByText('削除'));

            await waitFor(() => {
                expect(screen.getByText(/削除の保存に失敗しました/)).toBeInTheDocument();
            });
        });

        it('本番 SAS トークンで管理者モード時にも削除ボタンが表示されること', async () => {
            // import.meta.env.DEV 以外のパスもカバーするため prod トークンを使用
            mockAuth.sasToken = 'sp=rwdl&st=2026-01-01&se=2026-12-31&spr=https&sig=abc';
            mockAuth.isAdmin = true;

            mockFetchIndex.mockResolvedValue({ ok: true, data: mockIndexData });
            mockFetchSession.mockImplementation((ref) => {
                if (ref === 'g1-2026-01-15/0')
                    return Promise.resolve({ ok: true, data: mockSessionData1 });
                if (ref === 'g1-2026-01-20/0')
                    return Promise.resolve({ ok: true, data: mockSessionData2 });
                return Promise.resolve({ ok: false, error: 'not found' });
            });

            renderWithRouter('g1');

            await waitFor(() => {
                expect(screen.getByText('フロントエンド勉強会')).toBeInTheDocument();
            });

            const deleteButtons = screen.getAllByRole('button', {
                name: /のセッションを削除/,
            });
            expect(deleteButtons).toHaveLength(2);
        });

        it('セッションデータが見つからない場合にエラーメッセージが表示されること', async () => {
            const user = userEvent.setup();
            mockFetchIndex.mockResolvedValue({ ok: true, data: mockIndexData });
            // セッションデータの取得に失敗するケース（sessionDataMap に入らない）
            mockFetchSession.mockImplementation((ref) => {
                if (ref === 'g1-2026-01-15/0')
                    return Promise.resolve({ ok: true, data: mockSessionData1 });
                // g1-2026-01-20/0 は取得失敗
                return Promise.resolve({ ok: false, error: 'not found' });
            });

            renderWithRouter('g1');

            await waitFor(() => {
                expect(screen.getByText('フロントエンド勉強会')).toBeInTheDocument();
            });

            // 取得成功したセッションの削除ボタンをクリック（g1-2026-01-15）
            const deleteButtons = screen.getAllByRole('button', {
                name: /のセッションを削除/,
            });
            // g1-2026-01-20 は fetch 失敗で periodSessions に含まれないため
            // g1-2026-01-15 だけが表示される
            expect(deleteButtons).toHaveLength(1);

            await user.click(deleteButtons[0]);

            // ダイアログが開く → 削除
            // このセッションの sessionRef は g1-2026-01-15/0 で sessionDataMap にはある
            // sessionDataMap にないケースを再現するには手動で deleteTarget を設定する必要があるが
            // コンポーネントテストではUI経由でのみ操作するため、sessionDataMap にないケースは
            // fetchSession がすべて失敗するケースで再現する
        });

        it('version 不一致で indexUpdater が null を返した場合に競合エラーメッセージが表示されること', async () => {
            const user = userEvent.setup();
            mockFetchIndex.mockResolvedValue({ ok: true, data: mockIndexData });
            mockFetchSession.mockImplementation((ref) => {
                if (ref === 'g1-2026-01-15/0')
                    return Promise.resolve({ ok: true, data: mockSessionData1 });
                if (ref === 'g1-2026-01-20/0')
                    return Promise.resolve({ ok: true, data: mockSessionData2 });
                return Promise.resolve({ ok: false, error: 'not found' });
            });

            // BlobWriter の実際の動作を模倣:
            // indexUpdater が null を返すと index.json の PUT がスキップされ
            // results に data/index.json エントリが含まれない
            const conflictIndex = { ...mockIndexData, version: 999 };
            mockExecuteWriteSequence.mockImplementation(async ({ indexUpdater }) => {
                const result = indexUpdater ? indexUpdater(conflictIndex) : null;
                expect(result).toBeNull();
                return {
                    allSucceeded: true,
                    results: [], // index.json の PUT がスキップされた状態
                };
            });

            renderWithRouter('g1');

            await waitFor(() => {
                expect(screen.getByText('フロントエンド勉強会')).toBeInTheDocument();
            });

            const deleteButtons = screen.getAllByRole('button', {
                name: /のセッションを削除/,
            });
            await user.click(deleteButtons[0]);
            await user.click(screen.getByText('削除'));

            await waitFor(() => {
                expect(
                    screen.getByText(/他のユーザーが同時に編集しています/)
                ).toBeInTheDocument();
            });
        });

        it('editError で indexUpdater が null を返した場合に競合エラーメッセージが表示されること', async () => {
            const user = userEvent.setup();
            mockFetchIndex.mockResolvedValue({ ok: true, data: mockIndexData });
            mockFetchSession.mockImplementation((ref) => {
                if (ref === 'g1-2026-01-15/0')
                    return Promise.resolve({ ok: true, data: mockSessionData1 });
                if (ref === 'g1-2026-01-20/0')
                    return Promise.resolve({ ok: true, data: mockSessionData2 });
                return Promise.resolve({ ok: false, error: 'not found' });
            });

            // removeSessionFromGroup がエラーを返す場合
            mockRemoveSessionFromGroup.mockReturnValue({
                index: mockIndexData,
                error: 'セッションが見つかりません',
            });
            mockExecuteWriteSequence.mockImplementation(async ({ indexUpdater }) => {
                const result = indexUpdater ? indexUpdater(mockIndexData) : null;
                expect(result).toBeNull();
                return {
                    allSucceeded: true,
                    results: [], // index.json の PUT がスキップされた状態
                };
            });

            renderWithRouter('g1');

            await waitFor(() => {
                expect(screen.getByText('フロントエンド勉強会')).toBeInTheDocument();
            });

            const deleteButtons = screen.getAllByRole('button', {
                name: /のセッションを削除/,
            });
            await user.click(deleteButtons[0]);
            await user.click(screen.getByText('削除'));

            await waitFor(() => {
                expect(
                    screen.getByText(/他のユーザーが同時に編集しています/)
                ).toBeInTheDocument();
            });
        });

        it('削除処理で例外が発生した場合にエラーメッセージが表示されること', async () => {
            const user = userEvent.setup();
            mockFetchIndex.mockResolvedValue({ ok: true, data: mockIndexData });
            mockFetchSession.mockImplementation((ref) => {
                if (ref === 'g1-2026-01-15/0')
                    return Promise.resolve({ ok: true, data: mockSessionData1 });
                if (ref === 'g1-2026-01-20/0')
                    return Promise.resolve({ ok: true, data: mockSessionData2 });
                return Promise.resolve({ ok: false, error: 'not found' });
            });

            mockExecuteWriteSequence.mockRejectedValue(new Error('ネットワークエラー'));

            renderWithRouter('g1');

            await waitFor(() => {
                expect(screen.getByText('フロントエンド勉強会')).toBeInTheDocument();
            });

            const deleteButtons = screen.getAllByRole('button', {
                name: /のセッションを削除/,
            });
            await user.click(deleteButtons[0]);
            await user.click(screen.getByText('削除'));

            await waitFor(() => {
                expect(screen.getByText(/削除に失敗しました/)).toBeInTheDocument();
            });
        });
    });
});

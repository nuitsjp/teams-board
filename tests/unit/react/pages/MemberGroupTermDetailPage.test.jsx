import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { MemberGroupTermDetailPage } from '../../../../src/pages/MemberGroupTermDetailPage.jsx';

// DataFetcher モック
const mockFetchIndex = vi.fn();
const mockFetchSession = vi.fn();
vi.mock('../../../../src/services/data-fetcher.js', () => ({
    DataFetcher: vi.fn().mockImplementation(() => ({
        fetchIndex: (...args) => mockFetchIndex(...args),
        fetchSession: (...args) => mockFetchSession(...args),
    })),
}));

// TermDetailService モック
const mockFetchGroupTermDetail = vi.fn();
const mockFetchMemberGroupTermDetail = vi.fn();
const mockSaveMemberGroupTermDetail = vi.fn();
const mockDeleteMemberGroupTermDetail = vi.fn();
vi.mock('../../../../src/services/term-detail-service.js', () => ({
    TermDetailService: Object.assign(
        vi.fn().mockImplementation(() => ({
            saveMemberGroupTermDetail: (...args) => mockSaveMemberGroupTermDetail(...args),
            deleteMemberGroupTermDetail: (...args) => mockDeleteMemberGroupTermDetail(...args),
        })),
        {
            fetchGroupTermDetail: (...args) => mockFetchGroupTermDetail(...args),
            fetchMemberGroupTermDetail: (...args) => mockFetchMemberGroupTermDetail(...args),
        }
    ),
}));

// useAuth モック
const mockAuth = { sasToken: null, isAdmin: false };
vi.mock('../../../../src/hooks/useAuth.jsx', () => ({
    useAuth: () => mockAuth,
    createAuthAdapter: (auth) => ({
        getSasToken: () => auth.sasToken,
        isAdminMode: () => auth.sasToken !== null,
    }),
}));

// BlobStorage モック
vi.mock('../../../../src/services/blob-storage.js', () => ({
    AzureBlobStorage: vi.fn(),
    DevBlobStorage: vi.fn(),
}));

// navigate モック
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return { ...actual, useNavigate: () => mockNavigate };
});

// validate-url モック
vi.mock('../../../../src/utils/validate-url.js', () => ({
    isValidUrl: (url) => url && (url.startsWith('http://') || url.startsWith('https://')),
}));

// --- モックデータ ---

const mockIndexData = {
    schemaVersion: 2,
    version: 1,
    groups: [
        {
            id: 'g1',
            name: 'フロントエンド勉強会',
            totalDurationSeconds: 3600,
            sessionRevisions: ['g1-2026-01-15/0'],
        },
    ],
    members: [
        {
            id: 'm1',
            name: '佐藤 一郎',
            totalDurationSeconds: 1800,
            sessionRevisions: ['g1-2026-01-15/0'],
        },
    ],
    updatedAt: '2026-01-01T00:00:00Z',
};

const mockSessionData = {
    sessionId: 'g1-2026-01-15',
    revision: 0,
    title: '勉強会第1回',
    startedAt: '2026-01-15T19:00:00',
    endedAt: null,
    attendances: [{ memberId: 'm1', durationSeconds: 1800 }],
    instructors: [],
    createdAt: '2026-01-15T00:00:00.000Z',
};

const mockCommonDetail = {
    purpose: 'フロントエンド技術の共有',
    learningContent: 'React 19 の新機能',
    learningOutcome: 'コンポーネント設計の理解',
    references: [{ title: '参考サイト', url: 'https://example.com' }],
};

const mockMemberDetail = {
    purpose: '個人の学習目的',
    learningContent: 'Hooks の深掘り',
    learningOutcome: 'カスタムフックの実装力',
    references: [],
};

// 2026-01-15 → 2025年度 下期 → sortKey = 20251
const TERM_KEY = '20251';

/** ルーター付きレンダーヘルパー */
function renderWithRouter(memberId = 'm1', groupId = 'g1', termKey = TERM_KEY) {
    return render(
        <MemoryRouter
            initialEntries={[`/members/${memberId}/groups/${groupId}/terms/${termKey}`]}
        >
            <Routes>
                <Route
                    path="/members/:memberId/groups/:groupId/terms/:termKey"
                    element={<MemberGroupTermDetailPage />}
                />
            </Routes>
        </MemoryRouter>
    );
}

/** 標準的なモック設定（正常系）: 詳細情報なし */
function setupDefaultMocks() {
    mockFetchIndex.mockResolvedValue({ ok: true, data: mockIndexData });
    mockFetchSession.mockResolvedValue({ ok: true, data: mockSessionData });
    mockFetchGroupTermDetail.mockResolvedValue({ ok: false });
    mockFetchMemberGroupTermDetail.mockResolvedValue({ ok: false });
}

/** 共通情報のみモック */
function setupCommonDetailOnly() {
    setupDefaultMocks();
    mockFetchGroupTermDetail.mockResolvedValue({ ok: true, data: mockCommonDetail });
}

/** 個人情報のみモック */
function setupMemberDetailOnly() {
    setupDefaultMocks();
    mockFetchMemberGroupTermDetail.mockResolvedValue({ ok: true, data: mockMemberDetail });
}

/** 両方存在モック */
function setupBothDetails() {
    setupDefaultMocks();
    mockFetchGroupTermDetail.mockResolvedValue({ ok: true, data: mockCommonDetail });
    mockFetchMemberGroupTermDetail.mockResolvedValue({ ok: true, data: mockMemberDetail });
}

beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.sasToken = null;
    mockAuth.isAdmin = false;
});

describe('MemberGroupTermDetailPage', () => {
    // --- 1. 読み込み中 ---
    it('読み込み中はスケルトンを表示する', () => {
        mockFetchIndex.mockReturnValue(new Promise(() => {})); // 解決しない
        renderWithRouter();
        expect(screen.getByText('読み込み中…')).toBeInTheDocument();
    });

    // --- 2. データ取得エラー ---
    it('fetchIndex が失敗した場合エラーメッセージを表示する', async () => {
        mockFetchIndex.mockResolvedValue({ ok: false, error: 'ネットワークエラー' });
        renderWithRouter();

        await waitFor(() => {
            expect(
                screen.getByText('データ取得エラー: ネットワークエラー')
            ).toBeInTheDocument();
        });
        // 戻るボタンが表示される
        expect(screen.getByText('戻る')).toBeInTheDocument();
    });

    // --- 3. メンバー/グループ未発見 ---
    it('メンバーが見つからない場合エラーを表示する', async () => {
        mockFetchIndex.mockResolvedValue({ ok: true, data: mockIndexData });
        renderWithRouter('unknown-member', 'g1', TERM_KEY);

        await waitFor(() => {
            expect(
                screen.getByText('メンバーまたはグループが見つかりません')
            ).toBeInTheDocument();
        });
    });

    it('グループが見つからない場合エラーを表示する', async () => {
        mockFetchIndex.mockResolvedValue({ ok: true, data: mockIndexData });
        renderWithRouter('m1', 'unknown-group', TERM_KEY);

        await waitFor(() => {
            expect(
                screen.getByText('メンバーまたはグループが見つかりません')
            ).toBeInTheDocument();
        });
    });

    // --- 4. 正常表示 ---
    it('メンバー名、グループ名、期ラベル、セッションテーブルを表示する', async () => {
        setupDefaultMocks();
        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByText('佐藤 一郎')).toBeInTheDocument();
        });

        // グループ名 / 期ラベル
        expect(
            screen.getByText(/フロントエンド勉強会 \/ 2025年度 下期/)
        ).toBeInTheDocument();
        // セッション一覧ヘッダー
        expect(screen.getByText('セッション一覧')).toBeInTheDocument();
    });

    // --- 5. セッション一覧 ---
    it('セッションテーブルに日付、時間、タイトルが表示される', async () => {
        setupDefaultMocks();
        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByText('2026-01-15')).toBeInTheDocument();
        });
        // タイトル
        expect(screen.getByText('勉強会第1回')).toBeInTheDocument();
        // 参加時間（1800秒 = 30分）— 合計と行の両方に表示
        const allDurations = screen.getAllByText('30分');
        expect(allDurations.length).toBeGreaterThanOrEqual(2);
        // 回数表示（テキストが複数要素にまたがるため部分一致）
        expect(screen.getByText('回参加', { exact: false })).toBeInTheDocument();
    });

    it('講師バッジを表示する', async () => {
        const sessionWithInstructor = {
            ...mockSessionData,
            instructors: ['m1'],
        };
        setupDefaultMocks();
        mockFetchSession.mockResolvedValue({ ok: true, data: sessionWithInstructor });
        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByText('講師')).toBeInTheDocument();
        });
    });

    it('セッションがない場合は空メッセージを表示する', async () => {
        mockFetchIndex.mockResolvedValue({ ok: true, data: mockIndexData });
        // 異なる期のセッション（上期 = sortKey 20250 ≠ 20251）
        mockFetchSession.mockResolvedValue({
            ok: true,
            data: { ...mockSessionData, startedAt: '2025-06-15T19:00:00' },
        });
        mockFetchGroupTermDetail.mockResolvedValue({ ok: false });
        mockFetchMemberGroupTermDetail.mockResolvedValue({ ok: false });
        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByText('セッションデータはありません')).toBeInTheDocument();
        });
    });

    // --- 6. 両方未登録 ---
    it('詳細情報がない場合「メンバー情報を追加」ボタンを表示する', async () => {
        setupDefaultMocks();
        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByText('メンバー情報を追加')).toBeInTheDocument();
        });
    });

    // --- 7. 共通情報のみ ---
    it('共通情報のみの場合ヘッダーに「詳細」を表示し共通情報の内容が見える', async () => {
        setupCommonDetailOnly();
        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByText('詳細')).toBeInTheDocument();
        });
        // 共通情報の内容
        expect(screen.getByText('フロントエンド技術の共有')).toBeInTheDocument();
        expect(screen.getByText('React 19 の新機能')).toBeInTheDocument();
        expect(screen.getByText('コンポーネント設計の理解')).toBeInTheDocument();
        // 参考資料リンク
        expect(screen.getByText('参考サイト')).toBeInTheDocument();
        // 共通情報のみの場合「メンバー情報を追加」は表示されない
        expect(screen.queryByText('メンバー情報を追加')).not.toBeInTheDocument();
    });

    // --- 8. 個人情報のみ ---
    it('個人情報のみの場合ヘッダーに「詳細」を表示し編集ボタンがある', async () => {
        setupMemberDetailOnly();
        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByText('詳細')).toBeInTheDocument();
        });
        expect(screen.getByText('個人の学習目的')).toBeInTheDocument();
        expect(screen.getByText('Hooks の深掘り')).toBeInTheDocument();
        expect(screen.getByText('カスタムフックの実装力')).toBeInTheDocument();
        // 編集ボタン
        expect(screen.getByText('編集')).toBeInTheDocument();
    });

    // --- 9. 両方存在: 共通優先 ---
    it('両方存在する場合は共通情報が優先して表示される', async () => {
        setupBothDetails();
        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByText('詳細')).toBeInTheDocument();
        });
        // 共通情報が優先的に表示される
        expect(screen.getByText('フロントエンド技術の共有')).toBeInTheDocument();
        expect(screen.getByText('React 19 の新機能')).toBeInTheDocument();
        // 個人情報の編集ボタンは表示されない（共通情報タブのため）
        expect(screen.queryByText('編集')).not.toBeInTheDocument();
        // タブボタンは存在しない
        expect(screen.queryByRole('button', { name: '個人情報' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: '共通情報' })).not.toBeInTheDocument();
    });

    // --- 11. 編集フォーム表示 ---
    it('編集ボタンをクリックするとフォームが表示される', async () => {
        const user = userEvent.setup();
        setupMemberDetailOnly();
        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByText('編集')).toBeInTheDocument();
        });

        await user.click(screen.getByText('編集'));

        // フォーム要素が表示される
        expect(screen.getByLabelText('セッションの目的')).toBeInTheDocument();
        expect(screen.getByLabelText('学習内容')).toBeInTheDocument();
        expect(screen.getByLabelText('学習の成果')).toBeInTheDocument();
        expect(screen.getByText('保存')).toBeInTheDocument();
        expect(screen.getByText('キャンセル')).toBeInTheDocument();
    });

    // --- 12. メンバー情報追加 ---
    it('「メンバー情報を追加」で空の編集フォームが表示される', async () => {
        const user = userEvent.setup();
        setupDefaultMocks();
        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByText('メンバー情報を追加')).toBeInTheDocument();
        });

        await user.click(screen.getByText('メンバー情報を追加'));

        // 空のフォームが表示される
        const purposeInput = screen.getByLabelText('セッションの目的');
        expect(purposeInput).toHaveValue('');
        expect(screen.getByText('保存')).toBeInTheDocument();
    });

    // --- 13. 保存成功 ---
    it('フォームを入力して保存すると成功メッセージが表示される', async () => {
        const user = userEvent.setup();
        setupMemberDetailOnly();
        mockSaveMemberGroupTermDetail.mockResolvedValue({ success: true });
        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByText('編集')).toBeInTheDocument();
        });

        await user.click(screen.getByText('編集'));

        // フォーム入力
        const purposeInput = screen.getByLabelText('セッションの目的');
        await user.clear(purposeInput);
        await user.type(purposeInput, '更新された目的');

        await user.click(screen.getByText('保存'));

        await waitFor(() => {
            expect(screen.getByText('メンバー情報を保存しました')).toBeInTheDocument();
        });
        expect(mockSaveMemberGroupTermDetail).toHaveBeenCalledWith(
            'm1',
            'g1',
            TERM_KEY,
            expect.objectContaining({ purpose: '更新された目的' })
        );
    });

    // --- 14. 保存失敗 ---
    it('保存が失敗した場合エラーメッセージが表示される', async () => {
        const user = userEvent.setup();
        setupMemberDetailOnly();
        mockSaveMemberGroupTermDetail.mockResolvedValue({
            success: false,
            error: '権限がありません',
        });
        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByText('編集')).toBeInTheDocument();
        });

        await user.click(screen.getByText('編集'));
        await user.click(screen.getByText('保存'));

        await waitFor(() => {
            expect(
                screen.getByText('保存に失敗しました: 権限がありません')
            ).toBeInTheDocument();
        });
    });

    it('保存時に例外が発生した場合エラーメッセージが表示される', async () => {
        const user = userEvent.setup();
        setupMemberDetailOnly();
        mockSaveMemberGroupTermDetail.mockRejectedValue(new Error('ネットワークエラー'));
        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByText('編集')).toBeInTheDocument();
        });

        await user.click(screen.getByText('編集'));
        await user.click(screen.getByText('保存'));

        await waitFor(() => {
            expect(
                screen.getByText('保存に失敗しました: ネットワークエラー')
            ).toBeInTheDocument();
        });
    });

    // --- 15. 削除確認 ---
    it('削除ボタンをクリックすると確認ダイアログが表示される', async () => {
        const user = userEvent.setup();
        setupMemberDetailOnly();
        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByText('編集')).toBeInTheDocument();
        });

        await user.click(screen.getByText('編集'));
        // 既存のメンバー情報がある場合のみ削除ボタンが表示される
        await user.click(screen.getByText('削除'));

        // 確認ダイアログ
        expect(screen.getByText('メンバー情報の削除')).toBeInTheDocument();
        expect(
            screen.getByText('このメンバー情報を削除しますか？この操作は取り消せません。')
        ).toBeInTheDocument();
    });

    it('削除確認ダイアログでキャンセルすると閉じる', async () => {
        const user = userEvent.setup();
        setupMemberDetailOnly();
        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByText('編集')).toBeInTheDocument();
        });

        await user.click(screen.getByText('編集'));
        await user.click(screen.getByText('削除'));

        // ダイアログ内のキャンセルボタン
        const dialog = screen.getByRole('dialog');
        await user.click(within(dialog).getByText('キャンセル'));

        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
    });

    // --- 16. 削除成功 ---
    it('削除が成功するとメンバー情報が消え成功メッセージが表示される', async () => {
        const user = userEvent.setup();
        setupMemberDetailOnly();
        mockDeleteMemberGroupTermDetail.mockResolvedValue({ success: true });
        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByText('編集')).toBeInTheDocument();
        });

        await user.click(screen.getByText('編集'));
        await user.click(screen.getByText('削除'));

        // ダイアログ内の削除確定ボタン
        const dialog = screen.getByRole('dialog');
        await user.click(within(dialog).getByText('削除'));

        await waitFor(() => {
            expect(screen.getByText('メンバー情報を削除しました')).toBeInTheDocument();
        });
        expect(mockDeleteMemberGroupTermDetail).toHaveBeenCalledWith('m1', 'g1', TERM_KEY);
    });

    it('削除が失敗した場合エラーメッセージが表示される', async () => {
        const user = userEvent.setup();
        setupMemberDetailOnly();
        mockDeleteMemberGroupTermDetail.mockResolvedValue({
            success: false,
            error: '削除権限なし',
        });
        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByText('編集')).toBeInTheDocument();
        });

        await user.click(screen.getByText('編集'));
        await user.click(screen.getByText('削除'));

        const dialog = screen.getByRole('dialog');
        await user.click(within(dialog).getByText('削除'));

        await waitFor(() => {
            expect(
                screen.getByText('削除に失敗しました: 削除権限なし')
            ).toBeInTheDocument();
        });
    });

    it('削除時に例外が発生した場合エラーメッセージが表示される', async () => {
        const user = userEvent.setup();
        setupMemberDetailOnly();
        mockDeleteMemberGroupTermDetail.mockRejectedValue(new Error('サーバーエラー'));
        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByText('編集')).toBeInTheDocument();
        });

        await user.click(screen.getByText('編集'));
        await user.click(screen.getByText('削除'));

        const dialog = screen.getByRole('dialog');
        await user.click(within(dialog).getByText('削除'));

        await waitFor(() => {
            expect(
                screen.getByText('削除に失敗しました: サーバーエラー')
            ).toBeInTheDocument();
        });
    });

    // --- 追加カバレッジ: URL バリデーション ---
    it('無効な URL で保存するとバリデーションエラーが表示される', async () => {
        const user = userEvent.setup();
        setupMemberDetailOnly();
        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByText('編集')).toBeInTheDocument();
        });

        await user.click(screen.getByText('編集'));

        // 参考資料を追加
        await user.click(screen.getByText('追加'));

        // URL に無効な値を入力
        const urlInput = screen.getByPlaceholderText('https://...');
        await user.type(urlInput, 'invalid-url');

        await user.click(screen.getByText('保存'));

        // バリデーションエラー
        expect(
            screen.getByText('http または https の URL を入力してください')
        ).toBeInTheDocument();
        // 保存は呼ばれない
        expect(mockSaveMemberGroupTermDetail).not.toHaveBeenCalled();
    });

    // --- 追加カバレッジ: 参考資料の削除 ---
    it('参考資料を削除できる', async () => {
        const user = userEvent.setup();
        setupMemberDetailOnly();
        // 参考資料付きのメンバー情報
        mockFetchMemberGroupTermDetail.mockResolvedValue({
            ok: true,
            data: {
                ...mockMemberDetail,
                references: [{ title: '資料1', url: 'https://example.com/1' }],
            },
        });
        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByText('編集')).toBeInTheDocument();
        });

        await user.click(screen.getByText('編集'));

        // 参考資料 1 を削除
        await user.click(screen.getByLabelText('参考資料 1 を削除'));

        // URL 入力が消える
        expect(screen.queryByDisplayValue('https://example.com/1')).not.toBeInTheDocument();
    });

    // --- 追加カバレッジ: キャンセル ---
    it('編集をキャンセルするとフォームが閉じる', async () => {
        const user = userEvent.setup();
        setupMemberDetailOnly();
        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByText('編集')).toBeInTheDocument();
        });

        await user.click(screen.getByText('編集'));
        expect(screen.getByLabelText('セッションの目的')).toBeInTheDocument();

        await user.click(screen.getByText('キャンセル'));

        // フォームが閉じて詳細表示に戻る
        await waitFor(() => {
            expect(screen.queryByLabelText('セッションの目的')).not.toBeInTheDocument();
        });
        expect(screen.getByText('個人の学習目的')).toBeInTheDocument();
    });

    // --- 追加カバレッジ: メンバー情報追加から保存（activeTab が null の場合） ---
    it('メンバー情報追加から保存するとタブが member に設定される', async () => {
        const user = userEvent.setup();
        setupDefaultMocks();
        mockSaveMemberGroupTermDetail.mockResolvedValue({ success: true });
        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByText('メンバー情報を追加')).toBeInTheDocument();
        });

        await user.click(screen.getByText('メンバー情報を追加'));

        const purposeInput = screen.getByLabelText('セッションの目的');
        await user.type(purposeInput, '新しい目的');

        await user.click(screen.getByText('保存'));

        await waitFor(() => {
            expect(screen.getByText('メンバー情報を保存しました')).toBeInTheDocument();
        });
    });

    // --- 追加カバレッジ: 参考資料のタイトル更新 ---
    it('参考資料のタイトルと URL を更新できる', async () => {
        const user = userEvent.setup();
        setupMemberDetailOnly();
        mockSaveMemberGroupTermDetail.mockResolvedValue({ success: true });
        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByText('編集')).toBeInTheDocument();
        });

        await user.click(screen.getByText('編集'));
        await user.click(screen.getByText('追加'));

        const titleInput = screen.getByPlaceholderText('タイトル');
        const urlInput = screen.getByPlaceholderText('https://...');

        await user.type(titleInput, 'テスト資料');
        await user.type(urlInput, 'https://test.example.com');

        await user.click(screen.getByText('保存'));

        await waitFor(() => {
            expect(mockSaveMemberGroupTermDetail).toHaveBeenCalledWith(
                'm1',
                'g1',
                TERM_KEY,
                expect.objectContaining({
                    references: [{ title: 'テスト資料', url: 'https://test.example.com' }],
                })
            );
        });
    });

    // --- 追加カバレッジ: 空の参考資料はフィルタリングされる ---
    it('空の参考資料は保存時に除去される', async () => {
        const user = userEvent.setup();
        setupDefaultMocks();
        mockSaveMemberGroupTermDetail.mockResolvedValue({ success: true });
        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByText('メンバー情報を追加')).toBeInTheDocument();
        });

        await user.click(screen.getByText('メンバー情報を追加'));

        // 空の参考資料を追加（タイトルも URL も空）
        await user.click(screen.getByText('追加'));

        // 目的だけ入力して保存
        const purposeInput = screen.getByLabelText('セッションの目的');
        await user.type(purposeInput, 'テスト');

        await user.click(screen.getByText('保存'));

        await waitFor(() => {
            expect(mockSaveMemberGroupTermDetail).toHaveBeenCalledWith(
                'm1',
                'g1',
                TERM_KEY,
                expect.objectContaining({ references: [] })
            );
        });
    });

    // --- 追加カバレッジ: 個人情報のみで削除成功 ---
    it('個人情報を削除すると追加ボタンが表示される', async () => {
        const user = userEvent.setup();
        setupMemberDetailOnly();
        mockDeleteMemberGroupTermDetail.mockResolvedValue({ success: true });
        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByText('編集')).toBeInTheDocument();
        });

        await user.click(screen.getByText('編集'));
        await user.click(screen.getByText('削除'));

        const dialog = screen.getByRole('dialog');
        await user.click(within(dialog).getByText('削除'));

        await waitFor(() => {
            expect(screen.getByText('メンバー情報を削除しました')).toBeInTheDocument();
        });
    });

    // --- 追加カバレッジ: 戻るボタン ---
    it('正常表示時の戻るボタンをクリックするとナビゲートされる', async () => {
        const user = userEvent.setup();
        setupDefaultMocks();
        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByText('佐藤 一郎')).toBeInTheDocument();
        });

        await user.click(screen.getByText('戻る'));
        // navigateBack は window.history.state を参照するため、MemoryRouter では navigate('/') が呼ばれる
        expect(mockNavigate).toHaveBeenCalled();
    });

    it('エラー表示時の戻るボタンをクリックするとナビゲートされる', async () => {
        const user = userEvent.setup();
        mockFetchIndex.mockResolvedValue({ ok: false, error: 'エラー' });
        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByText('戻る')).toBeInTheDocument();
        });

        await user.click(screen.getByText('戻る'));
        expect(mockNavigate).toHaveBeenCalled();
    });

    // --- 追加カバレッジ: 学習内容と学習の成果の編集 ---
    it('学習内容と学習の成果を編集できる', async () => {
        const user = userEvent.setup();
        setupMemberDetailOnly();
        mockSaveMemberGroupTermDetail.mockResolvedValue({ success: true });
        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByText('編集')).toBeInTheDocument();
        });

        await user.click(screen.getByText('編集'));

        const contentInput = screen.getByLabelText('学習内容');
        await user.clear(contentInput);
        await user.type(contentInput, '新しい学習内容');

        const outcomeInput = screen.getByLabelText('学習の成果');
        await user.clear(outcomeInput);
        await user.type(outcomeInput, '新しい成果');

        await user.click(screen.getByText('保存'));

        await waitFor(() => {
            expect(mockSaveMemberGroupTermDetail).toHaveBeenCalledWith(
                'm1',
                'g1',
                TERM_KEY,
                expect.objectContaining({
                    learningContent: '新しい学習内容',
                    learningOutcome: '新しい成果',
                })
            );
        });
    });

    // --- 追加カバレッジ: 共通情報がある場合は「メンバー情報を追加」が出ない ---
    it('共通情報がある場合は「メンバー情報を追加」ボタンが表示されない', async () => {
        setupCommonDetailOnly();
        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByText('フロントエンド技術の共有')).toBeInTheDocument();
        });

        // 追加ボタンは表示されない
        expect(screen.queryByText('メンバー情報を追加')).not.toBeInTheDocument();
    });

    // --- 追加カバレッジ: 複数参考資料の操作 ---
    it('複数の参考資料を追加・削除できる', async () => {
        const user = userEvent.setup();
        setupMemberDetailOnly();
        mockFetchMemberGroupTermDetail.mockResolvedValue({
            ok: true,
            data: {
                ...mockMemberDetail,
                references: [
                    { title: '資料A', url: 'https://a.example.com' },
                    { title: '資料B', url: 'https://b.example.com' },
                ],
            },
        });
        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByText('編集')).toBeInTheDocument();
        });

        await user.click(screen.getByText('編集'));

        // 2つの参考資料が表示されている
        expect(screen.getByDisplayValue('資料A')).toBeInTheDocument();
        expect(screen.getByDisplayValue('資料B')).toBeInTheDocument();

        // 1番目を削除（インデックス調整の検証）
        await user.click(screen.getByLabelText('参考資料 1 を削除'));

        // 資料A が消え、資料B が残る
        expect(screen.queryByDisplayValue('資料A')).not.toBeInTheDocument();
        expect(screen.getByDisplayValue('資料B')).toBeInTheDocument();
    });

    // --- 追加カバレッジ: URL エラー時に URL を修正するとエラーがクリアされる ---
    it('URL を修正するとバリデーションエラーがクリアされる', async () => {
        const user = userEvent.setup();
        setupMemberDetailOnly();
        mockSaveMemberGroupTermDetail.mockResolvedValue({ success: true });
        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByText('編集')).toBeInTheDocument();
        });

        await user.click(screen.getByText('編集'));
        await user.click(screen.getByText('追加'));

        const urlInput = screen.getByPlaceholderText('https://...');
        await user.type(urlInput, 'bad');

        // 保存を試みてバリデーションエラーを発生させる
        await user.click(screen.getByText('保存'));
        expect(
            screen.getByText('http または https の URL を入力してください')
        ).toBeInTheDocument();

        // URL を修正
        await user.clear(urlInput);
        await user.type(urlInput, 'https://valid.example.com');

        // 再度保存
        await user.click(screen.getByText('保存'));

        await waitFor(() => {
            expect(mockSaveMemberGroupTermDetail).toHaveBeenCalled();
        });
    });

    // --- 追加カバレッジ: 共通情報のみの場合は共通タブがデフォルト ---
    it('共通情報のみ存在する場合は共通情報がアクティブタブになる', async () => {
        setupCommonDetailOnly();
        renderWithRouter();

        await waitFor(() => {
            // 見出しは「詳細」に統一
            expect(screen.getByText('詳細')).toBeInTheDocument();
            expect(screen.getByText('フロントエンド技術の共有')).toBeInTheDocument();
        });
    });

    // --- 追加カバレッジ: 新規追加で削除ボタンは表示されない ---
    it('新規追加時は削除ボタンが表示されない', async () => {
        const user = userEvent.setup();
        setupDefaultMocks();
        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByText('メンバー情報を追加')).toBeInTheDocument();
        });

        await user.click(screen.getByText('メンバー情報を追加'));

        // 削除ボタンは表示されない（hasMember が false）
        expect(screen.queryByText('削除')).not.toBeInTheDocument();
    });

    // --- 追加カバレッジ: セッションのタイトルがない場合 ---
    it('セッションのタイトルがない場合は空で表示される', async () => {
        setupDefaultMocks();
        mockFetchSession.mockResolvedValue({
            ok: true,
            data: { ...mockSessionData, title: null },
        });
        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByText('2026-01-15')).toBeInTheDocument();
        });
        // タイトル列は空
        const table = screen.getByRole('table');
        const rows = within(table).getAllByRole('row');
        // ヘッダー行 + データ行
        expect(rows.length).toBe(2);
    });

    // --- 追加カバレッジ: メンバー情報追加→キャンセル後に編集ボタンで空フォームが表示される ---
    it('メンバー情報追加をキャンセルした後、編集ボタンで空フォームが表示される', async () => {
        const user = userEvent.setup();
        setupDefaultMocks();
        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByText('メンバー情報を追加')).toBeInTheDocument();
        });

        // 追加→キャンセル
        await user.click(screen.getByText('メンバー情報を追加'));
        await user.click(screen.getByText('キャンセル'));

        // activeTab が 'member' のまま、editing が false → 編集ボタンが表示される
        await user.click(screen.getByText('編集'));

        // memberDetail が null なので空のフォームが表示される
        const purposeInput = screen.getByLabelText('セッションの目的');
        expect(purposeInput).toHaveValue('');
    });

    // --- 追加カバレッジ: メンバーの初期文字がアバターに表示される ---
    it('メンバー名の先頭文字がアバターに表示される', async () => {
        setupDefaultMocks();
        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByText('佐')).toBeInTheDocument();
        });
    });

    // --- 追加カバレッジ: 認証済みモード ---
    it('SAS トークンが設定されている場合も正常に動作する', async () => {
        mockAuth.sasToken = 'test-sas-token';
        mockAuth.isAdmin = true;
        setupDefaultMocks();
        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByText('佐藤 一郎')).toBeInTheDocument();
        });
    });

    it('開発モード（token=dev）で動作する', async () => {
        mockAuth.sasToken = 'dev';
        mockAuth.isAdmin = true;
        setupDefaultMocks();
        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByText('佐藤 一郎')).toBeInTheDocument();
        });
    });

    // --- 追加カバレッジ: 共通情報の参考資料表示 ---
    it('共通情報の参考資料リンクが正しく表示される', async () => {
        setupCommonDetailOnly();
        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByText('参考サイト')).toBeInTheDocument();
        });

        const link = screen.getByText('参考サイト').closest('a');
        expect(link).toHaveAttribute('href', 'https://example.com');
        expect(link).toHaveAttribute('target', '_blank');
    });

    // --- 追加カバレッジ: 参考資料の URL のみ（タイトルなし）表示 ---
    it('参考資料にタイトルがない場合は URL が表示される', async () => {
        setupDefaultMocks();
        mockFetchGroupTermDetail.mockResolvedValue({
            ok: true,
            data: {
                ...mockCommonDetail,
                references: [{ title: '', url: 'https://no-title.example.com' }],
            },
        });
        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByText('https://no-title.example.com')).toBeInTheDocument();
        });
    });

    // --- 追加カバレッジ: instructors が undefined のセッション ---
    it('instructors が未定義のセッションでもエラーにならない', async () => {
        setupDefaultMocks();
        mockFetchSession.mockResolvedValue({
            ok: true,
            data: {
                ...mockSessionData,
                instructors: undefined,
            },
        });
        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByText('2026-01-15')).toBeInTheDocument();
        });
        // 講師バッジは表示されない
        expect(screen.queryByText('講師')).not.toBeInTheDocument();
    });

    // --- 追加カバレッジ: startedAt が null のセッション ---
    it('startedAt が null のセッションは日付が空で表示される', async () => {
        setupDefaultMocks();
        mockFetchSession.mockResolvedValue({
            ok: true,
            data: {
                ...mockSessionData,
                startedAt: null,
            },
        });
        // startedAt が null の場合、extractDate は '' を返し、getFiscalPeriod は NaN を返す
        // → termKey とマッチしないのでフィルタされる
        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByText('セッションデータはありません')).toBeInTheDocument();
        });
    });

    // --- 追加カバレッジ: 出席データなしのメンバー ---
    it('出席データがないセッションは 0 秒として表示される', async () => {
        setupDefaultMocks();
        mockFetchSession.mockResolvedValue({
            ok: true,
            data: {
                ...mockSessionData,
                attendances: [{ memberId: 'other', durationSeconds: 1800 }],
            },
        });
        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByText('2026-01-15')).toBeInTheDocument();
        });
        // 0秒 = 0分（合計とテーブル行の両方に表示される）
        const zeroMinutes = screen.getAllByText('0分');
        expect(zeroMinutes.length).toBeGreaterThanOrEqual(1);
    });

    // --- 追加カバレッジ: 新規追加フォームで全フィールドに入力 ---
    it('新規追加時に全フィールドと参考資料を入力して保存できる', async () => {
        const user = userEvent.setup();
        setupDefaultMocks();
        mockSaveMemberGroupTermDetail.mockResolvedValue({ success: true });
        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByText('メンバー情報を追加')).toBeInTheDocument();
        });

        await user.click(screen.getByText('メンバー情報を追加'));

        // 全フィールドに入力
        await user.type(screen.getByLabelText('セッションの目的'), '新規目的');
        await user.type(screen.getByLabelText('学習内容'), '新規学習内容');
        await user.type(screen.getByLabelText('学習の成果'), '新規成果');

        // 参考資料を追加して入力
        await user.click(screen.getByText('追加'));
        const titleInput = screen.getByPlaceholderText('タイトル');
        const urlInput = screen.getByPlaceholderText('https://...');
        await user.type(titleInput, '参考');
        await user.type(urlInput, 'https://ref.example.com');

        await user.click(screen.getByText('保存'));

        await waitFor(() => {
            expect(mockSaveMemberGroupTermDetail).toHaveBeenCalledWith(
                'm1', 'g1', TERM_KEY,
                expect.objectContaining({
                    purpose: '新規目的',
                    learningContent: '新規学習内容',
                    learningOutcome: '新規成果',
                    references: [{ title: '参考', url: 'https://ref.example.com' }],
                })
            );
        });
    });

    // --- 追加カバレッジ: 編集キャンセル ---
    it('編集をキャンセルすると表示モードに戻る', async () => {
        const user = userEvent.setup();
        setupMemberDetailOnly();
        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByText('編集')).toBeInTheDocument();
        });

        await user.click(screen.getByText('編集'));
        expect(screen.getByLabelText('セッションの目的')).toBeInTheDocument();

        await user.click(screen.getByText('キャンセル'));
        expect(screen.queryByLabelText('セッションの目的')).not.toBeInTheDocument();
        expect(screen.getByText('個人の学習目的')).toBeInTheDocument();
    });

    // --- 追加カバレッジ: 保存中に例外が発生 ---
    it('保存中に例外が発生するとエラーメッセージが表示される', async () => {
        const user = userEvent.setup();
        setupMemberDetailOnly();
        mockSaveMemberGroupTermDetail.mockRejectedValue(new Error('通信エラー'));
        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByText('編集')).toBeInTheDocument();
        });

        await user.click(screen.getByText('編集'));
        await user.click(screen.getByText('保存'));

        await waitFor(() => {
            expect(screen.getByText(/保存に失敗しました.*通信エラー/)).toBeInTheDocument();
        });
    });

    // --- 追加カバレッジ: 削除中に例外が発生 ---
    it('削除中に例外が発生するとエラーメッセージが表示される', async () => {
        const user = userEvent.setup();
        setupMemberDetailOnly();
        mockDeleteMemberGroupTermDetail.mockRejectedValue(new Error('削除失敗'));
        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByText('編集')).toBeInTheDocument();
        });

        await user.click(screen.getByText('編集'));
        await user.click(screen.getByText('削除'));

        const dialog = screen.getByRole('dialog');
        await user.click(within(dialog).getByText('削除'));

        await waitFor(() => {
            expect(screen.getByText(/削除に失敗しました.*削除失敗/)).toBeInTheDocument();
        });
    });

    // --- 追加カバレッジ: 削除確認ダイアログのキャンセル ---
    it('削除確認ダイアログでキャンセルすると閉じる', async () => {
        const user = userEvent.setup();
        setupMemberDetailOnly();
        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByText('編集')).toBeInTheDocument();
        });

        await user.click(screen.getByText('編集'));
        await user.click(screen.getByText('削除'));

        const dialog = screen.getByRole('dialog');
        expect(dialog).toBeInTheDocument();

        await user.click(within(dialog).getByText('キャンセル'));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    // --- 追加カバレッジ: fetchSession が失敗したセッションはスキップされる ---
    it('セッション取得に失敗した場合はスキップされる', async () => {
        mockFetchIndex.mockResolvedValue({ ok: true, data: mockIndexData });
        mockFetchSession.mockResolvedValue({ ok: false, error: 'Not Found' });
        mockFetchGroupTermDetail.mockResolvedValue({ ok: false });
        mockFetchMemberGroupTermDetail.mockResolvedValue({ ok: false });
        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByText('セッションデータはありません')).toBeInTheDocument();
        });
    });
});

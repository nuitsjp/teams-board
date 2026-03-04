import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { MemberDetailPage } from '../../../../src/pages/MemberDetailPage.jsx';

// モック用の関数参照を保持する
const mockFetchIndex = vi.fn();
const mockFetchSession = vi.fn();

vi.mock('../../../../src/services/data-fetcher.js', () => {
    return {
        DataFetcher: vi.fn().mockImplementation(() => ({
            fetchIndex: (...args) => mockFetchIndex(...args),
            fetchSession: (...args) => mockFetchSession(...args),
        })),
    };
});

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return { ...actual, useNavigate: () => mockNavigate };
});

const mockIndexData = {
    schemaVersion: 2,
    version: 1,
    organizers: [{ id: 'org1', name: 'フロントエンド推進室' }],
    groups: [
        {
            id: 'g1',
            name: 'フロントエンド勉強会',
            organizerId: 'org1',
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
    title: '振り返り会',
    startedAt: '2026-01-15T19:00:00',
    endedAt: null,
    attendances: [{ memberId: 'm1', durationSeconds: 1800 }],
    createdAt: '2026-01-15T00:00:00.000Z',
};

// 複数期にまたがるモックデータ
const mockMultiPeriodIndexData = {
    schemaVersion: 2,
    version: 1,
    groups: [
        {
            id: 'g1',
            name: 'フロントエンド勉強会',
            totalDurationSeconds: 7200,
            sessionRevisions: ['g1-2025-06-15/0', 'g1-2026-01-15/0'],
        },
        {
            id: 'g2',
            name: 'TypeScript読書会',
            totalDurationSeconds: 5400,
            sessionRevisions: ['g2-2025-05-12/0'],
        },
    ],
    members: [
        {
            id: 'm1',
            name: '佐藤 一郎',
            totalDurationSeconds: 9000,
            sessionRevisions: ['g1-2025-06-15/0', 'g2-2025-05-12/0', 'g1-2026-01-15/0'],
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
        attendances: [{ memberId: 'm1', durationSeconds: 3600 }],
        createdAt: '2025-06-15T00:00:00.000Z',
    },
    'g2-2025-05-12/0': {
        sessionId: 'g2-2025-05-12',
        revision: 0,
        title: '',
        startedAt: '2025-05-12T19:00:00',
        endedAt: null,
        attendances: [{ memberId: 'm1', durationSeconds: 5400 }],
        createdAt: '2025-05-12T00:00:00.000Z',
    },
    'g1-2026-01-15/0': {
        sessionId: 'g1-2026-01-15',
        revision: 0,
        title: '',
        startedAt: '2026-01-15T19:00:00',
        endedAt: null,
        attendances: [{ memberId: 'm1', durationSeconds: 1800 }],
        createdAt: '2026-01-15T00:00:00.000Z',
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

    it('メンバー情報とグループ一覧を表示すること', async () => {
        mockFetchIndex.mockResolvedValue({ ok: true, data: mockIndexData });
        mockFetchSession.mockResolvedValue({ ok: true, data: mockSessionData });

        renderWithRouter('m1');

        await waitFor(() => {
            expect(screen.getByText('佐藤 一郎')).toBeInTheDocument();
        });

        // 期サマリーが表示される（2025年度 下期 = 2026年1月）
        expect(screen.getByText('2025年度 下期')).toBeInTheDocument();
        // グループ名がカードに表示される
        expect(screen.getByText(/フロントエンド勉強会/)).toBeInTheDocument();
        // グループカードが表示される（data-testid 要素）
        const groupCard = screen.getByText(/フロントエンド勉強会/).closest('[data-testid="group-card"]');
        expect(groupCard).toBeInTheDocument();
    });

    it('グループカードに主催者名が表示されること', async () => {
        mockFetchIndex.mockResolvedValue({ ok: true, data: mockIndexData });
        mockFetchSession.mockResolvedValue({ ok: true, data: mockSessionData });

        renderWithRouter('m1');

        await waitFor(() => {
            expect(screen.getByText('佐藤 一郎')).toBeInTheDocument();
        });

        // 主催者名がグループ名の下に表示される
        expect(screen.getByText('フロントエンド推進室')).toBeInTheDocument();
    });

    it('主催者が未設定のグループでは主催者名が表示されないこと', async () => {
        const indexWithoutOrganizer = {
            ...mockIndexData,
            organizers: [],
            groups: [{ ...mockIndexData.groups[0], organizerId: null }],
        };
        mockFetchIndex.mockResolvedValue({ ok: true, data: indexWithoutOrganizer });
        mockFetchSession.mockResolvedValue({ ok: true, data: mockSessionData });

        renderWithRouter('m1');

        await waitFor(() => {
            expect(screen.getByText('佐藤 一郎')).toBeInTheDocument();
        });

        expect(screen.queryByText('フロントエンド推進室')).not.toBeInTheDocument();
    });

    it('存在しないメンバーIDの場合にエラーを表示すること', async () => {
        mockFetchIndex.mockResolvedValue({ ok: true, data: mockIndexData });

        renderWithRouter('unknown-id');

        await waitFor(() => {
            expect(screen.getByText('参加者が見つかりません')).toBeInTheDocument();
        });
    });

    it('「戻る」リンクが表示されること', async () => {
        mockFetchIndex.mockResolvedValue({ ok: true, data: mockIndexData });
        mockFetchSession.mockResolvedValue({ ok: true, data: mockSessionData });

        renderWithRouter('m1');

        await waitFor(() => {
            expect(screen.getByText('戻る')).toBeInTheDocument();
        });
    });

    it('「戻る」ボタンクリックで navigateBack が呼ばれること', async () => {
        const user = userEvent.setup();
        mockFetchIndex.mockResolvedValue({ ok: true, data: mockIndexData });
        mockFetchSession.mockResolvedValue({ ok: true, data: mockSessionData });

        renderWithRouter('m1');

        await waitFor(() => {
            expect(screen.getByText('戻る')).toBeInTheDocument();
        });

        await user.click(screen.getByText('戻る'));
        // 履歴なし環境ではダッシュボードへフォールバック
        expect(mockNavigate).toHaveBeenCalledWith('/');
    });

    it('エラー画面の「戻る」ボタンクリックで navigateBack が呼ばれること', async () => {
        const user = userEvent.setup();
        mockFetchIndex.mockResolvedValue({ ok: false, error: 'ネットワークエラー' });

        renderWithRouter('m1');

        await waitFor(() => {
            expect(screen.getByText('戻る')).toBeInTheDocument();
        });

        await user.click(screen.getByText('戻る'));
        expect(mockNavigate).toHaveBeenCalledWith('/');
    });

    describe('期別表示', () => {
        it('複数期のサマリーが降順で表示されること', async () => {
            mockFetchIndex.mockResolvedValue({ ok: true, data: mockMultiPeriodIndexData });
            mockFetchSession.mockImplementation((ref) =>
                Promise.resolve({ ok: true, data: mockMultiPeriodSessions[ref] })
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
            mockFetchSession.mockImplementation((ref) =>
                Promise.resolve({ ok: true, data: mockMultiPeriodSessions[ref] })
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
            mockFetchSession.mockImplementation((ref) =>
                Promise.resolve({ ok: true, data: mockMultiPeriodSessions[ref] })
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

    it('fetchIndexがエラーを返した場合にエラーメッセージを表示すること', async () => {
        mockFetchIndex.mockResolvedValue({ ok: false, error: 'ネットワークエラー' });

        renderWithRouter('m1');

        await waitFor(() => {
            expect(screen.getByText('データ取得エラー: ネットワークエラー')).toBeInTheDocument();
        });
    });

    it('全セッション取得が失敗した場合にエラーを表示すること', async () => {
        mockFetchIndex.mockResolvedValue({ ok: true, data: mockIndexData });
        mockFetchSession.mockResolvedValue({ ok: false, error: 'セッションエラー' });

        renderWithRouter('m1');

        await waitFor(() => {
            expect(screen.getByText('セッションデータの取得に失敗しました')).toBeInTheDocument();
        });
    });

    it('グループカードをクリックすると詳細画面へ遷移すること', async () => {
        const user = userEvent.setup();
        mockFetchIndex.mockResolvedValue({ ok: true, data: mockIndexData });
        mockFetchSession.mockResolvedValue({ ok: true, data: mockSessionData });

        renderWithRouter('m1');

        await waitFor(() => {
            expect(screen.getByText('佐藤 一郎')).toBeInTheDocument();
        });

        // グループカードをクリック（sortKey: 2025年度下期 = 20251）
        const groupCard = screen.getByText(/フロントエンド勉強会/).closest('[data-testid="group-card"]');
        await user.click(groupCard);

        expect(mockNavigate).toHaveBeenCalledWith('/members/m1/groups/g1/terms/20251');
    });

    it('一部のセッション取得が失敗しても成功分は表示されること', async () => {
        const indexData = {
            schemaVersion: 2,
            version: 1,
            groups: [
                {
                    id: 'g1',
                    name: 'テストグループ',
                    totalDurationSeconds: 3600,
                    sessionRevisions: ['s-ok/0', 's-fail/0'],
                },
            ],
            members: [
                {
                    id: 'm1',
                    name: '田中',
                    totalDurationSeconds: 1800,
                    sessionRevisions: ['s-ok/0', 's-fail/0'],
                },
            ],
            updatedAt: '2026-01-01T00:00:00Z',
        };
        mockFetchIndex.mockResolvedValue({ ok: true, data: indexData });
        mockFetchSession.mockImplementation((ref) => {
            if (ref === 's-ok/0') {
                return Promise.resolve({
                    ok: true,
                    data: {
                        sessionId: 's-ok',
                        revision: 0,
                        title: '',
                        startedAt: '2026-01-10T19:00:00',
                        endedAt: null,
                        attendances: [{ memberId: 'm1', durationSeconds: 1800 }],
                        createdAt: '2026-01-10T00:00:00.000Z',
                    },
                });
            }
            return Promise.resolve({ ok: false, error: '取得失敗' });
        });

        renderWithRouter('m1');

        await waitFor(() => {
            expect(screen.getByText('田中')).toBeInTheDocument();
        });

        // 成功したセッションのデータが表示される
        expect(screen.getByText(/テストグループ/)).toBeInTheDocument();
    });

    it('セッションにメンバーの出席データがない場合スキップされること', async () => {
        const indexData = {
            schemaVersion: 2,
            version: 1,
            groups: [
                {
                    id: 'g1',
                    name: 'グループA',
                    totalDurationSeconds: 3600,
                    sessionRevisions: ['s-with/0', 's-without/0'],
                },
            ],
            members: [
                {
                    id: 'm1',
                    name: '鈴木',
                    totalDurationSeconds: 900,
                    sessionRevisions: ['s-with/0', 's-without/0'],
                },
            ],
            updatedAt: '2026-01-01T00:00:00Z',
        };
        mockFetchIndex.mockResolvedValue({ ok: true, data: indexData });
        mockFetchSession.mockImplementation((ref) => {
            if (ref === 's-with/0') {
                return Promise.resolve({
                    ok: true,
                    data: {
                        sessionId: 's-with',
                        revision: 0,
                        title: '',
                        startedAt: '2026-01-20T19:00:00',
                        endedAt: null,
                        attendances: [{ memberId: 'm1', durationSeconds: 900 }],
                        createdAt: '2026-01-20T00:00:00.000Z',
                    },
                });
            }
            // このセッションにはm1の出席記録がない
            return Promise.resolve({
                ok: true,
                data: {
                    sessionId: 's-without',
                    revision: 0,
                    title: '',
                    startedAt: '2026-01-25T19:00:00',
                    endedAt: null,
                    attendances: [{ memberId: 'm-other', durationSeconds: 1200 }],
                    createdAt: '2026-01-25T00:00:00.000Z',
                },
            });
        });

        renderWithRouter('m1');

        await waitFor(() => {
            expect(screen.getByText('鈴木')).toBeInTheDocument();
        });

        // 出席データのあるグループが表示される
        expect(screen.getByText(/グループA/)).toBeInTheDocument();
        // グループカードが表示される
        const groupCard = screen.getByText(/グループA/).closest('[data-testid="group-card"]');
        expect(groupCard).toBeInTheDocument();
    });

    it('sessionRefの所属グループが index.json で解決できない場合は不整合エラーを表示すること', async () => {
        // グループのsessionRevisionsに含まれないsessionRefのケース
        const indexData = {
            schemaVersion: 2,
            version: 1,
            groups: [
                {
                    id: 'g1',
                    name: '元グループ',
                    totalDurationSeconds: 3600,
                    sessionRevisions: [], // sessionRef を含めない
                },
            ],
            members: [
                {
                    id: 'm1',
                    name: '山田',
                    totalDurationSeconds: 1800,
                    sessionRevisions: ['orphan-session/0'],
                },
            ],
            updatedAt: '2026-01-01T00:00:00Z',
        };
        mockFetchIndex.mockResolvedValue({ ok: true, data: indexData });
        mockFetchSession.mockResolvedValue({
            ok: true,
            data: {
                sessionId: 'orphan-session',
                revision: 0,
                title: '',
                startedAt: '2026-01-15T19:00:00',
                endedAt: null,
                attendances: [{ memberId: 'm1', durationSeconds: 1800 }],
                createdAt: '2026-01-15T00:00:00.000Z',
            },
        });

        renderWithRouter('m1');

        await waitFor(() => {
            expect(
                screen.getByText(
                    'データ不整合: セッション orphan-session の所属グループが index.json に見つかりません'
                )
            ).toBeInTheDocument();
        });
    });

    it('統合後でも sessionRef 逆引きで統合先グループ名を表示すること', async () => {
        mockFetchIndex.mockResolvedValue({
            ok: true,
            data: {
                schemaVersion: 2,
                version: 1,
                groups: [
                    {
                        id: 'g-target',
                        name: '統合先グループ',
                        totalDurationSeconds: 3600,
                        sessionRevisions: ['g-old-2026-01-15/0'],
                    },
                ],
                members: [
                    {
                        id: 'm1',
                        name: '佐藤 一郎',
                        totalDurationSeconds: 1800,
                        sessionRevisions: ['g-old-2026-01-15/0'],
                    },
                ],
                updatedAt: '2026-02-10T00:00:00Z',
            },
        });
        mockFetchSession.mockResolvedValue({
            ok: true,
            data: {
                sessionId: 'g-old-2026-01-15',
                revision: 0,
                title: '',
                startedAt: '2026-01-15T19:00:00',
                endedAt: null,
                attendances: [{ memberId: 'm1', durationSeconds: 1800 }],
                createdAt: '2026-01-15T00:00:00.000Z',
            },
        });

        renderWithRouter('m1');

        await waitFor(() => {
            expect(screen.getByText('佐藤 一郎')).toBeInTheDocument();
        });

        expect(screen.getByText('統合先グループ')).toBeInTheDocument();
        expect(screen.queryByText('不明')).not.toBeInTheDocument();
    });

    describe('講師バッジ', () => {
        const instructorIndexData = {
            schemaVersion: 2,
            version: 1,
            groups: [
                {
                    id: 'g1',
                    name: 'フロントエンド勉強会',
                    totalDurationSeconds: 7200,
                    sessionRevisions: ['s1/0', 's2/0'],
                },
                {
                    id: 'g2',
                    name: 'TypeScript読書会',
                    totalDurationSeconds: 3600,
                    sessionRevisions: ['s3/0'],
                },
            ],
            members: [
                {
                    id: 'm1',
                    name: '佐藤 一郎',
                    totalDurationSeconds: 9000,
                    sessionRevisions: ['s1/0', 's2/0', 's3/0'],
                },
            ],
            updatedAt: '2026-01-01T00:00:00Z',
        };

        const instructorSessions = {
            's1/0': {
                sessionId: 's1',
                revision: 0,
                title: 'React入門',
                startedAt: '2025-06-15T19:00:00',
                endedAt: null,
                attendances: [{ memberId: 'm1', durationSeconds: 3600 }],
                instructors: ['m1'],
                createdAt: '2025-06-15T00:00:00.000Z',
            },
            's2/0': {
                sessionId: 's2',
                revision: 0,
                title: '',
                startedAt: '2026-01-20T19:00:00',
                endedAt: null,
                attendances: [{ memberId: 'm1', durationSeconds: 3600 }],
                instructors: ['m1'],
                createdAt: '2026-01-20T00:00:00.000Z',
            },
            's3/0': {
                sessionId: 's3',
                revision: 0,
                title: '',
                startedAt: '2025-05-10T19:00:00',
                endedAt: null,
                attendances: [{ memberId: 'm1', durationSeconds: 1800 }],
                instructors: [],
                createdAt: '2025-05-10T00:00:00.000Z',
            },
        };

        it('講師セッションがあるグループに講師バッジが表示されること', async () => {
            mockFetchIndex.mockResolvedValue({ ok: true, data: instructorIndexData });
            mockFetchSession.mockImplementation((ref) =>
                Promise.resolve({ ok: true, data: instructorSessions[ref] })
            );

            renderWithRouter('m1');

            await waitFor(() => {
                expect(screen.getByText('佐藤 一郎')).toBeInTheDocument();
            });

            // ヘッダーカードに講師回数が表示される
            const instructorCountElements = screen.getAllByText(/講師/);
            expect(instructorCountElements.length).toBeGreaterThanOrEqual(1);

            // グループカードに講師バッジが表示される
            const badges = screen.getAllByText('講師');
            expect(badges.length).toBeGreaterThanOrEqual(1);
        });

        it('講師セッションが0件の場合はバッジが表示されないこと', async () => {
            const noInstructorSessions = {
                's1/0': { ...instructorSessions['s1/0'], instructors: [] },
                's2/0': { ...instructorSessions['s2/0'], instructors: [] },
                's3/0': { ...instructorSessions['s3/0'], instructors: [] },
            };
            mockFetchIndex.mockResolvedValue({ ok: true, data: instructorIndexData });
            mockFetchSession.mockImplementation((ref) =>
                Promise.resolve({ ok: true, data: noInstructorSessions[ref] })
            );

            renderWithRouter('m1');

            await waitFor(() => {
                expect(screen.getByText('佐藤 一郎')).toBeInTheDocument();
            });

            // 講師バッジが表示されない
            expect(screen.queryByText('講師')).not.toBeInTheDocument();
        });

        it('期を切り替えると講師バッジの表示が切り替わること', async () => {
            const user = userEvent.setup();
            mockFetchIndex.mockResolvedValue({ ok: true, data: instructorIndexData });
            mockFetchSession.mockImplementation((ref) =>
                Promise.resolve({ ok: true, data: instructorSessions[ref] })
            );

            renderWithRouter('m1');

            await waitFor(() => {
                expect(screen.getByText('佐藤 一郎')).toBeInTheDocument();
            });

            // 上期ボタンをクリックして切り替え
            const unselectedButton = screen.getByRole('button', { pressed: false });
            await user.click(unselectedButton);

            // 上期ではフロントエンド勉強会に講師バッジがある（s1は講師）
            // TypeScript読書会には講師バッジがない（s3は講師でない）
            expect(screen.getByText(/フロントエンド勉強会/)).toBeInTheDocument();
            expect(screen.getByText(/TypeScript読書会/)).toBeInTheDocument();
        });
    });
});

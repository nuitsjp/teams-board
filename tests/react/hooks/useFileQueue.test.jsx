import { renderHook, act, waitFor } from '@testing-library/react';
import { useFileQueue } from '../../../src/hooks/useFileQueue.js';

// テスト用のモック CsvTransformer
function createMockTransformer(parseResult) {
    return { parse: vi.fn().mockResolvedValue(parseResult) };
}

// 標準的なパース成功結果
function createParseResult(overrides = {}) {
    return {
        ok: true,
        sessionRecord: {
            id: 'abc12345-2026-01-15',
            groupId: 'abc12345',
            date: '2026-01-15',
            attendances: [{ memberId: 'mem001', durationSeconds: 3600 }],
        },
        mergeInput: {
            sessionId: 'abc12345-2026-01-15',
            groupId: 'abc12345',
            groupName: 'テスト勉強会',
            date: '2026-01-15',
            attendances: [
                { memberId: 'mem001', memberName: '佐藤 太郎', durationSeconds: 3600 },
            ],
        },
        warnings: [],
        ...overrides,
    };
}

// グループ名が空のパース結果
function createEmptyGroupParseResult() {
    return createParseResult({
        sessionRecord: {
            id: 'e3b0c442-2026-01-15',
            groupId: 'e3b0c442',
            date: '2026-01-15',
            attendances: [{ memberId: 'mem001', durationSeconds: 3600 }],
        },
        mergeInput: {
            sessionId: 'e3b0c442-2026-01-15',
            groupId: 'e3b0c442',
            groupName: '',
            date: '2026-01-15',
            attendances: [
                { memberId: 'mem001', memberName: '佐藤 太郎', durationSeconds: 3600 },
            ],
        },
    });
}

describe('useFileQueue — ファイルバリデーション', () => {
    it('CSV以外のファイルはエラーになる', async () => {
        const transformer = createMockTransformer(createParseResult());
        const { result } = renderHook(() => useFileQueue(transformer));

        const file = new File(['dummy'], 'test.txt', { type: 'text/plain' });
        act(() => {
            result.current.addFiles([file]);
        });

        await waitFor(() => {
            expect(result.current.queue[0].status).toBe('error');
        });

        expect(result.current.queue[0].errors).toContain('CSVファイルのみ対応しています');
        // パーサーは呼ばれないこと
        expect(transformer.parse).not.toHaveBeenCalled();
    });

    it('10MBを超えるファイルはエラーになる', async () => {
        const transformer = createMockTransformer(createParseResult());
        const { result } = renderHook(() => useFileQueue(transformer));

        // 10MB超のファイルを作成
        const largeContent = new ArrayBuffer(10 * 1024 * 1024 + 1);
        const file = new File([largeContent], 'large.csv', { type: 'text/csv' });
        act(() => {
            result.current.addFiles([file]);
        });

        await waitFor(() => {
            expect(result.current.queue[0].status).toBe('error');
        });

        expect(result.current.queue[0].errors).toContain('ファイルサイズが10MBを超えています');
        expect(transformer.parse).not.toHaveBeenCalled();
    });
});

describe('useFileQueue — パース処理', () => {
    it('パース失敗時にエラーステータスになる', async () => {
        const transformer = createMockTransformer({
            ok: false,
            errors: ['CSVフォーマットが不正です'],
        });
        const { result } = renderHook(() => useFileQueue(transformer));

        const file = new File(['dummy'], 'test.csv', { type: 'text/csv' });
        act(() => {
            result.current.addFiles([file]);
        });

        await waitFor(() => {
            expect(result.current.queue[0].status).toBe('error');
        });

        expect(result.current.queue[0].errors).toContain('CSVフォーマットが不正です');
    });

    it('パース成功時にreadyステータスになりreadyItemsに含まれる', async () => {
        const transformer = createMockTransformer(createParseResult());
        const { result } = renderHook(() => useFileQueue(transformer));

        const file = new File(['dummy'], 'test.csv', { type: 'text/csv' });
        act(() => {
            result.current.addFiles([file]);
        });

        await waitFor(() => {
            expect(result.current.queue[0].status).toBe('ready');
        });

        expect(result.current.queue[0].parseResult).toBeTruthy();
        expect(result.current.readyItems).toHaveLength(1);
    });

    it('警告付きのパース結果が正しく保持される', async () => {
        const transformer = createMockTransformer(
            createParseResult({ warnings: ['参加者名が不明です'] })
        );
        const { result } = renderHook(() => useFileQueue(transformer));

        const file = new File(['dummy'], 'test.csv', { type: 'text/csv' });
        act(() => {
            result.current.addFiles([file]);
        });

        await waitFor(() => {
            expect(result.current.queue[0].status).toBe('ready');
        });

        expect(result.current.queue[0].warnings).toEqual(['参加者名が不明です']);
    });

    it('既存セッションIDと重複する場合はduplicate_warningになる', async () => {
        const transformer = createMockTransformer(createParseResult());
        const { result } = renderHook(() => useFileQueue(transformer));

        // 既存セッションIDを設定
        act(() => {
            result.current.setExistingSessionIds(new Set(['abc12345-2026-01-15']));
        });

        const file = new File(['dummy'], 'test.csv', { type: 'text/csv' });
        act(() => {
            result.current.addFiles([file]);
        });

        await waitFor(() => {
            expect(result.current.queue[0].status).toBe('duplicate_warning');
        });

        expect(result.current.queue[0].hasDuplicate).toBe(true);
        expect(result.current.queue[0].parseResult).toBeTruthy();
    });
});

describe('useFileQueue — 重複承認', () => {
    it('approveDuplicate でduplicate_warningからreadyに変更される', async () => {
        const transformer = createMockTransformer(createParseResult());
        const { result } = renderHook(() => useFileQueue(transformer));

        // 既存セッションIDを設定して重複を発生させる
        act(() => {
            result.current.setExistingSessionIds(new Set(['abc12345-2026-01-15']));
        });

        const file = new File(['dummy'], 'test.csv', { type: 'text/csv' });
        act(() => {
            result.current.addFiles([file]);
        });

        await waitFor(() => {
            expect(result.current.queue[0].status).toBe('duplicate_warning');
        });

        const itemId = result.current.queue[0].id;

        // 重複を承認
        act(() => {
            result.current.approveDuplicate(itemId);
        });

        expect(result.current.queue[0].status).toBe('ready');
        expect(result.current.readyItems).toHaveLength(1);
    });
});

describe('useFileQueue — ファイル削除', () => {
    it('removeFile でキューからアイテムが削除される', async () => {
        const transformer = createMockTransformer(createParseResult());
        const { result } = renderHook(() => useFileQueue(transformer));

        const file = new File(['dummy'], 'test.csv', { type: 'text/csv' });
        act(() => {
            result.current.addFiles([file]);
        });

        await waitFor(() => {
            expect(result.current.queue[0].status).toBe('ready');
        });

        const itemId = result.current.queue[0].id;

        act(() => {
            result.current.removeFile(itemId);
        });

        expect(result.current.queue).toHaveLength(0);
    });
});

describe('useFileQueue — 保存ステータス更新', () => {
    it('updateStatus("saving") でsavingステータスになる', async () => {
        const transformer = createMockTransformer(createParseResult());
        const { result } = renderHook(() => useFileQueue(transformer));

        const file = new File(['dummy'], 'test.csv', { type: 'text/csv' });
        act(() => {
            result.current.addFiles([file]);
        });

        await waitFor(() => {
            expect(result.current.queue[0].status).toBe('ready');
        });

        const itemId = result.current.queue[0].id;

        act(() => {
            result.current.updateStatus(itemId, 'saving');
        });

        expect(result.current.queue[0].status).toBe('saving');
    });

    it('updateStatus("saved") でsavedステータスになる', async () => {
        const transformer = createMockTransformer(createParseResult());
        const { result } = renderHook(() => useFileQueue(transformer));

        const file = new File(['dummy'], 'test.csv', { type: 'text/csv' });
        act(() => {
            result.current.addFiles([file]);
        });

        await waitFor(() => {
            expect(result.current.queue[0].status).toBe('ready');
        });

        const itemId = result.current.queue[0].id;

        act(() => {
            result.current.updateStatus(itemId, 'saved');
        });

        expect(result.current.queue[0].status).toBe('saved');
    });

    it('updateStatus("save_failed") でsave_failedステータスになりfailedItemsに含まれる', async () => {
        const transformer = createMockTransformer(createParseResult());
        const { result } = renderHook(() => useFileQueue(transformer));

        const file = new File(['dummy'], 'test.csv', { type: 'text/csv' });
        act(() => {
            result.current.addFiles([file]);
        });

        await waitFor(() => {
            expect(result.current.queue[0].status).toBe('ready');
        });

        const itemId = result.current.queue[0].id;

        act(() => {
            result.current.updateStatus(itemId, 'save_failed', {
                errors: ['ネットワークエラー'],
            });
        });

        expect(result.current.queue[0].status).toBe('save_failed');
        expect(result.current.queue[0].errors).toEqual(['ネットワークエラー']);
        expect(result.current.failedItems).toHaveLength(1);
    });

    it('updateStatus("save_failed") でextra未指定時は空配列になる', async () => {
        const transformer = createMockTransformer(createParseResult());
        const { result } = renderHook(() => useFileQueue(transformer));

        const file = new File(['dummy'], 'test.csv', { type: 'text/csv' });
        act(() => {
            result.current.addFiles([file]);
        });

        await waitFor(() => {
            expect(result.current.queue[0].status).toBe('ready');
        });

        const itemId = result.current.queue[0].id;

        act(() => {
            result.current.updateStatus(itemId, 'save_failed');
        });

        expect(result.current.queue[0].status).toBe('save_failed');
        expect(result.current.queue[0].errors).toEqual([]);
    });

    it('updateStatus("ready") でreadyステータスにリセットされる', async () => {
        const transformer = createMockTransformer(createParseResult());
        const { result } = renderHook(() => useFileQueue(transformer));

        const file = new File(['dummy'], 'test.csv', { type: 'text/csv' });
        act(() => {
            result.current.addFiles([file]);
        });

        await waitFor(() => {
            expect(result.current.queue[0].status).toBe('ready');
        });

        const itemId = result.current.queue[0].id;

        // save_failedにしてからreadyにリセット
        act(() => {
            result.current.updateStatus(itemId, 'save_failed', {
                errors: ['エラー'],
            });
        });

        expect(result.current.queue[0].status).toBe('save_failed');

        act(() => {
            result.current.updateStatus(itemId, 'ready');
        });

        expect(result.current.queue[0].status).toBe('ready');
        expect(result.current.queue[0].errors).toEqual([]);
    });

    it('updateStatus で未知のステータスを渡しても状態が変わらない', async () => {
        const transformer = createMockTransformer(createParseResult());
        const { result } = renderHook(() => useFileQueue(transformer));

        const file = new File(['dummy'], 'test.csv', { type: 'text/csv' });
        act(() => {
            result.current.addFiles([file]);
        });

        await waitFor(() => {
            expect(result.current.queue[0].status).toBe('ready');
        });

        const itemId = result.current.queue[0].id;

        act(() => {
            result.current.updateStatus(itemId, 'unknown_status');
        });

        // ステータスは変わらない
        expect(result.current.queue[0].status).toBe('ready');
    });
});

describe('useFileQueue — 複数アイテム操作', () => {
    it('複数アイテムがある場合、対象アイテムのみステータスが変更される', async () => {
        let callCount = 0;
        const transformer = {
            parse: vi.fn().mockImplementation(() => {
                callCount++;
                return Promise.resolve(
                    createParseResult({
                        sessionRecord: {
                            id: `group${callCount}-2026-01-15`,
                            groupId: `group${callCount}`,
                            date: '2026-01-15',
                            attendances: [{ memberId: 'mem001', durationSeconds: 3600 }],
                        },
                        mergeInput: {
                            sessionId: `group${callCount}-2026-01-15`,
                            groupId: `group${callCount}`,
                            groupName: `グループ${callCount}`,
                            date: '2026-01-15',
                            attendances: [
                                {
                                    memberId: 'mem001',
                                    memberName: '佐藤 太郎',
                                    durationSeconds: 3600,
                                },
                            ],
                        },
                    })
                );
            }),
        };
        const { result } = renderHook(() => useFileQueue(transformer));

        // 2つのファイルを追加
        const file1 = new File(['dummy1'], 'test1.csv', { type: 'text/csv' });
        const file2 = new File(['dummy2'], 'test2.csv', { type: 'text/csv' });
        act(() => {
            result.current.addFiles([file1, file2]);
        });

        await waitFor(() => {
            expect(result.current.queue).toHaveLength(2);
            expect(result.current.queue.every((item) => item.status === 'ready')).toBe(true);
        });

        const firstItemId = result.current.queue[0].id;

        // 1つ目のアイテムだけsavingにする
        act(() => {
            result.current.updateStatus(firstItemId, 'saving');
        });

        expect(result.current.queue[0].status).toBe('saving');
        expect(result.current.queue[1].status).toBe('ready');

        // 1つ目をsavedにする
        act(() => {
            result.current.updateStatus(firstItemId, 'saved');
        });

        expect(result.current.queue[0].status).toBe('saved');
        expect(result.current.queue[1].status).toBe('ready');
    });

    it('approveDuplicate はduplicate_warningステータス以外のアイテムには影響しない', async () => {
        const transformer = createMockTransformer(createParseResult());
        const { result } = renderHook(() => useFileQueue(transformer));

        const file = new File(['dummy'], 'test.csv', { type: 'text/csv' });
        act(() => {
            result.current.addFiles([file]);
        });

        await waitFor(() => {
            expect(result.current.queue[0].status).toBe('ready');
        });

        const itemId = result.current.queue[0].id;

        // readyステータスのアイテムにapproveDuplicateしても変化しない
        act(() => {
            result.current.approveDuplicate(itemId);
        });

        expect(result.current.queue[0].status).toBe('ready');
    });
});

describe('useFileQueue — SELECT_GROUP 分岐', () => {
    it('parseResult の date が null の場合、重複チェックがスキップされる', async () => {
        const resultWithNoDate = createParseResult({
            mergeInput: {
                sessionId: 'abc12345-2026-01-15',
                groupId: 'abc12345',
                groupName: 'テスト勉強会',
                date: null,
                attendances: [
                    { memberId: 'mem001', memberName: '佐藤 太郎', durationSeconds: 3600 },
                ],
            },
        });
        const transformer = createMockTransformer(resultWithNoDate);
        const { result } = renderHook(() => useFileQueue(transformer));

        // 既存セッションIDを設定
        act(() => {
            result.current.setExistingSessionIds(new Set(['existgrp1-2026-01-15']));
        });

        const file = new File(['dummy'], 'test.csv', { type: 'text/csv' });
        act(() => {
            result.current.addFiles([file]);
        });

        await waitFor(() => {
            expect(result.current.queue[0].status).toBe('ready');
        });

        const itemId = result.current.queue[0].id;

        // グループ選択（dateがnullなので重複チェックがスキップされる）
        act(() => {
            result.current.selectGroup(itemId, 'existgrp1', '既存グループ');
        });

        // dateがnullなのでnewSessionIdもnull → 重複にならずready
        expect(result.current.queue[0].status).toBe('ready');
        expect(result.current.queue[0].hasDuplicate).toBeFalsy();
    });

    it('警告がundefinedのパース結果でもwarningsが空配列になる', async () => {
        // warnings プロパティが undefined の結果
        const resultWithoutWarnings = {
            ok: true,
            sessionRecord: {
                id: 'abc12345-2026-01-15',
                groupId: 'abc12345',
                date: '2026-01-15',
                attendances: [{ memberId: 'mem001', durationSeconds: 3600 }],
            },
            mergeInput: {
                sessionId: 'abc12345-2026-01-15',
                groupId: 'abc12345',
                groupName: '',
                date: '2026-01-15',
                attendances: [
                    { memberId: 'mem001', memberName: '佐藤 太郎', durationSeconds: 3600 },
                ],
            },
        };
        const transformer = createMockTransformer(resultWithoutWarnings);
        const { result } = renderHook(() => useFileQueue(transformer));

        const file = new File(['dummy'], 'test.csv', { type: 'text/csv' });
        act(() => {
            result.current.addFiles([file]);
        });

        // missing_group になる（groupNameが空）
        await waitFor(() => {
            expect(result.current.queue[0].status).toBe('missing_group');
        });

        // warningsがundefinedでも空配列にフォールバックされる
        expect(result.current.queue[0].warnings).toEqual([]);
    });
});

describe('useFileQueue — SELECT_GROUP', () => {
    it('selectGroup で groupOverride が設定される', async () => {
        const transformer = createMockTransformer(createParseResult());
        const { result } = renderHook(() => useFileQueue(transformer));

        // ファイルを追加
        const file = new File(['dummy'], 'test.csv', { type: 'text/csv' });
        act(() => {
            result.current.addFiles([file]);
        });

        // パース完了を待つ
        await waitFor(() => {
            expect(result.current.queue[0].status).toBe('ready');
        });

        const itemId = result.current.queue[0].id;

        // グループ選択
        act(() => {
            result.current.selectGroup(itemId, 'newgroup1', '別のグループ');
        });

        expect(result.current.queue[0].groupOverride).toEqual({
            groupId: 'newgroup1',
            groupName: '別のグループ',
        });
        expect(result.current.queue[0].status).toBe('ready');
    });

    it('selectGroup で変更後の sessionId が既存と重複する場合 duplicate_warning になる', async () => {
        const transformer = createMockTransformer(createParseResult());
        const { result } = renderHook(() => useFileQueue(transformer));

        // 既存セッションIDを設定（重複を発生させる）
        act(() => {
            result.current.setExistingSessionIds(new Set(['existgrp1-2026-01-15']));
        });

        // ファイルを追加
        const file = new File(['dummy'], 'test.csv', { type: 'text/csv' });
        act(() => {
            result.current.addFiles([file]);
        });

        await waitFor(() => {
            expect(result.current.queue[0].status).toBe('ready');
        });

        const itemId = result.current.queue[0].id;

        // 重複するグループを選択
        act(() => {
            result.current.selectGroup(itemId, 'existgrp1', '既存グループ');
        });

        expect(result.current.queue[0].status).toBe('duplicate_warning');
        expect(result.current.queue[0].hasDuplicate).toBe(true);
    });
});

describe('useFileQueue — MISSING_GROUP', () => {
    it('groupName が空の場合 missing_group ステータスになる', async () => {
        const transformer = createMockTransformer(createEmptyGroupParseResult());
        const { result } = renderHook(() => useFileQueue(transformer));

        const file = new File(['dummy'], 'test.csv', { type: 'text/csv' });
        act(() => {
            result.current.addFiles([file]);
        });

        await waitFor(() => {
            expect(result.current.queue[0].status).toBe('missing_group');
        });

        // readyItems に含まれないこと
        expect(result.current.readyItems).toHaveLength(0);
    });

    it('missing_group のアイテムでグループを選択すると ready になる', async () => {
        const transformer = createMockTransformer(createEmptyGroupParseResult());
        const { result } = renderHook(() => useFileQueue(transformer));

        const file = new File(['dummy'], 'test.csv', { type: 'text/csv' });
        act(() => {
            result.current.addFiles([file]);
        });

        await waitFor(() => {
            expect(result.current.queue[0].status).toBe('missing_group');
        });

        const itemId = result.current.queue[0].id;

        // 既存グループを選択
        act(() => {
            result.current.selectGroup(itemId, 'existgrp1', '既存グループ');
        });

        expect(result.current.queue[0].status).toBe('ready');
        expect(result.current.queue[0].groupOverride).toEqual({
            groupId: 'existgrp1',
            groupName: '既存グループ',
        });
        expect(result.current.readyItems).toHaveLength(1);
    });
});

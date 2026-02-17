import { renderHook, act, waitFor } from '@testing-library/react';
import { useFileQueue } from '../../../src/hooks/useFileQueue.js';

// テスト用のモック CsvTransformer
function createMockTransformer(parseResult) {
    return { parse: vi.fn().mockResolvedValue(parseResult) };
}

// 標準的なパース成功結果（V2: parsedSession 形式）
function createParseResult(overrides = {}) {
    return {
        ok: true,
        parsedSession: {
            sessionId: '01TESTSESSION00000000000',
            groupName: 'テスト勉強会',
            date: '2026-01-15',
            startedAt: '2026-01-15T19:00:00',
            endedAt: null,
            attendances: [
                { memberName: '佐藤 太郎', memberEmail: 'taro@example.com', durationSeconds: 3600 },
            ],
        },
        warnings: [],
        ...overrides,
    };
}

// グループ名が空のパース結果
function createEmptyGroupParseResult() {
    return createParseResult({
        parsedSession: {
            sessionId: '01EMPTYGROUP000000000000',
            groupName: '',
            date: '2026-01-15',
            startedAt: '2026-01-15T19:00:00',
            endedAt: null,
            attendances: [
                { memberName: '佐藤 太郎', memberEmail: 'taro@example.com', durationSeconds: 3600 },
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
        expect(transformer.parse).not.toHaveBeenCalled();
    });

    it('10MBを超えるファイルはエラーになる', async () => {
        const transformer = createMockTransformer(createParseResult());
        const { result } = renderHook(() => useFileQueue(transformer));

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
                        parsedSession: {
                            sessionId: `01TESTSESSION0000000000${String(callCount).padStart(2, '0')}`,
                            groupName: `グループ${callCount}`,
                            date: '2026-01-15',
                            startedAt: '2026-01-15T19:00:00',
                            endedAt: null,
                            attendances: [
                                {
                                    memberName: '佐藤 太郎',
                                    memberEmail: 'taro@example.com',
                                    durationSeconds: 3600,
                                },
                            ],
                        },
                    })
                );
            }),
        };
        const { result } = renderHook(() => useFileQueue(transformer));

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

        act(() => {
            result.current.updateStatus(firstItemId, 'saving');
        });

        expect(result.current.queue[0].status).toBe('saving');
        expect(result.current.queue[1].status).toBe('ready');

        act(() => {
            result.current.updateStatus(firstItemId, 'saved');
        });

        expect(result.current.queue[0].status).toBe('saved');
        expect(result.current.queue[1].status).toBe('ready');
    });
});

describe('useFileQueue — SELECT_GROUP', () => {
    it('selectGroup で groupOverride が設定される', async () => {
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
            result.current.selectGroup(itemId, 'newgroup1', '別のグループ');
        });

        expect(result.current.queue[0].groupOverride).toEqual({
            groupId: 'newgroup1',
            groupName: '別のグループ',
        });
        expect(result.current.queue[0].status).toBe('ready');
    });

    it('警告がundefinedのパース結果でもwarningsが空配列になる', async () => {
        const resultWithoutWarnings = {
            ok: true,
            parsedSession: {
                sessionId: '01TESTSESSION00000000000',
                groupName: '',
                date: '2026-01-15',
                startedAt: '2026-01-15T19:00:00',
                endedAt: null,
                attendances: [
                    { memberName: '佐藤 太郎', memberEmail: 'taro@example.com', durationSeconds: 3600 },
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

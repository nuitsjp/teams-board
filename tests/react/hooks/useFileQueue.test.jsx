import { renderHook, act } from '@testing-library/react';
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
        await vi.waitFor(() => {
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

        await vi.waitFor(() => {
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

        await vi.waitFor(() => {
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

        await vi.waitFor(() => {
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

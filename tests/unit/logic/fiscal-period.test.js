import { getFiscalPeriod, getFiscalPeriodFromSortKey } from '../../../src/utils/fiscal-period.js';

describe('getFiscalPeriod', () => {
    it('上期に属するセッションを分類する（2025-06-15 → 2025年度 上期）', () => {
        const result = getFiscalPeriod('2025-06-15');
        expect(result).toEqual({
            fiscalYear: 2025,
            half: 'first',
            label: '2025年度 上期',
            sortKey: 20250,
        });
    });

    it('下期に属するセッションを分類する（10〜12月: 2025-11-20 → 2025年度 下期）', () => {
        const result = getFiscalPeriod('2025-11-20');
        expect(result).toEqual({
            fiscalYear: 2025,
            half: 'second',
            label: '2025年度 下期',
            sortKey: 20251,
        });
    });

    it('下期に属するセッションを分類する（1〜3月: 2026-02-03 → 2025年度 下期）', () => {
        const result = getFiscalPeriod('2026-02-03');
        expect(result).toEqual({
            fiscalYear: 2025,
            half: 'second',
            label: '2025年度 下期',
            sortKey: 20251,
        });
    });

    it('年度の境界: 3月31日は前年度の下期に属する', () => {
        const result = getFiscalPeriod('2026-03-31');
        expect(result).toEqual({
            fiscalYear: 2025,
            half: 'second',
            label: '2025年度 下期',
            sortKey: 20251,
        });
    });

    it('年度の境界: 4月1日は新年度の上期に属する', () => {
        const result = getFiscalPeriod('2026-04-01');
        expect(result).toEqual({
            fiscalYear: 2026,
            half: 'first',
            label: '2026年度 上期',
            sortKey: 20260,
        });
    });

    it('上期の全月（4〜9月）を正しく分類する', () => {
        for (const month of ['04', '05', '06', '07', '08', '09']) {
            const result = getFiscalPeriod(`2025-${month}-15`);
            expect(result.half).toBe('first');
            expect(result.fiscalYear).toBe(2025);
        }
    });

    it('下期の全月（10〜3月）を正しく分類する', () => {
        for (const month of ['10', '11', '12']) {
            const result = getFiscalPeriod(`2025-${month}-15`);
            expect(result.half).toBe('second');
            expect(result.fiscalYear).toBe(2025);
        }
        for (const month of ['01', '02', '03']) {
            const result = getFiscalPeriod(`2026-${month}-15`);
            expect(result.half).toBe('second');
            expect(result.fiscalYear).toBe(2025);
        }
    });

    it('sortKey で降順ソートすると「下期 → 上期」の順になる', () => {
        const firstHalf = getFiscalPeriod('2025-06-15');
        const secondHalf = getFiscalPeriod('2025-11-20');
        expect(secondHalf.sortKey).toBeGreaterThan(firstHalf.sortKey);
    });
});

describe('getFiscalPeriodFromSortKey', () => {
    it('上期の sortKey から期情報を逆算する（20250 → 2025年度 上期）', () => {
        expect(getFiscalPeriodFromSortKey(20250)).toEqual({
            fiscalYear: 2025,
            half: 'first',
            label: '2025年度 上期',
            sortKey: 20250,
        });
    });

    it('下期の sortKey から期情報を逆算する（20251 → 2025年度 下期）', () => {
        expect(getFiscalPeriodFromSortKey(20251)).toEqual({
            fiscalYear: 2025,
            half: 'second',
            label: '2025年度 下期',
            sortKey: 20251,
        });
    });

    it('文字列の sortKey も受け付ける', () => {
        expect(getFiscalPeriodFromSortKey('20240')).toEqual({
            fiscalYear: 2024,
            half: 'first',
            label: '2024年度 上期',
            sortKey: 20240,
        });
    });

    it('不正な halfIndex の場合は null を返す', () => {
        expect(getFiscalPeriodFromSortKey(20252)).toBeNull();
    });

    it('数値に変換できない値の場合は null を返す', () => {
        expect(getFiscalPeriodFromSortKey('abc')).toBeNull();
    });

    it('getFiscalPeriod の結果と getFiscalPeriodFromSortKey が往復一致する', () => {
        const original = getFiscalPeriod('2025-11-20');
        const restored = getFiscalPeriodFromSortKey(original.sortKey);
        expect(restored).toEqual(original);
    });
});

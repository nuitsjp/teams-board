/**
 * 日付文字列から年度の上期・下期を算出する
 * 上期 = 4月〜9月、下期 = 10月〜3月
 * 年度は4月始まり（1〜3月は前年度の下期に属する）
 *
 * @param {string} dateString - YYYY-MM-DD 形式の日付文字列
 * @returns {{ fiscalYear: number, half: 'first' | 'second', label: string, sortKey: number }}
 */
export function getFiscalPeriod(dateString) {
    const [yearStr, monthStr] = dateString.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);

    const isFirstHalf = month >= 4 && month <= 9;
    const fiscalYear = month >= 4 ? year : year - 1;
    const half = isFirstHalf ? 'first' : 'second';
    const label = `${fiscalYear}年度 ${isFirstHalf ? '上期' : '下期'}`;
    const sortKey = fiscalYear * 10 + (half === 'second' ? 1 : 0);

    return { fiscalYear, half, label, sortKey };
}

/**
 * sortKey（数値または文字列）から年度の期情報を逆算する
 * sortKey の形式: fiscalYear * 10 + halfIndex（0 = 上期、1 = 下期）
 * 例: 20251 → 2025年度 下期、20240 → 2024年度 上期
 *
 * @param {number|string} sortKey - sortKey 値
 * @returns {{ fiscalYear: number, half: 'first' | 'second', label: string, sortKey: number } | null}
 */
export function getFiscalPeriodFromSortKey(sortKey) {
    const key = Number(sortKey);
    if (!Number.isFinite(key) || key < 0) {
        return null;
    }

    const halfIndex = key % 10;
    if (halfIndex !== 0 && halfIndex !== 1) {
        return null;
    }

    const fiscalYear = Math.floor(key / 10);
    const half = halfIndex === 1 ? 'second' : 'first';
    const label = `${fiscalYear}年度 ${half === 'first' ? '上期' : '下期'}`;

    return { fiscalYear, half, label, sortKey: key };
}

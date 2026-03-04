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
 * sortKey（termKey）から期ラベルを復元する
 * @param {string|number} termKey - sortKey 形式（例: "20240" = 2024年度 上期）
 * @returns {string} 期ラベル（例: "2024年度 上期"）
 */
export function termKeyToLabel(termKey) {
    const key = Number(termKey);
    const fiscalYear = Math.floor(key / 10);
    const halfDigit = key % 10;
    return `${fiscalYear}年度 ${halfDigit === 0 ? '上期' : '下期'}`;
}

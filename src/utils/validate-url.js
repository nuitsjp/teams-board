/**
 * URL が http または https スキームかを検証する
 * @param {string} url - 検証対象の URL 文字列
 * @returns {boolean} 有効な http/https URL の場合 true
 */
export function isValidUrl(url) {
    if (!url || typeof url !== 'string') return false;
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
}

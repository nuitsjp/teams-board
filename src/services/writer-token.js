/**
 * writer-token.json から一般ユーザー用の書き込み SAS トークンを取得する
 * @returns {Promise<string|null>} SAS トークン文字列、取得失敗時は null
 */
export async function fetchWriterToken() {
    try {
        const response = await fetch(`data/writer-token.json?v=${Date.now()}`);
        if (!response.ok) return null;
        const { sasToken } = await response.json();
        return sasToken || null;
    } catch {
        return null;
    }
}

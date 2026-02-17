// session-ref.js — sessionRevision 文字列（<sessionId>/<revision>）の操作ヘルパー

/**
 * sessionRef 文字列を生成する
 * @param {string} sessionId - ULID 形式のセッションID
 * @param {number} revision - リビジョン番号（0始まり）
 * @returns {string} "sessionId/revision" 形式の文字列
 */
export function createSessionRef(sessionId, revision) {
    return `${sessionId}/${revision}`;
}

/**
 * sessionRef 文字列をパースする
 * @param {string} ref - "sessionId/revision" 形式の文字列
 * @returns {{ sessionId: string, revision: number }}
 */
export function parseSessionRef(ref) {
    const slashIndex = ref.lastIndexOf('/');
    return {
        sessionId: ref.slice(0, slashIndex),
        revision: Number(ref.slice(slashIndex + 1)),
    };
}

/**
 * sessionRef からファイルパスを生成する
 * @param {string} ref - "sessionId/revision" 形式の文字列
 * @returns {string} "data/sessions/sessionId/revision.json"
 */
export function sessionRefToPath(ref) {
    const { sessionId, revision } = parseSessionRef(ref);
    return `data/sessions/${sessionId}/${revision}.json`;
}

/**
 * sessionRef のリビジョンを +1 した新しい ref を返す
 * @param {string} ref - "sessionId/revision" 形式の文字列
 * @returns {string} リビジョンをインクリメントした新しい ref
 */
export function incrementRevision(ref) {
    const { sessionId, revision } = parseSessionRef(ref);
    return createSessionRef(sessionId, revision + 1);
}

/**
 * sessionRef から sessionId 部分を抽出する
 * @param {string} ref - "sessionId/revision" 形式の文字列
 * @returns {string}
 */
export function getSessionId(ref) {
    return ref.slice(0, ref.lastIndexOf('/'));
}

/**
 * sessionRef から revision 数値を抽出する
 * @param {string} ref - "sessionId/revision" 形式の文字列
 * @returns {number}
 */
export function getRevision(ref) {
    return Number(ref.slice(ref.lastIndexOf('/') + 1));
}

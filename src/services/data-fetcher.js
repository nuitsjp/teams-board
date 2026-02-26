// DataFetcher — 静的サイトからのJSONデータ取得（V2: sessionRef ベース）
import { sessionRefToPath } from './session-ref.js';

const DEFAULT_INDEX_TTL = 30_000;
const DEFAULT_SESSION_TTL = 30_000;

/**
 * セッション JSON のデシリアライズ処理
 * 存在しないフィールドにデフォルト値をセットする
 * @param {object} data - 生のセッション JSON データ
 * @returns {object} 正規化されたセッションデータ
 */
function deserializeSession(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return { instructors: [] };
    }
    return {
        ...data,
        instructors: Array.isArray(data.instructors) ? data.instructors : [],
    };
}

export class DataFetcher {
    /** @type {number} index.json キャッシュの TTL（ミリ秒） */
    #indexTtl;

    /** @type {number} セッション JSON キャッシュの TTL（ミリ秒） */
    #sessionTtl;

    /** @type {{ data: {ok: true, data: object}, timestamp: number } | null} */
    #indexCache = null;

    /** @type {Map<string, {data: {ok: true, data: object}, timestamp: number}>} */
    #sessionCache = new Map();

    /** @type {Map<string, Promise<{ok: true, data: object} | {ok: false, error: string}>>} */
    #inflight = new Map();

    /**
     * @param {object} [options]
     * @param {number} [options.indexTtl=30000] index.json キャッシュの TTL（ミリ秒）
     * @param {number} [options.sessionTtl=30000] セッション JSON キャッシュの TTL（ミリ秒）
     */
    constructor({ indexTtl = DEFAULT_INDEX_TTL, sessionTtl = DEFAULT_SESSION_TTL } = {}) {
        this.#indexTtl = indexTtl;
        this.#sessionTtl = sessionTtl;
    }

    /**
     * index.json のキャッシュを明示的に無効化する
     */
    invalidateIndexCache() {
        this.#indexCache = null;
    }

    /**
     * セッションJSONキャッシュを明示的に無効化する
     * @param {string} [sessionRef] 指定時は対象セッションのみ無効化。
     *   省略時はセッションキャッシュを全消去する。
     */
    invalidateSessionCache(sessionRef) {
        if (typeof sessionRef === 'string' && sessionRef.length > 0) {
            this.#sessionCache.delete(sessionRefToPath(sessionRef));
            return;
        }
        this.#sessionCache.clear();
    }

    /**
     * index.jsonを取得する（TTL ベースキャッシュ付き）
     * @returns {Promise<{ok: true, data: object} | {ok: false, error: string}>}
     */
    async fetchIndex() {
        // TTL 内のキャッシュヒット
        if (this.#indexCache && Date.now() - this.#indexCache.timestamp < this.#indexTtl) {
            return this.#indexCache.data;
        }

        const url = `data/index.json?v=${Date.now()}`;
        const result = await this.#fetchJsonWithDedup(url);

        // 成功時のみキャッシュに保存
        if (result.ok) {
            this.#indexCache = { data: result, timestamp: Date.now() };
        }

        return result;
    }

    /**
     * セッション詳細JSONを取得する（V2: sessionRef ベース）
     * V2 ではセッションファイルは不変（追記のみ）なのでキャッシュバスター不要。
     * @param {string} sessionRef - "sessionId/revision" 形式
     * @returns {Promise<{ok: true, data: object} | {ok: false, error: string}>}
     */
    async fetchSession(sessionRef) {
        const cacheKey = sessionRefToPath(sessionRef);

        // TTL ベースキャッシュヒット
        const cached = this.#sessionCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.#sessionTtl) {
            return cached.data;
        }

        // V2 セッションは不変のためキャッシュバスター不要
        const result = await this.#fetchJsonWithDedup(cacheKey);

        // 成功時のみキャッシュに保存（デシリアライズ処理を適用）
        if (result.ok) {
            const deserialized = { ok: true, data: deserializeSession(result.data) };
            this.#sessionCache.set(cacheKey, { data: deserialized, timestamp: Date.now() });
            return deserialized;
        }

        return result;
    }

    /**
     * 重複排除付きの JSON 取得
     * @param {string} url
     * @returns {Promise<{ok: true, data: object} | {ok: false, error: string}>}
     */
    async #fetchJsonWithDedup(url) {
        // inflight チェック — 同一 URL の進行中 Promise を返す
        const inflight = this.#inflight.get(url);
        if (inflight) {
            return inflight;
        }

        // 新規 fetch の Promise を inflight に登録
        const promise = this.#fetchJson(url).finally(() => {
            this.#inflight.delete(url);
        });
        this.#inflight.set(url, promise);

        return promise;
    }

    /**
     * @param {string} url
     * @returns {Promise<{ok: true, data: object} | {ok: false, error: string}>}
     */
    async #fetchJson(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                return { ok: false, error: `HTTP ${response.status} ${response.statusText}` };
            }
            const data = await response.json();
            return { ok: true, data };
        } catch (err) {
            return { ok: false, error: err.message };
        }
    }
}

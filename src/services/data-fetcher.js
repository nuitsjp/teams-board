// DataFetcher — 静的サイトからのJSONデータ取得（キャッシュ・重複排除付き）
const DEFAULT_INDEX_TTL = 30_000;

export class DataFetcher {
    /** @type {number} index.json キャッシュの TTL（ミリ秒） */
    #indexTtl;

    /** @type {{ data: {ok: true, data: object}, timestamp: number } | null} */
    #indexCache = null;

    /** @type {Map<string, {ok: true, data: object}>} */
    #sessionCache = new Map();

    /** @type {Map<string, Promise<{ok: true, data: object} | {ok: false, error: string}>>} */
    #inflight = new Map();

    /**
     * @param {object} [options]
     * @param {number} [options.indexTtl=30000] index.json キャッシュの TTL（ミリ秒）
     */
    constructor({ indexTtl = DEFAULT_INDEX_TTL } = {}) {
        this.#indexTtl = indexTtl;
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
     * セッション詳細JSONを取得する（永続キャッシュ付き、不変リソース）
     * @param {string} sessionId
     * @returns {Promise<{ok: true, data: object} | {ok: false, error: string}>}
     */
    async fetchSession(sessionId) {
        const url = `data/sessions/${sessionId}.json`;

        // 永続キャッシュヒット
        const cached = this.#sessionCache.get(url);
        if (cached) {
            return cached;
        }

        const result = await this.#fetchJsonWithDedup(url);

        // 成功時のみキャッシュに保存
        if (result.ok) {
            this.#sessionCache.set(url, result);
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

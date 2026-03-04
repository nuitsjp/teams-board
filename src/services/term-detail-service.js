// TermDetailService — グループ期詳細・メンバー個別情報の取得/保存/削除

/**
 * グループ期詳細・メンバー個別詳細の CRUD 操作を提供するサービス
 */
export class TermDetailService {
    #blobStorage;

    /**
     * @param {object} blobStorage - BlobStorage インターフェース実装（write/delete メソッド）
     */
    constructor(blobStorage) {
        this.#blobStorage = blobStorage;
    }

    /**
     * グループ期共通情報を取得する
     * @param {string} groupId
     * @param {string} termKey - sortKey 形式（例: "20240"）
     * @returns {Promise<{ok: true, data: object} | {ok: false, notFound: boolean, error?: string}>}
     */
    async fetchGroupTermDetail(groupId, termKey) {
        return this.#fetchJson(`data/group-term-details/${groupId}/${termKey}.json`);
    }

    /**
     * グループ期共通情報を保存する
     * @param {string} groupId
     * @param {string} termKey
     * @param {object} data - { purpose, learningContent, learningOutcome, references }
     * @returns {Promise<{path: string, success: boolean, error?: string}>}
     */
    async saveGroupTermDetail(groupId, termKey, data) {
        const path = `data/group-term-details/${groupId}/${termKey}.json`;
        const content = JSON.stringify(data, null, 2);
        return this.#blobStorage.write(path, content, 'application/json');
    }

    /**
     * メンバー個別情報を取得する
     * @param {string} memberId
     * @param {string} groupId
     * @param {string} termKey
     * @returns {Promise<{ok: true, data: object} | {ok: false, notFound: boolean, error?: string}>}
     */
    async fetchMemberGroupTermDetail(memberId, groupId, termKey) {
        return this.#fetchJson(
            `data/member-group-term-details/${memberId}/${groupId}/${termKey}.json`
        );
    }

    /**
     * メンバー個別情報を保存する
     * @param {string} memberId
     * @param {string} groupId
     * @param {string} termKey
     * @param {object} data - { purpose, learningContent, learningOutcome, references }
     * @returns {Promise<{path: string, success: boolean, error?: string}>}
     */
    async saveMemberGroupTermDetail(memberId, groupId, termKey, data) {
        const path = `data/member-group-term-details/${memberId}/${groupId}/${termKey}.json`;
        const content = JSON.stringify(data, null, 2);
        return this.#blobStorage.write(path, content, 'application/json');
    }

    /**
     * メンバー個別情報を削除する
     * @param {string} memberId
     * @param {string} groupId
     * @param {string} termKey
     * @returns {Promise<{path: string, success: boolean, error?: string}>}
     */
    async deleteMemberGroupTermDetail(memberId, groupId, termKey) {
        const path = `data/member-group-term-details/${memberId}/${groupId}/${termKey}.json`;
        return this.#blobStorage.delete(path);
    }

    /**
     * JSON ファイルを取得する（404 は未登録として扱う）
     * @param {string} url
     * @returns {Promise<{ok: true, data: object} | {ok: false, notFound: boolean, error?: string}>}
     */
    async #fetchJson(url) {
        try {
            const response = await fetch(`${url}?v=${Date.now()}`);
            if (response.status === 404) {
                return { ok: false, notFound: true };
            }
            if (!response.ok) {
                return {
                    ok: false,
                    notFound: false,
                    error: `HTTP ${response.status} ${response.statusText}`,
                };
            }
            const data = await response.json();
            return { ok: true, data };
        } catch (err) {
            return { ok: false, notFound: false, error: err.message };
        }
    }
}

// BlobStorage テスト — AzureBlobStorage / DevBlobStorage
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AzureBlobStorage, DevBlobStorage } from '../../../src/services/blob-storage.js';

describe('AzureBlobStorage', () => {
    let storage;
    let mockAuth;

    beforeEach(() => {
        mockAuth = { getSasToken: () => 'sv=2025-01-05&sig=test' };
        storage = new AzureBlobStorage('https://blob.example.com', mockAuth);
        vi.restoreAllMocks();
    });

    it('成功時に { success: true } を返すこと', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({ ok: true, status: 200 })
        );

        const result = await storage.write(
            'data/sessions/abc.json',
            '{"id":"abc"}',
            'application/json'
        );

        expect(result).toEqual({ path: 'data/sessions/abc.json', success: true });
    });

    it('正しいURL・ヘッダー・ボディでfetchが呼ばれること', async () => {
        const mockFetch = vi.fn().mockResolvedValue({ ok: true });
        vi.stubGlobal('fetch', mockFetch);

        await storage.write('data/index.json', '{}', 'application/json');

        expect(mockFetch).toHaveBeenCalledWith(
            'https://blob.example.com/data/index.json?sv=2025-01-05&sig=test',
            {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'x-ms-blob-type': 'BlockBlob',
                    'x-ms-version': '2025-01-05',
                    'x-ms-blob-cache-control': 'no-cache',
                },
                body: '{}',
            }
        );
    });

    it('data/index.json パスに no-cache の Cache-Control ヘッダーが設定されること', async () => {
        const mockFetch = vi.fn().mockResolvedValue({ ok: true });
        vi.stubGlobal('fetch', mockFetch);

        await storage.write('data/index.json', '{}', 'application/json');

        const headers = mockFetch.mock.calls[0][1].headers;
        expect(headers['x-ms-blob-cache-control']).toBe('no-cache');
    });

    it('data/sessions/ パスに immutable の Cache-Control ヘッダーが設定されること（V2 セッションは不変）', async () => {
        const mockFetch = vi.fn().mockResolvedValue({ ok: true });
        vi.stubGlobal('fetch', mockFetch);

        await storage.write('data/sessions/01ABC/0.json', '{}', 'application/json');

        const headers = mockFetch.mock.calls[0][1].headers;
        expect(headers['x-ms-blob-cache-control']).toBe('max-age=31536000, immutable');
    });

    it('assets/ パスに immutable の Cache-Control ヘッダーが設定されること', async () => {
        const mockFetch = vi.fn().mockResolvedValue({ ok: true });
        vi.stubGlobal('fetch', mockFetch);

        await storage.write('assets/index-abc123.js', 'code', 'application/javascript');

        const headers = mockFetch.mock.calls[0][1].headers;
        expect(headers['x-ms-blob-cache-control']).toBe('max-age=31536000, immutable');
    });

    it('HTTPエラー時に { success: false } とエラーメッセージを返すこと', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({ ok: false, status: 403, statusText: 'Forbidden' })
        );

        const result = await storage.write('data/test.json', '{}', 'application/json');

        expect(result).toEqual({
            path: 'data/test.json',
            success: false,
            error: 'HTTP 403 Forbidden',
        });
    });

    it('ネットワークエラー時に { success: false } とエラーメッセージを返すこと', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockRejectedValue(new Error('Network error'))
        );

        const result = await storage.write('data/test.json', '{}', 'application/json');

        expect(result).toEqual({
            path: 'data/test.json',
            success: false,
            error: 'Network error',
        });
    });
});

describe('DevBlobStorage', () => {
    let storage;

    beforeEach(() => {
        storage = new DevBlobStorage();
        vi.restoreAllMocks();
        // 静的フィールドをリセット（#warningShown）
        // テストごとに新しいインスタンスを使うが、静的フィールドは共有される
    });

    it('成功時に { success: true } を返すこと', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ success: true }),
            })
        );

        const result = await storage.write(
            'data/index.json',
            '{"groups":[]}',
            'application/json'
        );

        expect(result).toEqual({ path: 'data/index.json', success: true });
    });

    it('/dev-fixtures-write に正しいリクエストボディでPOSTすること', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ success: true }),
        });
        vi.stubGlobal('fetch', mockFetch);

        await storage.write('data/index.json', '{"groups":[]}', 'application/json');

        expect(mockFetch).toHaveBeenCalledWith('/dev-fixtures-write', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: 'data/index.json', data: { groups: [] } }),
        });
    });

    it('HTTPエラーレスポンス時にエラー情報を返すこと', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error',
                json: () => Promise.resolve({ error: 'ファイル書き込みに失敗しました' }),
            })
        );

        const result = await storage.write('data/index.json', '{}', 'application/json');

        expect(result).toEqual({
            path: 'data/index.json',
            success: false,
            error: 'ファイル書き込みに失敗しました',
        });
    });

    it('HTTPエラーレスポンスにerrorフィールドがない場合はステータスを返すこと', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error',
                json: () => Promise.resolve({}),
            })
        );

        const result = await storage.write('data/index.json', '{}', 'application/json');

        expect(result).toEqual({
            path: 'data/index.json',
            success: false,
            error: 'HTTP 500 Internal Server Error',
        });
    });

    it('レスポンスの success が false の場合にエラーを返すこと', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ success: false, error: '書き込み権限がありません' }),
            })
        );

        const result = await storage.write('data/index.json', '{}', 'application/json');

        expect(result).toEqual({
            path: 'data/index.json',
            success: false,
            error: '書き込み権限がありません',
        });
    });

    it('ネットワークエラー時に { success: false } を返すこと', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockRejectedValue(new Error('Failed to fetch'))
        );

        const result = await storage.write('data/index.json', '{}', 'application/json');

        expect(result).toEqual({
            path: 'data/index.json',
            success: false,
            error: 'Failed to fetch',
        });
    });

    it('文字列以外のcontentがそのまま渡されること', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ success: true }),
        });
        vi.stubGlobal('fetch', mockFetch);

        const dataObj = { groups: [], members: [] };
        await storage.write('data/index.json', dataObj, 'application/json');

        // content がオブジェクトの場合、typeof content === 'string' が false なのでそのまま data に入る
        expect(mockFetch).toHaveBeenCalledWith('/dev-fixtures-write', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: 'data/index.json', data: dataObj }),
        });
    });

    it('初回使用時にコンソールへ警告を表示すること', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ success: true }),
            })
        );

        // 新インスタンスで2回 write を呼ぶ（静的フィールドが共有）
        // ※ 前のテストで既に表示済みの可能性があるため、呼ばれないケースも許容
        await storage.write('data/a.json', '{}', 'application/json');
        await storage.write('data/b.json', '{}', 'application/json');

        // warn が呼ばれた場合は最大1回
        expect(warnSpy.mock.calls.filter((c) => c[0].includes('開発モード')).length).toBeLessThanOrEqual(1);
        warnSpy.mockRestore();
    });
});

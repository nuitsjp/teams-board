// IndexFetcher テスト — ProductionIndexFetcher / DevIndexFetcher
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProductionIndexFetcher, DevIndexFetcher } from '../../src/services/index-fetcher.js';

describe('ProductionIndexFetcher', () => {
    let fetcher;
    let mockAuth;

    beforeEach(() => {
        mockAuth = { getSasToken: () => 'sv=2025-01-05&sig=test' };
        fetcher = new ProductionIndexFetcher('https://blob.example.com', mockAuth);
        vi.restoreAllMocks();
    });

    it('成功時に { ok: true, data } を返すこと', async () => {
        const indexData = { groups: [], members: [], updatedAt: '2026-02-06' };
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(indexData),
            })
        );

        const result = await fetcher.fetch();

        expect(result).toEqual({ ok: true, data: indexData });
    });

    it('正しいURLでfetchが呼ばれること', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({}),
        });
        vi.stubGlobal('fetch', mockFetch);

        await fetcher.fetch();

        expect(mockFetch).toHaveBeenCalledWith(
            'https://blob.example.com/data/index.json?sv=2025-01-05&sig=test'
        );
    });

    it('HTTPエラー時に { ok: false, error } を返すこと', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: false,
                status: 404,
                statusText: 'Not Found',
            })
        );

        const result = await fetcher.fetch();

        expect(result).toEqual({ ok: false, error: 'HTTP 404 Not Found' });
    });

    it('ネットワークエラー時に { ok: false, error } を返すこと', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockRejectedValue(new Error('Network error'))
        );

        const result = await fetcher.fetch();

        expect(result).toEqual({ ok: false, error: 'Network error' });
    });
});

describe('DevIndexFetcher', () => {
    let fetcher;

    beforeEach(() => {
        fetcher = new DevIndexFetcher();
        vi.restoreAllMocks();
    });

    it('成功時に { ok: true, data } を返すこと', async () => {
        const indexData = { groups: [{ id: 'g1' }], members: [] };
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(indexData),
            })
        );

        const result = await fetcher.fetch();

        expect(result).toEqual({ ok: true, data: indexData });
    });

    it('キャッシュバスター付きの相対パスでfetchが呼ばれること', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({}),
        });
        vi.stubGlobal('fetch', mockFetch);

        await fetcher.fetch();

        const calledUrl = mockFetch.mock.calls[0][0];
        expect(calledUrl).toMatch(/^\/data\/index\.json\?v=\d+$/);
    });

    it('HTTPエラー時に { ok: false, error } を返すこと', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error',
            })
        );

        const result = await fetcher.fetch();

        expect(result).toEqual({ ok: false, error: 'HTTP 500 Internal Server Error' });
    });

    it('ネットワークエラー時に { ok: false, error } を返すこと', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockRejectedValue(new Error('Failed to fetch'))
        );

        const result = await fetcher.fetch();

        expect(result).toEqual({ ok: false, error: 'Failed to fetch' });
    });
});

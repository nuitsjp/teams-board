import { fetchWriterToken } from '../../../src/services/writer-token.js';

describe('fetchWriterToken', () => {
    let originalFetch;

    beforeEach(() => {
        originalFetch = global.fetch;
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    it('正常取得時に SAS トークン文字列を返すこと', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ sasToken: 'writer-sas-token-123' }),
        });

        const token = await fetchWriterToken();
        expect(token).toBe('writer-sas-token-123');
    });

    it('HTTP エラー時に null を返すこと', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 404,
        });

        const token = await fetchWriterToken();
        expect(token).toBeNull();
    });

    it('ネットワークエラー時に null を返すこと', async () => {
        global.fetch = vi.fn().mockRejectedValue(new Error('Network Error'));

        const token = await fetchWriterToken();
        expect(token).toBeNull();
    });

    it('sasToken フィールドがない場合 null を返すこと', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ otherField: 'value' }),
        });

        const token = await fetchWriterToken();
        expect(token).toBeNull();
    });

    it('キャッシュバスター付き URL で fetch が呼ばれること', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ sasToken: 'token' }),
        });

        await fetchWriterToken();

        expect(global.fetch).toHaveBeenCalledTimes(1);
        const url = global.fetch.mock.calls[0][0];
        expect(url).toMatch(/^data\/writer-token\.json\?v=\d+$/);
    });
});

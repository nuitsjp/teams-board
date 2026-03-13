// TermDetailService テスト — グループ/メンバー期詳細の取得・保存・削除
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TermDetailService } from '../../../src/services/term-detail-service.js';

describe('TermDetailService.fetchGroupTermDetail', () => {
    let mockFetch;

    beforeEach(() => {
        mockFetch = vi.fn();
        vi.stubGlobal('fetch', mockFetch);
    });

    it('成功時に { ok: true, data } を返すこと', async () => {
        const detailData = { memo: 'テストメモ', goals: ['目標1'] };
        mockFetch.mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(detailData),
        });

        const result = await TermDetailService.fetchGroupTermDetail('g1', '20251');

        expect(result).toEqual({ ok: true, data: detailData });
    });

    it('キャッシュバスター付きの正しい URL で fetch が呼ばれること', async () => {
        mockFetch.mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({}),
        });

        await TermDetailService.fetchGroupTermDetail('g1', '20251');

        const url = mockFetch.mock.calls[0][0];
        expect(url).toMatch(/^data\/group-term-details\/g1\/20251\.json\?v=\d+$/);
    });

    it('404レスポンス時に { ok: false, notFound: true } を返すこと', async () => {
        mockFetch.mockResolvedValue({
            ok: false,
            status: 404,
            statusText: 'Not Found',
        });

        const result = await TermDetailService.fetchGroupTermDetail('g1', '20251');

        expect(result).toEqual({ ok: false, notFound: true });
    });

    it('HTTPエラー時に { ok: false, notFound: false, error } を返すこと', async () => {
        mockFetch.mockResolvedValue({
            ok: false,
            status: 500,
            statusText: 'Internal Server Error',
        });

        const result = await TermDetailService.fetchGroupTermDetail('g1', '20251');

        expect(result).toEqual({
            ok: false,
            notFound: false,
            error: 'HTTP 500 Internal Server Error',
        });
    });

    it('ネットワークエラー時に { ok: false, notFound: false, error } を返すこと', async () => {
        mockFetch.mockRejectedValue(new Error('Network error'));

        const result = await TermDetailService.fetchGroupTermDetail('g1', '20251');

        expect(result).toEqual({
            ok: false,
            notFound: false,
            error: 'Network error',
        });
    });
});

describe('TermDetailService#saveGroupTermDetail', () => {
    let service;
    let mockBlobStorage;

    beforeEach(() => {
        mockBlobStorage = {
            write: vi.fn().mockResolvedValue({ success: true }),
            delete: vi.fn(),
        };
        service = new TermDetailService(mockBlobStorage);
    });

    it('正しいパス・コンテンツ・Content-Type で blobStorage.write を呼ぶこと', async () => {
        const data = { memo: 'テスト', goals: ['目標A'] };

        await service.saveGroupTermDetail('g1', '20251', data);

        expect(mockBlobStorage.write).toHaveBeenCalledWith(
            'data/group-term-details/g1/20251.json',
            JSON.stringify(data, null, 2),
            'application/json'
        );
    });

    it('blobStorage.write の戻り値をそのまま返すこと', async () => {
        const writeResult = { path: 'data/group-term-details/g1/20251.json', success: true };
        mockBlobStorage.write.mockResolvedValue(writeResult);

        const result = await service.saveGroupTermDetail('g1', '20251', {});

        expect(result).toEqual(writeResult);
    });
});

describe('TermDetailService.fetchMemberGroupTermDetail', () => {
    let mockFetch;

    beforeEach(() => {
        mockFetch = vi.fn();
        vi.stubGlobal('fetch', mockFetch);
    });

    it('成功時に { ok: true, data } を返すこと', async () => {
        const detailData = { note: 'メンバーメモ' };
        mockFetch.mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(detailData),
        });

        const result = await TermDetailService.fetchMemberGroupTermDetail('m1', 'g1', '20251');

        expect(result).toEqual({ ok: true, data: detailData });
    });

    it('キャッシュバスター付きの正しい URL で fetch が呼ばれること', async () => {
        mockFetch.mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({}),
        });

        await TermDetailService.fetchMemberGroupTermDetail('m1', 'g1', '20251');

        const url = mockFetch.mock.calls[0][0];
        expect(url).toMatch(
            /^data\/member-group-term-details\/m1\/g1\/20251\.json\?v=\d+$/
        );
    });

    it('404レスポンス時に { ok: false, notFound: true } を返すこと', async () => {
        mockFetch.mockResolvedValue({
            ok: false,
            status: 404,
            statusText: 'Not Found',
        });

        const result = await TermDetailService.fetchMemberGroupTermDetail('m1', 'g1', '20251');

        expect(result).toEqual({ ok: false, notFound: true });
    });

    it('HTTPエラー時に { ok: false, notFound: false, error } を返すこと', async () => {
        mockFetch.mockResolvedValue({
            ok: false,
            status: 403,
            statusText: 'Forbidden',
        });

        const result = await TermDetailService.fetchMemberGroupTermDetail('m1', 'g1', '20251');

        expect(result).toEqual({
            ok: false,
            notFound: false,
            error: 'HTTP 403 Forbidden',
        });
    });

    it('ネットワークエラー時に { ok: false, notFound: false, error } を返すこと', async () => {
        mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));

        const result = await TermDetailService.fetchMemberGroupTermDetail('m1', 'g1', '20251');

        expect(result).toEqual({
            ok: false,
            notFound: false,
            error: 'Failed to fetch',
        });
    });
});

describe('TermDetailService#saveMemberGroupTermDetail', () => {
    let service;
    let mockBlobStorage;

    beforeEach(() => {
        mockBlobStorage = {
            write: vi.fn().mockResolvedValue({ success: true }),
            delete: vi.fn(),
        };
        service = new TermDetailService(mockBlobStorage);
    });

    it('正しいパス・コンテンツ・Content-Type で blobStorage.write を呼ぶこと', async () => {
        const data = { note: 'メンバーメモ' };

        await service.saveMemberGroupTermDetail('m1', 'g1', '20251', data);

        expect(mockBlobStorage.write).toHaveBeenCalledWith(
            'data/member-group-term-details/m1/g1/20251.json',
            JSON.stringify(data, null, 2),
            'application/json'
        );
    });

    it('blobStorage.write の戻り値をそのまま返すこと', async () => {
        const writeResult = {
            path: 'data/member-group-term-details/m1/g1/20251.json',
            success: true,
        };
        mockBlobStorage.write.mockResolvedValue(writeResult);

        const result = await service.saveMemberGroupTermDetail('m1', 'g1', '20251', {});

        expect(result).toEqual(writeResult);
    });
});

describe('TermDetailService#deleteMemberGroupTermDetail', () => {
    let service;
    let mockBlobStorage;

    beforeEach(() => {
        mockBlobStorage = {
            write: vi.fn(),
            delete: vi.fn().mockResolvedValue({ success: true }),
        };
        service = new TermDetailService(mockBlobStorage);
    });

    it('正しいパスで blobStorage.delete を呼ぶこと', async () => {
        await service.deleteMemberGroupTermDetail('m1', 'g1', '20251');

        expect(mockBlobStorage.delete).toHaveBeenCalledWith(
            'data/member-group-term-details/m1/g1/20251.json'
        );
    });

    it('blobStorage.delete の戻り値をそのまま返すこと', async () => {
        const deleteResult = {
            path: 'data/member-group-term-details/m1/g1/20251.json',
            success: true,
        };
        mockBlobStorage.delete.mockResolvedValue(deleteResult);

        const result = await service.deleteMemberGroupTermDetail('m1', 'g1', '20251');

        expect(result).toEqual(deleteResult);
    });
});

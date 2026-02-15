// DataFetcher テスト — キャッシュ・重複排除対応
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DataFetcher } from '../../src/services/data-fetcher.js';

describe('DataFetcher', () => {
    let fetcher;
    let mockFetch;

    beforeEach(() => {
        mockFetch = vi.fn();
        vi.stubGlobal('fetch', mockFetch);
        fetcher = new DataFetcher();
    });

    describe('fetchIndex', () => {
        it('data/index.json にキャッシュバスター付きでリクエストすること', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ groups: [], members: [], updatedAt: '' }),
            });
            await fetcher.fetchIndex();
            const url = mockFetch.mock.calls[0][0];
            expect(url).toMatch(/^data\/index\.json\?v=\d+$/);
        });

        it('成功時に { ok: true, data: DashboardIndex } を返すこと', async () => {
            const indexData = {
                groups: [
                    {
                        id: 'abc12345',
                        name: 'フロントエンド勉強会',
                        totalDurationSeconds: 3600,
                        sessionIds: ['abc12345-2026-01-15'],
                    },
                ],
                members: [
                    {
                        id: 'mem00001',
                        name: '佐藤 一郎',
                        totalDurationSeconds: 3600,
                        sessionIds: ['abc12345-2026-01-15'],
                    },
                ],
                updatedAt: '2026-02-01',
            };
            mockFetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(indexData),
            });
            const result = await fetcher.fetchIndex();
            expect(result).toEqual({ ok: true, data: indexData });
        });

        it('HTTPエラー時に { ok: false, error: string } を返すこと', async () => {
            mockFetch.mockResolvedValue({
                ok: false,
                status: 404,
                statusText: 'Not Found',
            });
            const result = await fetcher.fetchIndex();
            expect(result.ok).toBe(false);
            expect(result.error).toContain('404');
        });

        it('ネットワークエラー時に適切なエラー結果を返すこと', async () => {
            mockFetch.mockRejectedValue(new Error('Network error'));
            const result = await fetcher.fetchIndex();
            expect(result.ok).toBe(false);
            expect(result.error).toContain('Network error');
        });
    });

    describe('fetchSession', () => {
        it('data/sessions/<id>.json にキャッシュバスターなしでリクエストすること', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                json: () =>
                    Promise.resolve({
                        id: 'abc12345-2026-01-15',
                        groupId: 'abc12345',
                        date: '2026-01-15',
                        attendances: [],
                    }),
            });
            await fetcher.fetchSession('abc12345-2026-01-15');
            const url = mockFetch.mock.calls[0][0];
            expect(url).toBe('data/sessions/abc12345-2026-01-15.json');
            expect(url).not.toContain('?v=');
        });

        it('成功時に { ok: true, data: SessionRecord } を返すこと', async () => {
            const sessionData = {
                id: 'abc12345-2026-01-15',
                groupId: 'abc12345',
                date: '2026-01-15',
                attendances: [{ memberId: 'mem00001', durationSeconds: 3600 }],
            };
            mockFetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(sessionData),
            });
            const result = await fetcher.fetchSession('abc12345-2026-01-15');
            expect(result).toEqual({ ok: true, data: sessionData });
        });

        it('HTTPエラー時に { ok: false, error: string } を返すこと', async () => {
            mockFetch.mockResolvedValue({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error',
            });
            const result = await fetcher.fetchSession('missing');
            expect(result.ok).toBe(false);
            expect(result.error).toContain('500');
        });

        it('ネットワークエラー時に適切なエラー結果を返すこと', async () => {
            mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));
            const result = await fetcher.fetchSession('err');
            expect(result.ok).toBe(false);
            expect(result.error).toContain('Failed to fetch');
        });
    });

    describe('index.json キャッシュ', () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('TTL 内の再リクエストではキャッシュから返却し、fetch を呼ばないこと', async () => {
            const indexData = { groups: [], members: [], updatedAt: '' };
            mockFetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(indexData),
            });

            const result1 = await fetcher.fetchIndex();
            const result2 = await fetcher.fetchIndex();

            expect(mockFetch).toHaveBeenCalledTimes(1);
            expect(result1).toEqual({ ok: true, data: indexData });
            expect(result2).toEqual({ ok: true, data: indexData });
        });

        it('TTL 超過後はネットワークから再取得すること', async () => {
            const indexData1 = { groups: [], members: [], updatedAt: 'v1' };
            const indexData2 = { groups: [], members: [], updatedAt: 'v2' };
            mockFetch
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve(indexData1),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve(indexData2),
                });

            // カスタム TTL（5秒）のインスタンスを使用
            const shortTtlFetcher = new DataFetcher({ indexTtl: 5000 });

            await shortTtlFetcher.fetchIndex();
            vi.advanceTimersByTime(5001);
            const result2 = await shortTtlFetcher.fetchIndex();

            expect(mockFetch).toHaveBeenCalledTimes(2);
            expect(result2).toEqual({ ok: true, data: indexData2 });
        });

        it('失敗レスポンスをキャッシュに保存しないこと', async () => {
            mockFetch
                .mockResolvedValueOnce({
                    ok: false,
                    status: 500,
                    statusText: 'Internal Server Error',
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({ groups: [], members: [], updatedAt: '' }),
                });

            const result1 = await fetcher.fetchIndex();
            const result2 = await fetcher.fetchIndex();

            expect(result1.ok).toBe(false);
            expect(result2.ok).toBe(true);
            expect(mockFetch).toHaveBeenCalledTimes(2);
        });

        it('明示的無効化後は TTL 内でもネットワークから再取得すること', async () => {
            const indexData1 = { groups: [], members: [], updatedAt: 'v1' };
            const indexData2 = { groups: [], members: [], updatedAt: 'v2' };
            mockFetch
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve(indexData1),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve(indexData2),
                });

            await fetcher.fetchIndex();
            fetcher.invalidateIndexCache();
            const result2 = await fetcher.fetchIndex();

            expect(mockFetch).toHaveBeenCalledTimes(2);
            expect(result2).toEqual({ ok: true, data: indexData2 });
        });
    });

    describe('セッション JSON キャッシュ', () => {
        it('同一 sessionId の再リクエストではキャッシュから返却すること', async () => {
            const sessionData = {
                id: 'abc12345-2026-01-15',
                groupId: 'abc12345',
                date: '2026-01-15',
                attendances: [],
            };
            mockFetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(sessionData),
            });

            const result1 = await fetcher.fetchSession('abc12345-2026-01-15');
            const result2 = await fetcher.fetchSession('abc12345-2026-01-15');

            expect(mockFetch).toHaveBeenCalledTimes(1);
            expect(result1).toEqual({ ok: true, data: sessionData });
            expect(result2).toEqual({ ok: true, data: sessionData });
        });

        it('異なる sessionId は別々にリクエストすること', async () => {
            mockFetch
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({ id: 'session-a' }),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({ id: 'session-b' }),
                });

            await fetcher.fetchSession('session-a');
            await fetcher.fetchSession('session-b');

            expect(mockFetch).toHaveBeenCalledTimes(2);
        });

        it('失敗レスポンスをキャッシュに保存しないこと', async () => {
            mockFetch
                .mockResolvedValueOnce({
                    ok: false,
                    status: 404,
                    statusText: 'Not Found',
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({ id: 'abc12345' }),
                });

            const result1 = await fetcher.fetchSession('abc12345');
            const result2 = await fetcher.fetchSession('abc12345');

            expect(result1.ok).toBe(false);
            expect(result2.ok).toBe(true);
            expect(mockFetch).toHaveBeenCalledTimes(2);
        });
    });

    describe('重複排除', () => {
        it('同一 URL の同時リクエストを 1 つの fetch に統合すること', async () => {
            let resolveResponse;
            mockFetch.mockReturnValue(
                new Promise((resolve) => {
                    resolveResponse = resolve;
                })
            );

            // 同時に 2 つのリクエストを発行
            const promise1 = fetcher.fetchSession('abc12345');
            const promise2 = fetcher.fetchSession('abc12345');

            // fetch は 1 回のみ呼ばれる
            expect(mockFetch).toHaveBeenCalledTimes(1);

            // レスポンスを解決
            resolveResponse({
                ok: true,
                json: () => Promise.resolve({ id: 'abc12345' }),
            });

            const [result1, result2] = await Promise.all([promise1, promise2]);
            expect(result1).toEqual(result2);
            expect(result1).toEqual({ ok: true, data: { id: 'abc12345' } });
        });

        it('異なる URL は重複排除しないこと', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ id: 'dummy' }),
            });

            // 異なる sessionId で同時にリクエスト
            await Promise.all([
                fetcher.fetchSession('session-a'),
                fetcher.fetchSession('session-b'),
            ]);

            expect(mockFetch).toHaveBeenCalledTimes(2);
        });
    });

    describe('コンストラクタオプション', () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('indexTtl を指定するとカスタム TTL が適用されること', async () => {
            const customFetcher = new DataFetcher({ indexTtl: 1000 });
            mockFetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ groups: [], members: [], updatedAt: '' }),
            });

            await customFetcher.fetchIndex();

            // 1000ms 以内はキャッシュヒット
            vi.advanceTimersByTime(999);
            await customFetcher.fetchIndex();
            expect(mockFetch).toHaveBeenCalledTimes(1);

            // 1000ms 超過でキャッシュミス
            vi.advanceTimersByTime(2);
            await customFetcher.fetchIndex();
            expect(mockFetch).toHaveBeenCalledTimes(2);
        });

        it('デフォルトでは TTL が 30,000ms であること', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ groups: [], members: [], updatedAt: '' }),
            });

            await fetcher.fetchIndex();

            // 29,999ms ではキャッシュヒット
            vi.advanceTimersByTime(29_999);
            await fetcher.fetchIndex();
            expect(mockFetch).toHaveBeenCalledTimes(1);

            // 30,000ms 超過でキャッシュミス
            vi.advanceTimersByTime(2);
            await fetcher.fetchIndex();
            expect(mockFetch).toHaveBeenCalledTimes(2);
        });
    });

    describe('公開 API の後方互換性', () => {
        it('fetchIndex の成功時に { ok: true, data } を返すこと', async () => {
            const indexData = { groups: [], members: [], updatedAt: '' };
            mockFetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(indexData),
            });
            const result = await fetcher.fetchIndex();
            expect(result).toHaveProperty('ok', true);
            expect(result).toHaveProperty('data', indexData);
        });

        it('fetchIndex の失敗時に { ok: false, error } を返すこと', async () => {
            mockFetch.mockResolvedValue({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error',
            });
            const result = await fetcher.fetchIndex();
            expect(result).toHaveProperty('ok', false);
            expect(result).toHaveProperty('error');
            expect(typeof result.error).toBe('string');
        });

        it('fetchSession の成功時に { ok: true, data } を返すこと', async () => {
            const sessionData = { id: 'test-session' };
            mockFetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(sessionData),
            });
            const result = await fetcher.fetchSession('test-session');
            expect(result).toHaveProperty('ok', true);
            expect(result).toHaveProperty('data', sessionData);
        });

        it('fetchSession の失敗時に { ok: false, error } を返すこと', async () => {
            mockFetch.mockRejectedValue(new Error('Network error'));
            const result = await fetcher.fetchSession('err');
            expect(result).toHaveProperty('ok', false);
            expect(result).toHaveProperty('error');
            expect(typeof result.error).toBe('string');
        });
    });
});

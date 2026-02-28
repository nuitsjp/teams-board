// DataFetcher テスト — V2: sessionRef ベースのフェッチ・キャッシュ
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DataFetcher } from '../../../src/services/data-fetcher.js';

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
                schemaVersion: 2,
                version: 1,
                groups: [
                    {
                        id: '01ABC',
                        name: 'フロントエンド勉強会',
                        totalDurationSeconds: 3600,
                        sessionRevisions: ['01DEF/0'],
                    },
                ],
                members: [
                    {
                        id: '01GHI',
                        name: '佐藤 一郎',
                        totalDurationSeconds: 3600,
                        sessionRevisions: ['01DEF/0'],
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

    describe('fetchSession（V2: sessionRef ベース）', () => {
        it('sessionRef からパスを構築してリクエストすること（キャッシュバスターなし）', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                json: () =>
                    Promise.resolve({
                        sessionId: '01DEF',
                        revision: 0,
                        title: '',
                        startedAt: '2026-01-15T09:00:00.000Z',
                        endedAt: null,
                        attendances: [],
                        createdAt: '2026-01-15T09:00:00.000Z',
                    }),
            });
            await fetcher.fetchSession('01DEF/0');
            const url = mockFetch.mock.calls[0][0];
            // V2: キャッシュバスターなし、パスは data/sessions/<sessionId>/<revision>.json
            expect(url).toBe('data/sessions/01DEF/0.json');
        });

        it('成功時に { ok: true, data: SessionRecord } を返すこと', async () => {
            const sessionData = {
                sessionId: '01DEF',
                revision: 0,
                title: '',
                startedAt: '2026-01-15T09:00:00.000Z',
                endedAt: null,
                attendances: [{ memberId: '01GHI', durationSeconds: 3600 }],
                createdAt: '2026-01-15T09:00:00.000Z',
            };
            mockFetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(sessionData),
            });
            const result = await fetcher.fetchSession('01DEF/0');
            expect(result).toEqual({ ok: true, data: { ...sessionData, instructors: [] } });
        });

        it('HTTPエラー時に { ok: false, error: string } を返すこと', async () => {
            mockFetch.mockResolvedValue({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error',
            });
            const result = await fetcher.fetchSession('missing/0');
            expect(result.ok).toBe(false);
            expect(result.error).toContain('500');
        });

        it('ネットワークエラー時に適切なエラー結果を返すこと', async () => {
            mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));
            const result = await fetcher.fetchSession('err/0');
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

    describe('セッション JSON キャッシュ（V2: sessionRef ベース）', () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('TTL 内の再リクエストではキャッシュから返却し、fetch を呼ばないこと', async () => {
            const sessionData = {
                sessionId: '01DEF',
                revision: 0,
                title: '',
                startedAt: '2026-01-15T09:00:00.000Z',
                endedAt: null,
                attendances: [],
                createdAt: '2026-01-15T09:00:00.000Z',
            };
            mockFetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(sessionData),
            });

            const result1 = await fetcher.fetchSession('01DEF/0');
            const result2 = await fetcher.fetchSession('01DEF/0');

            expect(mockFetch).toHaveBeenCalledTimes(1);
            expect(result1).toEqual({ ok: true, data: { ...sessionData, instructors: [] } });
            expect(result2).toEqual({ ok: true, data: { ...sessionData, instructors: [] } });
        });

        it('TTL 超過後はネットワークから再取得すること', async () => {
            const sessionData1 = { sessionId: '01DEF', revision: 0 };
            const sessionData2 = { sessionId: '01DEF', revision: 1 };
            mockFetch
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve(sessionData1),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve(sessionData2),
                });

            const shortTtlFetcher = new DataFetcher({ sessionTtl: 5000 });

            await shortTtlFetcher.fetchSession('01DEF/0');
            vi.advanceTimersByTime(5001);
            const result2 = await shortTtlFetcher.fetchSession('01DEF/0');

            expect(mockFetch).toHaveBeenCalledTimes(2);
            expect(result2).toEqual({ ok: true, data: { ...sessionData2, instructors: [] } });
        });

        it('異なる sessionRef は別々にリクエストすること', async () => {
            mockFetch
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({ sessionId: 'session-a' }),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({ sessionId: 'session-b' }),
                });

            await fetcher.fetchSession('session-a/0');
            await fetcher.fetchSession('session-b/0');

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
                    json: () => Promise.resolve({ sessionId: '01DEF' }),
                });

            const result1 = await fetcher.fetchSession('01DEF/0');
            const result2 = await fetcher.fetchSession('01DEF/0');

            expect(result1.ok).toBe(false);
            expect(result2.ok).toBe(true);
            expect(mockFetch).toHaveBeenCalledTimes(2);
        });

        it('明示的無効化後は TTL 内でも再取得すること', async () => {
            mockFetch
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({ sessionId: '01DEF', title: 'v1' }),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({ sessionId: '01DEF', title: 'v2' }),
                });

            const result1 = await fetcher.fetchSession('01DEF/0');
            fetcher.invalidateSessionCache('01DEF/0');
            const result2 = await fetcher.fetchSession('01DEF/0');

            expect(result1).toEqual({ ok: true, data: { sessionId: '01DEF', title: 'v1', instructors: [] } });
            expect(result2).toEqual({ ok: true, data: { sessionId: '01DEF', title: 'v2', instructors: [] } });
            expect(mockFetch).toHaveBeenCalledTimes(2);

            // V2: キャッシュバスターなし
            expect(mockFetch.mock.calls[0][0]).toBe('data/sessions/01DEF/0.json');
            expect(mockFetch.mock.calls[1][0]).toBe('data/sessions/01DEF/0.json');
        });

        it('全消去（引数なし）後は再取得すること', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ sessionId: '01DEF' }),
            });

            await fetcher.fetchSession('01DEF/0');
            fetcher.invalidateSessionCache(); // 全消去
            await fetcher.fetchSession('01DEF/0');

            expect(mockFetch).toHaveBeenCalledTimes(2);
        });

        it('影響のない他のセッションは既存キャッシュ挙動を維持すること', async () => {
            mockFetch
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({ sessionId: 'session-a' }),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({ sessionId: 'session-b' }),
                });

            await fetcher.fetchSession('session-a/0');
            await fetcher.fetchSession('session-b/0');

            // session-a のみ無効化
            fetcher.invalidateSessionCache('session-a/0');

            // session-b は TTL 内キャッシュから返却（fetch 呼ばれない）
            await fetcher.fetchSession('session-b/0');
            expect(mockFetch).toHaveBeenCalledTimes(2);
        });
    });

    describe('重複排除', () => {
        it('同一 URL の同時リクエストを 1 つの fetch に統合すること', async () => {
            vi.useFakeTimers();
            let resolveResponse;
            mockFetch.mockReturnValue(
                new Promise((resolve) => {
                    resolveResponse = resolve;
                })
            );

            // 同時に 2 つのリクエストを発行
            const promise1 = fetcher.fetchSession('01DEF/0');
            const promise2 = fetcher.fetchSession('01DEF/0');

            // fetch は 1 回のみ呼ばれる
            expect(mockFetch).toHaveBeenCalledTimes(1);

            // レスポンスを解決
            resolveResponse({
                ok: true,
                json: () => Promise.resolve({ sessionId: '01DEF' }),
            });

            const [result1, result2] = await Promise.all([promise1, promise2]);
            expect(result1).toEqual(result2);
            expect(result1).toEqual({ ok: true, data: { sessionId: '01DEF', instructors: [] } });
            vi.useRealTimers();
        });

        it('異なる URL は重複排除しないこと', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ sessionId: 'dummy' }),
            });

            // 異なる sessionRef で同時にリクエスト
            await Promise.all([
                fetcher.fetchSession('session-a/0'),
                fetcher.fetchSession('session-b/0'),
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

        it('sessionTtl を指定するとカスタム TTL が適用されること', async () => {
            const customFetcher = new DataFetcher({ sessionTtl: 2000 });
            mockFetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ sessionId: 'session-1' }),
            });

            await customFetcher.fetchSession('session-1/0');

            // 2000ms 以内はキャッシュヒット
            vi.advanceTimersByTime(1999);
            await customFetcher.fetchSession('session-1/0');
            expect(mockFetch).toHaveBeenCalledTimes(1);

            // 2000ms 超過でキャッシュミス
            vi.advanceTimersByTime(2);
            await customFetcher.fetchSession('session-1/0');
            expect(mockFetch).toHaveBeenCalledTimes(2);
        });

        it('デフォルトでは indexTtl が 30,000ms であること', async () => {
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

        it('デフォルトでは sessionTtl が 30,000ms であること', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ sessionId: 'session-1' }),
            });

            await fetcher.fetchSession('session-1/0');

            // 29,999ms ではキャッシュヒット
            vi.advanceTimersByTime(29_999);
            await fetcher.fetchSession('session-1/0');
            expect(mockFetch).toHaveBeenCalledTimes(1);

            // 30,000ms 超過でキャッシュミス
            vi.advanceTimersByTime(2);
            await fetcher.fetchSession('session-1/0');
            expect(mockFetch).toHaveBeenCalledTimes(2);
        });
    });

    describe('セッションデシリアライズ', () => {
        it('instructors フィールドがない場合は空配列をセットすること', async () => {
            const rawData = { sessionId: '01DEF', revision: 0 };
            mockFetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(rawData),
            });
            const result = await fetcher.fetchSession('01DEF/0');

            expect(result.ok).toBe(true);
            expect(result.data.instructors).toEqual([]);
        });

        it('instructors フィールドが配列の場合はそのまま保持すること', async () => {
            const rawData = {
                sessionId: '01DEF',
                revision: 0,
                instructors: ['member1', 'member2'],
            };
            mockFetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(rawData),
            });
            const result = await fetcher.fetchSession('01DEF/0');

            expect(result.data.instructors).toEqual(['member1', 'member2']);
        });

        it('instructors フィールドが配列以外の場合は空配列に正規化すること', async () => {
            const rawData = { sessionId: '01DEF', revision: 0, instructors: 'invalid' };
            mockFetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(rawData),
            });
            const result = await fetcher.fetchSession('01DEF/0');

            expect(result.data.instructors).toEqual([]);
        });

        it('セッション JSON が null の場合でも TypeError にならず正常に返すこと', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(null),
            });
            const result = await fetcher.fetchSession('01DEF/0');

            expect(result.ok).toBe(true);
            expect(result.data.instructors).toEqual([]);
        });

        it('セッション JSON が非オブジェクト値の場合でもクラッシュしないこと', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(42),
            });
            const result = await fetcher.fetchSession('01DEF/0');

            expect(result.ok).toBe(true);
            expect(result.data.instructors).toEqual([]);
        });

        it('既存フィールドはデシリアライズ後も保持されること', async () => {
            const rawData = {
                sessionId: '01DEF',
                revision: 0,
                title: 'テスト',
                startedAt: '2026-01-15T09:00:00.000Z',
                endedAt: null,
                attendances: [{ memberId: 'member1', durationSeconds: 3600 }],
                createdAt: '2026-01-15T09:00:00.000Z',
            };
            mockFetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(rawData),
            });
            const result = await fetcher.fetchSession('01DEF/0');

            expect(result.data.sessionId).toBe('01DEF');
            expect(result.data.title).toBe('テスト');
            expect(result.data.attendances).toHaveLength(1);
            expect(result.data.instructors).toEqual([]);
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
            const sessionData = { sessionId: 'test-session' };
            mockFetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(sessionData),
            });
            const result = await fetcher.fetchSession('test-session/0');
            expect(result).toHaveProperty('ok', true);
            expect(result).toHaveProperty('data', { ...sessionData, instructors: [] });
        });

        it('fetchSession の失敗時に { ok: false, error } を返すこと', async () => {
            mockFetch.mockRejectedValue(new Error('Network error'));
            const result = await fetcher.fetchSession('err/0');
            expect(result).toHaveProperty('ok', false);
            expect(result).toHaveProperty('error');
            expect(typeof result.error).toBe('string');
        });
    });
});

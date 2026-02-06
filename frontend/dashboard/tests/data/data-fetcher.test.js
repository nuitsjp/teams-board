// DataFetcher テスト — 新データ構造対応
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DataFetcher } from '../../public/js/data/data-fetcher.js';

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
        json: () => Promise.resolve({ studyGroups: [], members: [], updatedAt: '' }),
      });
      await fetcher.fetchIndex();
      const url = mockFetch.mock.calls[0][0];
      expect(url).toMatch(/^data\/index\.json\?v=\d+$/);
    });

    it('成功時に { ok: true, data: DashboardIndex } を返すこと', async () => {
      const indexData = {
        studyGroups: [{ id: 'abc12345', name: 'もくもく勉強会', totalDurationSeconds: 3600, sessionIds: ['abc12345-2026-01-15'] }],
        members: [{ id: 'mem00001', name: 'テスト太郎', totalDurationSeconds: 3600, sessionIds: ['abc12345-2026-01-15'] }],
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
        json: () => Promise.resolve({ id: 'abc12345-2026-01-15', studyGroupId: 'abc12345', date: '2026-01-15', attendances: [] }),
      });
      await fetcher.fetchSession('abc12345-2026-01-15');
      const url = mockFetch.mock.calls[0][0];
      expect(url).toBe('data/sessions/abc12345-2026-01-15.json');
      expect(url).not.toContain('?v=');
    });

    it('成功時に { ok: true, data: SessionRecord } を返すこと', async () => {
      const sessionData = {
        id: 'abc12345-2026-01-15',
        studyGroupId: 'abc12345',
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
});

// DataFetcher テスト
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DataFetcher } from '../../src/data/data-fetcher.js';

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
        json: () => Promise.resolve({ items: [], updatedAt: '' }),
      });
      await fetcher.fetchIndex();
      const url = mockFetch.mock.calls[0][0];
      expect(url).toMatch(/^data\/index\.json\?v=\d+$/);
    });

    it('成功時に { ok: true, data: DashboardIndex } を返すこと', async () => {
      const indexData = { items: [{ id: 'a', title: 'A', summary: {} }], updatedAt: '2026-01-01' };
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

  describe('fetchItem', () => {
    it('data/items/<id>.json にキャッシュバスターなしでリクエストすること', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 'x', title: 'X', data: {} }),
      });
      await fetcher.fetchItem('x');
      const url = mockFetch.mock.calls[0][0];
      expect(url).toBe('data/items/x.json');
      expect(url).not.toContain('?v=');
    });

    it('成功時に { ok: true, data: ItemDetail } を返すこと', async () => {
      const itemData = { id: 'item-001', title: '月次', data: { key: 'val' } };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(itemData),
      });
      const result = await fetcher.fetchItem('item-001');
      expect(result).toEqual({ ok: true, data: itemData });
    });

    it('HTTPエラー時に { ok: false, error: string } を返すこと', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });
      const result = await fetcher.fetchItem('missing');
      expect(result.ok).toBe(false);
      expect(result.error).toContain('500');
    });

    it('ネットワークエラー時に適切なエラー結果を返すこと', async () => {
      mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));
      const result = await fetcher.fetchItem('err');
      expect(result.ok).toBe(false);
      expect(result.error).toContain('Failed to fetch');
    });
  });
});

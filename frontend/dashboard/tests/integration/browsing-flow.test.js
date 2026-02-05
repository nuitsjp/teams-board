// 閲覧フロー結合テスト（10.1）
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Router } from '../../src/core/router.js';
import { DataFetcher } from '../../src/data/data-fetcher.js';
import { DashboardView } from '../../src/ui/dashboard-view.js';
import { DetailView } from '../../src/ui/detail-view.js';

describe('閲覧フロー結合テスト', () => {
  let appEl;
  let mockFetch;
  let fetcher;
  let router;
  let dashboardView;
  let detailView;

  const indexData = {
    items: [
      { id: 'item-001', title: '月次売上レポート', summary: { 期間: '2026年1月', 売上合計: 1500000 } },
      { id: 'item-002', title: '週次アクセス集計', summary: { 期間: '2026-W05', PV合計: 8500 } },
    ],
    updatedAt: '2026-02-01T10:00:00+09:00',
  };

  const itemDetail = {
    id: 'item-001',
    title: '月次売上レポート',
    data: { 期間: '2026年1月', 売上合計: 1500000, 件数: 42 },
  };

  beforeEach(() => {
    document.body.innerHTML = '<main id="app"></main>';
    appEl = document.getElementById('app');
    window.location.hash = '';

    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    router = new Router();
    fetcher = new DataFetcher();
    dashboardView = new DashboardView(appEl, fetcher, router);
    detailView = new DetailView(appEl, fetcher, router);
  });

  it('初期表示 → index.json取得 → 一覧レンダリングの一連フローが動作すること', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(indexData),
    });

    await dashboardView.render();

    const url = mockFetch.mock.calls[0][0];
    expect(url).toMatch(/data\/index\.json\?v=\d+/);
    const items = appEl.querySelectorAll('.item-card');
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain('月次売上レポート');
  });

  it('アイテム選択 → 詳細画面表示のフローが動作すること', async () => {
    // 一覧表示
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(indexData),
    });
    await dashboardView.render();

    // 詳細表示（navigate経由ではなく直接renderを呼んでフロー検証）
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(itemDetail),
    });
    // カードのitemIdを取得してdetailViewで描画
    const firstCard = appEl.querySelector('.item-card');
    const itemId = firstCard.dataset.itemId;
    expect(itemId).toBe('item-001');

    await detailView.render(itemId);

    expect(appEl.querySelector('.detail-view')).not.toBeNull();
    expect(appEl.textContent).toContain('月次売上レポート');
    // fetchItemがキャッシュバスターなしで呼ばれた
    const itemUrl = mockFetch.mock.calls[1][0];
    expect(itemUrl).toBe('data/items/item-001.json');
  });

  it('詳細画面から「戻る」→ 一覧画面復帰のフローが動作すること', async () => {
    // 詳細画面を表示
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(itemDetail),
    });
    await detailView.render('item-001');
    expect(appEl.querySelector('.detail-view')).not.toBeNull();

    // 戻るリンクを確認
    const backLink = appEl.querySelector('.back-link');
    expect(backLink).not.toBeNull();

    // 一覧に戻る
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(indexData),
    });
    await dashboardView.render();

    expect(appEl.querySelector('.item-list')).not.toBeNull();
    expect(appEl.querySelectorAll('.item-card')).toHaveLength(2);
  });

  it('index.json取得失敗時のエラー表示フローが動作すること', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });

    await dashboardView.render();

    const error = appEl.querySelector('.error');
    expect(error).not.toBeNull();
    expect(error.textContent).toContain('500');
  });

  it('items取得はキャッシュバスターなし（不変リソース）であること', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(itemDetail),
    });

    await detailView.render('item-001');

    const url = mockFetch.mock.calls[0][0];
    expect(url).toBe('data/items/item-001.json');
    expect(url).not.toContain('?v=');
  });

  it('Router経由のルート変更がコールバックを正しく呼び出すこと', () => {
    const callback = vi.fn();
    router.onRouteChange(callback);
    router.navigate({ view: 'detail', itemId: 'item-001' });
    expect(callback).toHaveBeenCalledWith({ view: 'detail', itemId: 'item-001' });
    router.navigate({ view: 'dashboard' });
    expect(callback).toHaveBeenCalledWith({ view: 'dashboard' });
  });
});

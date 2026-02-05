// DashboardView テスト
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DashboardView } from '../../src/ui/dashboard-view.js';

describe('DashboardView', () => {
  let container;
  let mockFetcher;
  let mockRouter;
  let view;

  beforeEach(() => {
    container = document.createElement('main');
    document.body.innerHTML = '';
    document.body.appendChild(container);

    mockFetcher = {
      fetchIndex: vi.fn(),
    };
    mockRouter = {
      navigate: vi.fn(),
    };
    view = new DashboardView(container, mockFetcher, mockRouter);
  });

  it('データ取得中にローディング表示がDOMに存在すること', async () => {
    // fetchIndexが解決しないPromiseを返す
    mockFetcher.fetchIndex.mockReturnValue(new Promise(() => {}));
    view.render();
    // 同期的にDOM確認
    expect(container.querySelector('.loading')).not.toBeNull();
  });

  it('データ取得成功後にアイテム一覧がDOMにレンダリングされること', async () => {
    mockFetcher.fetchIndex.mockResolvedValue({
      ok: true,
      data: {
        items: [
          { id: 'item-001', title: '月次売上レポート', summary: { 期間: '2026年1月' } },
          { id: 'item-002', title: '週次アクセス集計', summary: { 期間: '2026-W05' } },
        ],
        updatedAt: '2026-02-01',
      },
    });
    await view.render();
    const items = container.querySelectorAll('.item-card');
    expect(items).toHaveLength(2);
  });

  it('各アイテムがクリック可能な要素としてレンダリングされること', async () => {
    mockFetcher.fetchIndex.mockResolvedValue({
      ok: true,
      data: {
        items: [{ id: 'item-001', title: 'テスト', summary: {} }],
        updatedAt: '2026-02-01',
      },
    });
    await view.render();
    const card = container.querySelector('.item-card');
    expect(card).not.toBeNull();
    card.click();
    expect(mockRouter.navigate).toHaveBeenCalledWith({ view: 'detail', itemId: 'item-001' });
  });

  it('データ取得失敗時にエラーメッセージがDOMに表示されること', async () => {
    mockFetcher.fetchIndex.mockResolvedValue({
      ok: false,
      error: 'HTTP 404 Not Found',
    });
    await view.render();
    const error = container.querySelector('.error');
    expect(error).not.toBeNull();
    expect(error.textContent).toContain('404');
  });

  it('アイテムのsummary情報が表示されること', async () => {
    mockFetcher.fetchIndex.mockResolvedValue({
      ok: true,
      data: {
        items: [{ id: 'a', title: 'A', summary: { 期間: '2026年1月', 件数: 42 } }],
        updatedAt: '2026-02-01',
      },
    });
    await view.render();
    const summaryEl = container.querySelector('.item-summary');
    expect(summaryEl).not.toBeNull();
    expect(summaryEl.textContent).toContain('2026年1月');
  });
});

// DetailView テスト
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DetailView } from '../../src/ui/detail-view.js';

describe('DetailView', () => {
  let container;
  let mockFetcher;
  let mockRouter;
  let view;

  beforeEach(() => {
    container = document.createElement('main');
    document.body.innerHTML = '';
    document.body.appendChild(container);

    mockFetcher = {
      fetchItem: vi.fn(),
    };
    mockRouter = {
      navigate: vi.fn(),
    };
    view = new DetailView(container, mockFetcher, mockRouter);
  });

  it('指定IDのアイテム詳細がDOMにレンダリングされること', async () => {
    mockFetcher.fetchItem.mockResolvedValue({
      ok: true,
      data: {
        id: 'item-001',
        title: '月次売上レポート',
        data: { 期間: '2026年1月', 売上合計: 1500000 },
      },
    });
    await view.render('item-001');
    expect(mockFetcher.fetchItem).toHaveBeenCalledWith('item-001');
    const detail = container.querySelector('.detail-view');
    expect(detail).not.toBeNull();
    expect(detail.textContent).toContain('月次売上レポート');
  });

  it('データ取得失敗時にエラーメッセージと「一覧へ戻る」リンクが表示されること', async () => {
    mockFetcher.fetchItem.mockResolvedValue({
      ok: false,
      error: 'HTTP 404 Not Found',
    });
    await view.render('missing');
    const error = container.querySelector('.error');
    expect(error).not.toBeNull();
    expect(error.textContent).toContain('404');
    const backLink = container.querySelector('.back-link');
    expect(backLink).not.toBeNull();
  });

  it('「戻る」操作でRouterのnavigateがdashboardルートで呼び出されること', async () => {
    mockFetcher.fetchItem.mockResolvedValue({
      ok: true,
      data: { id: 'item-001', title: 'テスト', data: {} },
    });
    await view.render('item-001');
    const backLink = container.querySelector('.back-link');
    expect(backLink).not.toBeNull();
    backLink.click();
    expect(mockRouter.navigate).toHaveBeenCalledWith({ view: 'dashboard' });
  });

  it('詳細データの各フィールドが表示されること', async () => {
    mockFetcher.fetchItem.mockResolvedValue({
      ok: true,
      data: {
        id: 'item-001',
        title: 'テスト',
        data: { キー1: '値1', キー2: 100 },
      },
    });
    await view.render('item-001');
    const detail = container.querySelector('.detail-view');
    expect(detail.textContent).toContain('キー1');
    expect(detail.textContent).toContain('値1');
  });
});

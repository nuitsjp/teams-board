// 閲覧フロー結合テスト — ドメインモデル対応
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Router } from '../../public/js/core/router.js';
import { DataFetcher } from '../../public/js/data/data-fetcher.js';
import { DashboardView } from '../../public/js/ui/dashboard-view.js';
import { MemberDetailView } from '../../public/js/ui/detail-view.js';

describe('閲覧フロー結合テスト', () => {
  let appEl;
  let mockFetch;
  let fetcher;
  let router;
  let dashboardView;
  let memberDetailView;

  const indexData = {
    studyGroups: [
      { id: 'abc12345', name: 'もくもく勉強会', totalDurationSeconds: 7200, sessionIds: ['abc12345-2026-01-15', 'abc12345-2026-01-22'] },
    ],
    members: [
      { id: 'mem00001', name: 'テスト太郎', totalDurationSeconds: 5400, sessionIds: ['abc12345-2026-01-15', 'abc12345-2026-01-22'] },
      { id: 'mem00002', name: 'テスト花子', totalDurationSeconds: 7200, sessionIds: ['abc12345-2026-01-15'] },
    ],
    updatedAt: '2026-02-01T10:00:00+09:00',
  };

  const sessionRecord1 = {
    id: 'abc12345-2026-01-15',
    studyGroupId: 'abc12345',
    date: '2026-01-15',
    attendances: [
      { memberId: 'mem00001', durationSeconds: 3600 },
      { memberId: 'mem00002', durationSeconds: 7200 },
    ],
  };

  const sessionRecord2 = {
    id: 'abc12345-2026-01-22',
    studyGroupId: 'abc12345',
    date: '2026-01-22',
    attendances: [
      { memberId: 'mem00001', durationSeconds: 1800 },
    ],
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
    memberDetailView = new MemberDetailView(appEl, fetcher, router);
  });

  it('初期表示 → index.json取得 → 勉強会グループ・参加者一覧レンダリングの一連フローが動作すること', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(indexData),
    });

    await dashboardView.render();

    const url = mockFetch.mock.calls[0][0];
    expect(url).toMatch(/data\/index\.json\?v=\d+/);
    const groups = appEl.querySelectorAll('.study-group-card');
    expect(groups).toHaveLength(1);
    expect(groups[0].textContent).toContain('もくもく勉強会');
    const members = appEl.querySelectorAll('.member-card');
    expect(members).toHaveLength(2);
  });

  it('参加者選択 → ドリルダウン画面表示のフローが動作すること', async () => {
    // トップ画面表示
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(indexData),
    });
    await dashboardView.render();

    // 参加者クリック → memberDetail遷移（降順で花子が先）
    const firstMember = appEl.querySelectorAll('.member-card')[0];
    expect(firstMember.dataset.memberId).toBe('mem00002');

    // ドリルダウン画面: index再取得 + session取得
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(indexData),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(sessionRecord1),
    });

    await memberDetailView.render('mem00002');

    expect(appEl.querySelector('.member-detail-view')).not.toBeNull();
    expect(appEl.textContent).toContain('テスト花子');
    expect(appEl.textContent).toContain('2026-01-15');
  });

  it('ドリルダウン画面から「戻る」→ トップ画面復帰のフローが動作すること', async () => {
    // ドリルダウン画面を表示
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(indexData),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(sessionRecord1),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(sessionRecord2),
    });

    await memberDetailView.render('mem00001');
    expect(appEl.querySelector('.member-detail-view')).not.toBeNull();

    const backLink = appEl.querySelector('.back-link');
    expect(backLink).not.toBeNull();

    // トップ画面に戻る
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(indexData),
    });
    await dashboardView.render();

    expect(appEl.querySelectorAll('.study-group-card')).toHaveLength(1);
    expect(appEl.querySelectorAll('.member-card')).toHaveLength(2);
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

  it('sessions取得はキャッシュバスターなし（不変リソース）であること', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(indexData),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(sessionRecord1),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(sessionRecord2),
    });

    await memberDetailView.render('mem00001');

    // 2番目以降のfetchがsession取得（キャッシュバスターなし）
    const sessionUrl = mockFetch.mock.calls[1][0];
    expect(sessionUrl).toMatch(/^data\/sessions\/.+\.json$/);
    expect(sessionUrl).not.toContain('?v=');
  });

  it('Router経由のルート変更がコールバックを正しく呼び出すこと', () => {
    const callback = vi.fn();
    router.onRouteChange(callback);
    router.navigate({ view: 'memberDetail', memberId: 'mem00001' });
    expect(callback).toHaveBeenCalledWith({ view: 'memberDetail', memberId: 'mem00001' });
    router.navigate({ view: 'dashboard' });
    expect(callback).toHaveBeenCalledWith({ view: 'dashboard' });
  });
});

// DashboardView テスト — ドメインモデル対応
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DashboardView } from '../../public/js/ui/dashboard-view.js';

describe('DashboardView', () => {
  let container;
  let mockFetcher;
  let mockRouter;
  let view;

  const indexData = {
    studyGroups: [
      { id: 'abc12345', name: 'もくもく勉強会', totalDurationSeconds: 7200, sessionIds: ['abc12345-2026-01-15', 'abc12345-2026-01-22'] },
      { id: 'def67890', name: '読書会', totalDurationSeconds: 3600, sessionIds: ['def67890-2026-01-20'] },
    ],
    members: [
      { id: 'mem00001', name: 'テスト太郎', totalDurationSeconds: 5400, sessionIds: ['abc12345-2026-01-15', 'abc12345-2026-01-22', 'def67890-2026-01-20'] },
      { id: 'mem00002', name: 'テスト花子', totalDurationSeconds: 7200, sessionIds: ['abc12345-2026-01-15', 'abc12345-2026-01-22'] },
    ],
    updatedAt: '2026-02-01',
  };

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
    mockFetcher.fetchIndex.mockReturnValue(new Promise(() => {}));
    view.render();
    expect(container.querySelector('.loading')).not.toBeNull();
  });

  it('勉強会グループ一覧セクションが描画されること', async () => {
    mockFetcher.fetchIndex.mockResolvedValue({ ok: true, data: indexData });
    await view.render();
    const groups = container.querySelectorAll('.study-group-card');
    expect(groups).toHaveLength(2);
    expect(groups[0].textContent).toContain('もくもく勉強会');
    expect(groups[0].textContent).toContain('2回');
    expect(groups[1].textContent).toContain('読書会');
  });

  it('参加者一覧セクションが合計時間の降順で描画されること', async () => {
    mockFetcher.fetchIndex.mockResolvedValue({ ok: true, data: indexData });
    await view.render();
    const members = container.querySelectorAll('.member-card');
    expect(members).toHaveLength(2);
    // 花子（7200秒）が太郎（5400秒）より先に表示される（降順）
    expect(members[0].textContent).toContain('テスト花子');
    expect(members[1].textContent).toContain('テスト太郎');
  });

  it('勉強会グループに名称・開催回数・合計学習時間が表示されること', async () => {
    mockFetcher.fetchIndex.mockResolvedValue({ ok: true, data: indexData });
    await view.render();
    const group = container.querySelector('.study-group-card');
    expect(group.textContent).toContain('もくもく勉強会');
    expect(group.textContent).toContain('2回');
    // 7200秒 = 2時間0分
    expect(group.textContent).toContain('2時間0分');
  });

  it('参加者に名前・合計学習時間・参加回数が表示されること', async () => {
    mockFetcher.fetchIndex.mockResolvedValue({ ok: true, data: indexData });
    await view.render();
    const members = container.querySelectorAll('.member-card');
    // 花子: 7200秒 = 2時間0分, 2回参加
    expect(members[0].textContent).toContain('テスト花子');
    expect(members[0].textContent).toContain('2時間0分');
    expect(members[0].textContent).toContain('2回');
  });

  it('参加者をクリックした際にmemberDetailルートへ遷移すること', async () => {
    mockFetcher.fetchIndex.mockResolvedValue({ ok: true, data: indexData });
    await view.render();
    // 降順で花子が最初
    const memberCard = container.querySelectorAll('.member-card')[0];
    memberCard.click();
    expect(mockRouter.navigate).toHaveBeenCalledWith({ view: 'memberDetail', memberId: 'mem00002' });
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
});

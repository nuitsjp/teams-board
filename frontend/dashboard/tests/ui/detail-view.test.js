// MemberDetailView テスト — 個人ドリルダウン画面
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemberDetailView } from '../../public/js/ui/detail-view.js';

describe('MemberDetailView', () => {
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
      { id: 'mem00001', name: 'テスト太郎', totalDurationSeconds: 5400, sessionIds: ['abc12345-2026-01-15', 'def67890-2026-01-20'] },
    ],
    updatedAt: '2026-02-01',
  };

  const sessionRecord1 = {
    id: 'abc12345-2026-01-15',
    studyGroupId: 'abc12345',
    date: '2026-01-15',
    attendances: [
      { memberId: 'mem00001', durationSeconds: 3600 },
      { memberId: 'mem00002', durationSeconds: 1800 },
    ],
  };

  const sessionRecord2 = {
    id: 'def67890-2026-01-20',
    studyGroupId: 'def67890',
    date: '2026-01-20',
    attendances: [
      { memberId: 'mem00001', durationSeconds: 1800 },
    ],
  };

  beforeEach(() => {
    container = document.createElement('main');
    document.body.innerHTML = '';
    document.body.appendChild(container);

    mockFetcher = {
      fetchIndex: vi.fn(),
      fetchSession: vi.fn(),
    };
    mockRouter = {
      navigate: vi.fn(),
    };
    view = new MemberDetailView(container, mockFetcher, mockRouter);
  });

  it('sessionIdsに対応するSessionRecordを並列取得して出席一覧を描画すること', async () => {
    mockFetcher.fetchIndex.mockResolvedValue({ ok: true, data: indexData });
    mockFetcher.fetchSession
      .mockResolvedValueOnce({ ok: true, data: sessionRecord1 })
      .mockResolvedValueOnce({ ok: true, data: sessionRecord2 });

    await view.render('mem00001');
    const attendanceItems = container.querySelectorAll('.attendance-item');
    expect(attendanceItems).toHaveLength(2);
    // fetchSessionが2回呼ばれる
    expect(mockFetcher.fetchSession).toHaveBeenCalledTimes(2);
  });

  it('出席一覧が開催日の降順で表示されること', async () => {
    mockFetcher.fetchIndex.mockResolvedValue({ ok: true, data: indexData });
    mockFetcher.fetchSession
      .mockResolvedValueOnce({ ok: true, data: sessionRecord1 })
      .mockResolvedValueOnce({ ok: true, data: sessionRecord2 });

    await view.render('mem00001');
    const attendanceItems = container.querySelectorAll('.attendance-item');
    // 2026-01-20 が 2026-01-15 より先（降順）
    expect(attendanceItems[0].textContent).toContain('2026-01-20');
    expect(attendanceItems[1].textContent).toContain('2026-01-15');
  });

  it('各出席記録に勉強会名・開催日・学習時間が表示されること', async () => {
    mockFetcher.fetchIndex.mockResolvedValue({ ok: true, data: indexData });
    mockFetcher.fetchSession
      .mockResolvedValueOnce({ ok: true, data: sessionRecord1 })
      .mockResolvedValueOnce({ ok: true, data: sessionRecord2 });

    await view.render('mem00001');
    const items = container.querySelectorAll('.attendance-item');
    // 読書会のセッション（降順で最初）
    expect(items[0].textContent).toContain('読書会');
    expect(items[0].textContent).toContain('2026-01-20');
    expect(items[0].textContent).toContain('30分');
  });

  it('合計学習時間と参加回数が表示されること', async () => {
    mockFetcher.fetchIndex.mockResolvedValue({ ok: true, data: indexData });
    mockFetcher.fetchSession
      .mockResolvedValueOnce({ ok: true, data: sessionRecord1 })
      .mockResolvedValueOnce({ ok: true, data: sessionRecord2 });

    await view.render('mem00001');
    const summary = container.querySelector('.member-summary');
    expect(summary).not.toBeNull();
    // 5400秒 = 1時間30分
    expect(summary.textContent).toContain('1時間30分');
    expect(summary.textContent).toContain('2回');
  });

  it('「戻る」操作でdashboardルートへ遷移すること', async () => {
    mockFetcher.fetchIndex.mockResolvedValue({ ok: true, data: indexData });
    mockFetcher.fetchSession
      .mockResolvedValueOnce({ ok: true, data: sessionRecord1 })
      .mockResolvedValueOnce({ ok: true, data: sessionRecord2 });

    await view.render('mem00001');
    const backLink = container.querySelector('.back-link');
    expect(backLink).not.toBeNull();
    backLink.click();
    expect(mockRouter.navigate).toHaveBeenCalledWith({ view: 'dashboard' });
  });

  it('セッションデータ取得失敗時にエラーメッセージとトップへの戻り手段を表示すること', async () => {
    mockFetcher.fetchIndex.mockResolvedValue({ ok: true, data: indexData });
    mockFetcher.fetchSession.mockResolvedValue({
      ok: false,
      error: 'HTTP 500 Internal Server Error',
    });

    await view.render('mem00001');
    const error = container.querySelector('.error');
    expect(error).not.toBeNull();
    const backLink = container.querySelector('.back-link');
    expect(backLink).not.toBeNull();
  });

  it('index取得失敗時にエラーメッセージとトップへの戻り手段を表示すること', async () => {
    mockFetcher.fetchIndex.mockResolvedValue({
      ok: false,
      error: 'HTTP 404 Not Found',
    });

    await view.render('mem00001');
    const error = container.querySelector('.error');
    expect(error).not.toBeNull();
    expect(error.textContent).toContain('404');
    const backLink = container.querySelector('.back-link');
    expect(backLink).not.toBeNull();
  });
});

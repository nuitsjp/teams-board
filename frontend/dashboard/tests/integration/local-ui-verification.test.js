// 置換後データでのUI表示テスト — LocalVerificationRunnerと実UIコンポーネントの結合検証
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LocalVerificationRunner } from '../../src/local-batch/local-verification-runner.js';
import { DataFetcher } from '../../src/data/data-fetcher.js';
import { DashboardView } from '../../src/ui/dashboard-view.js';
import { MemberDetailView } from '../../src/ui/detail-view.js';
import { Router } from '../../src/core/router.js';

// 置換後データを想定したテストデータ
const replacedIndex = {
  studyGroups: [
    {
      id: 'grp00001',
      name: 'もくもく勉強会',
      totalDurationSeconds: 10800,
      sessionIds: ['grp00001-2026-01-15', 'grp00001-2026-01-22'],
    },
  ],
  members: [
    {
      id: 'mem00001',
      name: 'テスト太郎',
      totalDurationSeconds: 7200,
      sessionIds: ['grp00001-2026-01-15', 'grp00001-2026-01-22'],
    },
    {
      id: 'mem00002',
      name: 'テスト花子',
      totalDurationSeconds: 3600,
      sessionIds: ['grp00001-2026-01-15'],
    },
  ],
  updatedAt: '2026-02-06T03:00:00.000Z',
};

const replacedSession1 = {
  id: 'grp00001-2026-01-15',
  studyGroupId: 'grp00001',
  date: '2026-01-15',
  attendances: [
    { memberId: 'mem00001', durationSeconds: 3600 },
    { memberId: 'mem00002', durationSeconds: 3600 },
  ],
};

const replacedSession2 = {
  id: 'grp00001-2026-01-22',
  studyGroupId: 'grp00001',
  date: '2026-01-22',
  attendances: [
    { memberId: 'mem00001', durationSeconds: 3600 },
  ],
};

describe('置換後データでのUI表示テスト', () => {
  let appEl;
  let mockFetch;
  let fetcher;
  let router;
  let dashboardView;
  let memberDetailView;
  let verificationRunner;

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
    verificationRunner = new LocalVerificationRunner({ fetcher });
  });

  describe('一覧表示の成立確認', () => {
    it('置換後データで一覧表示が成立すること', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(replacedIndex),
      });

      // 検証ランナーで成功を確認
      const verifyResult = await verificationRunner.verifyDashboard();
      expect(verifyResult.ok).toBe(true);
      expect(verifyResult.data.studyGroupCount).toBe(1);
      expect(verifyResult.data.memberCount).toBe(2);

      // 実際のUI描画でも一覧が成立すること
      await dashboardView.render();

      const groups = appEl.querySelectorAll('.study-group-card');
      expect(groups).toHaveLength(1);
      expect(groups[0].textContent).toContain('もくもく勉強会');

      const members = appEl.querySelectorAll('.member-card');
      expect(members).toHaveLength(2);
    });
  });

  describe('ドリルダウン表示の成立確認', () => {
    it('置換後データでドリルダウン表示が成立すること', async () => {
      // fetchIndex → fetchSession1 → fetchSession2 の順で応答
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(replacedIndex),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(replacedSession1),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(replacedSession2),
        });

      // 検証ランナーでドリルダウン成功を確認
      const verifyResult = await verificationRunner.verifyMemberDetail('mem00001');
      expect(verifyResult.ok).toBe(true);
      expect(verifyResult.data.sessionCount).toBe(2);

      // 実際のUI描画でも詳細表示が成立すること（fetchモックをリセット）
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(replacedIndex),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(replacedSession1),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(replacedSession2),
        });

      await memberDetailView.render('mem00001');

      expect(appEl.querySelector('.member-detail-view')).not.toBeNull();
      expect(appEl.textContent).toContain('テスト太郎');
      expect(appEl.textContent).toContain('2026-01-15');
      expect(appEl.textContent).toContain('2026-01-22');
    });
  });

  describe('参照先JSON欠落時のエラー表示', () => {
    it('index.json欠落時にエラーが表示されること', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      // 検証ランナーがエラーを検出
      const verifyResult = await verificationRunner.verifyDashboard();
      expect(verifyResult.ok).toBe(false);
      expect(verifyResult.error).toContain('index.json');

      // 実際のUI描画でもエラーが表示されること
      await dashboardView.render();

      const error = appEl.querySelector('.error');
      expect(error).not.toBeNull();
      expect(error.textContent).toContain('404');
    });

    it('セッションJSON欠落時にエラーが検出されること', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(replacedIndex),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: 'Not Found',
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: 'Not Found',
        });

      // 検証ランナーがセッション欠落を検出
      const verifyResult = await verificationRunner.verifyMemberDetail('mem00001');
      expect(verifyResult.ok).toBe(false);
      expect(verifyResult.error).toContain('grp00001-2026-01-15');
    });
  });

  describe('一覧→詳細→戻るの画面遷移', () => {
    it('一覧から詳細へ遷移し、戻る操作が成立すること', async () => {
      // ステップ1: 一覧表示
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(replacedIndex),
      });
      await dashboardView.render();

      const groups = appEl.querySelectorAll('.study-group-card');
      expect(groups).toHaveLength(1);
      const members = appEl.querySelectorAll('.member-card');
      expect(members).toHaveLength(2);

      // ステップ2: メンバークリック → 詳細画面遷移
      const routeChanges = [];
      router.onRouteChange((route) => routeChanges.push(route));

      // 花子をクリック（降順で花子が先ではなく、時間降順で太郎(7200)が先）
      const firstMember = members[0];
      expect(firstMember.dataset.memberId).toBe('mem00001');
      firstMember.click();
      expect(routeChanges[0]).toEqual({ view: 'memberDetail', memberId: 'mem00001' });

      // 詳細画面描画
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(replacedIndex),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(replacedSession1),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(replacedSession2),
        });

      await memberDetailView.render('mem00001');
      expect(appEl.querySelector('.member-detail-view')).not.toBeNull();
      expect(appEl.textContent).toContain('テスト太郎');

      // ステップ3: 戻るリンククリック
      const backLink = appEl.querySelector('.back-link');
      expect(backLink).not.toBeNull();
      backLink.click();
      expect(routeChanges[1]).toEqual({ view: 'dashboard' });

      // 一覧に戻る
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(replacedIndex),
      });
      await dashboardView.render();

      expect(appEl.querySelectorAll('.study-group-card')).toHaveLength(1);
      expect(appEl.querySelectorAll('.member-card')).toHaveLength(2);
    });

    it('検証ランナーのverifyNavigationが遷移成立を確認すること', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(replacedIndex),
      });
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(replacedIndex),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(replacedIndex),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(replacedIndex),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(replacedSession1),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(replacedSession2),
        });

      const result = await verificationRunner.verifyNavigation();
      expect(result.ok).toBe(true);
      expect(result.data.steps).toContain('dashboard');
      expect(result.data.steps).toContain('memberDetail');
      expect(result.data.steps).toContain('back');
    });
  });
});

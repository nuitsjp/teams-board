// LocalVerificationRunner テスト — 置換後データでの画面動作を検証する
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LocalVerificationRunner } from '../../local-batch/local-verification-runner.js';

/**
 * テスト用のDataFetcherモックを生成する
 */
function createMockFetcher() {
  return {
    fetchIndex: vi.fn(),
    fetchSession: vi.fn(),
  };
}

// テスト用のインデックスデータ
const sampleIndex = {
  studyGroups: [
    {
      id: 'grp00001',
      name: 'もくもく勉強会',
      totalDurationSeconds: 7200,
      sessionIds: ['grp00001-2026-01-15', 'grp00001-2026-01-22'],
    },
  ],
  members: [
    {
      id: 'mem00001',
      name: 'テスト太郎',
      totalDurationSeconds: 5400,
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

// テスト用のセッションデータ
const sampleSession1 = {
  id: 'grp00001-2026-01-15',
  studyGroupId: 'grp00001',
  date: '2026-01-15',
  attendances: [
    { memberId: 'mem00001', durationSeconds: 3600 },
    { memberId: 'mem00002', durationSeconds: 3600 },
  ],
};

const sampleSession2 = {
  id: 'grp00001-2026-01-22',
  studyGroupId: 'grp00001',
  date: '2026-01-22',
  attendances: [
    { memberId: 'mem00001', durationSeconds: 1800 },
  ],
};

describe('LocalVerificationRunner', () => {
  let runner;
  let mockFetcher;

  beforeEach(() => {
    mockFetcher = createMockFetcher();
    runner = new LocalVerificationRunner({ fetcher: mockFetcher });
  });

  describe('verifyDashboard — 一覧表示の検証', () => {
    it('インデックスJSON読み込みが成功した場合okを返すこと', async () => {
      mockFetcher.fetchIndex.mockResolvedValue({ ok: true, data: sampleIndex });

      const result = await runner.verifyDashboard();

      expect(result.ok).toBe(true);
      expect(result.data.studyGroupCount).toBe(1);
      expect(result.data.memberCount).toBe(2);
    });

    it('インデックスJSON読み込みが失敗した場合エラーを返すこと', async () => {
      mockFetcher.fetchIndex.mockResolvedValue({
        ok: false,
        error: 'HTTP 404 Not Found',
      });

      const result = await runner.verifyDashboard();

      expect(result.ok).toBe(false);
      expect(result.error).toContain('index.json');
    });

    it('インデックスに勉強会グループが0件の場合警告を含むこと', async () => {
      mockFetcher.fetchIndex.mockResolvedValue({
        ok: true,
        data: { ...sampleIndex, studyGroups: [], members: [] },
      });

      const result = await runner.verifyDashboard();

      expect(result.ok).toBe(true);
      expect(result.data.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('verifyMemberDetail — ドリルダウン表示の検証', () => {
    it('メンバーのセッションJSONを読み込んでドリルダウン表示が成立すること', async () => {
      mockFetcher.fetchIndex.mockResolvedValue({ ok: true, data: sampleIndex });
      mockFetcher.fetchSession
        .mockResolvedValueOnce({ ok: true, data: sampleSession1 })
        .mockResolvedValueOnce({ ok: true, data: sampleSession2 });

      const result = await runner.verifyMemberDetail('mem00001');

      expect(result.ok).toBe(true);
      expect(result.data.memberId).toBe('mem00001');
      expect(result.data.sessionCount).toBe(2);
    });

    it('インデックス読み込みが失敗した場合エラーを返すこと', async () => {
      mockFetcher.fetchIndex.mockResolvedValue({
        ok: false,
        error: 'HTTP 404 Not Found',
      });

      const result = await runner.verifyMemberDetail('mem00001');

      expect(result.ok).toBe(false);
      expect(result.error).toContain('index.json');
    });

    it('指定メンバーがインデックスに存在しない場合エラーを返すこと', async () => {
      mockFetcher.fetchIndex.mockResolvedValue({ ok: true, data: sampleIndex });

      const result = await runner.verifyMemberDetail('unknown-member');

      expect(result.ok).toBe(false);
      expect(result.error).toContain('unknown-member');
    });

    it('一部セッションJSONの読み込みが失敗した場合エラー詳細を含むこと', async () => {
      mockFetcher.fetchIndex.mockResolvedValue({ ok: true, data: sampleIndex });
      mockFetcher.fetchSession
        .mockResolvedValueOnce({ ok: true, data: sampleSession1 })
        .mockResolvedValueOnce({ ok: false, error: 'HTTP 404 Not Found' });

      const result = await runner.verifyMemberDetail('mem00001');

      expect(result.ok).toBe(false);
      expect(result.error).toContain('grp00001-2026-01-22');
    });

    it('セッションにメンバーの出席記録がない場合警告を含むこと', async () => {
      const sessionWithoutMember = {
        ...sampleSession1,
        attendances: [{ memberId: 'mem00002', durationSeconds: 3600 }],
      };
      mockFetcher.fetchIndex.mockResolvedValue({ ok: true, data: sampleIndex });
      mockFetcher.fetchSession
        .mockResolvedValueOnce({ ok: true, data: sessionWithoutMember })
        .mockResolvedValueOnce({ ok: true, data: sampleSession2 });

      const result = await runner.verifyMemberDetail('mem00001');

      // 一部セッションに出席記録がなくても成功扱い（警告付き）
      expect(result.ok).toBe(true);
      expect(result.data.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('verifyNavigation — 最小画面遷移の検証', () => {
    it('一覧→詳細→戻るの遷移が成立すること', async () => {
      mockFetcher.fetchIndex.mockResolvedValue({ ok: true, data: sampleIndex });
      mockFetcher.fetchSession
        .mockResolvedValue({ ok: true, data: sampleSession1 });

      const result = await runner.verifyNavigation();

      expect(result.ok).toBe(true);
      expect(result.data.steps).toContain('dashboard');
      expect(result.data.steps).toContain('memberDetail');
      expect(result.data.steps).toContain('back');
    });

    it('一覧表示が失敗した場合遷移全体が失敗すること', async () => {
      mockFetcher.fetchIndex.mockResolvedValue({
        ok: false,
        error: 'HTTP 500 Internal Server Error',
      });

      const result = await runner.verifyNavigation();

      expect(result.ok).toBe(false);
    });

    it('メンバーが0件の場合ドリルダウン確認をスキップし警告を返すこと', async () => {
      mockFetcher.fetchIndex.mockResolvedValue({
        ok: true,
        data: { ...sampleIndex, members: [] },
      });

      const result = await runner.verifyNavigation();

      expect(result.ok).toBe(true);
      expect(result.data.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('runAll — 全検証の一括実行', () => {
    it('全検証が成功した場合にサマリーを返すこと', async () => {
      mockFetcher.fetchIndex.mockResolvedValue({ ok: true, data: sampleIndex });
      mockFetcher.fetchSession
        .mockResolvedValue({ ok: true, data: sampleSession1 });

      const result = await runner.runAll();

      expect(result.ok).toBe(true);
      expect(result.data).toHaveProperty('dashboard');
      expect(result.data).toHaveProperty('memberDetail');
      expect(result.data).toHaveProperty('navigation');
    });

    it('いずれかの検証が失敗した場合に失敗結果を含めること', async () => {
      mockFetcher.fetchIndex.mockResolvedValue({
        ok: false,
        error: 'HTTP 404 Not Found',
      });

      const result = await runner.runAll();

      expect(result.ok).toBe(false);
      expect(result.data.dashboard.ok).toBe(false);
    });
  });
});

// ConversionReporter テスト — 変換実行結果のレポーティング
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConversionReporter } from '../../src/local-batch/conversion-reporter.js';

/**
 * テスト用のfsモックを生成する
 */
function createMockFs() {
  return {
    writeFile: vi.fn().mockResolvedValue(undefined),
  };
}

describe('ConversionReporter', () => {
  let reporter;
  let mockFs;

  beforeEach(() => {
    mockFs = createMockFs();
    reporter = new ConversionReporter({ fs: mockFs });
  });

  describe('総合ステータスの計算', () => {
    it('全成功の場合successを返すこと', () => {
      const report = reporter.buildReport({
        inputCsvCount: 3,
        generatedSessionCount: 3,
        fileResults: [
          { path: 'index.json', ok: true },
          { path: 'sessions/a.json', ok: true },
          { path: 'sessions/b.json', ok: true },
          { path: 'sessions/c.json', ok: true },
        ],
        issues: [],
      });

      expect(report.status).toBe('success');
    });

    it('全失敗の場合failureを返すこと', () => {
      const report = reporter.buildReport({
        inputCsvCount: 2,
        generatedSessionCount: 0,
        fileResults: [],
        issues: [
          { filePath: 'input.csv', message: '変換失敗', severity: 'error' },
        ],
      });

      expect(report.status).toBe('failure');
    });

    it('一部成功の場合partialを返すこと', () => {
      const report = reporter.buildReport({
        inputCsvCount: 3,
        generatedSessionCount: 2,
        fileResults: [
          { path: 'index.json', ok: true },
          { path: 'sessions/a.json', ok: true },
          { path: 'sessions/b.json', ok: false, error: '書き込み失敗' },
        ],
        issues: [],
      });

      expect(report.status).toBe('partial');
    });
  });

  describe('サマリー情報', () => {
    it('入力CSVファイル数と生成セッション数を出力すること', () => {
      const report = reporter.buildReport({
        inputCsvCount: 5,
        generatedSessionCount: 4,
        fileResults: [
          { path: 'index.json', ok: true },
          { path: 'sessions/a.json', ok: true },
        ],
        issues: [],
      });

      expect(report.summary.inputCsvCount).toBe(5);
      expect(report.summary.generatedSessionCount).toBe(4);
    });

    it('書き込み成功ファイル数と失敗ファイル数を出力すること', () => {
      const report = reporter.buildReport({
        inputCsvCount: 3,
        generatedSessionCount: 3,
        fileResults: [
          { path: 'index.json', ok: true },
          { path: 'sessions/a.json', ok: true },
          { path: 'sessions/b.json', ok: false, error: '失敗' },
        ],
        issues: [],
      });

      expect(report.summary.writtenFileCount).toBe(2);
      expect(report.summary.failedFileCount).toBe(1);
    });
  });

  describe('部分失敗の分離報告', () => {
    it('成功分と失敗分を分離して保持すること', () => {
      const report = reporter.buildReport({
        inputCsvCount: 3,
        generatedSessionCount: 2,
        fileResults: [
          { path: 'index.json', ok: true },
          { path: 'sessions/a.json', ok: true },
          { path: 'sessions/b.json', ok: false, error: 'ENOSPC' },
        ],
        issues: [],
      });

      expect(report.fileResults.filter((r) => r.ok)).toHaveLength(2);
      expect(report.fileResults.filter((r) => !r.ok)).toHaveLength(1);
    });

    it('失敗ファイルごとの理由が含まれること', () => {
      const report = reporter.buildReport({
        inputCsvCount: 2,
        generatedSessionCount: 2,
        fileResults: [
          { path: 'sessions/a.json', ok: false, error: 'ENOSPC: no space left' },
          { path: 'sessions/b.json', ok: false, error: 'EACCES: permission denied' },
        ],
        issues: [],
      });

      const failed = report.fileResults.filter((r) => !r.ok);
      expect(failed[0].error).toContain('ENOSPC');
      expect(failed[1].error).toContain('EACCES');
    });
  });

  describe('検証エラーの報告', () => {
    it('検証issuesがレポートに含まれること', () => {
      const issues = [
        { filePath: 'index.json', fieldPath: 'members', message: '必須キー欠落', severity: 'error' },
        { filePath: 'sessions/a.json', issueType: 'missing-session', message: '参照不整合' },
      ];

      const report = reporter.buildReport({
        inputCsvCount: 1,
        generatedSessionCount: 1,
        fileResults: [],
        issues,
      });

      expect(report.issues).toHaveLength(2);
      expect(report.issues[0].filePath).toBe('index.json');
    });
  });

  describe('レポートの構造', () => {
    it('ConversionReport契約に準拠した構造を返すこと', () => {
      const report = reporter.buildReport({
        inputCsvCount: 1,
        generatedSessionCount: 1,
        fileResults: [{ path: 'index.json', ok: true }],
        issues: [],
      });

      expect(report).toHaveProperty('status');
      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('fileResults');
      expect(report).toHaveProperty('issues');
      expect(report.summary).toHaveProperty('inputCsvCount');
      expect(report.summary).toHaveProperty('generatedSessionCount');
      expect(report.summary).toHaveProperty('writtenFileCount');
      expect(report.summary).toHaveProperty('failedFileCount');
    });
  });

  describe('標準出力への表示', () => {
    it('レポートを文字列としてフォーマットできること', () => {
      const report = reporter.buildReport({
        inputCsvCount: 2,
        generatedSessionCount: 2,
        fileResults: [
          { path: 'index.json', ok: true },
          { path: 'sessions/a.json', ok: true },
        ],
        issues: [],
      });

      const output = reporter.format(report);
      expect(typeof output).toBe('string');
      expect(output).toContain('success');
      expect(output.length).toBeGreaterThan(0);
    });
  });

  describe('JSONファイルへの保存', () => {
    it('レポートをJSONファイルとして保存できること', async () => {
      const report = reporter.buildReport({
        inputCsvCount: 1,
        generatedSessionCount: 1,
        fileResults: [{ path: 'index.json', ok: true }],
        issues: [],
      });

      await reporter.saveToFile(report, '/output/report.json');

      expect(mockFs.writeFile).toHaveBeenCalledOnce();
      const [path, content] = mockFs.writeFile.mock.calls[0];
      expect(path).toBe('/output/report.json');
      const saved = JSON.parse(content);
      expect(saved.status).toBe('success');
    });
  });

  describe('検証エラーのみの場合', () => {
    it('ファイル書き込みなし・検証エラーありの場合failureを返すこと', () => {
      const report = reporter.buildReport({
        inputCsvCount: 1,
        generatedSessionCount: 1,
        fileResults: [],
        issues: [
          { filePath: 'index.json', fieldPath: 'studyGroups', message: '型不正', severity: 'error' },
        ],
      });

      expect(report.status).toBe('failure');
      expect(report.summary.writtenFileCount).toBe(0);
      expect(report.summary.failedFileCount).toBe(0);
    });
  });
});

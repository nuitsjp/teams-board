// ローカル変換パイプライン結合テスト — 入力から検証・置換・レポートまでの統合フロー
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LocalConvertCommand } from '../../local-batch/local-convert-command.js';
import { SessionAggregationService } from '../../local-batch/session-aggregation-service.js';
import { DataContractValidator } from '../../local-batch/data-contract-validator.js';
import { ConsistencyValidator } from '../../local-batch/consistency-validator.js';
import { ConversionReporter } from '../../local-batch/conversion-reporter.js';
import { IndexMerger } from '../../public/js/data/index-merger.js';

/**
 * テスト用のCSV解析結果を生成する
 * IndexMergerと整合するmergeInput形式
 */
function createParseResult(sessionId, groupId, groupName, date, attendances) {
  return {
    ok: true,
    sessionRecord: {
      id: sessionId,
      studyGroupId: groupId,
      date,
      attendances: attendances.map((a) => ({
        memberId: a.memberId,
        durationSeconds: a.durationSeconds,
      })),
    },
    mergeInput: {
      sessionId,
      studyGroupId: groupId,
      studyGroupName: groupName,
      date,
      attendances: attendances.map((a) => ({
        memberId: a.memberId,
        memberName: a.memberName,
        durationSeconds: a.durationSeconds,
      })),
    },
    warnings: [],
  };
}

// 共通テストデータ
const csvFile1 = { path: '/data/sample/report1.csv', name: 'report1.csv', sizeBytes: 1500 };
const csvFile2 = { path: '/data/sample/report2.csv', name: 'report2.csv', sizeBytes: 1200 };
const csvFile3 = { path: '/data/sample/report3.csv', name: 'report3.csv', sizeBytes: 1800 };

const parseResult1 = createParseResult(
  'grp00001-2026-01-15', 'grp00001', 'もくもく勉強会', '2026-01-15',
  [
    { memberId: 'mem00001', memberName: 'テスト太郎', durationSeconds: 3600 },
    { memberId: 'mem00002', memberName: 'テスト花子', durationSeconds: 1800 },
  ]
);

const parseResult2 = createParseResult(
  'grp00001-2026-01-22', 'grp00001', 'もくもく勉強会', '2026-01-22',
  [
    { memberId: 'mem00001', memberName: 'テスト太郎', durationSeconds: 2700 },
  ]
);

const parseResult3 = createParseResult(
  'grp00002-2026-01-20', 'grp00002', '読書会', '2026-01-20',
  [
    { memberId: 'mem00001', memberName: 'テスト太郎', durationSeconds: 5400 },
    { memberId: 'mem00003', memberName: '山田次郎', durationSeconds: 3600 },
  ]
);

describe('ローカル変換パイプライン結合テスト', () => {
  let command;
  let mockReader;
  let mockAdapter;
  let mockWriter;

  beforeEach(() => {
    // 実コンポーネントを使用（IndexMerger含む）
    const aggregator = new SessionAggregationService({
      indexMerger: new IndexMerger(),
    });
    const contractValidator = new DataContractValidator();
    const consistencyValidator = new ConsistencyValidator();
    const reporter = new ConversionReporter({ fs: { writeFile: vi.fn() } });

    // I/O系はモック
    mockReader = { listInputs: vi.fn() };
    mockAdapter = { parse: vi.fn() };
    mockWriter = { publish: vi.fn() };

    command = new LocalConvertCommand({
      reader: mockReader,
      adapter: mockAdapter,
      aggregator,
      contractValidator,
      consistencyValidator,
      writer: mockWriter,
      reporter,
    });
  });

  describe('正常フロー: 複数CSVの連続変換と累積更新', () => {
    it('複数CSVを連続変換しダッシュボードインデックスが累積更新されること', async () => {
      mockReader.listInputs.mockResolvedValue({
        ok: true, files: [csvFile1, csvFile2, csvFile3], warnings: [],
      });
      mockAdapter.parse
        .mockResolvedValueOnce(parseResult1)
        .mockResolvedValueOnce(parseResult2)
        .mockResolvedValueOnce(parseResult3);
      mockWriter.publish.mockImplementation(async (_dir, index, sessions) => ({
        allSucceeded: true,
        results: [
          { path: 'index.json', ok: true },
          ...sessions.map((s) => ({ path: `sessions/${s.id}.json`, ok: true })),
        ],
      }));

      const result = await command.execute({
        inputDir: '/data/sample',
        outputDir: '/output',
      });

      expect(result.status).toBe('success');
      expect(result.summary.inputCsvCount).toBe(3);
      expect(result.summary.generatedSessionCount).toBe(3);

      // writerに渡されたインデックスを検証
      const [, publishedIndex, publishedSessions] = mockWriter.publish.mock.calls[0];

      // 2つの勉強会グループが累積されていること
      expect(publishedIndex.studyGroups).toHaveLength(2);
      const mokumoku = publishedIndex.studyGroups.find((g) => g.id === 'grp00001');
      const dokusho = publishedIndex.studyGroups.find((g) => g.id === 'grp00002');
      expect(mokumoku.sessionIds).toHaveLength(2);
      expect(dokusho.sessionIds).toHaveLength(1);

      // 3名のメンバーが累積されていること
      expect(publishedIndex.members).toHaveLength(3);

      // テスト太郎は3セッションに参加
      const taro = publishedIndex.members.find((m) => m.id === 'mem00001');
      expect(taro.sessionIds).toHaveLength(3);
      expect(taro.totalDurationSeconds).toBe(3600 + 2700 + 5400);

      // 3つのセッションが生成されていること
      expect(publishedSessions).toHaveLength(3);
    });
  });

  describe('検証失敗時の公開データ保全', () => {
    it('契約検証でエラーが発生した場合writerが呼ばれず公開データが未変更であること', async () => {
      // 不正なparseResult（セッションの必須キーが欠落）
      const badParseResult = {
        ok: true,
        sessionRecord: {
          id: 'bad-session',
          studyGroupId: 'grp00001',
          // date欠落
          attendances: [{ memberId: 'mem00001', durationSeconds: 100 }],
        },
        mergeInput: {
          sessionId: 'bad-session',
          studyGroupId: 'grp00001',
          studyGroupName: 'もくもく勉強会',
          date: '2026-01-15',
          attendances: [
            { memberId: 'mem00001', memberName: 'テスト太郎', durationSeconds: 100 },
          ],
        },
        warnings: [],
      };

      mockReader.listInputs.mockResolvedValue({
        ok: true, files: [csvFile1], warnings: [],
      });
      mockAdapter.parse.mockResolvedValue(badParseResult);

      const result = await command.execute({
        inputDir: '/data/sample',
        outputDir: '/output',
      });

      expect(result.status).toBe('failure');
      expect(mockWriter.publish).not.toHaveBeenCalled();
      // 契約検証のエラーがissuesに含まれること
      const contractErrors = result.issues.filter(
        (i) => i.severity === 'error' && i.fieldPath
      );
      expect(contractErrors.length).toBeGreaterThan(0);
    });

    it('整合性検証でエラーが発生した場合writerが呼ばれないこと', async () => {
      // sessionRecordとmergeInputの時間が異なる → 整合性検証でduration-mismatch
      const inconsistentParseResult = {
        ok: true,
        sessionRecord: {
          id: 'grp00001-2026-01-15',
          studyGroupId: 'grp00001',
          date: '2026-01-15',
          attendances: [
            { memberId: 'mem00001', durationSeconds: 9999 },
          ],
        },
        mergeInput: {
          sessionId: 'grp00001-2026-01-15',
          studyGroupId: 'grp00001',
          studyGroupName: 'もくもく勉強会',
          date: '2026-01-15',
          attendances: [
            { memberId: 'mem00001', memberName: 'テスト太郎', durationSeconds: 3600 },
          ],
        },
        warnings: [],
      };

      mockReader.listInputs.mockResolvedValue({
        ok: true, files: [csvFile1], warnings: [],
      });
      mockAdapter.parse.mockResolvedValue(inconsistentParseResult);

      const result = await command.execute({
        inputDir: '/data/sample',
        outputDir: '/output',
      });

      // 整合性検証がduration-mismatchを検出し置換を防止すること
      expect(result.status).toBe('failure');
      expect(mockWriter.publish).not.toHaveBeenCalled();
      const durationErrors = result.issues.filter(
        (i) => i.issueType === 'duration-mismatch'
      );
      expect(durationErrors.length).toBeGreaterThan(0);
    });
  });

  describe('部分失敗のレポート分離', () => {
    it('一部CSVの変換失敗時に成功分と失敗分が分離して報告されること', async () => {
      mockReader.listInputs.mockResolvedValue({
        ok: true, files: [csvFile1, csvFile2], warnings: [],
      });
      mockAdapter.parse
        .mockResolvedValueOnce(parseResult1)
        .mockResolvedValueOnce({
          ok: false,
          errors: ['Teams出席レポート形式ではありません'],
        });
      mockWriter.publish.mockImplementation(async (_dir, index, sessions) => ({
        allSucceeded: true,
        results: [
          { path: 'index.json', ok: true },
          ...sessions.map((s) => ({ path: `sessions/${s.id}.json`, ok: true })),
        ],
      }));

      const result = await command.execute({
        inputDir: '/data/sample',
        outputDir: '/output',
      });

      // 部分成功（1件成功 + 1件失敗 = partial ではなく success になりうる）
      // レポーターの判定: errorを含むissueがあるかどうか
      expect(result.summary.inputCsvCount).toBe(2);
      expect(result.summary.generatedSessionCount).toBe(1);

      // 変換エラーがissuesに含まれること
      const transformErrors = result.issues.filter(
        (i) => i.filePath === 'report2.csv' && i.severity === 'error'
      );
      expect(transformErrors.length).toBeGreaterThan(0);

      // 成功分はwriterに渡されていること
      expect(mockWriter.publish).toHaveBeenCalledOnce();
      const [, , publishedSessions] = mockWriter.publish.mock.calls[0];
      expect(publishedSessions).toHaveLength(1);
    });

    it('書き込み一部失敗時にレポートが成功と失敗を分離すること', async () => {
      mockReader.listInputs.mockResolvedValue({
        ok: true, files: [csvFile1, csvFile2], warnings: [],
      });
      mockAdapter.parse
        .mockResolvedValueOnce(parseResult1)
        .mockResolvedValueOnce(parseResult2);
      mockWriter.publish.mockResolvedValue({
        allSucceeded: false,
        results: [
          { path: 'index.json', ok: true },
          { path: 'sessions/grp00001-2026-01-15.json', ok: true },
          { path: 'sessions/grp00001-2026-01-22.json', ok: false, error: 'ENOSPC' },
        ],
      });

      const result = await command.execute({
        inputDir: '/data/sample',
        outputDir: '/output',
      });

      expect(result.summary.writtenFileCount).toBe(2);
      expect(result.summary.failedFileCount).toBe(1);

      const succeeded = result.fileResults.filter((r) => r.ok);
      const failed = result.fileResults.filter((r) => !r.ok);
      expect(succeeded).toHaveLength(2);
      expect(failed).toHaveLength(1);
      expect(failed[0].error).toContain('ENOSPC');
    });
  });

  describe('べき等性の検証', () => {
    it('同一入力で2回実行した場合に同じレポート構造を返すこと', async () => {
      const setupMocks = () => {
        mockReader.listInputs.mockResolvedValue({
          ok: true, files: [csvFile1, csvFile2], warnings: [],
        });
        mockAdapter.parse
          .mockResolvedValueOnce(parseResult1)
          .mockResolvedValueOnce(parseResult2);
        mockWriter.publish.mockImplementation(async (_dir, index, sessions) => ({
          allSucceeded: true,
          results: [
            { path: 'index.json', ok: true },
            ...sessions.map((s) => ({ path: `sessions/${s.id}.json`, ok: true })),
          ],
        }));
      };

      // 1回目
      setupMocks();
      const result1 = await command.execute({
        inputDir: '/data/sample',
        outputDir: '/output',
      });

      // 2回目（モックリセット）
      vi.clearAllMocks();
      setupMocks();
      const result2 = await command.execute({
        inputDir: '/data/sample',
        outputDir: '/output',
      });

      // 構造が同一
      expect(result1.status).toBe(result2.status);
      expect(result1.summary.inputCsvCount).toBe(result2.summary.inputCsvCount);
      expect(result1.summary.generatedSessionCount).toBe(result2.summary.generatedSessionCount);
      expect(result1.summary.writtenFileCount).toBe(result2.summary.writtenFileCount);
    });
  });

  describe('全CSVの変換失敗', () => {
    it('全CSVが失敗した場合はwriterを呼ばずにfailureレポートを返すこと', async () => {
      mockReader.listInputs.mockResolvedValue({
        ok: true, files: [csvFile1], warnings: [],
      });
      mockAdapter.parse.mockResolvedValue({
        ok: false,
        errors: ['不正なCSV形式'],
      });

      const result = await command.execute({
        inputDir: '/data/sample',
        outputDir: '/output',
      });

      expect(result.status).toBe('failure');
      expect(result.summary.generatedSessionCount).toBe(0);
      expect(mockWriter.publish).not.toHaveBeenCalled();
    });
  });

  describe('入力読み込み失敗', () => {
    it('CSV0件の場合はfailureレポートを返し変換を行わないこと', async () => {
      mockReader.listInputs.mockResolvedValue({
        ok: false,
        error: 'CSVファイルが見つかりません',
        warnings: [],
      });

      const result = await command.execute({
        inputDir: '/data/sample',
        outputDir: '/output',
      });

      expect(result.status).toBe('failure');
      expect(mockAdapter.parse).not.toHaveBeenCalled();
      expect(mockWriter.publish).not.toHaveBeenCalled();
    });
  });
});

// LocalConvertCommand テスト — 入力から検証・置換・レポートまでを統制する
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LocalConvertCommand } from '../../local-batch/local-convert-command.js';

/**
 * 全依存コンポーネントのモックを生成する
 */
function createMockDeps() {
  return {
    reader: {
      listInputs: vi.fn(),
    },
    adapter: {
      parse: vi.fn(),
    },
    aggregator: {
      aggregate: vi.fn(),
    },
    contractValidator: {
      validateIndex: vi.fn().mockReturnValue([]),
      validateSession: vi.fn().mockReturnValue([]),
    },
    consistencyValidator: {
      validate: vi.fn().mockReturnValue([]),
    },
    writer: {
      publish: vi.fn(),
    },
    reporter: {
      buildReport: vi.fn(),
      format: vi.fn().mockReturnValue('レポート出力'),
      saveToFile: vi.fn().mockResolvedValue(undefined),
    },
  };
}

// 正常パスで使う共通テストデータ
const sampleCsvFiles = [
  { path: '/data/sample/report1.csv', name: 'report1.csv', sizeBytes: 1500 },
  { path: '/data/sample/report2.csv', name: 'report2.csv', sizeBytes: 1200 },
];

const sampleParseResult1 = {
  ok: true,
  sessionRecord: {
    id: 'abc12345-2026-01-15',
    studyGroupId: 'abc12345',
    date: '2026-01-15',
    attendances: [{ memberId: 'mem00001', durationSeconds: 3600 }],
  },
  mergeInput: {
    sessionId: 'abc12345-2026-01-15',
    studyGroupId: 'abc12345',
    studyGroupName: 'もくもく勉強会',
    date: '2026-01-15',
    attendances: [
      { memberId: 'mem00001', memberName: 'テスト太郎', durationSeconds: 3600 },
    ],
  },
  warnings: [],
};

const sampleParseResult2 = {
  ok: true,
  sessionRecord: {
    id: 'abc12345-2026-01-22',
    studyGroupId: 'abc12345',
    date: '2026-01-22',
    attendances: [{ memberId: 'mem00001', durationSeconds: 1800 }],
  },
  mergeInput: {
    sessionId: 'abc12345-2026-01-22',
    studyGroupId: 'abc12345',
    studyGroupName: 'もくもく勉強会',
    date: '2026-01-22',
    attendances: [
      { memberId: 'mem00001', memberName: 'テスト太郎', durationSeconds: 1800 },
    ],
  },
  warnings: [],
};

const sampleAggregation = {
  index: {
    studyGroups: [{
      id: 'abc12345',
      name: 'もくもく勉強会',
      totalDurationSeconds: 5400,
      sessionIds: ['abc12345-2026-01-15', 'abc12345-2026-01-22'],
    }],
    members: [{
      id: 'mem00001',
      name: 'テスト太郎',
      totalDurationSeconds: 5400,
      sessionIds: ['abc12345-2026-01-15', 'abc12345-2026-01-22'],
    }],
    updatedAt: '2026-02-06T03:00:00.000Z',
  },
  sessions: [
    sampleParseResult1.sessionRecord,
    sampleParseResult2.sessionRecord,
  ],
  warnings: [],
};

const samplePublishResult = {
  allSucceeded: true,
  results: [
    { path: 'index.json', ok: true },
    { path: 'sessions/abc12345-2026-01-15.json', ok: true },
    { path: 'sessions/abc12345-2026-01-22.json', ok: true },
  ],
};

/**
 * 正常パスのモックを一括セットアップする
 */
function setupSuccessPath(deps) {
  deps.reader.listInputs.mockResolvedValue({
    ok: true,
    files: sampleCsvFiles,
    warnings: [],
  });
  deps.adapter.parse
    .mockResolvedValueOnce(sampleParseResult1)
    .mockResolvedValueOnce(sampleParseResult2);
  deps.aggregator.aggregate.mockReturnValue(sampleAggregation);
  deps.writer.publish.mockResolvedValue(samplePublishResult);
  deps.reporter.buildReport.mockReturnValue({
    status: 'success',
    summary: { inputCsvCount: 2, generatedSessionCount: 2, writtenFileCount: 3, failedFileCount: 0 },
    fileResults: samplePublishResult.results,
    issues: [],
  });
}

describe('LocalConvertCommand', () => {
  let command;
  let deps;

  beforeEach(() => {
    deps = createMockDeps();
    command = new LocalConvertCommand(deps);
  });

  describe('正常な変換フロー', () => {
    it('入力読込→変換→集約→検証→置換→レポートの順序で実行すること', async () => {
      const callOrder = [];

      deps.reader.listInputs.mockImplementation(async () => {
        callOrder.push('input');
        return { ok: true, files: sampleCsvFiles, warnings: [] };
      });
      deps.adapter.parse.mockImplementation(async () => {
        callOrder.push('transform');
        return sampleParseResult1;
      });
      deps.aggregator.aggregate.mockImplementation(() => {
        callOrder.push('aggregate');
        return sampleAggregation;
      });
      deps.contractValidator.validateIndex.mockImplementation(() => {
        callOrder.push('validate');
        return [];
      });
      deps.writer.publish.mockImplementation(async () => {
        callOrder.push('publish');
        return samplePublishResult;
      });
      deps.reporter.buildReport.mockImplementation(() => {
        callOrder.push('report');
        return { status: 'success', summary: {}, fileResults: [], issues: [] };
      });

      await command.execute({
        inputDir: '/data/sample',
        outputDir: '/output',
      });

      expect(callOrder[0]).toBe('input');
      expect(callOrder.indexOf('transform')).toBeGreaterThan(callOrder.indexOf('input'));
      expect(callOrder.indexOf('aggregate')).toBeGreaterThan(callOrder.indexOf('transform'));
      expect(callOrder.indexOf('validate')).toBeGreaterThan(callOrder.indexOf('aggregate'));
      expect(callOrder.indexOf('publish')).toBeGreaterThan(callOrder.indexOf('validate'));
      expect(callOrder.indexOf('report')).toBeGreaterThan(callOrder.indexOf('publish'));
    });

    it('成功時にConversionReportを返すこと', async () => {
      setupSuccessPath(deps);

      const result = await command.execute({
        inputDir: '/data/sample',
        outputDir: '/output',
      });

      expect(result).toHaveProperty('status');
      expect(result.status).toBe('success');
    });
  });

  describe('入力読込の失敗', () => {
    it('入力読込が失敗した場合は変換を行わずエラーレポートを返すこと', async () => {
      deps.reader.listInputs.mockResolvedValue({
        ok: false,
        error: 'CSVファイルが見つかりません',
        warnings: [],
      });
      deps.reporter.buildReport.mockReturnValue({
        status: 'failure',
        summary: { inputCsvCount: 0, generatedSessionCount: 0, writtenFileCount: 0, failedFileCount: 0 },
        fileResults: [],
        issues: [{ filePath: '/data/sample', message: 'CSVファイルが見つかりません', severity: 'error' }],
      });

      const result = await command.execute({
        inputDir: '/data/sample',
        outputDir: '/output',
      });

      expect(result.status).toBe('failure');
      // 変換・置換は呼ばれない
      expect(deps.adapter.parse).not.toHaveBeenCalled();
      expect(deps.writer.publish).not.toHaveBeenCalled();
    });
  });

  describe('変換エラーの処理', () => {
    it('一部CSVの変換に失敗した場合は成功分のみ集約すること', async () => {
      deps.reader.listInputs.mockResolvedValue({
        ok: true,
        files: sampleCsvFiles,
        warnings: [],
      });
      deps.adapter.parse
        .mockResolvedValueOnce(sampleParseResult1)
        .mockResolvedValueOnce({
          ok: false,
          errors: ['Teams出席レポート形式ではありません'],
        });

      // 1件のみの集約結果
      const partialAgg = {
        index: sampleAggregation.index,
        sessions: [sampleParseResult1.sessionRecord],
        warnings: [],
      };
      deps.aggregator.aggregate.mockReturnValue(partialAgg);
      deps.writer.publish.mockResolvedValue({
        allSucceeded: true,
        results: [{ path: 'index.json', ok: true }],
      });
      deps.reporter.buildReport.mockReturnValue({
        status: 'partial',
        summary: { inputCsvCount: 2, generatedSessionCount: 1, writtenFileCount: 1, failedFileCount: 0 },
        fileResults: [],
        issues: [],
      });

      const result = await command.execute({
        inputDir: '/data/sample',
        outputDir: '/output',
      });

      // aggregatorには成功分のみが渡される
      expect(deps.aggregator.aggregate).toHaveBeenCalledOnce();
      const aggregateArg = deps.aggregator.aggregate.mock.calls[0][0];
      expect(aggregateArg).toHaveLength(1);
    });
  });

  describe('検証ゲート', () => {
    it('契約検証でエラーが検出された場合は置換を行わないこと', async () => {
      deps.reader.listInputs.mockResolvedValue({
        ok: true,
        files: [sampleCsvFiles[0]],
        warnings: [],
      });
      deps.adapter.parse.mockResolvedValue(sampleParseResult1);
      deps.aggregator.aggregate.mockReturnValue({
        ...sampleAggregation,
        sessions: [sampleParseResult1.sessionRecord],
      });

      // 契約検証がエラーを返す
      deps.contractValidator.validateIndex.mockReturnValue([
        { filePath: 'index.json', fieldPath: 'studyGroups', message: '型不正', severity: 'error' },
      ]);
      deps.reporter.buildReport.mockReturnValue({
        status: 'failure',
        summary: { inputCsvCount: 1, generatedSessionCount: 1, writtenFileCount: 0, failedFileCount: 0 },
        fileResults: [],
        issues: [{ filePath: 'index.json', fieldPath: 'studyGroups', message: '型不正', severity: 'error' }],
      });

      const result = await command.execute({
        inputDir: '/data/sample',
        outputDir: '/output',
      });

      expect(result.status).toBe('failure');
      // 置換は呼ばれない
      expect(deps.writer.publish).not.toHaveBeenCalled();
    });

    it('整合性検証でエラーが検出された場合は置換を行わないこと', async () => {
      deps.reader.listInputs.mockResolvedValue({
        ok: true,
        files: [sampleCsvFiles[0]],
        warnings: [],
      });
      deps.adapter.parse.mockResolvedValue(sampleParseResult1);
      deps.aggregator.aggregate.mockReturnValue({
        ...sampleAggregation,
        sessions: [sampleParseResult1.sessionRecord],
      });

      // 整合性検証がエラーを返す
      deps.consistencyValidator.validate.mockReturnValue([
        { filePath: 'index.json', issueType: 'duration-mismatch', message: '合計時間不一致' },
      ]);
      deps.reporter.buildReport.mockReturnValue({
        status: 'failure',
        summary: { inputCsvCount: 1, generatedSessionCount: 1, writtenFileCount: 0, failedFileCount: 0 },
        fileResults: [],
        issues: [{ filePath: 'index.json', issueType: 'duration-mismatch', message: '合計時間不一致' }],
      });

      const result = await command.execute({
        inputDir: '/data/sample',
        outputDir: '/output',
      });

      expect(result.status).toBe('failure');
      expect(deps.writer.publish).not.toHaveBeenCalled();
    });
  });

  describe('べき等な動作', () => {
    it('同一入力で2回実行した場合に同じ結果を返すこと', async () => {
      setupSuccessPath(deps);

      const result1 = await command.execute({
        inputDir: '/data/sample',
        outputDir: '/output',
      });

      // モックをリセットして再セットアップ
      vi.clearAllMocks();
      setupSuccessPath(deps);

      const result2 = await command.execute({
        inputDir: '/data/sample',
        outputDir: '/output',
      });

      expect(result1.status).toBe(result2.status);
    });
  });

  describe('コマンドオプション', () => {
    it('inputDirとoutputDirを正しくコンポーネントに渡すこと', async () => {
      setupSuccessPath(deps);

      await command.execute({
        inputDir: '/custom/input',
        outputDir: '/custom/output',
      });

      expect(deps.reader.listInputs).toHaveBeenCalledWith('/custom/input');
      expect(deps.writer.publish).toHaveBeenCalledWith(
        '/custom/output',
        expect.any(Object),
        expect.any(Array)
      );
    });
  });

  describe('全CSVの変換失敗', () => {
    it('全CSVが変換失敗した場合は集約・置換を行わずfailureレポートを返すこと', async () => {
      deps.reader.listInputs.mockResolvedValue({
        ok: true,
        files: [sampleCsvFiles[0]],
        warnings: [],
      });
      deps.adapter.parse.mockResolvedValue({
        ok: false,
        errors: ['不正なCSV形式'],
      });
      deps.reporter.buildReport.mockReturnValue({
        status: 'failure',
        summary: { inputCsvCount: 1, generatedSessionCount: 0, writtenFileCount: 0, failedFileCount: 0 },
        fileResults: [],
        issues: [{ filePath: 'report1.csv', message: '不正なCSV形式', severity: 'error' }],
      });

      const result = await command.execute({
        inputDir: '/data/sample',
        outputDir: '/output',
      });

      expect(result.status).toBe('failure');
      expect(deps.writer.publish).not.toHaveBeenCalled();
    });
  });
});

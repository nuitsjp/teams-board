// LocalConvertCommand — 入力から検証・置換・レポートまでを統制するコマンド
import { SampleDatasetReader } from './sample-dataset-reader.js';
import { CsvTransformerAdapter } from './csv-transformer-adapter.js';
import { SessionAggregationService } from './session-aggregation-service.js';
import { DataContractValidator } from './data-contract-validator.js';
import { ConsistencyValidator } from './consistency-validator.js';
import { AtomicPublicDataWriter } from './atomic-public-data-writer.js';
import { ConversionReporter } from './conversion-reporter.js';

export class LocalConvertCommand {
  /**
   * @param {object} [deps] - 依存注入（テスト用）
   */
  constructor(deps = {}) {
    this._reader = deps.reader || new SampleDatasetReader();
    this._adapter = deps.adapter || new CsvTransformerAdapter();
    this._aggregator = deps.aggregator || new SessionAggregationService();
    this._contractValidator = deps.contractValidator || new DataContractValidator();
    this._consistencyValidator = deps.consistencyValidator || new ConsistencyValidator();
    this._writer = deps.writer || new AtomicPublicDataWriter();
    this._reporter = deps.reporter || new ConversionReporter();
  }

  /**
   * ローカル変換フローを実行する
   * 実行順序: 入力読込 → 変換 → 集約 → 検証 → 置換 → レポート
   * @param {object} options
   * @param {string} options.inputDir - 入力ディレクトリ
   * @param {string} options.outputDir - 出力ディレクトリ
   * @returns {Promise<object>} ConversionReport
   */
  async execute(options) {
    const { inputDir, outputDir } = options;
    const allIssues = [];

    // 1. 入力読込
    const inputResult = await this._reader.listInputs(inputDir);
    if (!inputResult.ok) {
      return this._reporter.buildReport({
        inputCsvCount: 0,
        generatedSessionCount: 0,
        fileResults: [],
        issues: [{ filePath: inputDir, message: inputResult.error, severity: 'error' }],
      });
    }

    // 2. 変換（CSV → SessionRecord + MergeInput）
    const parsedSessions = [];
    const transformErrors = [];

    for (const csvFile of inputResult.files) {
      const parseResult = await this._adapter.parse(csvFile);
      if (parseResult.ok) {
        parsedSessions.push({
          sessionRecord: parseResult.sessionRecord,
          mergeInput: parseResult.mergeInput,
        });
        if (parseResult.warnings.length > 0) {
          for (const w of parseResult.warnings) {
            allIssues.push({ filePath: csvFile.name, message: w, severity: 'warning' });
          }
        }
      } else {
        for (const err of parseResult.errors) {
          transformErrors.push({ filePath: csvFile.name, message: err, severity: 'error' });
        }
      }
    }

    // 全CSVが変換失敗した場合
    if (parsedSessions.length === 0) {
      return this._reporter.buildReport({
        inputCsvCount: inputResult.files.length,
        generatedSessionCount: 0,
        fileResults: [],
        issues: [...allIssues, ...transformErrors],
      });
    }

    // 3. 集約
    const aggregation = this._aggregator.aggregate(parsedSessions);
    if (aggregation.warnings.length > 0) {
      for (const w of aggregation.warnings) {
        allIssues.push({ filePath: 'aggregation', message: w, severity: 'warning' });
      }
    }

    // 4. 検証（契約検証 + 整合性検証）
    const contractIssues = this._contractValidator.validateIndex(aggregation.index);
    for (const session of aggregation.sessions) {
      const sessionIssues = this._contractValidator.validateSession(
        `sessions/${session.id}.json`,
        session
      );
      contractIssues.push(...sessionIssues);
    }

    const consistencyIssues = this._consistencyValidator.validate(
      aggregation.index,
      aggregation.sessions
    );

    const validationErrors = [
      ...contractIssues.filter((i) => i.severity === 'error'),
      ...consistencyIssues,
    ];

    // 検証失敗時は置換を行わない
    if (validationErrors.length > 0) {
      return this._reporter.buildReport({
        inputCsvCount: inputResult.files.length,
        generatedSessionCount: aggregation.sessions.length,
        fileResults: [],
        issues: [...allIssues, ...transformErrors, ...contractIssues, ...consistencyIssues],
      });
    }

    // 5. 置換
    const publishResult = await this._writer.publish(
      outputDir,
      aggregation.index,
      aggregation.sessions
    );

    // 6. レポート
    return this._reporter.buildReport({
      inputCsvCount: inputResult.files.length,
      generatedSessionCount: aggregation.sessions.length,
      fileResults: publishResult.results,
      issues: [...allIssues, ...transformErrors, ...contractIssues, ...consistencyIssues],
    });
  }
}

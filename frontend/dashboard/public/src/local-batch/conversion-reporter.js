// ConversionReporter — 変換実行結果のレポーティング
import * as fsPromises from 'node:fs/promises';

export class ConversionReporter {
  /**
   * @param {object} [deps] - 依存注入（テスト用）
   * @param {object} [deps.fs] - fs/promises互換オブジェクト（writeFileメソッド）
   */
  constructor(deps = {}) {
    this._fs = deps.fs || fsPromises;
  }

  /**
   * 変換実行結果からConversionReportを構築する
   * @param {object} params
   * @param {number} params.inputCsvCount - 入力CSVファイル数
   * @param {number} params.generatedSessionCount - 生成セッション数
   * @param {Array<{path: string, ok: boolean, error?: string}>} params.fileResults - ファイル書き込み結果
   * @param {object[]} params.issues - 検証エラー・警告
   * @returns {object} ConversionReport
   */
  buildReport({ inputCsvCount, generatedSessionCount, fileResults, issues }) {
    const writtenFileCount = fileResults.filter((r) => r.ok).length;
    const failedFileCount = fileResults.filter((r) => !r.ok).length;
    // severityが未設定のissue（整合性検証等）もエラーとして扱う
    const hasErrors = issues.some((i) => i.severity === 'error' || !i.severity) || failedFileCount > 0;
    const hasSuccess = writtenFileCount > 0;

    let status;
    if (!hasErrors && generatedSessionCount > 0) {
      status = 'success';
    } else if (hasErrors && hasSuccess) {
      status = 'partial';
    } else {
      status = 'failure';
    }

    return {
      status,
      summary: {
        inputCsvCount,
        generatedSessionCount,
        writtenFileCount,
        failedFileCount,
      },
      fileResults,
      issues,
    };
  }

  /**
   * レポートを標準出力用の文字列にフォーマットする
   * @param {object} report - ConversionReport
   * @returns {string}
   */
  format(report) {
    const lines = [];
    lines.push(`=== 変換レポート ===`);
    lines.push(`ステータス: ${report.status}`);
    lines.push(`入力CSV数: ${report.summary.inputCsvCount}`);
    lines.push(`生成セッション数: ${report.summary.generatedSessionCount}`);
    lines.push(`書き込み成功: ${report.summary.writtenFileCount} ファイル`);
    lines.push(`書き込み失敗: ${report.summary.failedFileCount} ファイル`);

    if (report.issues.length > 0) {
      lines.push('');
      lines.push('--- 検証結果 ---');
      for (const issue of report.issues) {
        lines.push(`  [${issue.severity || 'error'}] ${issue.filePath}: ${issue.message}`);
      }
    }

    const failed = report.fileResults.filter((r) => !r.ok);
    if (failed.length > 0) {
      lines.push('');
      lines.push('--- 失敗ファイル ---');
      for (const f of failed) {
        lines.push(`  ${f.path}: ${f.error}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * レポートをJSONファイルとして保存する
   * @param {object} report - ConversionReport
   * @param {string} filePath - 保存先パス
   */
  async saveToFile(report, filePath) {
    await this._fs.writeFile(filePath, JSON.stringify(report, null, 2), 'utf-8');
  }
}

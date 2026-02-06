// SampleDatasetReader — data/sample 配下のCSV入力を収集し、欠落条件を検出する
import * as fsPromises from 'node:fs/promises';
import { constants } from 'node:fs';
import { join } from 'node:path';

export class SampleDatasetReader {
  /**
   * @param {object} [deps] - 依存注入（テスト用）
   * @param {typeof fsPromises} [deps.fs] - fs/promises互換オブジェクト
   * @param {Function} [deps.joinPath] - path.join互換関数
   */
  constructor(deps = {}) {
    this._fs = deps.fs || fsPromises;
    this._join = deps.joinPath || join;
  }

  /**
   * 入力ディレクトリからCSVファイルを列挙し、前提条件を検証する
   * @param {string} inputDir - 入力ディレクトリパス
   * @returns {Promise<{ok: boolean, files?: CsvInputFile[], warnings?: string[], error?: string}>}
   */
  async listInputs(inputDir) {
    const warnings = [];

    // ディレクトリ読み込み
    let entries;
    try {
      entries = await this._fs.readdir(inputDir);
    } catch (err) {
      return {
        ok: false,
        error: `入力ディレクトリを読み込めません: ${inputDir} (${err.message})`,
        warnings,
      };
    }

    // .csvファイルのみ抽出
    const csvEntries = entries.filter(
      (name) => name.toLowerCase().endsWith('.csv')
    );

    // ファイルメタ情報の収集とアクセス確認
    const files = [];
    for (const name of csvEntries) {
      const filePath = this._join(inputDir, name);

      // ファイルかどうか確認
      let fileStat;
      try {
        fileStat = await this._fs.stat(filePath);
      } catch {
        warnings.push(`ファイル情報を取得できません: ${name}`);
        continue;
      }

      if (!fileStat.isFile()) {
        continue;
      }

      // 読み取り権限確認
      try {
        await this._fs.access(filePath, constants.R_OK);
      } catch {
        warnings.push(`読み取り不可: ${name}`);
        continue;
      }

      files.push({
        path: filePath,
        name,
        sizeBytes: fileStat.size,
      });
    }

    // 対象CSVが0件の場合はエラー
    if (files.length === 0) {
      return {
        ok: false,
        error: `対象CSVファイルが見つかりません: ${inputDir}`,
        warnings,
      };
    }

    return {
      ok: true,
      files,
      warnings,
    };
  }
}

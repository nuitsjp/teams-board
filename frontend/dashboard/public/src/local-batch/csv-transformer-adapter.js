// CsvTransformerAdapter — ローカルファイル入力を既存CSV変換器へ適合させるアダプター
import * as fsPromises from 'node:fs/promises';
import { CsvTransformer } from '../logic/csv-transformer.js';

export class CsvTransformerAdapter {
  /**
   * @param {object} [deps] - 依存注入（テスト用）
   * @param {object} [deps.fs] - fs/promises互換オブジェクト（readFileメソッド）
   * @param {object} [deps.csvTransformer] - CsvTransformer互換オブジェクト（parseメソッド）
   */
  constructor(deps = {}) {
    this._fs = deps.fs || fsPromises;
    this._transformer = deps.csvTransformer || new CsvTransformer();
  }

  /**
   * ローカルCSVファイルを読み込み、既存CsvTransformerで変換する
   * @param {object} csvInputFile - SampleDatasetReaderが返すCsvInputFile
   * @param {string} csvInputFile.path - ファイルパス
   * @param {string} csvInputFile.name - ファイル名
   * @param {number} csvInputFile.sizeBytes - ファイルサイズ
   * @returns {Promise<{ok: true, sessionRecord: object, mergeInput: object, warnings: string[]} | {ok: false, errors: string[]}>}
   */
  async parse(csvInputFile) {
    // ファイル読み込み
    let fileBuffer;
    try {
      fileBuffer = await this._fs.readFile(csvInputFile.path);
    } catch (err) {
      return {
        ok: false,
        errors: [`ファイル読み込みに失敗しました: ${csvInputFile.name} (${err.message})`],
      };
    }

    // Node.jsのBufferをArrayBufferに変換し、File互換オブジェクトを構築
    const arrayBuffer = fileBuffer.buffer.slice(
      fileBuffer.byteOffset,
      fileBuffer.byteOffset + fileBuffer.byteLength
    );

    const source = {
      name: csvInputFile.name,
      arrayBuffer: async () => arrayBuffer,
    };

    // 既存CsvTransformer.parseをそのまま呼び出し、結果を透過的に返す
    return this._transformer.parse(source);
  }
}

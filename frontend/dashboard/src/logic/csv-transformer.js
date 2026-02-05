// CsvTransformer — CSVパース・JSON変換
import Papa from 'papaparse';

export class CsvTransformer {
  /**
   * CSVファイルをパースしてDashboardItem/ItemDetailに変換する
   * @param {File} file
   * @returns {Promise<{ok: true, dashboardItems: Array, itemDetails: Array, warnings: string[]} | {ok: false, errors: string[]}>}
   */
  async parse(file) {
    return new Promise((resolve) => {
      Papa.parse(file, {
        header: true,
        worker: true,
        skipEmptyLines: true,
        complete: (results) => {
          // PapaParseエラーチェック
          if (results.errors.length > 0) {
            resolve({
              ok: false,
              errors: results.errors.map((e) => `行${e.row}: ${e.message}`),
            });
            return;
          }

          // 空データチェック
          if (results.data.length === 0) {
            resolve({
              ok: false,
              errors: ['CSVにデータ行がありません'],
            });
            return;
          }

          const warnings = [];
          const dashboardItems = [];
          const itemDetails = [];

          for (const row of results.data) {
            const { id, title, ...rest } = row;

            // summaryはid/title以外の全フィールド
            const summary = {};
            for (const [key, value] of Object.entries(rest)) {
              const num = Number(value);
              summary[key] = isNaN(num) || value === '' ? value : num;
            }

            dashboardItems.push({ id, title, summary });

            itemDetails.push({
              id,
              title,
              data: { ...rest },
            });
          }

          resolve({ ok: true, dashboardItems, itemDetails, warnings });
        },
        error: (err) => {
          resolve({
            ok: false,
            errors: [err.message],
          });
        },
      });
    });
  }
}

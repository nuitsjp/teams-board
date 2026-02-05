// CsvTransformer テスト
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CsvTransformer } from '../../src/logic/csv-transformer.js';

// PapaParseのモック
vi.mock('papaparse', () => ({
  default: {
    parse: vi.fn(),
  },
}));

import Papa from 'papaparse';

/**
 * File相当のヘルパー
 * @param {string} content
 * @param {string} name
 * @returns {File}
 */
function createFile(content, name = 'test.csv') {
  return new File([content], name, { type: 'text/csv' });
}

describe('CsvTransformer', () => {
  let transformer;

  beforeEach(() => {
    transformer = new CsvTransformer();
    vi.clearAllMocks();
  });

  describe('正常なCSVパース', () => {
    it('正常なCSV文字列をパースしてDashboardItem配列を生成できること', async () => {
      Papa.parse.mockImplementation((_file, config) => {
        config.complete({
          data: [
            { id: 'item-101', title: '四半期売上', category: '製品A', amount: '2000000', count: '55' },
            { id: 'item-102', title: '月次在庫', category: '部品B', amount: '0', count: '120' },
          ],
          errors: [],
        });
      });

      const file = createFile('dummy');
      const result = await transformer.parse(file);
      expect(result.ok).toBe(true);
      expect(result.dashboardItems).toHaveLength(2);
      expect(result.dashboardItems[0].id).toBe('item-101');
      expect(result.dashboardItems[0].title).toBe('四半期売上');
    });

    it('正常なCSV文字列をパースしてItemDetail配列を生成できること', async () => {
      Papa.parse.mockImplementation((_file, config) => {
        config.complete({
          data: [
            { id: 'item-101', title: '四半期売上', category: '製品A', amount: '2000000', count: '55' },
          ],
          errors: [],
        });
      });

      const file = createFile('dummy');
      const result = await transformer.parse(file);
      expect(result.ok).toBe(true);
      expect(result.itemDetails).toHaveLength(1);
      expect(result.itemDetails[0].id).toBe('item-101');
      expect(result.itemDetails[0].title).toBe('四半期売上');
      expect(result.itemDetails[0].data).toBeDefined();
    });

    it('各DashboardItemにsummaryが含まれること', async () => {
      Papa.parse.mockImplementation((_file, config) => {
        config.complete({
          data: [
            { id: 'x', title: 'X', category: 'C', amount: '100', count: '5' },
          ],
          errors: [],
        });
      });

      const file = createFile('dummy');
      const result = await transformer.parse(file);
      expect(result.ok).toBe(true);
      expect(result.dashboardItems[0].summary).toBeDefined();
      expect(typeof result.dashboardItems[0].summary).toBe('object');
    });
  });

  describe('エラーケース', () => {
    it('空のCSVファイルでエラー結果を返すこと', async () => {
      Papa.parse.mockImplementation((_file, config) => {
        config.complete({
          data: [],
          errors: [],
        });
      });

      const file = createFile('');
      const result = await transformer.parse(file);
      expect(result.ok).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('PapaParseがエラーを返した場合にエラー結果を返すこと', async () => {
      Papa.parse.mockImplementation((_file, config) => {
        config.complete({
          data: [],
          errors: [{ message: 'UndetectableDelimiter', row: 0 }],
        });
      });

      const file = createFile('bad data');
      const result = await transformer.parse(file);
      expect(result.ok).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('PapaParseのerrorコールバック時にエラー結果を返すこと', async () => {
      Papa.parse.mockImplementation((_file, config) => {
        config.error(new Error('パースエラー'));
      });

      const file = createFile('bad');
      const result = await transformer.parse(file);
      expect(result.ok).toBe(false);
      expect(result.errors[0]).toContain('パースエラー');
    });
  });

  describe('PapaParse呼び出し', () => {
    it('PapaParseがheader:trueで呼び出されること', async () => {
      Papa.parse.mockImplementation((_file, config) => {
        config.complete({ data: [{ id: 'a', title: 'A' }], errors: [] });
      });

      const file = createFile('dummy');
      await transformer.parse(file);
      expect(Papa.parse).toHaveBeenCalledTimes(1);
      const config = Papa.parse.mock.calls[0][1];
      expect(config.header).toBe(true);
    });

    it('PapaParseがworker:trueで呼び出されること（UIスレッド非ブロック）', async () => {
      Papa.parse.mockImplementation((_file, config) => {
        config.complete({ data: [{ id: 'a', title: 'A' }], errors: [] });
      });

      const file = createFile('dummy');
      await transformer.parse(file);
      const config = Papa.parse.mock.calls[0][1];
      expect(config.worker).toBe(true);
    });
  });
});

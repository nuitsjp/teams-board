// CsvTransformerAdapter テスト — ローカルファイル入力を既存CSV変換器へ適合させる
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CsvTransformerAdapter } from '../../src/local-batch/csv-transformer-adapter.js';

/**
 * テスト用のfsモックを生成する
 */
function createMockFs() {
  return {
    readFile: vi.fn(),
  };
}

/**
 * テスト用のCsvTransformerモックを生成する
 */
function createMockTransformer() {
  return {
    parse: vi.fn(),
  };
}

describe('CsvTransformerAdapter', () => {
  let adapter;
  let mockFs;
  let mockTransformer;

  beforeEach(() => {
    mockFs = createMockFs();
    mockTransformer = createMockTransformer();
    adapter = new CsvTransformerAdapter({
      fs: mockFs,
      csvTransformer: mockTransformer,
    });
  });

  describe('正常な変換', () => {
    it('ファイルパスからCSVを読み込み、CsvTransformerへ渡して変換結果を返すこと', async () => {
      // UTF-16LEのバイナリデータを模擬
      const fakeBuffer = new Uint8Array([0xff, 0xfe, 0x41, 0x00]).buffer;
      mockFs.readFile.mockResolvedValue(Buffer.from(fakeBuffer));

      const expectedResult = {
        ok: true,
        sessionRecord: {
          id: 'abcd1234-2026-01-15',
          studyGroupId: 'abcd1234',
          date: '2026-01-15',
          attendances: [{ memberId: 'ef567890', durationSeconds: 3600 }],
        },
        mergeInput: {
          sessionId: 'abcd1234-2026-01-15',
          studyGroupId: 'abcd1234',
          studyGroupName: 'テスト勉強会',
          date: '2026-01-15',
          attendances: [
            { memberId: 'ef567890', memberName: '田中太郎', durationSeconds: 3600 },
          ],
        },
        warnings: [],
      };
      mockTransformer.parse.mockResolvedValue(expectedResult);

      const result = await adapter.parse({
        path: '/test/data/sample/report.csv',
        name: 'report.csv',
        sizeBytes: 1500,
      });

      expect(result.ok).toBe(true);
      expect(result.sessionRecord).toEqual(expectedResult.sessionRecord);
      expect(result.mergeInput).toEqual(expectedResult.mergeInput);
      expect(result.warnings).toEqual([]);
    });

    it('CsvTransformerにFile互換オブジェクト（name, arrayBuffer）を渡すこと', async () => {
      const fakeBuffer = new Uint8Array([0xff, 0xfe]).buffer;
      mockFs.readFile.mockResolvedValue(Buffer.from(fakeBuffer));
      mockTransformer.parse.mockResolvedValue({
        ok: true,
        sessionRecord: {},
        mergeInput: {},
        warnings: [],
      });

      await adapter.parse({
        path: '/test/report.csv',
        name: 'report.csv',
        sizeBytes: 100,
      });

      // CsvTransformer.parseに渡されたオブジェクトを検証
      expect(mockTransformer.parse).toHaveBeenCalledOnce();
      const source = mockTransformer.parse.mock.calls[0][0];
      expect(source.name).toBe('report.csv');
      expect(typeof source.arrayBuffer).toBe('function');

      // arrayBuffer()がPromise<ArrayBuffer>を返すことを検証
      const buffer = await source.arrayBuffer();
      expect(buffer).toBeInstanceOf(ArrayBuffer);
    });
  });

  describe('変換エラーの伝播', () => {
    it('CsvTransformerがエラーを返した場合、そのまま伝播すること', async () => {
      const fakeBuffer = new Uint8Array([0xff, 0xfe]).buffer;
      mockFs.readFile.mockResolvedValue(Buffer.from(fakeBuffer));

      const errorResult = {
        ok: false,
        errors: ['Teams出席レポート形式ではありません'],
      };
      mockTransformer.parse.mockResolvedValue(errorResult);

      const result = await adapter.parse({
        path: '/test/invalid.csv',
        name: 'invalid.csv',
        sizeBytes: 100,
      });

      expect(result.ok).toBe(false);
      expect(result.errors).toEqual(['Teams出席レポート形式ではありません']);
    });

    it('変換警告を上位に透過的に伝播すること', async () => {
      const fakeBuffer = new Uint8Array([0xff, 0xfe]).buffer;
      mockFs.readFile.mockResolvedValue(Buffer.from(fakeBuffer));

      const warningResult = {
        ok: true,
        sessionRecord: { id: 'test-2026-01-15' },
        mergeInput: { sessionId: 'test-2026-01-15' },
        warnings: ['時間フォーマット不正（スキップ）: 山田花子 — "不明"'],
      };
      mockTransformer.parse.mockResolvedValue(warningResult);

      const result = await adapter.parse({
        path: '/test/report.csv',
        name: 'report.csv',
        sizeBytes: 100,
      });

      expect(result.ok).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('時間フォーマット不正');
    });
  });

  describe('ファイル読み込みエラー', () => {
    it('ファイル読み込みに失敗した場合はエラーを返すこと', async () => {
      mockFs.readFile.mockRejectedValue(
        new Error('ENOENT: no such file or directory')
      );

      const result = await adapter.parse({
        path: '/test/nonexistent.csv',
        name: 'nonexistent.csv',
        sizeBytes: 0,
      });

      expect(result.ok).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('nonexistent.csv');
    });
  });

  describe('ArrayBuffer変換', () => {
    it('Buffer型のreadFile結果をArrayBufferに変換して渡すこと', async () => {
      // Node.jsのBuffer（ArrayBufferのView）を返すケース
      const testData = new Uint8Array([0xff, 0xfe, 0x48, 0x00, 0x65, 0x00]);
      mockFs.readFile.mockResolvedValue(Buffer.from(testData));
      mockTransformer.parse.mockResolvedValue({
        ok: true,
        sessionRecord: {},
        mergeInput: {},
        warnings: [],
      });

      await adapter.parse({
        path: '/test/report.csv',
        name: 'report.csv',
        sizeBytes: 6,
      });

      const source = mockTransformer.parse.mock.calls[0][0];
      const buffer = await source.arrayBuffer();
      const view = new Uint8Array(buffer);
      // BOM（0xFF 0xFE）で始まるUTF-16LEデータが正しく渡されること
      expect(view[0]).toBe(0xff);
      expect(view[1]).toBe(0xfe);
    });
  });
});

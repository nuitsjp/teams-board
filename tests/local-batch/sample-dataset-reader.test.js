// SampleDatasetReader テスト — data/sample 配下のCSV入力列挙と前提検証
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SampleDatasetReader } from '../../src/local-batch/sample-dataset-reader.js';

/**
 * テスト用のfsモックを生成する
 */
function createMockFs() {
  return {
    readdir: vi.fn(),
    stat: vi.fn(),
    access: vi.fn(),
  };
}

const mockJoin = (...args) => args.join('/');

describe('SampleDatasetReader', () => {
  let reader;
  let mockFs;

  beforeEach(() => {
    mockFs = createMockFs();
    reader = new SampleDatasetReader({ fs: mockFs, joinPath: mockJoin });
  });

  describe('CSV列挙', () => {
    it('入力ディレクトリ配下の.csvファイルを列挙できること', async () => {
      mockFs.readdir.mockResolvedValue([
        'report-2026-01-15.csv',
        'report-2026-01-16.csv',
        'readme.txt',
      ]);
      mockFs.stat.mockImplementation(async () => ({
        size: 1500,
        isFile: () => true,
      }));
      mockFs.access.mockResolvedValue(undefined);

      const result = await reader.listInputs('/test/data/sample');

      expect(result.ok).toBe(true);
      expect(result.files).toHaveLength(2);
      expect(result.files[0].name).toBe('report-2026-01-15.csv');
      expect(result.files[1].name).toBe('report-2026-01-16.csv');
    });

    it('.csvファイルのみを対象とし他の拡張子は除外すること', async () => {
      mockFs.readdir.mockResolvedValue([
        'report.csv',
        'notes.txt',
        'data.json',
        'image.png',
      ]);
      mockFs.stat.mockResolvedValue({ size: 500, isFile: () => true });
      mockFs.access.mockResolvedValue(undefined);

      const result = await reader.listInputs('/test/data/sample');

      expect(result.ok).toBe(true);
      expect(result.files).toHaveLength(1);
      expect(result.files[0].name).toBe('report.csv');
    });

    it('ディレクトリエントリは除外すること', async () => {
      mockFs.readdir.mockResolvedValue(['subdir', 'report.csv']);
      mockFs.stat.mockImplementation(async (filePath) => {
        if (filePath.includes('subdir')) {
          return { size: 0, isFile: () => false };
        }
        return { size: 1000, isFile: () => true };
      });
      mockFs.access.mockResolvedValue(undefined);

      const result = await reader.listInputs('/test/data/sample');

      expect(result.ok).toBe(true);
      expect(result.files).toHaveLength(1);
      expect(result.files[0].name).toBe('report.csv');
    });
  });

  describe('0件エラー', () => {
    it('対象CSVが0件の場合はエラーを返して処理を中断すること', async () => {
      mockFs.readdir.mockResolvedValue(['notes.txt', 'readme.md']);
      mockFs.stat.mockResolvedValue({ size: 100, isFile: () => true });
      mockFs.access.mockResolvedValue(undefined);

      const result = await reader.listInputs('/test/data/sample');

      expect(result.ok).toBe(false);
      expect(result.error).toContain('CSV');
    });

    it('ディレクトリが空の場合はエラーを返すこと', async () => {
      mockFs.readdir.mockResolvedValue([]);

      const result = await reader.listInputs('/test/data/sample');

      expect(result.ok).toBe(false);
      expect(result.error).toContain('CSV');
    });
  });

  describe('読み取り不可ファイル検出', () => {
    it('読み取り不可のCSVファイルを検出しwarningsに記録すること', async () => {
      mockFs.readdir.mockResolvedValue(['good.csv', 'bad.csv']);
      mockFs.stat.mockResolvedValue({ size: 1000, isFile: () => true });
      mockFs.access.mockImplementation(async (filePath) => {
        if (filePath.includes('bad.csv')) {
          throw new Error('EACCES: permission denied');
        }
        return undefined;
      });

      const result = await reader.listInputs('/test/data/sample');

      expect(result.ok).toBe(true);
      expect(result.files).toHaveLength(1);
      expect(result.files[0].name).toBe('good.csv');
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('bad.csv');
    });

    it('全CSVが読み取り不可の場合はエラーを返すこと', async () => {
      mockFs.readdir.mockResolvedValue(['bad1.csv', 'bad2.csv']);
      mockFs.stat.mockResolvedValue({ size: 1000, isFile: () => true });
      mockFs.access.mockRejectedValue(new Error('EACCES: permission denied'));

      const result = await reader.listInputs('/test/data/sample');

      expect(result.ok).toBe(false);
      expect(result.error).toContain('CSV');
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('メタ情報', () => {
    it('ファイル名とサイズ等のメタ情報を返却すること', async () => {
      mockFs.readdir.mockResolvedValue(['report-2026-01-15.csv']);
      mockFs.stat.mockResolvedValue({ size: 1466, isFile: () => true });
      mockFs.access.mockResolvedValue(undefined);

      const result = await reader.listInputs('/test/data/sample');

      expect(result.ok).toBe(true);
      expect(result.files).toHaveLength(1);
      const file = result.files[0];
      expect(file).toHaveProperty('path');
      expect(file).toHaveProperty('name', 'report-2026-01-15.csv');
      expect(file).toHaveProperty('sizeBytes', 1466);
    });

    it('パスが入力ディレクトリとファイル名の結合であること', async () => {
      mockFs.readdir.mockResolvedValue(['report.csv']);
      mockFs.stat.mockResolvedValue({ size: 500, isFile: () => true });
      mockFs.access.mockResolvedValue(undefined);

      const result = await reader.listInputs('/test/data/sample');

      expect(result.ok).toBe(true);
      expect(result.files[0].path).toContain('report.csv');
      expect(result.files[0].path).toContain('/test/data/sample');
    });
  });

  describe('入力ディレクトリ不在', () => {
    it('入力ディレクトリが存在しない場合はエラーを返すこと', async () => {
      mockFs.readdir.mockRejectedValue(
        Object.assign(new Error('ENOENT: no such file or directory'), { code: 'ENOENT' })
      );

      const result = await reader.listInputs('/nonexistent/path');

      expect(result.ok).toBe(false);
      expect(result.error).toContain('/nonexistent/path');
    });
  });
});

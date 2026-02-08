// CsvTransformer テスト — Teams出席レポート専用パーサー
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CsvTransformer } from '../../src/services/csv-transformer.js';

// PapaParseのモック
vi.mock('papaparse', () => ({
  default: {
    parse: vi.fn(),
  },
}));

import Papa from 'papaparse';

// テスト用: jsdom に不足している API のモック
beforeEach(() => {
  // crypto.subtle.digest のモック（SHA-256ハッシュ）
  const mockDigest = vi.fn(async (_algo, data) => {
    const bytes = new Uint8Array(data);
    const hash = new Uint8Array(32);
    for (let i = 0; i < bytes.length; i++) {
      hash[i % 32] = (hash[i % 32] + bytes[i]) & 0xff;
    }
    return hash.buffer;
  });
  vi.stubGlobal('crypto', { subtle: { digest: mockDigest } });

  // File.prototype.arrayBuffer のポリフィル（jsdom未サポート対策）
  if (!File.prototype.arrayBuffer) {
    File.prototype.arrayBuffer = function () {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(this);
      });
    };
  }
});

/**
 * UTF-16LE エンコードされたバイナリデータを作成するヘルパー
 * @param {string} text
 * @returns {ArrayBuffer}
 */
function createUtf16leBuffer(text) {
  const buf = new ArrayBuffer(text.length * 2);
  const view = new Uint16Array(buf);
  for (let i = 0; i < text.length; i++) {
    view[i] = text.charCodeAt(i);
  }
  return buf;
}

/**
 * Teams出席レポート形式の3セクション構成テキストを作成するヘルパー
 */
function createTeamsReportText({
  title = 'フロントエンド勉強会',
  startTime = '2026/1/15 19:00:00',
  participants = [],
} = {}) {
  const lines = [];
  lines.push('1. 要約');
  lines.push(`会議のタイトル\t${title}`);
  lines.push(`開始時刻\t${startTime}`);
  lines.push('');
  lines.push('2. 参加者');
  lines.push('名前\tメール アドレス\t会議の長さ');
  for (const p of participants) {
    lines.push(`${p.name}\t${p.email}\t${p.duration}`);
  }
  lines.push('');
  lines.push('3. 会議中のアクティビティ');
  lines.push('なし');
  return lines.join('\n');
}

describe('CsvTransformer', () => {
  let transformer;

  beforeEach(() => {
    transformer = new CsvTransformer();
    vi.clearAllMocks();
  });

  describe('セクション分割', () => {
    it('3セクション構成（要約・参加者・アクティビティ）を正しく分割できること', async () => {
      const text = createTeamsReportText({
        participants: [
          { name: '佐藤 一郎', email: 'ichiro.sato@example.com', duration: '30 分 0 秒' },
        ],
      });
      const buffer = createUtf16leBuffer(text);
      const file = new File([buffer], 'report.csv', { type: 'text/csv' });

      // PapaParseのモック: 参加者セクションのTSVがパースされること
      Papa.parse.mockImplementation((input, config) => {
        config.complete({
          data: [
            { '名前': '佐藤 一郎', 'メール アドレス': 'ichiro.sato@example.com', '会議の長さ': '30 分 0 秒' },
          ],
          errors: [],
        });
      });

      const result = await transformer.parse(file);
      expect(result.ok).toBe(true);
    });

    it('「2. 参加者」セクションが見つからない場合にフォーマットエラーを返すこと', async () => {
      const text = '1. 要約\n会議のタイトル\t勉強会\n3. 会議中のアクティビティ\nなし';
      const buffer = createUtf16leBuffer(text);
      const file = new File([buffer], 'bad.csv', { type: 'text/csv' });

      const result = await transformer.parse(file);
      expect(result.ok).toBe(false);
      expect(result.errors.some((e) => e.includes('Teams出席レポート形式'))).toBe(true);
    });
  });

  describe('会議タイトルのクリーニング', () => {
    it('ダブルクォート囲みと「で会議中」を除去してクリーニング済み勉強会名を得ること', async () => {
      const text = createTeamsReportText({
        title: '"""フロントエンド勉強会""で会議中"',
        participants: [
          { name: '佐藤 一郎', email: 'ichiro.sato@example.com', duration: '30 分 0 秒' },
        ],
      });
      const buffer = createUtf16leBuffer(text);
      const file = new File([buffer], 'report.csv', { type: 'text/csv' });

      Papa.parse.mockImplementation((input, config) => {
        config.complete({
          data: [
            { '名前': '佐藤 一郎', 'メール アドレス': 'ichiro.sato@example.com', '会議の長さ': '30 分 0 秒' },
          ],
          errors: [],
        });
      });

      const result = await transformer.parse(file);
      expect(result.ok).toBe(true);
      expect(result.mergeInput.groupName).toBe('フロントエンド勉強会');
    });

    it('装飾のないタイトルはそのまま返すこと', async () => {
      const text = createTeamsReportText({
        title: 'フロントエンド勉強会',
        participants: [
          { name: '佐藤 一郎', email: 'ichiro.sato@example.com', duration: '30 分 0 秒' },
        ],
      });
      const buffer = createUtf16leBuffer(text);
      const file = new File([buffer], 'report.csv', { type: 'text/csv' });

      Papa.parse.mockImplementation((input, config) => {
        config.complete({
          data: [
            { '名前': '佐藤 一郎', 'メール アドレス': 'ichiro.sato@example.com', '会議の長さ': '30 分 0 秒' },
          ],
          errors: [],
        });
      });

      const result = await transformer.parse(file);
      expect(result.ok).toBe(true);
      expect(result.mergeInput.groupName).toBe('フロントエンド勉強会');
    });
  });

  describe('時間パース', () => {
    it('「X 分 Y 秒」形式を秒数に変換できること', async () => {
      const text = createTeamsReportText({
        participants: [
          { name: '佐藤 一郎', email: 'ichiro.sato@example.com', duration: '30 分 15 秒' },
        ],
      });
      const buffer = createUtf16leBuffer(text);
      const file = new File([buffer], 'report.csv', { type: 'text/csv' });

      Papa.parse.mockImplementation((input, config) => {
        config.complete({
          data: [
            { '名前': '佐藤 一郎', 'メール アドレス': 'ichiro.sato@example.com', '会議の長さ': '30 分 15 秒' },
          ],
          errors: [],
        });
      });

      const result = await transformer.parse(file);
      expect(result.ok).toBe(true);
      expect(result.sessionRecord.attendances[0].durationSeconds).toBe(1815);
    });

    it('「X 時間 Y 分 Z 秒」形式を秒数に変換できること', async () => {
      const text = createTeamsReportText({
        participants: [
          { name: '佐藤 一郎', email: 'ichiro.sato@example.com', duration: '1 時間 30 分 0 秒' },
        ],
      });
      const buffer = createUtf16leBuffer(text);
      const file = new File([buffer], 'report.csv', { type: 'text/csv' });

      Papa.parse.mockImplementation((input, config) => {
        config.complete({
          data: [
            { '名前': '佐藤 一郎', 'メール アドレス': 'ichiro.sato@example.com', '会議の長さ': '1 時間 30 分 0 秒' },
          ],
          errors: [],
        });
      });

      const result = await transformer.parse(file);
      expect(result.ok).toBe(true);
      expect(result.sessionRecord.attendances[0].durationSeconds).toBe(5400);
    });

    it('パースできない時間形式は警告として記録しスキップすること', async () => {
      const text = createTeamsReportText({
        participants: [
          { name: '佐藤 一郎', email: 'ichiro.sato@example.com', duration: '不正な形式' },
          { name: '高橋 美咲', email: 'misaki.takahashi@example.com', duration: '10 分 0 秒' },
        ],
      });
      const buffer = createUtf16leBuffer(text);
      const file = new File([buffer], 'report.csv', { type: 'text/csv' });

      Papa.parse.mockImplementation((input, config) => {
        config.complete({
          data: [
            { '名前': '佐藤 一郎', 'メール アドレス': 'ichiro.sato@example.com', '会議の長さ': '不正な形式' },
            { '名前': '高橋 美咲', 'メール アドレス': 'misaki.takahashi@example.com', '会議の長さ': '10 分 0 秒' },
          ],
          errors: [],
        });
      });

      const result = await transformer.parse(file);
      expect(result.ok).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      // 不正な行はスキップされ、正常な行のみ残る
      expect(result.sessionRecord.attendances).toHaveLength(1);
      expect(result.sessionRecord.attendances[0].durationSeconds).toBe(600);
    });
  });

  describe('ID生成', () => {
    it('SHA-256ハッシュ先頭8桁のIDが生成されること', async () => {
      const text = createTeamsReportText({
        participants: [
          { name: '佐藤 一郎', email: 'ichiro.sato@example.com', duration: '10 分 0 秒' },
        ],
      });
      const buffer = createUtf16leBuffer(text);
      const file = new File([buffer], 'report.csv', { type: 'text/csv' });

      Papa.parse.mockImplementation((input, config) => {
        config.complete({
          data: [
            { '名前': '佐藤 一郎', 'メール アドレス': 'ichiro.sato@example.com', '会議の長さ': '10 分 0 秒' },
          ],
          errors: [],
        });
      });

      const result = await transformer.parse(file);
      expect(result.ok).toBe(true);
      // Group ID: 8桁hex
      expect(result.mergeInput.groupId).toMatch(/^[0-9a-f]{8}$/);
      // Member ID: 8桁hex
      expect(result.sessionRecord.attendances[0].memberId).toMatch(/^[0-9a-f]{8}$/);
      // Session ID: groupId-YYYY-MM-DD
      expect(result.sessionRecord.id).toMatch(/^[0-9a-f]{8}-\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('開催日抽出', () => {
    it('開始時刻フィールドからYYYY-MM-DD形式の開催日を取得できること', async () => {
      const text = createTeamsReportText({
        startTime: '2026/1/15 19:00:00',
        participants: [
          { name: '佐藤 一郎', email: 'ichiro.sato@example.com', duration: '10 分 0 秒' },
        ],
      });
      const buffer = createUtf16leBuffer(text);
      const file = new File([buffer], 'report.csv', { type: 'text/csv' });

      Papa.parse.mockImplementation((input, config) => {
        config.complete({
          data: [
            { '名前': '佐藤 一郎', 'メール アドレス': 'ichiro.sato@example.com', '会議の長さ': '10 分 0 秒' },
          ],
          errors: [],
        });
      });

      const result = await transformer.parse(file);
      expect(result.ok).toBe(true);
      expect(result.sessionRecord.date).toBe('2026-01-15');
    });
  });

  describe('統合パイプライン', () => {
    it('正常なCSVから SessionRecord と MergeInput を生成できること', async () => {
      const text = createTeamsReportText({
        title: 'フロントエンド勉強会',
        startTime: '2026/1/15 19:00:00',
        participants: [
          { name: '佐藤 一郎', email: 'ichiro.sato@example.com', duration: '59 分 12 秒' },
          { name: '高橋 美咲', email: 'misaki.takahashi@example.com', duration: '20 分 59 秒' },
        ],
      });
      const buffer = createUtf16leBuffer(text);
      const file = new File([buffer], 'report.csv', { type: 'text/csv' });

      Papa.parse.mockImplementation((input, config) => {
        config.complete({
          data: [
            { '名前': '佐藤 一郎', 'メール アドレス': 'ichiro.sato@example.com', '会議の長さ': '59 分 12 秒' },
            { '名前': '高橋 美咲', 'メール アドレス': 'misaki.takahashi@example.com', '会議の長さ': '20 分 59 秒' },
          ],
          errors: [],
        });
      });

      const result = await transformer.parse(file);
      expect(result.ok).toBe(true);

      // SessionRecord の検証
      const { sessionRecord } = result;
      expect(sessionRecord.groupId).toMatch(/^[0-9a-f]{8}$/);
      expect(sessionRecord.date).toBe('2026-01-15');
      expect(sessionRecord.attendances).toHaveLength(2);
      expect(sessionRecord.attendances[0].durationSeconds).toBe(3552);
      expect(sessionRecord.attendances[1].durationSeconds).toBe(1259);

      // MergeInput の検証
      const { mergeInput } = result;
      expect(mergeInput.groupName).toBe('フロントエンド勉強会');
      expect(mergeInput.sessionId).toBe(sessionRecord.id);
      expect(mergeInput.date).toBe('2026-01-15');
      expect(mergeInput.attendances).toHaveLength(2);
      expect(mergeInput.attendances[0].memberName).toBe('佐藤 一郎');
      expect(mergeInput.attendances[0].durationSeconds).toBe(3552);
    });

    it('参加者が0件の場合はエラーを返すこと', async () => {
      const text = createTeamsReportText({ participants: [] });
      const buffer = createUtf16leBuffer(text);
      const file = new File([buffer], 'report.csv', { type: 'text/csv' });

      Papa.parse.mockImplementation((input, config) => {
        config.complete({
          data: [],
          errors: [],
        });
      });

      const result = await transformer.parse(file);
      expect(result.ok).toBe(false);
      expect(result.errors.some((e) => e.includes('参加者'))).toBe(true);
    });

    it('PapaParseがタブ区切り・ヘッダー付きで呼び出されること', async () => {
      const text = createTeamsReportText({
        participants: [
          { name: '佐藤 一郎', email: 'ichiro.sato@example.com', duration: '10 分 0 秒' },
        ],
      });
      const buffer = createUtf16leBuffer(text);
      const file = new File([buffer], 'report.csv', { type: 'text/csv' });

      Papa.parse.mockImplementation((input, config) => {
        config.complete({
          data: [
            { '名前': '佐藤 一郎', 'メール アドレス': 'ichiro.sato@example.com', '会議の長さ': '10 分 0 秒' },
          ],
          errors: [],
        });
      });

      await transformer.parse(file);
      const config = Papa.parse.mock.calls[0][1];
      expect(config.delimiter).toBe('\t');
      expect(config.header).toBe(true);
    });
  });
});

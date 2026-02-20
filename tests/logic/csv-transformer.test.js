// CsvTransformer テスト — Teams出席レポート専用パーサー（V2: parsedSession 出力）
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CsvTransformer } from '../../src/services/csv-transformer.js';

// PapaParseのモック
vi.mock('papaparse', () => ({
  default: {
    parse: vi.fn(),
  },
}));

import Papa from 'papaparse';

// ULID パターン（Crockford's Base32: 26文字）
const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

// テスト用: jsdom に不足している API のモック
beforeEach(() => {
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

      Papa.parse.mockImplementation((input, config) => {
        config.complete({
          data: [
            {
              名前: '佐藤 一郎',
              'メール アドレス': 'ichiro.sato@example.com',
              会議の長さ: '30 分 0 秒',
            },
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
            {
              名前: '佐藤 一郎',
              'メール アドレス': 'ichiro.sato@example.com',
              会議の長さ: '30 分 0 秒',
            },
          ],
          errors: [],
        });
      });

      const result = await transformer.parse(file);
      expect(result.ok).toBe(true);
      expect(result.parsedSession.groupName).toBe('フロントエンド勉強会');
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
            {
              名前: '佐藤 一郎',
              'メール アドレス': 'ichiro.sato@example.com',
              会議の長さ: '30 分 0 秒',
            },
          ],
          errors: [],
        });
      });

      const result = await transformer.parse(file);
      expect(result.ok).toBe(true);
      expect(result.parsedSession.groupName).toBe('フロントエンド勉強会');
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
            {
              名前: '佐藤 一郎',
              'メール アドレス': 'ichiro.sato@example.com',
              会議の長さ: '30 分 15 秒',
            },
          ],
          errors: [],
        });
      });

      const result = await transformer.parse(file);
      expect(result.ok).toBe(true);
      expect(result.parsedSession.attendances[0].durationSeconds).toBe(1815);
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
            {
              名前: '佐藤 一郎',
              'メール アドレス': 'ichiro.sato@example.com',
              会議の長さ: '1 時間 30 分 0 秒',
            },
          ],
          errors: [],
        });
      });

      const result = await transformer.parse(file);
      expect(result.ok).toBe(true);
      expect(result.parsedSession.attendances[0].durationSeconds).toBe(5400);
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
            {
              名前: '佐藤 一郎',
              'メール アドレス': 'ichiro.sato@example.com',
              会議の長さ: '不正な形式',
            },
            {
              名前: '高橋 美咲',
              'メール アドレス': 'misaki.takahashi@example.com',
              会議の長さ: '10 分 0 秒',
            },
          ],
          errors: [],
        });
      });

      const result = await transformer.parse(file);
      expect(result.ok).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      // 不正な行はスキップされ、正常な行のみ残る
      expect(result.parsedSession.attendances).toHaveLength(1);
      expect(result.parsedSession.attendances[0].durationSeconds).toBe(600);
    });
  });

  describe('ID生成', () => {
    it('ULID形式のsessionIdが生成されること', async () => {
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
            {
              名前: '佐藤 一郎',
              'メール アドレス': 'ichiro.sato@example.com',
              会議の長さ: '10 分 0 秒',
            },
          ],
          errors: [],
        });
      });

      const result = await transformer.parse(file);
      expect(result.ok).toBe(true);
      // sessionId: ULID
      expect(result.parsedSession.sessionId).toMatch(ULID_PATTERN);
    });
  });

  describe('開催日・開始時刻抽出', () => {
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
            {
              名前: '佐藤 一郎',
              'メール アドレス': 'ichiro.sato@example.com',
              会議の長さ: '10 分 0 秒',
            },
          ],
          errors: [],
        });
      });

      const result = await transformer.parse(file);
      expect(result.ok).toBe(true);
      expect(result.parsedSession.date).toBe('2026-01-15');
    });

    it('startedAt が ISO 8601 形式で出力されること', async () => {
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
            {
              名前: '佐藤 一郎',
              'メール アドレス': 'ichiro.sato@example.com',
              会議の長さ: '10 分 0 秒',
            },
          ],
          errors: [],
        });
      });

      const result = await transformer.parse(file);
      expect(result.ok).toBe(true);
      expect(result.parsedSession.startedAt).toBe('2026-01-15T19:00:00');
    });

    it('終了時刻がない場合は endedAt が null であること', async () => {
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
            {
              名前: '佐藤 一郎',
              'メール アドレス': 'ichiro.sato@example.com',
              会議の長さ: '10 分 0 秒',
            },
          ],
          errors: [],
        });
      });

      const result = await transformer.parse(file);
      expect(result.ok).toBe(true);
      expect(result.parsedSession.endedAt).toBeNull();
    });
  });

  describe('統合パイプライン', () => {
    it('正常なCSVから parsedSession を生成できること', async () => {
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
            {
              名前: '佐藤 一郎',
              'メール アドレス': 'ichiro.sato@example.com',
              会議の長さ: '59 分 12 秒',
            },
            {
              名前: '高橋 美咲',
              'メール アドレス': 'misaki.takahashi@example.com',
              会議の長さ: '20 分 59 秒',
            },
          ],
          errors: [],
        });
      });

      const result = await transformer.parse(file);
      expect(result.ok).toBe(true);

      // parsedSession の検証
      const { parsedSession } = result;
      expect(parsedSession.sessionId).toMatch(ULID_PATTERN);
      expect(parsedSession.groupName).toBe('フロントエンド勉強会');
      expect(parsedSession.date).toBe('2026-01-15');
      expect(parsedSession.startedAt).toBe('2026-01-15T19:00:00');
      expect(parsedSession.endedAt).toBeNull();
      expect(parsedSession.attendances).toHaveLength(2);
      expect(parsedSession.attendances[0].memberName).toBe('佐藤 一郎');
      expect(parsedSession.attendances[0].memberEmail).toBe('ichiro.sato@example.com');
      expect(parsedSession.attendances[0].durationSeconds).toBe(3552);
      expect(parsedSession.attendances[1].memberName).toBe('高橋 美咲');
      expect(parsedSession.attendances[1].durationSeconds).toBe(1259);

      // sessionRecord / mergeInput は存在しないこと
      expect(result.sessionRecord).toBeUndefined();
      expect(result.mergeInput).toBeUndefined();
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
            {
              名前: '佐藤 一郎',
              'メール アドレス': 'ichiro.sato@example.com',
              会議の長さ: '10 分 0 秒',
            },
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

  describe('エラーハンドリング', () => {
    it('PapaParseがパースエラーを返した場合にエラー結果を返すこと', async () => {
      const text = createTeamsReportText({
        participants: [
          { name: '佐藤 一郎', email: 'ichiro.sato@example.com', duration: '10 分 0 秒' },
        ],
      });
      const buffer = createUtf16leBuffer(text);
      const file = new File([buffer], 'report.csv', { type: 'text/csv' });

      Papa.parse.mockImplementation((input, config) => {
        config.complete({
          data: [],
          errors: [{ row: 0, message: 'フィールド数不一致' }],
        });
      });

      const result = await transformer.parse(file);
      expect(result.ok).toBe(false);
      expect(result.errors.some((e) => e.includes('フィールド数不一致'))).toBe(true);
    });

    it('PapaParseのerrorコールバックが呼ばれた場合にエラー結果を返すこと', async () => {
      const text = createTeamsReportText({
        participants: [
          { name: '佐藤 一郎', email: 'ichiro.sato@example.com', duration: '10 分 0 秒' },
        ],
      });
      const buffer = createUtf16leBuffer(text);
      const file = new File([buffer], 'report.csv', { type: 'text/csv' });

      Papa.parse.mockImplementation((input, config) => {
        config.error(new Error('ストリームエラー'));
      });

      const result = await transformer.parse(file);
      expect(result.ok).toBe(false);
      expect(result.errors.some((e) => e.includes('ストリームエラー'))).toBe(true);
    });

    it('予期しない例外が発生した場合にエラー結果を返すこと', async () => {
      const file = new File(['dummy'], 'bad.csv', { type: 'text/csv' });
      vi.spyOn(file, 'arrayBuffer').mockRejectedValue(new Error('読み取りエラー'));

      const result = await transformer.parse(file);
      expect(result.ok).toBe(false);
      expect(result.errors).toContain('読み取りエラー');
    });
  });

  describe('メールアドレスフォールバック', () => {
    it('「メール アドレス」がない場合に「メール」フィールドを使用すること', async () => {
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
            {
              名前: '佐藤 一郎',
              メール: 'ichiro.sato@example.com',
              会議の長さ: '10 分 0 秒',
            },
          ],
          errors: [],
        });
      });

      const result = await transformer.parse(file);
      expect(result.ok).toBe(true);
      expect(result.parsedSession.attendances[0].memberEmail).toBe('ichiro.sato@example.com');
    });

    it('メールアドレスフィールドがすべて空の場合は空文字でメールが設定されること', async () => {
      const text = createTeamsReportText({
        participants: [
          { name: '佐藤 一郎', email: '', duration: '10 分 0 秒' },
        ],
      });
      const buffer = createUtf16leBuffer(text);
      const file = new File([buffer], 'report.csv', { type: 'text/csv' });

      Papa.parse.mockImplementation((input, config) => {
        config.complete({
          data: [
            {
              名前: '佐藤 一郎',
              会議の長さ: '10 分 0 秒',
            },
          ],
          errors: [],
        });
      });

      const result = await transformer.parse(file);
      expect(result.ok).toBe(true);
      expect(result.parsedSession.attendances[0].memberEmail).toBe('');
    });
  });

  describe('開催日抽出（追加パターン）', () => {
    it('M/D/YY形式（2桁年号、2000年代）から日付を抽出できること', async () => {
      const text = createTeamsReportText({
        startTime: '1/15/26, 8:01:35 AM',
        participants: [
          { name: '佐藤 一郎', email: 'ichiro.sato@example.com', duration: '10 分 0 秒' },
        ],
      });
      const buffer = createUtf16leBuffer(text);
      const file = new File([buffer], 'report.csv', { type: 'text/csv' });

      Papa.parse.mockImplementation((input, config) => {
        config.complete({
          data: [
            {
              名前: '佐藤 一郎',
              'メール アドレス': 'ichiro.sato@example.com',
              会議の長さ: '10 分 0 秒',
            },
          ],
          errors: [],
        });
      });

      const result = await transformer.parse(file);
      expect(result.ok).toBe(true);
      expect(result.parsedSession.date).toBe('2026-01-15');
    });

    it('M/D/YY形式（2桁年号、1900年代 ≥50）から日付を抽出できること', async () => {
      const text = createTeamsReportText({
        startTime: '3/20/99, 10:00:00 AM',
        participants: [
          { name: '佐藤 一郎', email: 'ichiro.sato@example.com', duration: '10 分 0 秒' },
        ],
      });
      const buffer = createUtf16leBuffer(text);
      const file = new File([buffer], 'report.csv', { type: 'text/csv' });

      Papa.parse.mockImplementation((input, config) => {
        config.complete({
          data: [
            {
              名前: '佐藤 一郎',
              'メール アドレス': 'ichiro.sato@example.com',
              会議の長さ: '10 分 0 秒',
            },
          ],
          errors: [],
        });
      });

      const result = await transformer.parse(file);
      expect(result.ok).toBe(true);
      expect(result.parsedSession.date).toBe('1999-03-20');
    });

    it('日付形式が不正な場合は空文字を返すこと', async () => {
      const text = createTeamsReportText({
        startTime: '不正な日付',
        participants: [
          { name: '佐藤 一郎', email: 'ichiro.sato@example.com', duration: '10 分 0 秒' },
        ],
      });
      const buffer = createUtf16leBuffer(text);
      const file = new File([buffer], 'report.csv', { type: 'text/csv' });

      Papa.parse.mockImplementation((input, config) => {
        config.complete({
          data: [
            {
              名前: '佐藤 一郎',
              'メール アドレス': 'ichiro.sato@example.com',
              会議の長さ: '10 分 0 秒',
            },
          ],
          errors: [],
        });
      });

      const result = await transformer.parse(file);
      expect(result.ok).toBe(true);
      expect(result.parsedSession.date).toBe('');
    });
  });

  describe('時間パース（追加パターン）', () => {
    it('「X 時間」のみ（分・秒省略）を秒数に変換できること', async () => {
      const text = createTeamsReportText({
        participants: [
          { name: '佐藤 一郎', email: 'ichiro.sato@example.com', duration: '2 時間' },
        ],
      });
      const buffer = createUtf16leBuffer(text);
      const file = new File([buffer], 'report.csv', { type: 'text/csv' });

      Papa.parse.mockImplementation((input, config) => {
        config.complete({
          data: [
            {
              名前: '佐藤 一郎',
              'メール アドレス': 'ichiro.sato@example.com',
              会議の長さ: '2 時間',
            },
          ],
          errors: [],
        });
      });

      const result = await transformer.parse(file);
      expect(result.ok).toBe(true);
      expect(result.parsedSession.attendances[0].durationSeconds).toBe(7200);
    });

    it('「X 時間 Y 分」形式（秒省略）を秒数に変換できること', async () => {
      const text = createTeamsReportText({
        participants: [
          { name: '佐藤 一郎', email: 'ichiro.sato@example.com', duration: '1 時間 15 分' },
        ],
      });
      const buffer = createUtf16leBuffer(text);
      const file = new File([buffer], 'report.csv', { type: 'text/csv' });

      Papa.parse.mockImplementation((input, config) => {
        config.complete({
          data: [
            {
              名前: '佐藤 一郎',
              'メール アドレス': 'ichiro.sato@example.com',
              会議の長さ: '1 時間 15 分',
            },
          ],
          errors: [],
        });
      });

      const result = await transformer.parse(file);
      expect(result.ok).toBe(true);
      expect(result.parsedSession.attendances[0].durationSeconds).toBe(4500);
    });
  });

  describe('時間パース（分のみ・秒のみ）', () => {
    it('「X 分」のみ（秒省略）を秒数に変換できること', async () => {
      const text = createTeamsReportText({
        participants: [
          { name: '佐藤 一郎', email: 'ichiro.sato@example.com', duration: '52 分' },
        ],
      });
      const buffer = createUtf16leBuffer(text);
      const file = new File([buffer], 'report.csv', { type: 'text/csv' });

      Papa.parse.mockImplementation((input, config) => {
        config.complete({
          data: [
            {
              名前: '佐藤 一郎',
              'メール アドレス': 'ichiro.sato@example.com',
              会議の長さ: '52 分',
            },
          ],
          errors: [],
        });
      });

      const result = await transformer.parse(file);
      expect(result.ok).toBe(true);
      expect(result.parsedSession.attendances[0].durationSeconds).toBe(3120);
    });

    it('「X 秒」のみ（分省略）を秒数に変換できること', async () => {
      const text = createTeamsReportText({
        participants: [
          { name: '佐藤 一郎', email: 'ichiro.sato@example.com', duration: '45 秒' },
        ],
      });
      const buffer = createUtf16leBuffer(text);
      const file = new File([buffer], 'report.csv', { type: 'text/csv' });

      Papa.parse.mockImplementation((input, config) => {
        config.complete({
          data: [
            {
              名前: '佐藤 一郎',
              'メール アドレス': 'ichiro.sato@example.com',
              会議の長さ: '45 秒',
            },
          ],
          errors: [],
        });
      });

      const result = await transformer.parse(file);
      expect(result.ok).toBe(true);
      expect(result.parsedSession.attendances[0].durationSeconds).toBe(45);
    });
  });

  describe('セクション分割（追加パターン）', () => {
    it('「3. 会議中の」セクションがない場合でも参加者セクションを正しくパースすること', async () => {
      const lines = [
        '1. 要約',
        '会議のタイトル\tテスト会議',
        '開始時刻\t2026/2/1 10:00:00',
        '',
        '2. 参加者',
        '名前\tメール アドレス\t会議の長さ',
        '佐藤 一郎\tichiro.sato@example.com\t10 分 0 秒',
      ];
      const text = lines.join('\n');
      const buffer = createUtf16leBuffer(text);
      const file = new File([buffer], 'report.csv', { type: 'text/csv' });

      Papa.parse.mockImplementation((input, config) => {
        config.complete({
          data: [
            {
              名前: '佐藤 一郎',
              'メール アドレス': 'ichiro.sato@example.com',
              会議の長さ: '10 分 0 秒',
            },
          ],
          errors: [],
        });
      });

      const result = await transformer.parse(file);
      expect(result.ok).toBe(true);
      expect(result.parsedSession.groupName).toBe('テスト会議');
    });
  });
});

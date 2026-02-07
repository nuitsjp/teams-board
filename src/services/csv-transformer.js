// CsvTransformer — Teams出席レポートCSV（UTF-16LE/TSV）パーサー
import Papa from 'papaparse';

export class CsvTransformer {
  /**
   * Teams出席レポートCSVをパースし、SessionRecordとMergeInputを生成する
   * @param {File} file - Teams出席レポートCSVファイル
   * @returns {Promise<{ok: true, sessionRecord: object, mergeInput: object, warnings: string[]} | {ok: false, errors: string[]}>}
   */
  async parse(file) {
    try {
      // UTF-16LE → 文字列変換
      const arrayBuffer = await file.arrayBuffer();
      const decoder = new TextDecoder('utf-16le');
      const text = decoder.decode(arrayBuffer);

      // セクション分割
      const sections = this.#splitSections(text);
      if (!sections.ok) {
        return { ok: false, errors: sections.errors };
      }

      // 要約セクションからタイトル・開催日を抽出
      const summary = this.#parseSummary(sections.summary);
      const cleanedTitle = this.#cleanMeetingTitle(summary.title);
      const date = this.#parseDate(summary.startTime);

      // 参加者セクションをTSVパース
      const participantsResult = await this.#parseParticipants(sections.participants);
      if (!participantsResult.ok) {
        return { ok: false, errors: participantsResult.errors };
      }

      if (participantsResult.data.length === 0) {
        return { ok: false, errors: ['参加者データが見つかりません'] };
      }

      // ID生成
      const studyGroupId = await this.#generateId(cleanedTitle);
      const sessionId = `${studyGroupId}-${date}`;

      // 出席記録の構築
      const warnings = [];
      const attendances = [];
      const mergeAttendances = [];

      for (const row of participantsResult.data) {
        const name = row['名前'];
        const email = row['メール アドレス'] || row['メール'] || '';
        const durationStr = row['会議の長さ'];

        const durationSeconds = this.#parseDuration(durationStr);
        if (durationSeconds === null) {
          warnings.push(`時間フォーマット不正（スキップ）: ${name} — "${durationStr}"`);
          continue;
        }

        const memberId = await this.#generateId(email);

        attendances.push({ memberId, durationSeconds });
        mergeAttendances.push({ memberId, memberName: name, durationSeconds });
      }

      const sessionRecord = {
        id: sessionId,
        studyGroupId,
        date,
        attendances,
      };

      const mergeInput = {
        sessionId,
        studyGroupId,
        studyGroupName: cleanedTitle,
        date,
        attendances: mergeAttendances,
      };

      return { ok: true, sessionRecord, mergeInput, warnings };
    } catch (err) {
      return { ok: false, errors: [err.message] };
    }
  }

  /**
   * テキストを3セクションに分割する
   * @param {string} text
   * @returns {{ok: true, summary: string, participants: string} | {ok: false, errors: string[]}}
   */
  #splitSections(text) {
    const lines = text.split(/\r?\n/);
    let summaryStart = -1;
    let participantsStart = -1;
    let activityStart = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('1. 要約')) summaryStart = i;
      else if (line.startsWith('2. 参加者')) participantsStart = i;
      else if (line.startsWith('3. 会議中の')) activityStart = i;
    }

    if (participantsStart === -1) {
      return { ok: false, errors: ['Teams出席レポート形式ではありません'] };
    }

    const summaryEnd = participantsStart;
    const participantsEnd = activityStart !== -1 ? activityStart : lines.length;

    const summary = lines.slice(summaryStart + 1, summaryEnd).join('\n');
    const participants = lines.slice(participantsStart + 1, participantsEnd).join('\n');

    return { ok: true, summary, participants };
  }

  /**
   * 要約セクションからタイトルと開始時刻を抽出する
   * @param {string} summaryText
   * @returns {{ title: string, startTime: string }}
   */
  #parseSummary(summaryText) {
    const lines = summaryText.split(/\r?\n/);
    let title = '';
    let startTime = '';

    for (const line of lines) {
      const parts = line.split('\t');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts[1].trim();
        if (key === '会議のタイトル') title = value;
        else if (key === '開始時刻') startTime = value;
      }
    }

    return { title, startTime };
  }

  /**
   * 会議タイトルからTeamsの定型装飾を除去する
   * @param {string} title
   * @returns {string}
   */
  #cleanMeetingTitle(title) {
    let cleaned = title;
    // ダブルクォート囲みの除去（"""...""" や "..." パターン）
    cleaned = cleaned.replace(/^"+|"+$/g, '');
    // 「で会議中」の除去（末尾に付く場合、残留クォート含む）
    cleaned = cleaned.replace(/\s*で会議中"*\s*$/, '');
    // 残留ダブルクォートの除去
    cleaned = cleaned.replace(/^"+|"+$/g, '');
    return cleaned.trim();
  }

  /**
   * 開始時刻文字列からYYYY-MM-DD形式の日付を抽出する
   * @param {string} startTime
   * @returns {string}
   */
  #parseDate(startTime) {
    // 「2026/1/15 19:00:00」形式（4桁年号）
    const match4 = startTime.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
    if (match4) {
      const year = match4[1];
      const month = match4[2].padStart(2, '0');
      const day = match4[3].padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    // 「1/15/26, 8:01:35 AM」形式（2桁年号、M/D/YY）
    const match2 = startTime.match(/(\d{1,2})\/(\d{1,2})\/(\d{2})/);
    if (match2) {
      const month = match2[1].padStart(2, '0');
      const day = match2[2].padStart(2, '0');
      const shortYear = parseInt(match2[3], 10);
      const year = shortYear >= 50 ? 1900 + shortYear : 2000 + shortYear;
      return `${year}-${month}-${day}`;
    }

    return '';
  }

  /**
   * 「会議の長さ」フィールドの時間表記を秒数に変換する
   * @param {string} durationStr
   * @returns {number | null}
   */
  #parseDuration(durationStr) {
    // 「X 時間 Y 分 Z 秒」形式
    const longMatch = durationStr.match(/(\d+)\s*時間\s*(?:(\d+)\s*分\s*)?(?:(\d+)\s*秒)?/);
    if (longMatch) {
      const hours = parseInt(longMatch[1], 10);
      const minutes = parseInt(longMatch[2] || '0', 10);
      const seconds = parseInt(longMatch[3] || '0', 10);
      return hours * 3600 + minutes * 60 + seconds;
    }

    // 「X 分 Y 秒」形式
    const shortMatch = durationStr.match(/(\d+)\s*分\s*(\d+)\s*秒/);
    if (shortMatch) {
      const minutes = parseInt(shortMatch[1], 10);
      const seconds = parseInt(shortMatch[2], 10);
      return minutes * 60 + seconds;
    }

    return null;
  }

  /**
   * SHA-256ハッシュ先頭8桁（hex）のIDを生成する
   * @param {string} input
   * @returns {Promise<string>}
   */
  async #generateId(input) {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = new Uint8Array(hashBuffer);
    const hex = Array.from(hashArray.slice(0, 4))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return hex;
  }

  /**
   * 参加者セクションをPapaParseでTSVパースする
   * @param {string} participantsText
   * @returns {Promise<{ok: true, data: Array} | {ok: false, errors: string[]}>}
   */
  #parseParticipants(participantsText) {
    return new Promise((resolve) => {
      Papa.parse(participantsText, {
        delimiter: '\t',
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.errors.length > 0) {
            resolve({
              ok: false,
              errors: results.errors.map((e) => `行${e.row}: ${e.message}`),
            });
            return;
          }
          resolve({ ok: true, data: results.data });
        },
        error: (err) => {
          resolve({ ok: false, errors: [err.message] });
        },
      });
    });
  }
}

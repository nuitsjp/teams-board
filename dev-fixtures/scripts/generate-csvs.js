// Teams 出席レポート形式の CSV ファイルを生成するスクリプト
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ID マッピングを読み込み
const mappingsPath = join(__dirname, 'id-mappings.json');
const mappings = JSON.parse(readFileSync(mappingsPath, 'utf8'));

// index.json を読み込み
const indexPath = join(__dirname, '../data/index.json');
const indexData = JSON.parse(readFileSync(indexPath, 'utf8'));

// 旧 ID から新 ID へのマッピングを作成
const oldToNewGroupId = {};
for (const [oldId, mapping] of Object.entries(mappings.groups)) {
  oldToNewGroupId[oldId] = mapping.newId;
}

const oldToNewMemberId = {};
const memberIdToInfo = {};
for (const [oldId, mapping] of Object.entries(mappings.members)) {
  oldToNewMemberId[oldId] = mapping.newId;
  memberIdToInfo[oldId] = {
    name: mapping.name,
    email: mapping.email,
  };
}

// 秒数を「X 時間 Y 分 Z 秒」形式に変換
function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts = [];
  if (hours > 0) parts.push(`${hours} 時間`);
  if (minutes > 0) parts.push(`${minutes} 分`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs} 秒`);

  return parts.join(' ');
}

// 日付を「YYYY/M/D HH:MM:SS」形式に変換
function formatDate(dateStr) {
  // dateStr は "2026-01-15" 形式
  const [year, month, day] = dateStr.split('-');
  // 開始時刻は仮に 10:00:00 とする
  return `${year}/${parseInt(month)}/${parseInt(day)} 10:00:00`;
}

// グループ名を取得
function getGroupName(groupId) {
  const group = indexData.groups.find((g) => g.id === groupId);
  return group ? group.name : 'Unknown Group';
}

// CSV ファイルを生成
function generateCSV(sessionData) {
  const groupName = getGroupName(sessionData.groupId);
  const startTime = formatDate(sessionData.date);

  // セクション1: 要約
  const section1 = [
    '1. 要約',
    `会議のタイトル\t${groupName}`,
    `開始時刻\t${startTime}`,
    '',
  ].join('\n');

  // セクション2: 参加者
  const participantRows = sessionData.attendances.map((att) => {
    const memberInfo = memberIdToInfo[att.memberId];
    const name = memberInfo ? memberInfo.name : 'Unknown Member';
    const email = memberInfo ? memberInfo.email : 'unknown@example.com';
    const duration = formatDuration(att.durationSeconds);
    return `${name}\t${email}\t${duration}`;
  });

  const section2 = [
    '2. 参加者',
    '名前\tメール アドレス\t会議の長さ',
    ...participantRows,
    '',
  ].join('\n');

  // セクション3: 会議中のアクティビティ
  const section3 = '3. 会議中のアクティビティ\n';

  // すべてのセクションを結合
  const csvContent = section1 + section2 + section3;

  return csvContent;
}

// すべてのセッションを処理
const sessionsDir = join(__dirname, '../data/sessions');
const sessionFiles = readdirSync(sessionsDir).filter((f) => f.endsWith('.json'));

console.log(`${sessionFiles.length} 件のセッションを処理します...\n`);

for (const sessionFile of sessionFiles) {
  const sessionPath = join(sessionsDir, sessionFile);
  const sessionData = JSON.parse(readFileSync(sessionPath, 'utf8'));

  const groupName = getGroupName(sessionData.groupId);
  const csvFileName = `${groupName}-${sessionData.date}.csv`;
  const csvPath = join(__dirname, '../csv', csvFileName);

  const csvContent = generateCSV(sessionData);

  // UTF-16LE エンコーディングで保存
  const buffer = Buffer.from('\ufeff' + csvContent, 'utf16le');
  writeFileSync(csvPath, buffer);

  console.log(`✓ ${csvFileName}`);
}

console.log(`\n完了: ${sessionFiles.length} 件の CSV ファイルを生成しました`);

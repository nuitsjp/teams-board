// SHA-256 の先頭8桁が一致する文字列を探索するスクリプト
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// SHA-256 の先頭8桁を計算
function generateId(input) {
  const hash = createHash('sha256').update(input, 'utf8').digest('hex');
  return hash.substring(0, 8);
}

// 既存の index.json を読み込み
const indexPath = join(__dirname, '../data/index.json');
const indexData = JSON.parse(readFileSync(indexPath, 'utf8'));

console.log('=== グループ ID の確認 ===\n');

// グループ名から groupId を計算
const groupMappings = {};
for (const group of indexData.groups) {
  const calculatedId = generateId(group.name);
  const match = calculatedId === group.id;
  console.log(`グループ: ${group.name}`);
  console.log(`  既存 ID: ${group.id}`);
  console.log(`  計算 ID: ${calculatedId}`);
  console.log(`  一致: ${match ? 'Yes ✓' : 'No ✗'}\n`);

  groupMappings[group.id] = {
    name: group.name,
    calculatedId,
    match,
  };
}

console.log('=== メンバー ID の探索 ===\n');

// メンバー名からメールアドレスの候補を生成
const memberMappings = {};

function generateEmailCandidates(name) {
  // 名前からメールアドレスのベースを生成
  // 例: "Suzuki Taro A (鈴木 太郎)" → "suzuki.taro.a"
  const match = name.match(/^([A-Za-z\s]+)/);
  if (!match) return [];

  const englishName = match[1].trim().toLowerCase();
  const parts = englishName.split(/\s+/);
  const base = parts.join('.');

  return [
    `${base}@example.com`,
    `${base}@test.example.com`,
    `${parts.join('')}@example.com`,
    `${parts[0]}.${parts.slice(1).join('')}@example.com`,
  ];
}

function findMatchingEmail(memberId, memberName, maxAttempts = 10000) {
  const baseCandidates = generateEmailCandidates(memberName);

  // まず基本候補を試す
  for (const candidate of baseCandidates) {
    const calculatedId = generateId(candidate);
    if (calculatedId === memberId) {
      return { email: candidate, attempts: 1, found: true };
    }
  }

  // 一致しない場合、サフィックスを追加して探索
  for (let i = 1; i <= maxAttempts; i++) {
    for (const base of baseCandidates) {
      const emailWithSuffix = base.replace('@', `${i}@`);
      const calculatedId = generateId(emailWithSuffix);
      if (calculatedId === memberId) {
        return { email: emailWithSuffix, attempts: i, found: true };
      }
    }
  }

  return { email: null, attempts: maxAttempts, found: false };
}

for (const member of indexData.members) {
  console.log(`メンバー: ${member.name}`);
  console.log(`  既存 ID: ${member.id}`);

  const result = findMatchingEmail(member.id, member.name);

  if (result.found) {
    console.log(`  メール: ${result.email} (${result.attempts} 回の試行で発見) ✓\n`);
    memberMappings[member.id] = {
      name: member.name,
      email: result.email,
      match: true,
    };
  } else {
    console.log(`  メール: 見つかりませんでした (${result.attempts} 回試行) ✗\n`);
    memberMappings[member.id] = {
      name: member.name,
      email: null,
      match: false,
    };
  }
}

// 結果を JSON ファイルに保存
const outputPath = join(__dirname, '../scripts/id-mappings.json');
const mappings = {
  groups: groupMappings,
  members: memberMappings,
};

writeFileSync(outputPath, JSON.stringify(mappings, null, 2), 'utf8');
console.log(`\n結果を保存しました: ${outputPath}`);

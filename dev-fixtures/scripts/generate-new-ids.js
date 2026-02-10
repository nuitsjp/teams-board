// 新しい ID を生成してマッピングを作成するスクリプト
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

console.log('=== 新しいグループ ID の生成 ===\n');

// グループ名から新しい groupId を生成
const groupMappings = {};
for (const group of indexData.groups) {
  const newGroupId = generateId(group.name);
  console.log(`グループ: ${group.name}`);
  console.log(`  旧 ID: ${group.id}`);
  console.log(`  新 ID: ${newGroupId}\n`);

  groupMappings[group.id] = {
    oldId: group.id,
    newId: newGroupId,
    name: group.name,
  };
}

console.log('=== 新しいメンバー ID の生成 ===\n');

// メンバーにメールアドレスを割り当て
const memberEmailAssignments = {
  'Suzuki Taro A (鈴木 太郎)': 'suzuki.taro.a@example.com',
  'Tanaka Koji (田中 浩二)': 'tanaka.koji@example.com',
  'Yamamoto Yuki A (山本 裕貴)': 'yamamoto.yuki.a@example.com',
  'Watanabe Kenji (渡辺 健二)': 'watanabe.kenji@example.com',
};

const memberMappings = {};
for (const member of indexData.members) {
  const email = memberEmailAssignments[member.name];
  if (!email) {
    console.error(`エラー: メンバー「${member.name}」のメールアドレスが見つかりません`);
    continue;
  }

  const newMemberId = generateId(email);
  console.log(`メンバー: ${member.name}`);
  console.log(`  メール: ${email}`);
  console.log(`  旧 ID: ${member.id}`);
  console.log(`  新 ID: ${newMemberId}\n`);

  memberMappings[member.id] = {
    oldId: member.id,
    newId: newMemberId,
    name: member.name,
    email: email,
  };
}

// 結果を JSON ファイルに保存
const outputPath = join(__dirname, 'id-mappings.json');
const mappings = {
  groups: groupMappings,
  members: memberMappings,
};

writeFileSync(outputPath, JSON.stringify(mappings, null, 2), 'utf8');
console.log(`結果を保存しました: ${outputPath}`);

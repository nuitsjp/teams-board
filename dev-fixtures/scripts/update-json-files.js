// JSON ファイルを新しい ID で更新するスクリプト
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ID マッピングを読み込み
const mappingsPath = join(__dirname, 'id-mappings.json');
const mappings = JSON.parse(readFileSync(mappingsPath, 'utf8'));

// 旧 ID から新 ID へのマッピングを作成
const oldToNewGroupId = {};
for (const [oldId, mapping] of Object.entries(mappings.groups)) {
  oldToNewGroupId[oldId] = mapping.newId;
}

const oldToNewMemberId = {};
for (const [oldId, mapping] of Object.entries(mappings.members)) {
  oldToNewMemberId[oldId] = mapping.newId;
}

console.log('=== index.json の更新 ===\n');

// index.json を読み込み
const indexPath = join(__dirname, '../data/index.json');
const indexData = JSON.parse(readFileSync(indexPath, 'utf8'));

// groups セクションを更新
for (const group of indexData.groups) {
  const oldId = group.id;
  const newId = oldToNewGroupId[oldId];

  if (newId) {
    group.id = newId;

    // sessionIds も更新（groupId-YYYY-MM-DD 形式）
    group.sessionIds = group.sessionIds.map((sessionId) => {
      const parts = sessionId.split('-');
      const date = parts.slice(1).join('-'); // YYYY-MM-DD
      return `${newId}-${date}`;
    });

    console.log(`グループ更新: ${group.name}`);
    console.log(`  ${oldId} → ${newId}`);
  }
}

// members セクションを更新
for (const member of indexData.members) {
  const oldId = member.id;
  const newId = oldToNewMemberId[oldId];

  if (newId) {
    member.id = newId;

    // sessionIds も更新（groupId が変わっているため）
    member.sessionIds = member.sessionIds.map((sessionId) => {
      const parts = sessionId.split('-');
      const oldGroupId = parts[0];
      const date = parts.slice(1).join('-'); // YYYY-MM-DD
      const newGroupId = oldToNewGroupId[oldGroupId];
      return newGroupId ? `${newGroupId}-${date}` : sessionId;
    });

    console.log(`メンバー更新: ${member.name}`);
    console.log(`  ${oldId} → ${newId}`);
  }
}

// index.json を保存
writeFileSync(indexPath, JSON.stringify(indexData, null, 2) + '\n', 'utf8');
console.log('\nindex.json を更新しました\n');

console.log('=== sessions/*.json の更新 ===\n');

// セッションファイルを更新
const sessionsDir = join(__dirname, '../data/sessions');
const sessionFiles = readdirSync(sessionsDir).filter((f) => f.endsWith('.json'));

for (const sessionFile of sessionFiles) {
  const sessionPath = join(sessionsDir, sessionFile);
  const sessionData = JSON.parse(readFileSync(sessionPath, 'utf8'));

  // sessionId を更新（groupId-YYYY-MM-DD 形式）
  const parts = sessionData.id.split('-');
  const oldGroupId = parts[0];
  const date = parts.slice(1).join('-'); // YYYY-MM-DD
  const newGroupId = oldToNewGroupId[oldGroupId];
  const newSessionId = `${newGroupId}-${date}`;

  // groupId を更新
  sessionData.id = newSessionId;
  sessionData.groupId = newGroupId;

  // attendances の memberId を更新
  for (const attendance of sessionData.attendances) {
    const oldMemberId = attendance.memberId;
    const newMemberId = oldToNewMemberId[oldMemberId];
    if (newMemberId) {
      attendance.memberId = newMemberId;
    }
  }

  // 新しいファイル名で保存
  const newSessionFile = `${newSessionId}.json`;
  const newSessionPath = join(sessionsDir, newSessionFile);

  writeFileSync(newSessionPath, JSON.stringify(sessionData, null, 2) + '\n', 'utf8');
  console.log(`✓ ${sessionFile} → ${newSessionFile}`);

  // 古いファイルと新しいファイルが異なる場合、古いファイルを削除
  if (sessionFile !== newSessionFile) {
    const fs = await import('node:fs/promises');
    await fs.unlink(sessionPath);
  }
}

console.log(`\n完了: ${sessionFiles.length} 件のセッションファイルを更新しました`);

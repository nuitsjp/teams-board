import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * 実行オプションを解析する
 * @param {string[]} argv
 * @returns {{ mode: 'check' | 'fix', dataDir: string }}
 */
function parseOptions(argv) {
  let mode = 'check';
  let dataDir = path.resolve(process.cwd(), 'dev-fixtures/data');

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--check') {
      mode = 'check';
      continue;
    }
    if (arg === '--fix') {
      mode = 'fix';
      continue;
    }
    if (arg === '--data-dir') {
      const value = argv[i + 1];
      if (!value) {
        throw new Error('--data-dir の値が指定されていません');
      }
      dataDir = path.resolve(process.cwd(), value);
      i += 1;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
    throw new Error(`不明な引数です: ${arg}`);
  }

  return { mode, dataDir };
}

function printHelp() {
  console.log('セッションJSON正規化スクリプト');
  console.log('');
  console.log('使い方:');
  console.log('  node scripts/normalize-sessions.mjs --check [--data-dir <path>]');
  console.log('  node scripts/normalize-sessions.mjs --fix [--data-dir <path>]');
  console.log('');
  console.log('説明:');
  console.log('  index.json を正として、sessions/*.json の groupId フィールドを削除します。');
  console.log('  --check は変更せず検査のみ、--fix は実際に書き換えます。');
}

/**
 * JSONを読み込む
 * @param {string} filePath
 * @returns {Promise<any>}
 */
async function readJson(filePath) {
  const content = await fs.readFile(filePath, 'utf8');
  return JSON.parse(content);
}

/**
 * JSONを保存する
 * @param {string} filePath
 * @param {any} data
 */
async function writeJson(filePath, data) {
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

/**
 * index.json から sessionId -> groupId の対応を作る
 * @param {{ groups: Array<{id: string, sessionIds: string[]}> }} indexData
 */
function buildSessionOwnerMap(indexData) {
  const sessionOwnerMap = new Map();
  const duplicateAssignments = [];

  for (const group of indexData.groups || []) {
    for (const sessionId of group.sessionIds || []) {
      if (sessionOwnerMap.has(sessionId) && sessionOwnerMap.get(sessionId) !== group.id) {
        duplicateAssignments.push({
          sessionId,
          firstGroupId: sessionOwnerMap.get(sessionId),
          secondGroupId: group.id,
        });
      }
      sessionOwnerMap.set(sessionId, group.id);
    }
  }

  return { sessionOwnerMap, duplicateAssignments };
}

/**
 * sessions ディレクトリ内にある sessionId 一覧を取得する
 * @param {string} sessionsDir
 * @returns {Promise<Set<string>>}
 */
async function listSessionIdsFromFiles(sessionsDir) {
  const entries = await fs.readdir(sessionsDir, { withFileTypes: true });
  const ids = new Set();
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith('.json')) continue;
    ids.add(entry.name.slice(0, -'.json'.length));
  }
  return ids;
}

async function main() {
  const { mode, dataDir } = parseOptions(process.argv.slice(2));
  const indexPath = path.join(dataDir, 'index.json');
  const sessionsDir = path.join(dataDir, 'sessions');

  const indexData = await readJson(indexPath);
  const { sessionOwnerMap, duplicateAssignments } = buildSessionOwnerMap(indexData);
  const sessionIdsInFiles = await listSessionIdsFromFiles(sessionsDir);

  const missingSessionFiles = [];
  let checked = 0;
  let hasGroupIdCount = 0;
  let mismatchedGroupIdCount = 0;
  let fixedCount = 0;

  const sortedSessionIds = [...sessionOwnerMap.keys()].sort((a, b) => a.localeCompare(b));
  for (const sessionId of sortedSessionIds) {
    checked += 1;
    const expectedGroupId = sessionOwnerMap.get(sessionId);
    const sessionPath = path.join(sessionsDir, `${sessionId}.json`);

    let sessionData;
    try {
      sessionData = await readJson(sessionPath);
    } catch (error) {
      if (error && error.code === 'ENOENT') {
        missingSessionFiles.push(sessionId);
        continue;
      }
      throw error;
    }

    const hasGroupId = Object.prototype.hasOwnProperty.call(sessionData, 'groupId');
    if (!hasGroupId) {
      continue;
    }

    hasGroupIdCount += 1;
    if (sessionData.groupId !== expectedGroupId) {
      mismatchedGroupIdCount += 1;
    }

    if (mode === 'fix') {
      delete sessionData.groupId;
      await writeJson(sessionPath, sessionData);
      fixedCount += 1;
    }
  }

  const orphanSessionIds = [...sessionIdsInFiles].filter((id) => !sessionOwnerMap.has(id));

  console.log(`mode=${mode}`);
  console.log(`dataDir=${dataDir}`);
  console.log(`checkedSessions=${checked}`);
  console.log(`hasGroupId=${hasGroupIdCount}`);
  console.log(`mismatchedGroupId=${mismatchedGroupIdCount}`);
  console.log(`fixed=${fixedCount}`);
  console.log(`missingSessionFiles=${missingSessionFiles.length}`);
  console.log(`orphanSessionFiles=${orphanSessionIds.length}`);

  if (duplicateAssignments.length > 0) {
    console.error('index.json 内で同一 sessionId が複数グループに割り当てられています。');
    for (const item of duplicateAssignments) {
      console.error(
        `  sessionId=${item.sessionId}, first=${item.firstGroupId}, second=${item.secondGroupId}`
      );
    }
  }

  if (missingSessionFiles.length > 0) {
    console.error('index.json に存在するが sessions/*.json が見つからない sessionId があります。');
    for (const sessionId of missingSessionFiles) {
      console.error(`  ${sessionId}`);
    }
  }

  if (orphanSessionIds.length > 0) {
    console.error('sessions/*.json に存在するが index.json から参照されない sessionId があります。');
    for (const sessionId of orphanSessionIds.sort((a, b) => a.localeCompare(b))) {
      console.error(`  ${sessionId}`);
    }
  }

  const hasIntegrityError =
    duplicateAssignments.length > 0 || missingSessionFiles.length > 0 || orphanSessionIds.length > 0;
  const hasSchemaDrift = mode === 'check' && hasGroupIdCount > 0;

  if (hasSchemaDrift) {
    console.error('sessions/*.json に groupId が残っています。--fix で正規化してください。');
  }

  if (hasIntegrityError || hasSchemaDrift) {
    process.exitCode = 1;
  }
}

try {
  await main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

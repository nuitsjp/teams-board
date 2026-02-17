#!/usr/bin/env node
/**
 * dev-fixtures V1 → V2 移行スクリプト
 * V1 形式のフラットなセッションファイルを V2 形式のサブディレクトリ構造に変換する
 *
 * 使い方: node scripts/migrate-fixtures-v2.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const fixturesDir = resolve(__dirname, '..', 'dev-fixtures', 'data');
const indexPath = resolve(fixturesDir, 'index.json');
const sessionsDir = resolve(fixturesDir, 'sessions');

// ULID 生成
let generateId;
try {
    const { ulid } = await import('ulidx');
    generateId = ulid;
    console.log('ulidx を使用して ULID を生成します');
} catch {
    // フォールバック: crypto.randomUUID
    const { randomUUID } = await import('node:crypto');
    generateId = () => randomUUID().replace(/-/g, '').toUpperCase().slice(0, 26);
    console.log('フォールバック: crypto.randomUUID で ID を生成します');
}

// 1. V1 index.json を読み込み
const v1Index = JSON.parse(readFileSync(indexPath, 'utf-8'));

if (v1Index.schemaVersion === 2) {
    console.log('既に V2 形式です。移行をスキップします。');
    process.exit(0);
}

console.log(`V1 index.json を読み込み: ${v1Index.groups.length} グループ, ${v1Index.members.length} メンバー`);

// 2. ID マッピングを生成
const groupIdMap = new Map();
for (const group of v1Index.groups) {
    groupIdMap.set(group.id, generateId());
}

const memberIdMap = new Map();
for (const member of v1Index.members) {
    memberIdMap.set(member.id, generateId());
}

const sessionIdMap = new Map();
const allSessionIds = new Set(v1Index.groups.flatMap((g) => g.sessionIds));
for (const sid of allSessionIds) {
    sessionIdMap.set(sid, generateId());
}

console.log(`ID マッピング生成: ${groupIdMap.size} グループ, ${memberIdMap.size} メンバー, ${sessionIdMap.size} セッション`);

// 3. V2 index.json を生成
const v2Groups = v1Index.groups.map((group) => ({
    id: groupIdMap.get(group.id),
    name: group.name,
    totalDurationSeconds: group.totalDurationSeconds,
    sessionRevisions: group.sessionIds.map((sid) => `${sessionIdMap.get(sid)}/0`),
}));

const v2Members = v1Index.members.map((member) => ({
    id: memberIdMap.get(member.id),
    name: member.name,
    totalDurationSeconds: member.totalDurationSeconds,
    sessionRevisions: member.sessionIds.map((sid) => `${sessionIdMap.get(sid)}/0`),
}));

const v2Index = {
    schemaVersion: 2,
    version: 1,
    updatedAt: new Date().toISOString(),
    groups: v2Groups,
    members: v2Members,
};

// 4. V2 index.json を書き込み
writeFileSync(indexPath, JSON.stringify(v2Index, null, 2) + '\n', 'utf-8');
console.log('✓ index.json を V2 形式に更新');

// 5. V1 セッションファイルを V2 形式に変換
const v1SessionFiles = readdirSync(sessionsDir).filter((f) => f.endsWith('.json'));

let converted = 0;
for (const fileName of v1SessionFiles) {
    const v1SessionPath = resolve(sessionsDir, fileName);
    const v1Session = JSON.parse(readFileSync(v1SessionPath, 'utf-8'));
    const oldId = v1Session.id;
    const newId = sessionIdMap.get(oldId);

    if (!newId) {
        console.warn(`⚠ セッション ${oldId} のマッピングが見つかりません。スキップ`);
        continue;
    }

    // V2 セッションレコードを構築
    const v2Session = {
        sessionId: newId,
        revision: 0,
        title: v1Session.name || '',
        startedAt: `${v1Session.date}T09:00:00.000Z`,
        endedAt: null,
        attendances: v1Session.attendances.map((a) => ({
            memberId: memberIdMap.get(a.memberId) || a.memberId,
            durationSeconds: a.durationSeconds,
        })),
        createdAt: v2Index.updatedAt,
    };

    // V2 ディレクトリ構造で書き込み
    const v2Dir = resolve(sessionsDir, newId);
    mkdirSync(v2Dir, { recursive: true });
    writeFileSync(resolve(v2Dir, '0.json'), JSON.stringify(v2Session, null, 2) + '\n', 'utf-8');

    // V1 ファイルを削除
    rmSync(v1SessionPath);
    converted++;
    console.log(`  ${oldId} → ${newId}/0.json`);
}

console.log(`\n✓ 移行完了: ${converted} セッションを変換`);

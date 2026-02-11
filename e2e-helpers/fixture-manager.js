import { promises as fs } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';

const INDEX_JSON_PATH = resolve(process.cwd(), 'dev-fixtures/data/index.json');
const BACKUP_PATH = resolve(process.cwd(), 'dev-fixtures/data/.index.json.backup');

/**
 * index.jsonをバックアップファイルにコピー
 */
export async function backupIndexJson() {
  try {
    await fs.copyFile(INDEX_JSON_PATH, BACKUP_PATH);
    console.log('[fixture-manager] バックアップを作成しました:', BACKUP_PATH);
  } catch (error) {
    console.error('[fixture-manager] バックアップの作成に失敗しました:', error.message);
    throw error;
  }
}

/**
 * バックアップファイルからindex.jsonを復元
 */
export async function restoreIndexJson() {
  try {
    await fs.copyFile(BACKUP_PATH, INDEX_JSON_PATH);
    console.log('[fixture-manager] バックアップから復元しました:', INDEX_JSON_PATH);
  } catch (error) {
    console.error('[fixture-manager] バックアップからの復元に失敗しました:', error.message);
    throw error;
  }
}

/**
 * Gitのorigin/mainからindex.jsonを取得してクリーンな状態に復元
 */
export async function restoreFromGit() {
  try {
    console.log('[fixture-manager] Gitからクリーンなデータを復元中...');

    // git show を使ってorigin/mainからファイル内容を取得
    const content = execSync(
      'git show origin/main:dev-fixtures/data/index.json',
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    );

    await fs.writeFile(INDEX_JSON_PATH, content, 'utf-8');
    console.log('[fixture-manager] Gitから復元が完了しました:', INDEX_JSON_PATH);
  } catch (error) {
    console.error('[fixture-manager] Gitからの復元に失敗しました:', error.message);
    console.error('[fixture-manager] フォールバック: 既存のindex.jsonを使用します');
    // Gitからの復元が失敗しても、既存のファイルがあれば続行可能
    try {
      await fs.access(INDEX_JSON_PATH);
      console.log('[fixture-manager] 既存のindex.jsonが存在するため、続行します');
    } catch {
      throw new Error('index.jsonが存在せず、Gitからの復元にも失敗しました');
    }
  }
}

/**
 * バックアップファイルを削除
 */
export async function cleanupBackup() {
  try {
    await fs.unlink(BACKUP_PATH);
    console.log('[fixture-manager] バックアップファイルを削除しました:', BACKUP_PATH);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('[fixture-manager] バックアップファイルの削除に失敗しました:', error.message);
    }
    // ファイルが存在しない場合はエラーとしない
  }
}

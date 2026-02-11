import { restoreIndexJson, cleanupBackup } from '../e2e-helpers/fixture-manager.js';

/**
 * Playwrightグローバルティアダウン
 * テスト実行後にフィクスチャを元の状態に戻し、バックアップを削除
 */
export default async function globalTeardown() {
  console.log('\n[global-teardown] E2Eテスト終了後のクリーンアップを開始します...\n');

  // 1. バックアップから復元
  await restoreIndexJson();

  // 2. バックアップファイルを削除
  await cleanupBackup();

  console.log('\n[global-teardown] クリーンアップが完了しました。\n');
}

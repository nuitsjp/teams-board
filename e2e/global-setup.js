import { backupIndexJson, restoreFromGit } from '../e2e-helpers/fixture-manager.js';

/**
 * Playwrightグローバルセットアップ
 * テスト実行前にフィクスチャをクリーンな状態に復元し、バックアップを作成
 */
export default async function globalSetup() {
  console.log('\n[global-setup] E2Eテストの準備を開始します...\n');

  // 1. Gitから最新のクリーンなデータを復元
  await restoreFromGit();

  // 2. クリーンなデータをバックアップ
  await backupIndexJson();

  console.log('\n[global-setup] 準備が完了しました。テストを開始します。\n');
}

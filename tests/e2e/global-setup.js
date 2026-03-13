import { backupIndexJson, restoreFromGit, restoreFixtureFromGit } from './helpers/fixture-lifecycle.js';

/**
 * Playwrightグローバルセットアップ
 * テスト実行前にフィクスチャをクリーンな状態に復元し、バックアップを作成
 */
export default async function globalSetup() {
  console.log('\n[global-setup] E2Eテストの準備を開始します...\n');

  // 1. Gitから最新のクリーンなデータを復元
  await restoreFromGit();

  // 2. データ変更テストで削除される可能性があるフィクスチャも復元
  await restoreFixtureFromGit(
    'data/member-group-term-details/01KHNHF98NYNJPQV869R3WT90Y/01KHNHF98N1V9F6KS4EF77WWG9/20251.json'
  );

  // 3. クリーンなデータをバックアップ
  await backupIndexJson();

  console.log('\n[global-setup] 準備が完了しました。テストを開始します。\n');
}

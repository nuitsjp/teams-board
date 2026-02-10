#!/usr/bin/env node
/**
 * 静的ファイルをAzure Blob Storage ($web コンテナ) にアップロードする
 *
 * テスト・Lint・プロダクションビルドを実行し、dist/ 配下のビルド成果物を
 * $web コンテナに一括アップロードする。初回デプロイ時のみシードデータを配置する。
 */
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { importEnvParams, getEnvFileArg } from './lib/env-settings.mjs';
import { connectAzureStorage, execAz } from './lib/azure-storage.mjs';
import { writeStep, writeAction, writeDetail, writeInfo, writeSuccess } from './lib/logger.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '..');

/** pnpm コマンドを実行し、失敗時は例外をスローする */
function runPnpm(script, label) {
  writeAction(`${label}を実行しています...`);
  try {
    execFileSync('pnpm', ['run', script], { cwd: repoRoot, stdio: 'inherit', shell: true });
  } catch {
    throw new Error(`${label}に失敗しました。デプロイを中断します。`);
  }
  writeSuccess(`${label}完了`);
}

async function main() {
  const env = importEnvParams(getEnvFileArg());

  // テスト・Lint・ビルド
  runPnpm('test', 'テスト');
  runPnpm('lint', 'Lint');

  // プロダクションビルド（VITE_BLOB_BASE_URL を注入）
  process.env.VITE_BLOB_BASE_URL =
    `https://${env.AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net/$web`;
  writeAction('プロダクションビルドを実行しています...');
  writeDetail('VITE_BLOB_BASE_URL', process.env.VITE_BLOB_BASE_URL);
  try {
    execFileSync('pnpm', ['run', 'build'], { cwd: repoRoot, stdio: 'inherit', shell: true });
  } catch {
    throw new Error('ビルドに失敗しました');
  }
  writeSuccess('ビルド完了');

  // Azure接続
  const accountKey = await connectAzureStorage({
    subscriptionId: env.AZURE_SUBSCRIPTION_ID,
    resourceGroupName: env.AZURE_RESOURCE_GROUP_NAME,
    storageAccountName: env.AZURE_STORAGE_ACCOUNT_NAME,
  });

  // ソースディレクトリ
  const sourcePath = resolve(repoRoot, 'dist');
  writeAction(`アップロード元: ${sourcePath}`);

  // upload-batch で一括アップロード
  await execAz([
    'storage', 'blob', 'upload-batch',
    '--source', sourcePath,
    '--destination', '$web',
    '--account-name', env.AZURE_STORAGE_ACCOUNT_NAME,
    '--account-key', accountKey,
    '--overwrite',
  ]);

  // 初期データの配置（data/index.json が存在しない場合のみ）
  const existsResult = await execAz([
    'storage', 'blob', 'exists',
    '--container-name', '$web',
    '--name', 'data/index.json',
    '--account-name', env.AZURE_STORAGE_ACCOUNT_NAME,
    '--account-key', accountKey,
    '--output', 'tsv',
    '--query', 'exists',
  ]);

  if (existsResult === 'false') {
    const seedFile = resolve(__dirname, 'seed', 'index.json');
    writeAction('初期データを配置しています...');
    await execAz([
      'storage', 'blob', 'upload',
      '--file', seedFile,
      '--container-name', '$web',
      '--name', 'data/index.json',
      '--content-type', 'application/json; charset=utf-8',
      '--account-name', env.AZURE_STORAGE_ACCOUNT_NAME,
      '--account-key', accountKey,
      '--overwrite',
    ]);
    writeSuccess('初期 data/index.json をアップロードしました');
  } else {
    writeInfo('data/index.json は既に存在します。スキップしました');
  }

  // 静的サイトURL取得・結果出力
  const webEndpoint = await execAz([
    'storage', 'account', 'show',
    '--resource-group', env.AZURE_RESOURCE_GROUP_NAME,
    '--name', env.AZURE_STORAGE_ACCOUNT_NAME,
    '--query', 'primaryEndpoints.web',
    '--output', 'tsv',
  ]);
  writeStep('アップロード完了');
  writeDetail('静的サイトURL', webEndpoint);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});

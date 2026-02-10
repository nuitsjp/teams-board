#!/usr/bin/env node
/**
 * Azure Blob Storage ($web コンテナ) のセッションデータをクリアする
 *
 * $web コンテナの data/ 配下にアップロードされたセッションデータを削除し、
 * data/index.json を空の初期状態にリセットする。
 */
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { importEnvParams, getEnvFileArg } from './lib/env-settings.mjs';
import { connectAzureStorage, execAz } from './lib/azure-storage.mjs';
import {
  writeStep, writeAction, writeDetail, writeInfo, writeSuccess, writeWarn,
} from './lib/logger.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  const env = importEnvParams(getEnvFileArg());

  // Step 1: Azure接続
  writeStep('Step 1: Azure接続');
  const accountKey = await connectAzureStorage({
    subscriptionId: env.AZURE_SUBSCRIPTION_ID,
    resourceGroupName: env.AZURE_RESOURCE_GROUP_NAME,
    storageAccountName: env.AZURE_STORAGE_ACCOUNT_NAME,
  });

  // Step 2: data/ 配下のBlob削除
  writeStep('Step 2: data/ 配下のBlob削除');

  const blobsJson = await execAz([
    'storage', 'blob', 'list',
    '--container-name', '$web',
    '--prefix', 'data/',
    '--account-name', env.AZURE_STORAGE_ACCOUNT_NAME,
    '--account-key', accountKey,
    '--output', 'json',
  ]);

  const blobs = JSON.parse(blobsJson || '[]');
  let deleteCount = 0;

  if (blobs.length === 0) {
    writeWarn('data/ 配下にBlobが存在しません。スキップします。');
  } else {
    writeInfo(`data/ 配下のBlob数: ${blobs.length}`);

    for (const blob of blobs) {
      if (blob.name === 'data/index.json') {
        writeInfo(`  [スキップ] ${blob.name} (Step 3で上書き)`);
        continue;
      }
      await execAz([
        'storage', 'blob', 'delete',
        '--container-name', '$web',
        '--name', blob.name,
        '--account-name', env.AZURE_STORAGE_ACCOUNT_NAME,
        '--account-key', accountKey,
      ]);
      deleteCount++;
      writeInfo(`  [削除] ${blob.name}`);
    }
    writeSuccess(`削除完了: ${deleteCount} 件のBlobを削除しました`);
  }

  // Step 3: 空の index.json で上書き
  writeStep('Step 3: index.json の初期化');

  const seedFile = resolve(__dirname, 'seed', 'index.json');
  if (!existsSync(seedFile)) {
    throw new Error(`シードファイルが見つかりません: ${seedFile}`);
  }

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
  writeSuccess('data/index.json を初期状態で上書きしました');

  // Step 4: 結果サマリー
  const webEndpoint = await execAz([
    'storage', 'account', 'show',
    '--resource-group', env.AZURE_RESOURCE_GROUP_NAME,
    '--name', env.AZURE_STORAGE_ACCOUNT_NAME,
    '--query', 'primaryEndpoints.web',
    '--output', 'tsv',
  ]);

  writeStep('データクリア完了');
  writeDetail('Storageアカウント', env.AZURE_STORAGE_ACCOUNT_NAME);
  writeDetail('削除したBlob数', `${deleteCount}`);
  writeDetail('index.json', '初期化済み (シードファイルで上書き)');
  writeDetail('静的サイトURL', webEndpoint);
  writeInfo('');
  writeSuccess('全ステップが正常に完了しました');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});

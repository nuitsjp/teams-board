#!/usr/bin/env node
/**
 * Stored Access Policyに紐づくContainer SASトークンを生成し、管理者用URLを出力する
 */
import { importEnvParams, getEnvFileArg } from './lib/env-settings.mjs';
import { connectAzureStorage, execAz } from './lib/azure-storage.mjs';
import { writeStep, writeAction, writeDetail, writeInfo } from './lib/logger.mjs';

/** process.argv から --policy-name オプションの値を取得する */
function getPolicyNameArg() {
  const idx = process.argv.indexOf('--policy-name');
  if (idx !== -1 && idx + 1 < process.argv.length) {
    return process.argv[idx + 1];
  }
  return 'dashboard-admin';
}

async function main() {
  const env = importEnvParams(getEnvFileArg());
  const policyName = getPolicyNameArg();

  // Azure接続・アカウントキー取得
  const accountKey = await connectAzureStorage({
    subscriptionId: env.AZURE_SUBSCRIPTION_ID,
    resourceGroupName: env.AZURE_RESOURCE_GROUP_NAME,
    storageAccountName: env.AZURE_STORAGE_ACCOUNT_NAME,
  });

  // SASトークン生成
  writeAction(`SASトークンを生成しています (Policy: ${policyName})...`);
  const sasToken = await execAz([
    'storage', 'container', 'generate-sas',
    '--name', '$web',
    '--policy-name', policyName,
    '--https-only',
    '--account-name', env.AZURE_STORAGE_ACCOUNT_NAME,
    '--account-key', accountKey,
    '--output', 'tsv',
  ]);

  // 静的サイトエンドポイントURLの取得
  let webEndpoint = await execAz([
    'storage', 'account', 'show',
    '--resource-group', env.AZURE_RESOURCE_GROUP_NAME,
    '--name', env.AZURE_STORAGE_ACCOUNT_NAME,
    '--query', 'primaryEndpoints.web',
    '--output', 'tsv',
  ]);
  webEndpoint = webEndpoint.replace(/\/+$/, '');

  // SASトークンをURLエンコードして token= パラメータに格納
  const encodedSas = encodeURIComponent(sasToken);
  const adminUrl = `${webEndpoint}/index.html?token=${encodedSas}`;

  // 結果出力
  writeStep('SASトークン生成完了');
  writeDetail('Storageアカウント', env.AZURE_STORAGE_ACCOUNT_NAME);
  writeDetail('Policy', policyName);
  writeInfo('');
  writeInfo('--- SASトークン ---');
  writeInfo(sasToken);
  writeInfo('');
  writeInfo('--- 管理者用URL ---');
  writeInfo(adminUrl);
  writeInfo('');

  // パイプライン出力用
  process.stdout.write(adminUrl);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});

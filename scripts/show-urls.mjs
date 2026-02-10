#!/usr/bin/env node
/**
 * 利用者用URLおよび管理者用URL（SASトークン付き）を表示する
 */
import { importEnvParams, getEnvFileArg } from './lib/env-settings.mjs';
import { connectAzureStorage, execAz } from './lib/azure-storage.mjs';
import { writeStep, writeSuccess } from './lib/logger.mjs';

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

  // URL組み立て
  const userUrl = `${webEndpoint}/index.html`;
  const encodedSas = encodeURIComponent(sasToken);
  const adminUrl = `${webEndpoint}/index.html?token=${encodedSas}`;

  // 結果出力
  writeStep('ダッシュボードURL');
  writeSuccess(`利用者用URL: ${userUrl}`);
  writeSuccess(`管理者用URL: ${adminUrl}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});

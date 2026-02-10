import { execFile } from 'node:child_process';
import { writeDetail, writeAction, writeSuccess } from './logger.mjs';

/**
 * az CLI コマンドを実行し、標準出力を返す
 * @param {string[]} args - az コマンドの引数配列
 * @returns {Promise<string>} 標準出力（末尾改行除去済み）
 */
export function execAz(args) {
  return new Promise((resolve, reject) => {
    execFile('az', args, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        const msg = stderr?.trim() || error.message;
        reject(new Error(`az ${args.slice(0, 3).join(' ')} に失敗しました: ${msg}`));
        return;
      }
      resolve(stdout.trim());
    });
  });
}

/**
 * Azure Storageアカウントに接続し、アカウントキーを返す
 * @param {object} params
 * @param {string} params.subscriptionId - AzureサブスクリプションID
 * @param {string} params.resourceGroupName - リソースグループ名
 * @param {string} params.storageAccountName - Storageアカウント名
 * @returns {Promise<string>} アカウントキー
 */
export async function connectAzureStorage({ subscriptionId, resourceGroupName, storageAccountName }) {
  // サブスクリプション切替
  writeDetail('対象サブスクリプション', subscriptionId);
  writeAction('サブスクリプションを切り替えています...');
  await execAz(['account', 'set', '--subscription', subscriptionId]);
  writeSuccess('サブスクリプションを切り替えました');

  // Storageアカウントの接続確認
  writeAction(`Storageアカウント '${storageAccountName}' に接続しています...`);
  await execAz([
    'storage', 'account', 'show',
    '--resource-group', resourceGroupName,
    '--name', storageAccountName,
  ]);

  // アカウントキーを取得
  const accountKey = await execAz([
    'storage', 'account', 'keys', 'list',
    '--resource-group', resourceGroupName,
    '--account-name', storageAccountName,
    '--query', '[0].value',
    '--output', 'tsv',
  ]);
  if (!accountKey) {
    throw new Error('Storageアカウントキーの取得に失敗しました');
  }
  writeSuccess('Storageアカウントに接続しました');

  return accountKey;
}

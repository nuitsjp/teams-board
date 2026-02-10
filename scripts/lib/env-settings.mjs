import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeInfo } from './logger.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// プロジェクトルート（scripts/lib → scripts → プロジェクトルート）
const PROJECT_ROOT = resolve(__dirname, '..', '..');

/**
 * .env ファイルを読み込み、キーと値のオブジェクトを返す
 * @param {string} [envPath] - .envファイルのパス（未指定時はプロジェクトルートの .env）
 * @returns {Record<string, string>}
 */
export function loadEnvSettings(envPath = '') {
  let resolvedPath;
  if (envPath === '') {
    resolvedPath = resolve(PROJECT_ROOT, '.env');
  } else if (isAbsolute(envPath)) {
    resolvedPath = envPath;
  } else {
    resolvedPath = resolve(PROJECT_ROOT, envPath);
  }

  if (!existsSync(resolvedPath)) {
    throw new Error(
      `.env ファイルが見つかりません: ${resolvedPath}\n.env.example をコピーして .env を作成してください。`
    );
  }

  const settings = {};
  const lines = readFileSync(resolvedPath, 'utf-8').split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    // 空行とコメント行をスキップ
    if (trimmed === '' || trimmed.startsWith('#')) continue;

    const eqIndex = line.indexOf('=');
    if (eqIndex > 0) {
      const key = line.substring(0, eqIndex).trim();
      let value = line.substring(eqIndex + 1).trim();

      // クォートの除去（ダブルクォートまたはシングルクォート）
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      settings[key] = value;
    }
  }

  writeInfo(`.env を読み込みました: ${resolvedPath}`);
  return settings;
}

/**
 * .env ファイルを読み込み、全キーをオブジェクトとして返す。
 * .env.example に基づく必須キー検証も行う。
 * @param {string} [envPath] - .envファイルのパス
 * @returns {Record<string, string>}
 */
export function importEnvParams(envPath = '') {
  const settings = loadEnvSettings(envPath);

  // .env.example に基づく必須キー検証
  const examplePath = resolve(PROJECT_ROOT, '.env.example');
  if (existsSync(examplePath)) {
    const exampleLines = readFileSync(examplePath, 'utf-8').split(/\r?\n/);
    const requiredKeys = [];

    for (const line of exampleLines) {
      const trimmed = line.trim();
      if (trimmed === '' || trimmed.startsWith('#')) continue;

      const eqIndex = line.indexOf('=');
      if (eqIndex > 0) {
        requiredKeys.push(line.substring(0, eqIndex).trim());
      }
    }

    const missingKeys = requiredKeys.filter((key) => !(key in settings));
    if (missingKeys.length > 0) {
      throw new Error(
        `.env に必須キーが不足しています: ${missingKeys.join(', ')}\n.env.example を確認し、不足キーを .env に追加してください。`
      );
    }
  }

  return settings;
}

/**
 * process.argv から --env-file オプションの値を取得する
 * @returns {string} envファイルパス（未指定時は空文字列）
 */
export function getEnvFileArg() {
  const idx = process.argv.indexOf('--env-file');
  if (idx !== -1 && idx + 1 < process.argv.length) {
    return process.argv[idx + 1];
  }
  return '';
}

#!/usr/bin/env node
// ローカル変換実行スクリプト — data/sample のCSVを変換して public/data を置換する
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { LocalConvertCommand } from '../src/local-batch/local-convert-command.js';
import { ConversionReporter } from '../src/local-batch/conversion-reporter.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// デフォルトパス（プロジェクトルートからの相対）
const projectRoot = resolve(__dirname, '..');

const inputDir = resolve(projectRoot, 'data', 'sample');
const outputDir = resolve(projectRoot, 'public', 'data');

console.log('=== ローカルデータ変換 ===');
console.log(`入力: ${inputDir}`);
console.log(`出力: ${outputDir}`);
console.log('');

const command = new LocalConvertCommand();
const reporter = new ConversionReporter();

try {
  const result = await command.execute({ inputDir, outputDir });
  const output = reporter.format(result);
  console.log(output);

  if (result.status === 'failure') {
    process.exit(1);
  }
} catch (err) {
  console.error('変換中にエラーが発生しました:', err.message);
  process.exit(1);
}

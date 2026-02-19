/**
 * Marp スライドビルドスクリプト
 *
 * 使い方:
 *   node scripts/marp-build.mjs [--pdf] [--html] [入力ファイル]
 *
 * オプション:
 *   --html  HTML を生成（デフォルト）
 *   --pdf   PDF を生成
 *   引数なし: HTML を生成
 *   入力ファイル指定なし: docs/90.スライド/ 配下の全 .md を対象
 */
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SLIDE_DIR = path.join(ROOT, 'docs', '90.スライド');
const THEME_DIR = path.join(SLIDE_DIR, 'theme');
const OUTPUT_DIR = SLIDE_DIR;

// コマンドライン引数を解析
const args = process.argv.slice(2);
const generatePdf = args.includes('--pdf');
const generateHtml = args.includes('--html') || !generatePdf;
const inputFiles = args.filter((a) => !a.startsWith('--'));

// 入力ファイルの解決
function resolveInputFiles() {
    if (inputFiles.length > 0) {
        return inputFiles.map((f) => path.resolve(f));
    }
    // docs/90.スライド/ 配下の .md ファイルを検索（theme/ 配下は除外）
    const files = [];
    for (const entry of fs.readdirSync(SLIDE_DIR)) {
        const fullPath = path.join(SLIDE_DIR, entry);
        if (entry.endsWith('.md') && fs.statSync(fullPath).isFile()) {
            files.push(fullPath);
        }
    }
    return files;
}

function run() {
    const files = resolveInputFiles();
    if (files.length === 0) {
        console.error('対象の Markdown ファイルが見つかりません。');
        process.exit(1);
    }

    // 出力ディレクトリを作成
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    for (const inputFile of files) {
        const baseName = path.basename(inputFile, '.md');

        if (generateHtml) {
            const outputHtml = path.join(OUTPUT_DIR, `${baseName}.html`);
            console.log(`HTML 生成中: ${path.relative(ROOT, inputFile)}`);
            execSync(
                `pnpm dlx @marp-team/marp-cli --no-stdin "${inputFile}" --theme-set "${THEME_DIR}" --html --allow-local-files --output "${outputHtml}"`,
                { cwd: ROOT, stdio: 'inherit' }
            );
            console.log(`  -> ${path.relative(ROOT, outputHtml)}`);
        }

        if (generatePdf) {
            const outputPdf = path.join(OUTPUT_DIR, `${baseName}.pdf`);
            console.log(`PDF 生成中: ${path.relative(ROOT, inputFile)}`);
            execSync(
                `pnpm dlx @marp-team/marp-cli --no-stdin "${inputFile}" --theme-set "${THEME_DIR}" --html --pdf --allow-local-files --output "${outputPdf}"`,
                { cwd: ROOT, stdio: 'inherit' }
            );
            console.log(`  -> ${path.relative(ROOT, outputPdf)}`);
        }
    }

    console.log('\nビルド完了');
}

run();

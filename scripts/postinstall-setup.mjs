import { execSync } from 'node:child_process';
import { mkdir, rm, symlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// --- 環境検知 ---
const isCI = process.env.CI === 'true';
const skipPythonSetup = process.env.SKIP_PYTHON_SETUP === 'true';

// --- Phase 1: ワークスペース構成（全環境共通） ---

async function ensureOpenspecJunction(repositoryRootPath) {
  const sourceOpenspecPath = path.join(repositoryRootPath, 'openspec');
  const docsDirectoryPath = path.join(repositoryRootPath, 'docs');
  const junctionPath = path.join(docsDirectoryPath, 'openspec');

  await mkdir(docsDirectoryPath, { recursive: true });
  await rm(junctionPath, { recursive: true, force: true });
  await symlink(path.resolve(sourceOpenspecPath), junctionPath, 'junction');
}

// --- Phase 2: Python 環境セットアップ ---

function runUvSync(repositoryRootPath) {
  execSync('uv sync', { cwd: repositoryRootPath, stdio: 'inherit' });
}

// --- Phase 3: 開発者ツール（ローカル開発のみ） ---

function isGlobalPackageInstalled(packageName) {
  try {
    execSync(`npm list -g ${packageName}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function ensureGlobalPackage(packageName) {
  if (isGlobalPackageInstalled(packageName)) {
    return;
  }
  execSync(`npm install -g ${packageName}`, { stdio: 'inherit' });
}

function runRulesyncGenerate(repositoryRootPath) {
  execSync('rulesync generate --targets claudecode,agentsskills,copilot --features rules,skills', {
    cwd: repositoryRootPath,
    stdio: 'inherit',
  });
}

// --- メイン処理 ---

const scriptFilePath = fileURLToPath(import.meta.url);
const scriptDirectoryPath = path.dirname(scriptFilePath);
const repositoryRootPath = path.resolve(scriptDirectoryPath, '..');

const mode = isCI ? 'CI' : 'local';
console.log(`\npostinstall: ${mode} mode\n`);

// Phase 1: ワークスペース構成（全環境共通）
console.log('Phase 1: ワークスペース構成...');
await ensureOpenspecJunction(repositoryRootPath);

// Phase 2: Python 環境セットアップ（SKIP_PYTHON_SETUP=true でスキップ）
if (skipPythonSetup) {
  console.log('Phase 2: スキップ (SKIP_PYTHON_SETUP=true)');
} else {
  console.log('Phase 2: Python 環境セットアップ...');
  runUvSync(repositoryRootPath);
}

// Phase 3: 開発者ツール（CI 環境ではスキップ）
if (isCI) {
  console.log('Phase 3: スキップ (CI 環境)');
} else {
  console.log('Phase 3: 開発者ツールセットアップ...');
  ensureGlobalPackage('rulesync');
  ensureGlobalPackage('@playwright/cli');
  runRulesyncGenerate(repositoryRootPath);
}

console.log('\npostinstall: 完了\n');

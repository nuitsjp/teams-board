import { execSync } from 'node:child_process';
import { mkdir, rm, symlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

async function ensureOpenspecJunction(repositoryRootPath) {
  const sourceOpenspecPath = path.join(repositoryRootPath, 'openspec');
  const docsDirectoryPath = path.join(repositoryRootPath, 'docs');
  const junctionPath = path.join(docsDirectoryPath, 'openspec');

  await mkdir(docsDirectoryPath, { recursive: true });
  await rm(junctionPath, { recursive: true, force: true });
  await symlink(path.resolve(sourceOpenspecPath), junctionPath, 'junction');
}

function runUvSync(repositoryRootPath) {
  execSync('uv sync', { cwd: repositoryRootPath, stdio: 'inherit' });
}

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

const scriptFilePath = fileURLToPath(import.meta.url);
const scriptDirectoryPath = path.dirname(scriptFilePath);
const repositoryRootPath = path.resolve(scriptDirectoryPath, '..');

await ensureOpenspecJunction(repositoryRootPath);
runUvSync(repositoryRootPath);
ensureGlobalPackage('rulesync');
ensureGlobalPackage('@playwright/cli');
runRulesyncGenerate(repositoryRootPath);

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

function runRulesyncGenerate(repositoryRootPath) {
  execSync('pnpm run rulesync:generate', { cwd: repositoryRootPath, stdio: 'inherit' });
}

const scriptFilePath = fileURLToPath(import.meta.url);
const scriptDirectoryPath = path.dirname(scriptFilePath);
const repositoryRootPath = path.resolve(scriptDirectoryPath, '..');

await ensureOpenspecJunction(repositoryRootPath);
runUvSync(repositoryRootPath);
runRulesyncGenerate(repositoryRootPath);

import { lstat, mkdir, realpath, symlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptFilePath = fileURLToPath(import.meta.url);
const scriptDirectoryPath = path.dirname(scriptFilePath);
const repositoryRootPath = path.resolve(scriptDirectoryPath, '..');
const sourceOpenspecPath = path.join(repositoryRootPath, 'openspec');
const docsDirectoryPath = path.join(repositoryRootPath, 'docs');
const junctionPath = path.join(docsDirectoryPath, 'openspec');

async function exists(targetPath) {
  try {
    await lstat(targetPath);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

function normalizeComparePath(targetPath) {
  return targetPath.replace(/\//g, '\\').toLowerCase();
}

async function isExpectedLink(linkPath, sourcePath) {
  const stats = await lstat(linkPath);
  if (!stats.isSymbolicLink()) {
    return false;
  }

  const [resolvedLinkPath, resolvedSourcePath] = await Promise.all([
    realpath(linkPath),
    realpath(sourcePath),
  ]);

  return (
    normalizeComparePath(resolvedLinkPath) ===
    normalizeComparePath(resolvedSourcePath)
  );
}

async function ensureOpenspecJunction() {
  if (process.platform !== 'win32') {
    console.log(
      '[postinstall] Windows 以外のため、docs/openspec ジャンクション作成をスキップしました。'
    );
    return;
  }

  if (!(await exists(sourceOpenspecPath))) {
    throw new Error(
      `[postinstall] ソースが存在しないため作成できません: ${sourceOpenspecPath}`
    );
  }

  await mkdir(docsDirectoryPath, { recursive: true });

  if (!(await exists(junctionPath))) {
    await symlink(path.resolve(sourceOpenspecPath), junctionPath, 'junction');
    console.log(
      `[postinstall] docs/openspec ジャンクションを作成しました: ${junctionPath}`
    );
    return;
  }

  if (await isExpectedLink(junctionPath, sourceOpenspecPath)) {
    console.log(
      '[postinstall] docs/openspec ジャンクションは既に正しい状態です。'
    );
    return;
  }

  throw new Error(
    `[postinstall] docs/openspec が既存オブジェクトと競合しています。手動で解消してください: ${junctionPath}`
  );
}

try {
  await ensureOpenspecJunction();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
}

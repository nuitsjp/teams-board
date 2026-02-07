// AtomicPublicDataWriter — ステージング経由で公開データを安全に置換する
import * as fsPromises from 'node:fs/promises';
import * as nodePath from 'node:path';

export class AtomicPublicDataWriter {
  /**
   * @param {object} [deps] - 依存注入（テスト用）
   * @param {object} [deps.fs] - fs/promises互換オブジェクト
   * @param {function} [deps.joinPath] - パス結合関数
   */
  constructor(deps = {}) {
    this._fs = deps.fs || fsPromises;
    this._join = deps.joinPath || nodePath.join;
  }

  /**
   * ステージング経由で公開データを安全に置換する
   * @param {string} outputDir - 公開ディレクトリパス
   * @param {object} index - DashboardIndex
   * @param {object[]} sessions - SessionRecord[]
   * @returns {Promise<{allSucceeded: boolean, results: Array<{path: string, ok: boolean, error?: string}>}>}
   */
  async publish(outputDir, index, sessions) {
    const results = [];
    const stagingDir = this._join(outputDir, '.staging-' + Date.now());
    const sessionsDir = this._join(stagingDir, 'sessions');
    const lockPath = this._join(outputDir, '.lock');

    // ロック取得
    try {
      await this._acquireLock(lockPath);
    } catch (err) {
      return {
        allSucceeded: false,
        results: [{ path: lockPath, ok: false, error: err.message }],
      };
    }

    try {
      // ステージングディレクトリ作成
      try {
        await this._fs.mkdir(stagingDir, { recursive: true });
        await this._fs.mkdir(sessionsDir, { recursive: true });
      } catch (err) {
        return {
          allSucceeded: false,
          results: [{ path: stagingDir, ok: false, error: err.message }],
        };
      }

      // index.json書き込み
      const indexPath = this._join(stagingDir, 'index.json');
      try {
        await this._fs.writeFile(indexPath, JSON.stringify(index, null, 2), 'utf-8');
        results.push({ path: 'index.json', ok: true });
      } catch (err) {
        results.push({ path: 'index.json', ok: false, error: err.message });
      }

      // セッションJSON書き込み
      for (const session of sessions) {
        const sessionPath = this._join(sessionsDir, `${session.id}.json`);
        try {
          await this._fs.writeFile(sessionPath, JSON.stringify(session, null, 2), 'utf-8');
          results.push({ path: `sessions/${session.id}.json`, ok: true });
        } catch (err) {
          results.push({ path: `sessions/${session.id}.json`, ok: false, error: err.message });
        }
      }

      // 書き込み失敗があればswapしない
      const hasFailure = results.some((r) => !r.ok);
      if (hasFailure) {
        await this._cleanup(stagingDir);
        return { allSucceeded: false, results };
      }

      // 公開ディレクトリへの切替（swap）
      try {
        // 既存のsessionsディレクトリ配下へコピー
        const publicSessionsDir = this._join(outputDir, 'sessions');
        await this._fs.mkdir(publicSessionsDir, { recursive: true });

        // index.jsonをswap
        await this._fs.rename(
          this._join(stagingDir, 'index.json'),
          this._join(outputDir, 'index.json')
        );

        // セッションファイルをswap
        for (const session of sessions) {
          await this._fs.rename(
            this._join(sessionsDir, `${session.id}.json`),
            this._join(publicSessionsDir, `${session.id}.json`)
          );
        }
      } catch (err) {
        return {
          allSucceeded: false,
          results: [...results, { path: outputDir, ok: false, error: err.message }],
        };
      }

      // クリーンアップ
      await this._cleanup(stagingDir);

      return { allSucceeded: true, results };
    } finally {
      // ロック解放
      await this._releaseLock(lockPath);
    }
  }

  /** @private */
  async _acquireLock(lockPath) {
    try {
      // ロックファイルの存在確認（存在すれば他プロセスが実行中）
      await this._fs.stat(lockPath);
      throw new Error('別のプロセスが実行中です（ロックファイルが存在します）');
    } catch (err) {
      if (err.message.includes('別のプロセス')) {
        throw err;
      }
      // ファイルが存在しない場合は正常（ロック取得可能）
      await this._fs.writeFile(lockPath, String(Date.now()), 'utf-8');
    }
  }

  /** @private */
  async _releaseLock(lockPath) {
    try {
      await this._fs.rm(lockPath);
    } catch {
      // ロック解放失敗は無視
    }
  }

  /** @private */
  async _cleanup(dir) {
    try {
      await this._fs.rm(dir, { recursive: true });
    } catch {
      // クリーンアップ失敗は無視
    }
  }
}

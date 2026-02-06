// FileQueueManager — 複数ファイルのキュー管理・バリデーション・パース実行
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export class FileQueueManager {
  #csvTransformer;
  #onQueueUpdate;
  #queue = [];
  #existingSessionIds = new Set();

  /**
   * @param {object} csvTransformer - CsvTransformerインスタンス
   * @param {function} onQueueUpdate - キュー変更時コールバック (queue: QueueItem[]) => void
   */
  constructor(csvTransformer, onQueueUpdate) {
    this.#csvTransformer = csvTransformer;
    this.#onQueueUpdate = onQueueUpdate;
  }

  /**
   * ファイルをキューに追加し、バリデーション→パースを実行する
   * @param {FileList|File[]} files - 追加するファイル群
   * @returns {Promise<void>}
   */
  async addFiles(files) {
    for (const file of files) {
      const item = this.#createQueueItem(file);
      this.#queue.push(item);

      // バリデーション
      const validationError = this.#validateFile(file);
      if (validationError) {
        item.status = 'error';
        item.errors = [validationError];
        this.#notify();
        continue;
      }

      // パース実行
      item.status = 'validating';
      this.#notify();

      const result = await this.#csvTransformer.parse(file);
      if (!result.ok) {
        item.status = 'error';
        item.errors = result.errors;
        this.#notify();
        continue;
      }

      item.parseResult = result;
      item.warnings = result.warnings || [];

      // 重複チェック
      const sessionId = result.sessionRecord.id;
      if (this.#existingSessionIds.has(sessionId)) {
        item.status = 'duplicate_warning';
        item.hasDuplicate = true;
      } else {
        item.status = 'ready';
      }
      this.#notify();
    }
  }

  /**
   * キューからファイルを削除する
   * @param {string} fileId - 削除対象のQueueItem.id
   */
  removeFile(fileId) {
    this.#queue = this.#queue.filter((item) => item.id !== fileId);
    this.#notify();
  }

  /**
   * 重複警告を承認し、readyに遷移させる
   * @param {string} fileId - 対象のQueueItem.id
   */
  approveDuplicate(fileId) {
    const item = this.#findItem(fileId);
    if (item && item.status === 'duplicate_warning') {
      item.status = 'ready';
      this.#notify();
    }
  }

  /**
   * 保存可能（ready状態）なアイテムを返す
   * @returns {QueueItem[]}
   */
  getReadyItems() {
    return this.#queue.filter((item) => item.status === 'ready');
  }

  /**
   * 保存失敗アイテムを返す
   * @returns {QueueItem[]}
   */
  getFailedItems() {
    return this.#queue.filter((item) => item.status === 'save_failed');
  }

  /**
   * アイテムの状態を更新する
   * @param {string} fileId - 対象のQueueItem.id
   * @param {string} status - 新しい状態
   * @param {object} [extra] - 追加情報（errors, warnings等）
   */
  updateStatus(fileId, status, extra) {
    const item = this.#findItem(fileId);
    if (item) {
      item.status = status;
      if (extra) {
        if (extra.errors) item.errors = extra.errors;
        if (extra.warnings) item.warnings = extra.warnings;
      }
      this.#notify();
    }
  }

  /**
   * 重複チェック用の既存セッションID一覧を設定する
   * @param {Set<string>} sessionIds - 既存のセッションIDセット
   */
  setExistingSessionIds(sessionIds) {
    this.#existingSessionIds = sessionIds;
  }

  /**
   * 現在のキューを返す
   * @returns {QueueItem[]}
   */
  getQueue() {
    return [...this.#queue];
  }

  /**
   * QueueItemを生成する
   * @param {File} file
   * @returns {QueueItem}
   */
  #createQueueItem(file) {
    return {
      id: crypto.randomUUID(),
      file,
      status: 'pending',
      parseResult: null,
      errors: [],
      warnings: [],
      hasDuplicate: false,
    };
  }

  /**
   * ファイルのバリデーションを行う
   * @param {File} file
   * @returns {string|null} エラーメッセージ。問題なければnull
   */
  #validateFile(file) {
    // 拡張子チェック
    if (!file.name.toLowerCase().endsWith('.csv')) {
      return 'CSVファイルのみ対応しています';
    }
    // サイズチェック
    if (file.size > MAX_FILE_SIZE) {
      return 'ファイルサイズが10MBを超えています';
    }
    return null;
  }

  /**
   * IDでアイテムを検索する
   * @param {string} fileId
   * @returns {QueueItem|undefined}
   */
  #findItem(fileId) {
    return this.#queue.find((item) => item.id === fileId);
  }

  /**
   * コールバックを呼び出す
   */
  #notify() {
    this.#onQueueUpdate(this.getQueue());
  }
}

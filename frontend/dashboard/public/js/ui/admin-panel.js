// AdminPanel — 管理者向け操作UI（Teams出席レポートCSV複数ファイル対応）
import { formatDuration } from './dashboard-view.js';
import { FileQueueManager } from './file-queue-manager.js';

export class AdminPanel {
  #container;
  #auth;
  #csvTransformer;
  #blobWriter;
  #indexMerger;
  #dataFetcher;
  #queueManager;
  #saving = false;

  /**
   * @param {HTMLElement} container - 管理者パネルのコンテナ要素
   * @param {object} auth - AuthManagerインスタンス
   * @param {object} csvTransformer - CsvTransformerインスタンス
   * @param {object} blobWriter - BlobWriterインスタンス
   * @param {object} indexMerger - IndexMergerインスタンス
   * @param {object} [dataFetcher] - DataFetcherインスタンス（省略可、後方互換）
   */
  constructor(container, auth, csvTransformer, blobWriter, indexMerger, dataFetcher) {
    this.#container = container;
    this.#auth = auth;
    this.#csvTransformer = csvTransformer;
    this.#blobWriter = blobWriter;
    this.#indexMerger = indexMerger;
    this.#dataFetcher = dataFetcher || null;
  }

  /**
   * 管理者パネルを初期化する
   */
  async initialize() {
    if (!this.#auth.isAdminMode()) {
      this.#container.classList.add('hidden');
      return;
    }

    this.#container.classList.remove('hidden');

    // FileQueueManagerの初期化
    this.#queueManager = new FileQueueManager(
      this.#csvTransformer,
      (queue) => this.#onQueueUpdate(queue)
    );

    // 既存セッションIDの取得（DataFetcherが利用可能な場合）
    if (this.#dataFetcher) {
      const indexResult = await this.#dataFetcher.fetchIndex();
      if (indexResult.ok) {
        const sessionIds = new Set(
          indexResult.data.studyGroups.flatMap((g) => g.sessionIds)
        );
        this.#queueManager.setExistingSessionIds(sessionIds);
      }
    }

    this.#renderUploadUI();
  }

  /**
   * CSV投入UIを描画する
   */
  #renderUploadUI() {
    this.#container.innerHTML = `
      <h2>管理者パネル</h2>
      <div class="csv-drop-zone" id="drop-zone">
        <div class="drop-zone-icon">&#128196;</div>
        <div class="drop-zone-text">Teams出席レポートCSVをドラッグ&ドロップ、またはファイルを選択</div>
        <input type="file" accept=".csv" multiple id="csv-file-input">
      </div>
      <div id="queue-list"></div>
      <div id="admin-content"></div>
    `;

    this.#setupDropZone();
  }

  /**
   * ドロップゾーンのイベントを設定する
   */
  #setupDropZone() {
    const dropZone = this.#container.querySelector('#drop-zone');
    const fileInput = this.#container.querySelector('#csv-file-input');

    fileInput.addEventListener('change', (e) => {
      const files = Array.from(e.target.files);
      if (files.length > 0) {
        this.#queueManager.addFiles(files);
        fileInput.value = '';
      }
    });

    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
      const textEl = dropZone.querySelector('.drop-zone-text');
      if (textEl) textEl.textContent = 'ここにドロップ';
    });
    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('dragover');
      this.#restoreDropZoneText();
    });
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      this.#restoreDropZoneText();
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        this.#queueManager.addFiles(files);
      }
    });
  }

  /**
   * ドロップゾーンテキストを復元する
   */
  #restoreDropZoneText() {
    const dropZone = this.#container.querySelector('#drop-zone');
    const textEl = dropZone?.querySelector('.drop-zone-text');
    if (!textEl) return;
    const queue = this.#queueManager.getQueue();
    if (queue.length > 0) {
      textEl.textContent = 'さらにファイルを追加';
    } else {
      textEl.textContent = 'Teams出席レポートCSVをドラッグ&ドロップ、またはファイルを選択';
    }
  }

  /**
   * キュー更新コールバック
   * @param {Array} queue - 現在のキュー
   */
  #onQueueUpdate(queue) {
    const dropZone = this.#container.querySelector('#drop-zone');
    if (dropZone) {
      if (queue.length > 0) {
        dropZone.classList.add('compact');
        const textEl = dropZone.querySelector('.drop-zone-text');
        if (textEl && !dropZone.classList.contains('dragover')) {
          textEl.textContent = 'さらにファイルを追加';
        }
      } else {
        dropZone.classList.remove('compact');
        const textEl = dropZone.querySelector('.drop-zone-text');
        if (textEl) {
          textEl.textContent = 'Teams出席レポートCSVをドラッグ&ドロップ、またはファイルを選択';
        }
      }
    }

    this.#renderQueueList(queue);
    this.#renderPreviewArea(queue);
  }

  /**
   * キュー一覧を描画する
   * @param {Array} queue
   */
  #renderQueueList(queue) {
    const listEl = this.#container.querySelector('#queue-list');
    if (!listEl) return;

    if (queue.length === 0) {
      listEl.innerHTML = '';
      return;
    }

    const statusIcon = (status) => {
      switch (status) {
        case 'pending':
        case 'validating': return '<span class="status-icon pending">&#9203;</span>';
        case 'ready':
        case 'parsed': return '<span class="status-icon success">&#10003;</span>';
        case 'saving': return '<span class="status-icon pending">&#9203;</span>';
        case 'saved': return '<span class="status-icon success">&#10003;</span>';
        case 'error':
        case 'save_failed': return '<span class="status-icon failure">&#10007;</span>';
        case 'duplicate_warning': return '<span class="status-icon warning">&#9888;</span>';
        default: return '';
      }
    };

    const formatSize = (bytes) => {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    let html = '<ul class="queue-list">';
    for (const item of queue) {
      html += `<li class="queue-item queue-item-${item.status}" data-file-id="${item.id}">`;
      html += `${statusIcon(item.status)} `;
      html += `<span class="queue-item-name">${item.file.name}</span> `;
      html += `<span class="queue-item-size">(${formatSize(item.file.size)})</span>`;

      if (item.status === 'error') {
        html += `<span class="queue-item-error msg-error">${item.errors.join(', ')}</span>`;
      }
      if (item.status === 'duplicate_warning') {
        html += `<span class="queue-item-warning msg-warning">重複セッションが検出されました</span>`;
        html += `<button class="btn btn-sm btn-approve" data-approve-id="${item.id}">上書き</button>`;
      }

      if (item.status !== 'saving' && item.status !== 'saved') {
        html += `<button class="btn btn-sm btn-remove" data-remove-id="${item.id}">削除</button>`;
      }
      html += '</li>';
    }
    html += '</ul>';

    listEl.innerHTML = html;

    // 削除ボタン
    for (const btn of listEl.querySelectorAll('.btn-remove')) {
      btn.addEventListener('click', () => {
        this.#queueManager.removeFile(btn.dataset.removeId);
      });
    }
    // 重複承認ボタン
    for (const btn of listEl.querySelectorAll('.btn-approve')) {
      btn.addEventListener('click', () => {
        this.#queueManager.approveDuplicate(btn.dataset.approveId);
      });
    }
  }

  /**
   * プレビューエリアを描画する
   * @param {Array} queue
   */
  #renderPreviewArea(queue) {
    const contentArea = this.#container.querySelector('#admin-content');
    if (!contentArea) return;

    const parsedItems = queue.filter((item) =>
      item.parseResult && item.parseResult.ok &&
      (item.status === 'ready' || item.status === 'duplicate_warning' ||
       item.status === 'saving' || item.status === 'saved' || item.status === 'save_failed')
    );

    if (parsedItems.length === 0 && !this.#saving) {
      contentArea.innerHTML = '';
      return;
    }

    // 保存中はプレビューを更新しない
    if (this.#saving) return;

    let html = '';

    for (const item of parsedItems) {
      const { mergeInput } = item.parseResult;
      const totalDuration = mergeInput.attendances.reduce((sum, a) => sum + a.durationSeconds, 0);

      html += `<div class="preview-card" data-preview-id="${item.id}">`;
      html += '<div class="summary-card">';
      html += `<span class="summary-group">${mergeInput.studyGroupName}</span>`;
      html += `<span class="summary-date">${mergeInput.date}</span>`;
      html += `<span class="summary-count">参加者: ${mergeInput.attendances.length}名</span>`;
      html += `<span class="summary-duration">合計: ${formatDuration(totalDuration)}</span>`;
      if (item.hasDuplicate) {
        html += '<span class="msg-warning">&#9888; 重複</span>';
      }
      html += '</div>';

      // 詳細テーブル（初期非表示）
      html += '<div class="preview-detail" style="display:none">';
      html += '<table class="preview-table"><thead><tr><th>参加者</th><th>学習時間</th></tr></thead><tbody>';
      for (const a of mergeInput.attendances) {
        html += `<tr><td>${a.memberName}</td><td>${formatDuration(a.durationSeconds)}</td></tr>`;
      }
      html += '</tbody></table></div>';
      html += '</div>';
    }

    // 一括保存ボタン
    const readyCount = queue.filter((i) => i.status === 'ready').length;
    if (readyCount > 0) {
      html += `<button class="btn btn-primary" id="save-all-btn">一括保存 (${readyCount}件)</button>`;
    }

    // リトライボタン
    const failedCount = queue.filter((i) => i.status === 'save_failed').length;
    if (failedCount > 0) {
      html += `<button class="btn btn-retry" id="retry-btn">失敗した操作をリトライ (${failedCount}件)</button>`;
    }

    contentArea.innerHTML = html;

    // サマリーカードのクリックで詳細展開
    for (const card of contentArea.querySelectorAll('.summary-card')) {
      card.addEventListener('click', () => {
        const detail = card.parentElement.querySelector('.preview-detail');
        if (detail) {
          detail.style.display = detail.style.display === 'none' ? '' : 'none';
        }
      });
    }

    // 一括保存ボタン
    const saveBtn = contentArea.querySelector('#save-all-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => this.#handleBulkSave());
    }

    // リトライボタン
    const retryBtn = contentArea.querySelector('#retry-btn');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => this.#handleRetry());
    }
  }

  /**
   * 一括保存を実行する
   */
  async #handleBulkSave() {
    this.#saving = true;
    const readyItems = this.#queueManager.getReadyItems();
    const total = readyItems.length;
    const contentArea = this.#container.querySelector('#admin-content');

    // プログレスバー表示
    contentArea.innerHTML = `
      <div class="save-progress">
        <progress id="save-progress-bar" value="0" max="${total}"></progress>
        <div id="save-status" class="save-status">保存中...</div>
      </div>
    `;

    // 保存ボタン無効化
    const saveBtn = this.#container.querySelector('#save-all-btn');
    if (saveBtn) saveBtn.disabled = true;

    let completed = 0;
    for (const item of readyItems) {
      this.#queueManager.updateStatus(item.id, 'saving');
      const statusEl = contentArea.querySelector('#save-status');
      if (statusEl) statusEl.textContent = `保存中... ${item.file.name}`;

      const { sessionRecord, mergeInput } = item.parseResult;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

      const result = await this.#blobWriter.executeWriteSequence({
        rawCsv: {
          path: `raw/${timestamp}-${item.file.name}`,
          content: item.file,
          contentType: 'text/csv',
        },
        newItems: [{
          path: `data/sessions/${sessionRecord.id}.json`,
          content: JSON.stringify(sessionRecord, null, 2),
          contentType: 'application/json',
        }],
        indexUpdater: (currentIndex) => this.#indexMerger.merge(currentIndex, mergeInput).index,
      });

      completed++;
      const progressBar = contentArea.querySelector('#save-progress-bar');
      if (progressBar) progressBar.value = completed;

      if (result.allSucceeded) {
        this.#queueManager.updateStatus(item.id, 'saved');
      } else {
        this.#queueManager.updateStatus(item.id, 'save_failed', {
          errors: result.results.filter((r) => !r.success).map((r) => r.error),
        });
      }
    }

    this.#saving = false;
    // 最終状態を描画
    this.#onQueueUpdate(this.#queueManager.getQueue());
  }

  /**
   * 失敗した保存をリトライする
   */
  async #handleRetry() {
    const failedItems = this.#queueManager.getFailedItems();
    // 各ファイルをready状態に戻して再保存
    for (const item of failedItems) {
      this.#queueManager.updateStatus(item.id, 'ready');
    }
    await this.#handleBulkSave();
  }
}

// AdminPanel — 管理者向け操作UI（CsvUploader, PreviewPanel, 進捗表示を統合）
import { IndexMerger } from '../data/index-merger.js';

export class AdminPanel {
  #container;
  #auth;
  #csvTransformer;
  #blobWriter;
  #currentParseResult = null;
  #currentFile = null;

  constructor(container, auth, csvTransformer, blobWriter) {
    this.#container = container;
    this.#auth = auth;
    this.#csvTransformer = csvTransformer;
    this.#blobWriter = blobWriter;
  }

  /**
   * 管理者パネルを初期化する
   */
  initialize() {
    if (!this.#auth.isAdminMode()) {
      this.#container.classList.add('hidden');
      return;
    }

    this.#container.classList.remove('hidden');
    this.#renderUploadUI();
  }

  /**
   * CSV投入UIを描画する
   */
  #renderUploadUI() {
    this.#container.innerHTML = `
      <h2>管理者パネル</h2>
      <div class="csv-drop-zone" id="drop-zone">
        CSVファイルをドラッグ&ドロップ、またはファイルを選択
        <br><input type="file" accept=".csv" id="csv-file-input">
      </div>
      <div id="admin-content"></div>
    `;

    const dropZone = this.#container.querySelector('#drop-zone');
    const fileInput = this.#container.querySelector('#csv-file-input');

    // ファイル選択イベント
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) this.#handleFile(file);
    });

    // Drag&Dropイベント
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });
    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('dragover');
    });
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      const file = e.dataTransfer.files[0];
      if (file) this.#handleFile(file);
    });
  }

  /**
   * CSVファイルを処理する
   * @param {File} file
   */
  async #handleFile(file) {
    this.#currentFile = file;
    const contentArea = this.#container.querySelector('#admin-content');
    contentArea.innerHTML = '<div class="loading">CSVを解析中...</div>';

    const result = await this.#csvTransformer.parse(file);

    if (!result.ok) {
      contentArea.innerHTML = `<div class="error">パースエラー: ${result.errors.join(', ')}</div>`;
      return;
    }

    this.#currentParseResult = result;
    this.#renderPreview(contentArea, result);
  }

  /**
   * プレビューと保存ボタンを描画する
   * @param {HTMLElement} contentArea
   * @param {object} parseResult
   */
  #renderPreview(contentArea, parseResult) {
    const { dashboardItems } = parseResult;

    // プレビューテーブル
    let tableHtml = '<table class="preview-table"><thead><tr>';
    if (dashboardItems.length > 0) {
      tableHtml += '<th>ID</th><th>タイトル</th>';
      const summaryKeys = Object.keys(dashboardItems[0].summary);
      for (const key of summaryKeys) {
        tableHtml += `<th>${key}</th>`;
      }
      tableHtml += '</tr></thead><tbody>';
      for (const item of dashboardItems) {
        tableHtml += `<tr><td>${item.id}</td><td>${item.title}</td>`;
        for (const key of summaryKeys) {
          tableHtml += `<td>${item.summary[key] ?? ''}</td>`;
        }
        tableHtml += '</tr>';
      }
      tableHtml += '</tbody></table>';
    }

    contentArea.innerHTML = `
      ${tableHtml}
      <button class="btn btn-primary" id="save-btn">保存を確定</button>
    `;

    contentArea.querySelector('#save-btn').addEventListener('click', () => {
      this.#handleSave(contentArea);
    });
  }

  /**
   * データ保存を実行する
   * @param {HTMLElement} contentArea
   */
  async #handleSave(contentArea) {
    const { dashboardItems, itemDetails } = this.#currentParseResult;
    const file = this.#currentFile;
    const merger = new IndexMerger();

    contentArea.innerHTML = '<div class="loading">保存処理中...</div>';

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const rawCsv = file ? {
      path: `raw/${timestamp}-${file.name}`,
      content: file,
      contentType: 'text/csv',
    } : undefined;

    const newItems = itemDetails.map((detail) => ({
      path: `data/items/${detail.id}.json`,
      content: JSON.stringify(detail, null, 2),
      contentType: 'application/json',
    }));

    const result = await this.#blobWriter.executeWriteSequence({
      rawCsv,
      newItems,
      indexUpdater: (currentIndex) => merger.merge(currentIndex, dashboardItems),
    });

    this.#renderResults(contentArea, result);
  }

  /**
   * 書き込み結果を表示する
   * @param {HTMLElement} contentArea
   * @param {object} writeResult
   */
  #renderResults(contentArea, writeResult) {
    const { results, allSucceeded } = writeResult;

    let html = '<ul class="progress-list">';
    for (const r of results) {
      if (r.success) {
        html += `<li class="progress-item success">${r.path} — 成功</li>`;
      } else {
        html += `<li class="progress-item failure">${r.path} — 失敗: ${r.error}</li>`;
      }
    }
    html += '</ul>';

    if (!allSucceeded) {
      html += '<button class="btn btn-retry" id="retry-btn">失敗した操作をリトライ</button>';
    }

    contentArea.innerHTML = html;

    if (!allSucceeded) {
      const failedResults = results.filter((r) => !r.success);
      contentArea.querySelector('#retry-btn').addEventListener('click', async () => {
        contentArea.innerHTML = '<div class="loading">リトライ中...</div>';
        const retryResult = await this.#blobWriter.retryFailed(failedResults);
        this.#renderResults(contentArea, retryResult);
      });
    }
  }
}

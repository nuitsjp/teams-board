import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth, createAuthAdapter } from '../hooks/useAuth.jsx';
import { useFileQueue } from '../hooks/useFileQueue.js';
import { FileDropZone } from '../components/FileDropZone.jsx';
import { FileQueueList } from '../components/FileQueueList.jsx';
import { PreviewArea } from '../components/PreviewArea.jsx';
import { ProgressBar } from '../components/ProgressBar.jsx';
import { CsvTransformer } from '../services/csv-transformer.js';
import { BlobWriter } from '../services/blob-writer.js';
import { IndexMerger } from '../services/index-merger.js';
import { DataFetcher } from '../services/data-fetcher.js';

const BLOB_BASE_URL = 'https://strjstudylogprod.blob.core.windows.net/$web';

/**
 * 管理者パネル — CSVインポート・プレビュー・一括保存機能
 */
export function AdminPage() {
  const auth = useAuth();
  const authAdapter = useMemo(() => createAuthAdapter(auth), [auth]);

  const csvTransformer = useMemo(() => new CsvTransformer(), []);
  const blobWriter = useMemo(() => new BlobWriter(authAdapter, BLOB_BASE_URL), [authAdapter]);
  const indexMerger = useMemo(() => new IndexMerger(), []);
  const dataFetcher = useMemo(() => new DataFetcher(), []);

  const {
    queue, addFiles, removeFile, approveDuplicate,
    setExistingSessionIds, updateStatus, readyItems, failedItems,
  } = useFileQueue(csvTransformer);

  const [saving, setSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState({ current: 0, total: 0 });
  const [saveStatusText, setSaveStatusText] = useState('');

  // 既存セッションIDの取得
  useEffect(() => {
    (async () => {
      const indexResult = await dataFetcher.fetchIndex();
      if (indexResult.ok) {
        const sessionIds = new Set(
          indexResult.data.studyGroups.flatMap((g) => g.sessionIds)
        );
        setExistingSessionIds(sessionIds);
      }
    })();
  }, [dataFetcher, setExistingSessionIds]);

  // プレビュー用のアイテム
  const previewItems = queue.filter((item) =>
    item.parseResult && item.parseResult.ok &&
    ['ready', 'duplicate_warning', 'saving', 'saved', 'save_failed'].includes(item.status)
  );

  // 一括保存処理
  const handleBulkSave = useCallback(async () => {
    const itemsToSave = queue.filter((item) => item.status === 'ready');
    if (itemsToSave.length === 0) return;

    setSaving(true);
    setSaveProgress({ current: 0, total: itemsToSave.length });

    let completed = 0;
    for (const item of itemsToSave) {
      updateStatus(item.id, 'saving');
      setSaveStatusText(`保存中... ${item.file.name}`);

      const { sessionRecord, mergeInput } = item.parseResult;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

      const result = await blobWriter.executeWriteSequence({
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
        indexUpdater: (currentIndex) => indexMerger.merge(currentIndex, mergeInput).index,
      });

      completed++;
      setSaveProgress({ current: completed, total: itemsToSave.length });

      if (result.allSucceeded) {
        updateStatus(item.id, 'saved');
      } else {
        updateStatus(item.id, 'save_failed', {
          errors: result.results.filter((r) => !r.success).map((r) => r.error),
        });
      }
    }

    setSaving(false);
    setSaveStatusText('');
  }, [queue, updateStatus, blobWriter, indexMerger]);

  // リトライ処理
  const handleRetry = useCallback(async () => {
    const failed = queue.filter((item) => item.status === 'save_failed');
    for (const item of failed) {
      updateStatus(item.id, 'ready');
    }
    // ready状態に戻した後にhandleBulkSaveが呼ばれる（ボタンクリックで再実行）
  }, [queue, updateStatus]);

  if (!auth.isAdmin) return null;

  return (
    <section id="admin-panel">
      <h2>管理者パネル</h2>

      <FileDropZone
        onFilesAdded={addFiles}
        disabled={saving}
        hasFiles={queue.length > 0}
      />

      <FileQueueList
        queue={queue}
        onRemove={removeFile}
        onApproveDuplicate={approveDuplicate}
      />

      {saving ? (
        <ProgressBar
          current={saveProgress.current}
          total={saveProgress.total}
          visible={true}
          statusText={saveStatusText}
        />
      ) : (
        <>
          <PreviewArea readyItems={previewItems} />

          {readyItems.length > 0 && (
            <button className="btn btn-primary" onClick={handleBulkSave}>
              一括保存 ({readyItems.length}件)
            </button>
          )}

          {failedItems.length > 0 && (
            <button className="btn btn-retry" onClick={handleRetry}>
              失敗した操作をリトライ ({failedItems.length}件)
            </button>
          )}
        </>
      )}
    </section>
  );
}

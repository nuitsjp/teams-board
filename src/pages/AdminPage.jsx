import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth, createAuthAdapter } from '../hooks/useAuth.jsx';
import { useFileQueue } from '../hooks/useFileQueue.js';
import { FileDropZone } from '../components/FileDropZone.jsx';
import { FileQueueCardList } from '../components/FileQueueCardList.jsx';
import { ProgressBar } from '../components/ProgressBar.jsx';
import { CsvTransformer } from '../services/csv-transformer.js';
import { BlobWriter } from '../services/blob-writer.js';
import { IndexMerger } from '../services/index-merger.js';
import { DataFetcher } from '../services/data-fetcher.js';
import { APP_CONFIG } from '../config/app-config.js';
import { ArrowLeft, Upload, RotateCcw } from 'lucide-react';

/**
 * 管理者パネル — CSVインポート・プレビュー・一括保存機能
 */
export function AdminPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const authAdapter = useMemo(() => createAuthAdapter(auth), [auth]);

  const csvTransformer = useMemo(() => new CsvTransformer(), []);
  const blobWriter = useMemo(() => new BlobWriter(authAdapter, APP_CONFIG.blobBaseUrl), [authAdapter]);
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
          indexResult.data.groups.flatMap((g) => g.sessionIds)
        );
        setExistingSessionIds(sessionIds);
      }
    })();
  }, [dataFetcher, setExistingSessionIds]);

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
  }, [queue, updateStatus]);

  // 非管理者はダッシュボードにリダイレクト
  if (!auth.isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="space-y-6">
      {/* 戻るボタン */}
      <button
        onClick={() => navigate('/')}
        className="inline-flex items-center gap-2 text-sm text-primary-600 hover:text-primary-800 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        ダッシュボードへ戻る
      </button>

      <div>
        <h2 className="text-xl font-bold text-text-primary">管理者パネル</h2>
        <p className="text-sm text-text-muted mt-1">CSVインポート・プレビュー・一括保存</p>
      </div>

      <FileDropZone
        onFilesAdded={addFiles}
        disabled={saving}
        hasFiles={queue.length > 0}
      />

      <FileQueueCardList
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
        <div className="flex items-center gap-3">
          {readyItems.length > 0 && (
            <button
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
              onClick={handleBulkSave}
            >
              <Upload className="w-4 h-4" />
              一括保存 ({readyItems.length}件)
            </button>
          )}

          {failedItems.length > 0 && (
            <button
              className="inline-flex items-center gap-2 px-4 py-2 bg-accent-100 text-accent-600 border border-accent-300 rounded-lg hover:bg-accent-200 transition-colors text-sm font-medium"
              onClick={handleRetry}
            >
              <RotateCcw className="w-4 h-4" />
              失敗した操作をリトライ ({failedItems.length}件)
            </button>
          )}
        </div>
      )}
    </div>
  );
}

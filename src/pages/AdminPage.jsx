import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth, createAuthAdapter } from '../hooks/useAuth.jsx';
import { useFileQueue } from '../hooks/useFileQueue.js';
import { FileDropZone } from '../components/FileDropZone.jsx';
import { FileQueueCardList } from '../components/FileQueueCardList.jsx';
import { ProgressBar } from '../components/ProgressBar.jsx';
import { CsvTransformer } from '../services/csv-transformer.js';
import { BlobWriter } from '../services/blob-writer.js';
import { ProductionIndexFetcher, DevIndexFetcher } from '../services/index-fetcher.js';
import { AzureBlobStorage, DevBlobStorage } from '../services/blob-storage.js';
import { IndexMerger } from '../services/index-merger.js';
import { IndexEditor } from '../services/index-editor.js';
import { DataFetcher } from '../services/data-fetcher.js';
import { APP_CONFIG } from '../config/app-config.js';
import { ArrowLeft, Upload, RotateCcw, AlertCircle, CheckCircle } from 'lucide-react';
import { GroupNameEditor } from '../components/GroupNameEditor.jsx';

/**
 * 管理者パネル — CSVインポート・プレビュー・一括保存機能
 */
export function AdminPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const authAdapter = useMemo(() => createAuthAdapter(auth), [auth]);

  const csvTransformer = useMemo(() => new CsvTransformer(), []);

  // 環境に応じてIndexFetcherとBlobStorageを注入
  const indexFetcher = useMemo(() => {
    if (import.meta.env.DEV && authAdapter.getSasToken() === 'dev') {
      return new DevIndexFetcher();
    }
    return new ProductionIndexFetcher(APP_CONFIG.blobBaseUrl, authAdapter);
  }, [authAdapter]);

  const blobStorage = useMemo(() => {
    if (import.meta.env.DEV && authAdapter.getSasToken() === 'dev') {
      return new DevBlobStorage();
    }
    return new AzureBlobStorage(APP_CONFIG.blobBaseUrl, authAdapter);
  }, [authAdapter]);

  const blobWriter = useMemo(
    () => new BlobWriter(indexFetcher, blobStorage),
    [indexFetcher, blobStorage]
  );

  const indexMerger = useMemo(() => new IndexMerger(), []);
  const indexEditor = useMemo(() => new IndexEditor(), []);
  const dataFetcher = useMemo(() => new DataFetcher(), []);

  const {
    queue,
    addFiles,
    removeFile,
    approveDuplicate,
    selectGroup,
    setExistingSessionIds,
    updateStatus,
    readyItems,
    failedItems,
  } = useFileQueue(csvTransformer);

  const [saving, setSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState({ current: 0, total: 0 });
  const [saveStatusText, setSaveStatusText] = useState('');

  // グループ管理機能用の状態
  const [groups, setGroups] = useState([]);
  const [savingGroupId, setSavingGroupId] = useState(null);
  const [groupMessage, setGroupMessage] = useState({ type: '', text: '' });
  const [cachedIndex, setCachedIndex] = useState(null);

  // 既存セッションIDの取得とグループ一覧の取得
  useEffect(() => {
    (async () => {
      const indexResult = await dataFetcher.fetchIndex();
      if (indexResult.ok) {
        const sessionIds = new Set(indexResult.data.groups.flatMap((g) => g.sessionIds));
        setExistingSessionIds(sessionIds);
        setGroups(indexResult.data.groups);
        setCachedIndex(indexResult.data);
      }
    })();
  }, [dataFetcher, setExistingSessionIds]);

  // 一括保存処理
  const handleBulkSave = useCallback(async () => {
    const itemsToSave = queue.filter((item) => item.status === 'ready');
    if (itemsToSave.length === 0) return;

    setSaving(true);
    setSaveProgress({ current: 0, total: itemsToSave.length });
    setSaveStatusText(`保存中... 0/${itemsToSave.length} 件`);

    const preparedItems = itemsToSave.map((item) => {
      let { sessionRecord, mergeInput } = item.parseResult;

      // グループ上書きがある場合、mergeInput / sessionRecord を上書き
      if (item.groupOverride) {
        const { groupId, groupName } = item.groupOverride;
        const newSessionId = `${groupId}-${mergeInput.date}`;
        mergeInput = { ...mergeInput, groupId, groupName, sessionId: newSessionId };
        sessionRecord = { ...sessionRecord, groupId, id: newSessionId };
      }

      return {
        itemId: item.id,
        sourcePath: `data/sources/${sessionRecord.id}.csv`,
        sessionPath: `data/sessions/${sessionRecord.id}.json`,
        sourceFile: item.file,
        sessionRecord,
        mergeInput,
      };
    });

    for (const prepared of preparedItems) {
      updateStatus(prepared.itemId, 'saving');
    }

    const sessionPathSet = new Set(preparedItems.map((prepared) => prepared.sessionPath));
    let completedSessions = 0;

    const result = await blobWriter.executeWriteSequence({
      newItems: preparedItems.flatMap((prepared) => [
        {
          path: prepared.sourcePath,
          content: prepared.sourceFile,
          contentType: 'text/csv',
        },
        {
          path: prepared.sessionPath,
          content: JSON.stringify(prepared.sessionRecord, null, 2),
          contentType: 'application/json',
        },
      ]),
      indexUpdater: (currentIndex, writeResults) => {
        const resultByPath = new Map(writeResults.map((writeResult) => [writeResult.path, writeResult]));
        const successfulMergeInputs = preparedItems
          .filter(
            (prepared) =>
              (resultByPath.get(prepared.sourcePath)?.success ?? false) &&
              (resultByPath.get(prepared.sessionPath)?.success ?? false)
          )
          .map((prepared) => prepared.mergeInput);

        if (successfulMergeInputs.length === 0) {
          return null;
        }

        return successfulMergeInputs.reduce(
          (index, mergeInput) => indexMerger.merge(index, mergeInput).index,
          currentIndex
        );
      },
      onItemComplete: (writeResult) => {
        if (!sessionPathSet.has(writeResult.path)) {
          return;
        }
        completedSessions += 1;
        setSaveProgress({ current: completedSessions, total: itemsToSave.length });
        setSaveStatusText(`保存中... ${completedSessions}/${itemsToSave.length} 件`);
      },
    });

    const resultByPath = new Map(result.results.map((writeResult) => [writeResult.path, writeResult]));
    const indexWriteResult = resultByPath.get('data/index.json');

    for (const prepared of preparedItems) {
      const sourceWriteResult = resultByPath.get(prepared.sourcePath);
      const sessionWriteResult = resultByPath.get(prepared.sessionPath);
      const sourceSucceeded = sourceWriteResult?.success ?? result.allSucceeded;
      const sessionSucceeded = sessionWriteResult?.success ?? result.allSucceeded;
      const errors = [];

      if (!sourceSucceeded) {
        errors.push(sourceWriteResult?.error || 'CSVソース保存に失敗しました');
      }
      if (!sessionSucceeded) {
        errors.push(sessionWriteResult?.error || 'セッションJSON保存に失敗しました');
      }
      if (errors.length === 0 && indexWriteResult && !indexWriteResult.success) {
        errors.push(indexWriteResult.error || 'index.json の保存に失敗しました');
      }

      if (errors.length === 0) {
        updateStatus(prepared.itemId, 'saved');
      } else {
        updateStatus(prepared.itemId, 'save_failed', { errors });
      }
    }

    setSaveProgress({ current: itemsToSave.length, total: itemsToSave.length });
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

  // グループ名保存処理
  const handleSaveGroupName = useCallback(
    async (groupId, newName) => {
      setSavingGroupId(groupId);
      setGroupMessage({ type: '', text: '' });

      try {
        // 楽観的ロック: 最新のindex.jsonを取得
        const latestIndexResult = await dataFetcher.fetchIndex();
        if (!latestIndexResult.ok) {
          setGroupMessage({
            type: 'error',
            text: '最新データの取得に失敗しました。ネットワーク接続を確認してください',
          });
          setSavingGroupId(null);
          return false;
        }

        // updatedAtタイムスタンプを比較
        if (cachedIndex && latestIndexResult.data.updatedAt !== cachedIndex.updatedAt) {
          setGroupMessage({
            type: 'error',
            text: '他のユーザーが同時に編集しています。最新データを再読み込みしてください',
          });
          setSavingGroupId(null);
          return false;
        }

        // IndexEditorでindex.jsonを更新
        const { index: updatedIndex, error } = indexEditor.updateGroupName(
          latestIndexResult.data,
          groupId,
          newName
        );

        if (error) {
          setGroupMessage({ type: 'error', text: error });
          setSavingGroupId(null);
          return false;
        }

        // BlobWriterで保存
        const result = await blobWriter.executeWriteSequence({
          rawCsv: null,
          newItems: [],
          indexUpdater: () => updatedIndex,
        });

        if (!result.allSucceeded) {
          const errorMessages = result.results
            .filter((r) => !r.success)
            .map((r) => r.error)
            .join(', ');
          setGroupMessage({
            type: 'error',
            text: `保存に失敗しました。${errorMessages}`,
          });
          setSavingGroupId(null);
          return false;
        }

        // 保存成功後、最新index.jsonを再取得
        const refreshedIndexResult = await dataFetcher.fetchIndex();
        if (refreshedIndexResult.ok) {
          setGroups(refreshedIndexResult.data.groups);
          setCachedIndex(refreshedIndexResult.data);
        }

        setGroupMessage({ type: 'success', text: 'グループ名を保存しました' });
        setSavingGroupId(null);
        return true;
      } catch (err) {
        setGroupMessage({
          type: 'error',
          text: `保存に失敗しました。${err.message}`,
        });
        setSavingGroupId(null);
        return false;
      }
    },
    [dataFetcher, indexEditor, blobWriter, cachedIndex]
  );

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

      <FileDropZone onFilesAdded={addFiles} disabled={saving} hasFiles={queue.length > 0} />

      <FileQueueCardList
        queue={queue}
        groups={groups}
        onRemove={removeFile}
        onApproveDuplicate={approveDuplicate}
        onSelectGroup={selectGroup}
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

      {/* グループ管理セクション */}
      <div className="mt-8 pt-8 border-t border-border-light">
        <div className="mb-4">
          <h3 className="text-lg font-bold text-text-primary">グループ管理</h3>
          <p className="text-sm text-text-muted mt-1">
            グループ名を編集できます（グループIDは変更されません）
          </p>
        </div>

        {groupMessage.text && (
          <div
            className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${
              groupMessage.type === 'success'
                ? 'bg-green-50 text-green-800'
                : 'bg-red-50 text-red-800'
            }`}
          >
            {groupMessage.type === 'success' ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
            <span className="text-sm">{groupMessage.text}</span>
          </div>
        )}

        {groups.length === 0 ? (
          <p className="text-sm text-text-muted">グループがありません</p>
        ) : (
          <div className="bg-surface rounded-xl border border-border-light overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                    グループID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                    グループ名
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-text-muted uppercase tracking-wider">
                    総学習時間
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-text-muted uppercase tracking-wider">
                    セッション数
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light">
                {groups.map((group) => (
                  <tr key={group.id}>
                    <td className="px-4 py-3 text-sm text-text-muted font-mono">{group.id}</td>
                    <td className="px-4 py-3">
                      <GroupNameEditor
                        groupId={group.id}
                        initialName={group.name}
                        onSave={handleSaveGroupName}
                        disabled={savingGroupId !== null}
                      />
                    </td>
                    <td className="px-4 py-3 text-sm text-text-primary text-right">
                      {Math.floor(group.totalDurationSeconds / 3600)}時間
                      {Math.floor((group.totalDurationSeconds % 3600) / 60)}分
                    </td>
                    <td className="px-4 py-3 text-sm text-text-primary text-right">
                      {group.sessionIds.length}件
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
